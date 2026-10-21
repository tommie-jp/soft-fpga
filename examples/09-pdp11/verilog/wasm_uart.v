// wasm_uart.v — DPI ベースの UART（fake_uart.v の WASM 用置き換え）
// モジュール名は fake_uart のまま（tt_regs.v のインスタンス名に合わせる）
//
// TX: ld_tx_req/ld_tx_ack ハンドシェイクで文字を受け取り dpi_tty_putc を呼ぶ
// RX: 毎クロック dpi_tty_getc をポーリングして rx_data/rx_empty を制御する
//
// lint 抑止: 実 UART とのピン互換スタブのため txclk/rxclk 等は意図的に未使用。
// BLKSEQ は DPI 呼び出しまわりの一時変数で意図的なブロッキング代入。
/* verilator lint_off UNUSEDSIGNAL */
/* verilator lint_off BLKSEQ */

module fake_uart(clk, reset,
                 txclk, ld_tx_req, ld_tx_ack, tx_data, tx_enable, tx_out, tx_empty,
                 rxclk, uld_rx_req, uld_rx_ack, rx_data, rx_enable, rx_in, rx_empty);

   input        clk;
   input        reset;
   input        txclk;
   input        ld_tx_req;
   output       ld_tx_ack;
   input [7:0]  tx_data;
   input        tx_enable;
   output       tx_out;
   output       tx_empty;
   input        rxclk;
   input        uld_rx_req;
   output       uld_rx_ack;
   output [7:0] rx_data;
   input        rx_enable;
   input        rx_in;
   output       rx_empty;

   // DPI: WASM ハーネス（harness.cpp）で実装
   import "DPI-C" function void dpi_tty_putc(input int ch);
   import "DPI-C" function int  dpi_tty_getc();

   // ── TX 側 ──────────────────────────────────────────────────────────────
   // tt_regs.v の tto ステートマシンと同じ 2-bit ハンドシェイク FSM

   reg [1:0] tx_ld;
   wire [1:0] tx_ld_next;
   reg        ld_tx_ack;
   wire       ld_tx_ack_next;
   wire       ld_tx_data;

   assign tx_ld_next =
      (tx_ld == 2'b00 && ~ld_tx_req) ? 2'b00 :
      (tx_ld == 2'b00 &&  ld_tx_req) ? 2'b01 :
      (tx_ld == 2'b01 &&  ld_tx_req) ? 2'b01 :
      (tx_ld == 2'b01 && ~ld_tx_req) ? 2'b10 :
      2'b00;

   assign ld_tx_ack_next = tx_ld == 2'b01;
   assign ld_tx_data     = tx_ld == 2'b01;  // TX データ有効パルス

   always @(posedge clk or posedge reset)
     if (reset) begin
        tx_ld     <= 2'b00;
        ld_tx_ack <= 0;
     end else begin
        tx_ld     <= tx_ld_next;
        ld_tx_ack <= ld_tx_ack_next;
     end

   // TX: データ有効時に DPI で文字を出力、tx_empty を一時的に Low にする
   reg     tx_empty;
   integer _tx_delay;

   always @(posedge clk or posedge reset)
     if (reset) begin
        tx_empty  <= 1;
        _tx_delay = 0;
     end else begin
        if (ld_tx_data && tx_empty) begin
           dpi_tty_putc({24'b0, tx_data});
           tx_empty  <= 0;
           _tx_delay = 100;     // fake_uart.v と同じ 100 クロックの TX 遅延
        end
        if (_tx_delay > 0)
          _tx_delay = _tx_delay - 1;
        if (_tx_delay == 0 && tx_empty == 0)
          tx_empty <= 1;
     end

   assign tx_out = 1'b1;  // RS232 アイドル High

   // ── RX 側 ──────────────────────────────────────────────────────────────
   // tt_regs.v の tti ステートマシンと同じ 2-bit ハンドシェイク FSM

   reg [1:0] rx_uld;
   wire [1:0] rx_uld_next;
   reg        uld_rx_ack;
   wire       uld_rx_ack_next;
   wire       uld_rx_data;   // CPU が rx_data を読んだタイミング

   assign rx_uld_next =
      (rx_uld == 2'b00 && ~uld_rx_req) ? 2'b00 :
      (rx_uld == 2'b00 &&  uld_rx_req) ? 2'b01 :
      (rx_uld == 2'b01 &&  uld_rx_req) ? 2'b01 :
      (rx_uld == 2'b01 && ~uld_rx_req) ? 2'b10 :
      2'b00;

   assign uld_rx_ack_next = rx_uld == 2'b01;
   assign uld_rx_data     = rx_uld == 2'b00 && uld_rx_req;

   always @(posedge clk or posedge reset)
     if (reset) begin
        rx_uld     <= 2'b00;
        uld_rx_ack <= 0;
     end else begin
        rx_uld     <= rx_uld_next;
        uld_rx_ack <= uld_rx_ack_next;
     end

   // RX バッファ: DPI ポーリングで文字を受け取る
   //
   // tt_regs.v は rx_data を自分では保持せず、CPU が 17562 (RBUF) を読む瞬間に
   // この rx_data をそのまま返す。そのため、CPU が前の文字を読み終える前に
   // rx_data を次の文字で上書きすると、前の文字が消え、次の文字が 2 回読まれる
   // ("who" → "woo")。ペーストや自動入力のように文字が連続して届くと起きる。
   //
   // 対策: DPI から取り出した文字はいったん rx_stage に置き、tt_regs が
   // uld_rx_req で取りに来た瞬間 (uld_rx_data) に rx_data へ移す。tt_regs は
   // CPU の読み取りを終えてから次の uld_rx_req を出すので、rx_data は
   // CPU が読み終わるまで変わらない。
   //
   // rx_guard_cnt は 1 文字分の時間 (fake_uart.v の fake_char_delay と同じ
   // 3000 クロック) を模した、文字と文字の最小間隔。
   reg     rx_empty;
   reg [7:0] rx_data;    // tt_regs / CPU が読む文字。次の uld_rx_data まで保持する
   reg [7:0] rx_stage;   // DPI から受け取り、tt_regs に渡すのを待っている文字
   reg [11:0] rx_guard_cnt;  // 最大 4096 クロックガード（uld_rx_data 後のクールダウン）
   integer   _rx_char;

   always @(posedge clk or posedge reset)
     if (reset) begin
        rx_empty     <= 1;
        rx_data      <= 8'h00;
        rx_stage     <= 8'h00;
        rx_guard_cnt <= 12'd0;
        _rx_char      = -1;
     end else begin
        if (uld_rx_data) begin
           // ハンドシェイク開始: 待たせていた文字を rx_data に移し、
           // rx_empty=1 にしてガードカウンタをセット
           rx_data      <= rx_stage;
           rx_empty     <= 1;
           rx_guard_cnt <= 12'd3000;
        end else if (rx_guard_cnt > 0) begin
           rx_guard_cnt <= rx_guard_cnt - 1;
        end else if (rx_empty) begin
           // ガード終了 & バッファ空: 次の文字をポーリングして rx_stage に置く
           _rx_char = dpi_tty_getc();
           if (_rx_char >= 0) begin
              rx_stage <= _rx_char[7:0];
              rx_empty <= 0;
           end
        end
     end

endmodule
