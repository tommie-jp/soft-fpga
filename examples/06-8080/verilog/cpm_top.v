// cpm_top.v — CP/M 8080 soft-FPGA トップモジュール
//
// vm80a_core (Intel 8080A RTL) + 64KB RAM + I/O port decode
//
// クロック: pin_clk を 2 分周して f1/f2 二相クロックを生成する。
//           CPU は実効 clk/2 で動作する。
//
// I/O 判別: SYNC サイクルでステータスバイトを取得し、
//           INP(bit6)=1 なら IN、OUT(bit4)=1 なら OUT として扱う。
//
// I/O ポート（IN/OUT 命令）は C++ ハーネスが処理する:
//   $00  IN  - CONIN
//   $01  OUT - CONOUT
//   $02  IN  - CONST
//   $10  OUT/IN - DCMD/DSTS
//   $11  OUT - DTRK
//   $12  OUT - DSEC
//   $13  OUT - DDMA_L
//   $14  OUT - DDMA_H

module cpm_top (
    input  wire        clk,
    input  wire        reset,

    // I/O ポートインタフェース（C++ ハーネスへ）
    output reg         io_req,    // OUT: データ確定後の 1 クロックパルス
    output reg         io_wr,     // 1=OUT, 0=IN
    output reg  [7:0]  io_addr,   // ポート番号
    output reg  [7:0]  io_dout,   // CPU → ポート（OUT 時）
    input  wire [7:0]  io_din,    // ポート → CPU（IN 時）

    // IN タイミング用: DBIN が立った直後にハーネスが io_din を設定するため
    output wire        io_dbin,   // = cpu_dbin (DBIN: 1 のとき次サイクルで読む)
    output wire        io_active, // = cycle_io (I/O サイクル中)
    output wire [7:0]  io_port,   // = cpu_addr[7:0] (ポート番号、cycle_io=1 時有効)

    // デバッグ用シグナル
    output wire [15:0] dbg_pc,
    output wire [7:0]  dbg_a,
    output wire [7:0]  dbg_f,

    // バスアナライザ用追加信号
    output wire        dbg_sync,   // SYNC: マシンサイクル開始パルス
    output wire        dbg_wr_n,   // WR_N: ライトストローブ（アクティブ Low）
    output wire        dbg_hlda,   // HLDA: ホールドアクノリッジ
    output wire        dbg_wait,   // WAIT: ウェイトステート中
    output wire        dbg_inte,   // INTE: 割り込みイネーブル
    output wire        dbg_memr,   // MEMR: メモリリード（!cycle_io && dbin）
    output wire        dbg_memw    // MEMW: メモリライト（!cycle_io && !wr_n）
);

    // ---------------------------------------------------------
    // 二相クロック生成（ref: vm80a/org/rtl/de0/de0_top.v）
    // f1/f2 は非重複交番クロックイネーブル
    // ---------------------------------------------------------
    reg f1 /* verilator public */;
    reg f2 /* verilator public */;
    always @(posedge clk) begin
        f1 <= ~f1;
        f2 <=  f1;   // f2 は f1 の 1 クロック遅延 = 反転になる
    end

    // ---------------------------------------------------------
    // vm80a_core ポート接続
    // ---------------------------------------------------------
    wire [15:0] cpu_addr;
    wire [7:0]  cpu_dout;
    reg  [7:0]  cpu_din;
    wire        cpu_wr_n;    // active-low ライトストローブ
    wire        cpu_dbin;    // 1 = CPU がデータバスを読む
    wire        cpu_sync;    // 1 = ステータスバイト出力中
    wire        cpu_hlda;   // HLDA
    wire        cpu_wait;   // WAIT
    wire        cpu_inte;   // INTE

    vm80a_core cpu (
        .pin_clk    (clk),
        .pin_f1     (f1),
        .pin_f2     (f2),
        .pin_reset  (reset),
        .pin_hold   (1'b0),
        .pin_int    (1'b0),
        .pin_ready  (1'b1),
        .pin_a      (cpu_addr),
        .pin_dout   (cpu_dout),
        .pin_din    (cpu_din),
        .pin_wr_n   (cpu_wr_n),
        .pin_dbin   (cpu_dbin),
        .pin_sync   (cpu_sync),
        .pin_aena   (),
        .pin_dena   (),
        .pin_hlda   (cpu_hlda),
        .pin_wait   (cpu_wait),
        .pin_inte   (cpu_inte)
    );

    // ---------------------------------------------------------
    // 8080 ステータスバイト（SYNC サイクルで cpu_dout に現れる）
    // bit4 = OUT (I/O write), bit6 = INP (I/O read)
    // ---------------------------------------------------------
    reg [7:0] status;
    always @(posedge clk) begin
        if (cpu_sync)
            status <= cpu_dout;
    end

    wire cycle_inp = status[6];   // IN 命令サイクル
    wire cycle_out = status[4];   // OUT 命令サイクル
    wire cycle_io  = cycle_inp | cycle_out;

    // ---------------------------------------------------------
    // 64KB フラット RAM（/* verilator public */ で harness から直接アクセス）
    // ---------------------------------------------------------
    reg [7:0] ram [0:65535] /* verilator public */;

    always @(posedge clk) begin
        if (!reset && !cycle_io && !cpu_wr_n)
            ram[cpu_addr] <= cpu_dout;
    end

    // ---------------------------------------------------------
    // CPU データ入力セレクト
    // ---------------------------------------------------------
    always @(*) begin
        if (cycle_io)
            cpu_din = io_din;
        else
            cpu_din = ram[cpu_addr];
    end

    // ---------------------------------------------------------
    // I/O タイミング  ─  io_req / io_wr は vm80a にはない合成 1 クロックパルス信号。
    //   vm80a が持つのは標準 8080 バス信号（pin_wr_n / pin_dbin / pin_sync）のみ。
    //   cpm_top.v でこれらと f1/f2 フェーズを組み合わせて IO アクセスを 1 パルスに変換する。
    //
    // ─ OUT 命令 ─────────────────────────────────────────────────────────────────
    //   vm80a は「if (f1) wr_n <= ...」で T3_f1 に WR_N を落とす（アサート）。
    //   cpu_dout（= xr）は T3_f1 では古い値のまま; 次の T3_f2 で正しい値が確定する。
    //   WR_N 立ち上がり（T3 末 ≒ HLT T1 頭）を使うと io_req が次 M-CYC に入ってしまうため、
    //   f2 かつ WR_N Low（= IO OUT T3_f2）で発火し io_req を IO OUT M-CYC 内に収める。
    //
    // ─ IN 命令 ──────────────────────────────────────────────────────────────────
    //   vm80a は「if (f2) dbin_pin <= ...」で T2_f2 に DBIN をアサートする。
    //   ハーネスは DBIN 立ち上がりを検出して次ステップ前に io_din をセット済み。
    //   f1 かつ DBIN High（= IO IN T3_f1）で発火することで
    //     ① io_req が IO IN M-CYC 内に収まる
    //     ② io_din 確定後に捕捉できる
    // ---------------------------------------------------------

    always @(posedge clk) begin
        io_req <= 1'b0;   // 毎クロックデフォルト 0 → 発火クロックのみ 1 パルス
        io_wr  <= 1'b0;   // io_req と同様に毎クロックデフォルト 0（ホールドしない）

        // OUT: IO OUT T3_f2 — WR_N Low & f2 フェーズ（cpu_dout が確定したタイミング）
        if (cycle_out && f2 && !cpu_wr_n) begin
            io_req  <= 1'b1;
            io_wr   <= 1'b1;
            io_addr <= cpu_addr[7:0];
            io_dout <= cpu_dout;
        end

        // IN: IO IN T3_f1 — DBIN High & f1 フェーズ（io_din 確定後・IO IN M-CYC 内）
        if (cycle_inp && f1 && cpu_dbin) begin
            io_req  <= 1'b1;
            // io_wr はデフォルト 0 のまま（IN = 読み込み）
            io_addr <= cpu_addr[7:0];
        end
    end

    // IN 用: DBIN と I/O 情報を組み合わせ出力として直接公開
    // ハーネスは io_dbin=1 を検出後 io_din を設定（次 posedge で CPU が読む）
    assign io_dbin   = cpu_dbin;
    assign io_active = cycle_io;
    assign io_port   = cpu_addr[7:0];

    // ---------------------------------------------------------
    // デバッグ信号
    // ---------------------------------------------------------
    assign dbg_pc = cpu_addr;
    assign dbg_a  = cpu_dout;              // 実際の CPU データ出力バス
    assign dbg_f  = {7'b0, cpu_wr_n};     // bit0 = WR_n
    assign dbg_sync = cpu_sync;
    assign dbg_wr_n = cpu_wr_n;
    assign dbg_hlda = cpu_hlda;
    assign dbg_wait = cpu_wait;
    assign dbg_inte = cpu_inte;
    assign dbg_memr = !cycle_io && cpu_dbin;
    assign dbg_memw = !cycle_io && !cpu_wr_n;

endmodule
