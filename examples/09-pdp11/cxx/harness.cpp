// harness.cpp — PDP-11 / Unix V6 WASM ハーネス（Phase 4）
//
// DPI 実装（dpi_tty_putc / dpi_tty_getc）、step_n、send_key、
// get_display_char、ring buffer（RING_WORDS=10）、PC トリガー、sim_init、
// GPR snapshot（R0-R5/SP）、MMU PAR/PDR 読み取りを提供する。
// mem_probe: sim_set_mem_probe(addr) で指定したアドレスの RAM 値を
//            Word8[31:16] に毎サンプル記録する（LA の M1 信号）。
// uipar0:    Word9[11:0] に User I-space PAR0 を毎サンプル記録する（プロセス識別）。
//            Word9[12] は前サンプルから変化した場合に 1（コンテキストスイッチ検出）。

#include "Vtest_top_wasm.h"
#include "Vtest_top_wasm___024root.h"
#include "verilated.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <stdint.h>

// ── シミュレーションインスタンス ─────────────────────────────────────────

static Vtest_top_wasm* top = nullptr;
static uint64_t        sim_time = 0;

// ── シグナルアクセスマクロ ────────────────────────────────────────────────

#define SIM_SYSCLK  (top->rootp->test_top_wasm__DOT__sysclk)
#define SIM_BUTTON  (top->rootp->test_top_wasm__DOT__button)

// Phase 2 観測信号
#define OBS_PC       (top->rootp->test_top_wasm__DOT__obs_pc)
#define OBS_PSW      (top->rootp->test_top_wasm__DOT__obs_psw)
#define OBS_ADDR_P   (top->rootp->test_top_wasm__DOT__obs_addr_p)
#define OBS_DATA     (top->rootp->test_top_wasm__DOT__obs_data)
#define OBS_WR       (top->rootp->test_top_wasm__DOT__obs_wr)
#define OBS_CPU_CM   (top->rootp->test_top_wasm__DOT__obs_cpu_cm)
#define OBS_RK_STATE (top->rootp->test_top_wasm__DOT__obs_rk_state)
// Phase 3 追加観測信号
#define OBS_RD       (top->rootp->test_top_wasm__DOT__obs_rd)
#define OBS_BYTE_OP  (top->rootp->test_top_wasm__DOT__obs_byte_op)
#define OBS_TRAPPED  (top->rootp->test_top_wasm__DOT__obs_trapped)
#define OBS_HALTED   (top->rootp->test_top_wasm__DOT__obs_halted)
#define OBS_BUS_INT  (top->rootp->test_top_wasm__DOT__obs_bus_int)
#define OBS_INT_VEC  (top->rootp->test_top_wasm__DOT__obs_int_vec)
#define OBS_INT_IPL  (top->rootp->test_top_wasm__DOT__obs_int_ipl)
#define OBS_ADDR_V   (top->rootp->test_top_wasm__DOT__obs_addr_v)
// Phase 4 拡張観測信号
#define OBS_EXTRA1   (top->rootp->test_top_wasm__DOT__obs_extra1)
#define OBS_WORD4    (top->rootp->test_top_wasm__DOT__obs_word4)

// ── ring buffer（RING_WORDS = 10）────────────────────────────────────────
//
// Word0 [31:0]:
//   [17: 0] bus_addr_p  — Unibus 物理アドレス（18 ビット）
//   [18]    bus_wr      — バス書き込みストローブ
//   [19]    bus_rd      — バス読み出しストローブ
//   [21:20] cpu_cm      — CPU モード (00=kernel, 11=user)
//   [22]    bus_byte_op — バイト操作フラグ
//   [23]    trapped     — トラップ発生フラグ
//   [24]    halted      — CPU ホルトフラグ
//   [25]    bus_int     — 割り込みリクエスト中フラグ
//   [30:26] rk_state    — RK11 ステート（5 ビット）
// Word1 [31:0]:
//   [15: 0] bus_data    — バスデータ（読み書き共用）
//   [31:16] PSW         — プロセッサステータスワード
// Word2 [31:0]:
//   [15: 0] PC          — プログラムカウンタ（仮想）
//   [31:16] bus_addr_v  — 仮想アドレス（16 ビット）
// Word3 [31:0]:
//   [ 7: 0] int_vec       — 割り込みベクタ（8 ビット）
//   [15: 8] int_ipl       — 割り込み優先レベル（8 ビット）
//   [16]    reserved
//   [17]    bus_error     — バスエラー（NXM/no_decode）
//   [18]    waited        — CPU バス待ちストール
//   [19]    nxm_access    — 存在しないメモリアクセス
//   [20]    iopage_access — I/O ページアクセス
//   [21]    trap_bus      — バスエラートラップ（ベクタ 4）
//   [22]    trap_abort    — MMU アボートトラップ（ベクタ 0o250）
//   [23]    trap_odd      — 奇数アドレスアクセス
//   [31:24] reserved
// Word4 [31:0]:
//   [ 4: 0] istate        — CPU マイクロシーケンサ状態
//   [20: 5] isn           — 現在の命令ワード
//   [31:21] reserved（trapped 時は bits[31:24] = sys 0 indir の .word N）
// Word8 [31:0]:
//   [15: 0] SP            — スタックポインタ
//   [31:16] M1            — メモリプローブ値（sim_set_mem_probe で指定アドレスの RAM 読み値）
// Word9 [31:0]:
//   [11: 0] uipar0        — User I-space PAR0（プロセスコンテキスト識別子）
//   [12]    ctx_new       — 前サンプルから uipar0 が変化（コンテキストスイッチ）
//   [31:13] reserved

#define RING_SIZE  4096
#define RING_WORDS 10

static uint32_t ring[RING_SIZE * RING_WORDS];
static uint32_t ring_head = 0;
// ring_tick_mask: サンプリング間隔マスク
//   0u → 毎 tick (bare metal タイミング図用)
//   3u → 4tick に 1 回 (Unix V6 ブート用、既定)
static uint32_t ring_tick_mask = 3u;

// メモリプローブ: 0xFFFFFFFF = 無効（プローブなし）
extern "C" uint16_t ram_read_word(uint32_t byte_addr);
static uint32_t mem_probe_addr = 0xFFFFFFFFu;

// trapped の立ち上がりエッジを 1 サンプルだけ記録するラッチ。
// trapped は trap 処理中（数十 tick）HIGH を維持するため、OR 蓄積では
// 複数サンプルに重複記録される。立ち上がりエッジのみを使うことで
// 1 トラップイベント = 1 サンプルの bit23=1 に正規化する。
// trapped_word4: 立ち上がりエッジ瞬間の OBS_WORD4（ISN を含む）をキャプチャ。
// sample_ring() 時点では CPU がトラップベクタをフェッチ済みのため ISN が変化している。
static uint8_t  trapped_latch      = 0;
static uint8_t  trapped_prev       = 0;
static uint32_t trapped_word4      = 0;
static uint16_t trapped_indirect_n = 0xFFFFu; // sys 0 (indir) の .word N（0xFFFF = 非 indir）
static uint16_t g_prev_uipar0      = 0xFFFFu; // ctx_new エッジ検出用（0xFFFF = 未初期化）

static inline void sample_ring() {
    uint32_t* p = &ring[(ring_head % RING_SIZE) * RING_WORDS];
    p[0] = ((uint32_t)OBS_ADDR_P   & 0x3FFFFu)
         | ((uint32_t)(OBS_WR      & 1u) << 18)
         | ((uint32_t)(OBS_RD      & 1u) << 19)
         | ((uint32_t)(OBS_CPU_CM  & 3u) << 20)
         | ((uint32_t)(OBS_BYTE_OP & 1u) << 22)
         | ((uint32_t)(trapped_latch   ) << 23)
         | ((uint32_t)(OBS_HALTED  & 1u) << 24)
         | ((uint32_t)(OBS_BUS_INT & 1u) << 25)
         | ((uint32_t)(OBS_RK_STATE & 0x1Fu) << 26);
    p[1] = ((uint32_t)(OBS_DATA) & 0xFFFFu)
         | ((uint32_t)(OBS_PSW)  << 16);
    p[2] = ((uint32_t)(OBS_PC)     & 0xFFFFu)
         | ((uint32_t)(OBS_ADDR_V) << 16);
    p[3] = ((uint32_t)(OBS_INT_VEC  & 0xFFu))
         | ((uint32_t)(OBS_INT_IPL  & 0xFFu) << 8)
         | ((uint32_t)(OBS_EXTRA1   & 0xFFFFu) << 16);
    // trap サンプルはエッジ瞬間にキャプチャした ISN を使う（sample 時点では CPU が
    // トラップベクタをフェッチ済みで ISN が上書きされているため）
    // bits[31:24]: sys 0 (indir) の .word N（非 indir 時は 0）
    if (trapped_latch) {
        uint32_t indir = (trapped_indirect_n != 0xFFFFu)
                         ? ((uint32_t)(trapped_indirect_n & 0xFFu) << 24)
                         : 0u;
        p[4] = trapped_word4 | indir;
    } else {
        p[4] = (uint32_t)OBS_WORD4;
    }
    trapped_latch = 0;  // サンプル済みのためクリア
    // Word5-8: GPR スナップショット（R0-R5, SP）+ M1 メモリプローブ
    p[5] = ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r0) & 0xFFFFu)
         | ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r1) << 16);
    p[6] = ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r2) & 0xFFFFu)
         | ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r3) << 16);
    p[7] = ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r4) & 0xFFFFu)
         | ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r5) << 16);
    p[8] = ((uint32_t)(top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__sp) & 0xFFFFu)
         | (mem_probe_addr != 0xFFFFFFFFu
            ? ((uint32_t)ram_read_word(mem_probe_addr) << 16)
            : 0u);
    {
        // Word9: User I-space PAR0 をプロセスコンテキスト識別子として記録
        auto& _ph = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__par_h;
        auto& _pl = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__par_l;
        uint16_t _uipar0 = (((uint32_t)_ph[48u] << 8) | (uint32_t)_pl[48u]) & 0x0FFFu;
        uint8_t  _ctx_new = (_uipar0 != g_prev_uipar0) ? 1u : 0u;
        p[9] = (uint32_t)_uipar0 | ((uint32_t)_ctx_new << 12);
        g_prev_uipar0 = _uipar0;
    }
    ring_head++;
}

// ── コンソール I/O キュー ─────────────────────────────────────────────────

#define CON_OUT_SIZE 8192
#define CON_IN_SIZE  256

static uint8_t con_out_buf[CON_OUT_SIZE];
static int     con_out_head = 0;
static int     con_out_tail = 0;

static uint8_t con_in_buf[CON_IN_SIZE];
static int     con_in_head = 0;
static int     con_in_tail = 0;

// ── GPR スナップショット（R0-R5, SP, istate = 8 × uint16_t）────────────────
// CPU は pdp11 モジュール (top.cpu.r0..r5, top.cpu.sp, top.cpu.istate) に直接アクセス。
// インデックス: 0=R0 1=R1 2=R2 3=R3 4=R4 5=R5 6=SP 7=istate

static uint16_t gpr_snap[8];

// ── MMU スナップショット（Kernel I-space 8 pages + User I-space 8 pages）──
// 各エントリ: upper16=PAR[11:0], lower16=PDR[15:0]
// indices 0-7: kernel I-space (pxr_index 0-7)
// indices 8-15: user I-space  (pxr_index 48-55)

static uint32_t mmu_snap[16];

// ── トリガー ─────────────────────────────────────────────────────────────────
//
// g_trig_type に対応する TRIG_* 定数:
//   TRIG_NONE    0 — 無効
//   TRIG_PC      1 — PC 値一致 (obs_addr_v == g_trig_val)
//   TRIG_ISTATE  2 — istate 立ち上がり (g_trig_val=1 → f1 フェッチ開始)
//   TRIG_IOPAGE  3 — I/O ページアクセス (obs_extra1[3])
//   TRIG_TRAP    4 — トラップ発生 (obs_trapped)
//   TRIG_BUSERR  5 — バスエラー (obs_extra1[0])
//   TRIG_PC_DATA 6 — VA 一致かつバスデータ一致
//                    g_trig_val = (opcode << 16) | VA
//                    obs_addr_v == VA かつ obs_data == opcode（フェッチ時）
//                    VA だけでは複数プロセスが同じ低位アドレスを共有して誤検出する
//                    ため、命令語(opcode)も照合してプロセスを一意に絞り込む。
#define TRIG_NONE    0
#define TRIG_PC      1
#define TRIG_ISTATE  2
#define TRIG_IOPAGE  3
#define TRIG_TRAP    4
#define TRIG_BUSERR  5
#define TRIG_PC_DATA 6

// obs_extra1 ビット位置（test_top_wasm.v の assign 順と対応）
// assign obs_extra1 = {8'b0, trap_odd, trap_abort, trap_bus, iopage, nxm, waited, bus_error, 1'b0}
#define EXTRA1_BUS_ERROR  (2u)   // bit 1: top.bus_error
#define EXTRA1_IOPAGE     (16u)  // bit 4: top.bus1.iopage_access

static int      g_trig_type         = TRIG_NONE;
static uint32_t g_trig_val          = 0;
static int      g_triggered         = 0;
static int      g_trigger_once      = 1;  // 1 回ヒットしたら停止
static uint8_t  g_prev_istate       = 0xFFu; // istate エッジ検出用
static uint32_t g_trig_fire_head    = 0;     // トリガー発火時の ring_head
static int      g_post_trig_remain  = 0;     // 発火後に収集する残りサンプル数
#define POST_TRIG_SAMPLES 100

// ── DPI 実装（wasm_uart.v から呼ばれる） ─────────────────────────────────

extern "C" void dpi_tty_putc(int ch) {
    int c = ch & 0x7F;
    int next = (con_out_tail + 1) % CON_OUT_SIZE;
    if (next != con_out_head) {
        con_out_buf[con_out_tail] = (uint8_t)c;
        con_out_tail = next;
    }
}

extern "C" int dpi_tty_getc() {
    if (con_in_head == con_in_tail) return -1;
    int ch = con_in_buf[con_in_head];
    con_in_head = (con_in_head + 1) % CON_IN_SIZE;
    return ch;
}

// ── GPR / MMU 更新ヘルパー ────────────────────────────────────────────────

static inline void update_gpr() {
    gpr_snap[0] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r0;
    gpr_snap[1] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r1;
    gpr_snap[2] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r2;
    gpr_snap[3] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r3;
    gpr_snap[4] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r4;
    gpr_snap[5] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__r5;
    gpr_snap[6] = top->rootp->test_top_wasm__DOT__top__DOT__cpu__DOT__sp;
}

// ── クロック 1 サイクル ───────────────────────────────────────────────────

static inline void tick() {
    SIM_SYSCLK = 1;
    top->eval();
    SIM_SYSCLK = 0;
    top->eval();
    sim_time++;
}

// ── リセット ─────────────────────────────────────────────────────────────

static void do_reset() {
    SIM_BUTTON = 0;
    SIM_SYSCLK = 0;
    top->eval();
    SIM_BUTTON = (1 << 3);
    for (int i = 0; i < 64; i++) tick();
    SIM_BUTTON = 0;
    for (int i = 0; i < 64; i++) tick();
}

// ── RAM 操作（ram_v5.cpp の extern） ────────────────────────────────────────

extern "C" {
    void ram_clear(void);
    void ram_write_word(uint32_t byte_addr, uint16_t word);
}

// ── エクスポート関数 ──────────────────────────────────────────────────────

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    setenv("IDEIMAGE", "/disk0.rk", 1);

    VerilatedContext* ctx = new VerilatedContext;
    top = new Vtest_top_wasm(ctx);

    memset(ring,     0, sizeof(ring));
    memset(con_out_buf, 0, sizeof(con_out_buf));
    memset(con_in_buf,  0, sizeof(con_in_buf));
    memset(gpr_snap, 0, sizeof(gpr_snap));
    memset(mmu_snap, 0, sizeof(mmu_snap));
    con_out_head = con_out_tail = 0;
    con_in_head  = con_in_tail  = 0;
    ring_head          = 0;
    sim_time           = 0;
    g_trig_type        = TRIG_NONE;
    g_trig_val         = 0;
    g_triggered        = 0;
    g_prev_istate      = 0xFFu;
    g_trig_fire_head   = 0;
    g_post_trig_remain = 0;
    ring_tick_mask     = 3u;   // Unix V6 ブート: 4tick/sample

    do_reset();
}

// ── ベアメタル初期化 ─────────────────────────────────────────────────────
// Unix V6 ブートなし。RAM をクリアし、initial_pc を設定してリセットする。
// ポストリセットのフリーランニングティックは行わない（テストプログラムが
// write_word で書き込まれる前に HALT(0) を実行してしまうのを防ぐため）。
// CPU の実行は resume メッセージ受信後に開始する。
EMSCRIPTEN_KEEPALIVE void sim_init_bare(uint32_t start_pc) {
    VerilatedContext* ctx = new VerilatedContext;
    top = new Vtest_top_wasm(ctx);

    memset(ring,     0, sizeof(ring));
    memset(con_out_buf, 0, sizeof(con_out_buf));
    memset(con_in_buf,  0, sizeof(con_in_buf));
    memset(gpr_snap, 0, sizeof(gpr_snap));
    memset(mmu_snap, 0, sizeof(mmu_snap));
    con_out_head = con_out_tail = 0;
    con_in_head  = con_in_tail  = 0;
    ring_head          = 0;
    sim_time           = 0;
    g_trig_type        = TRIG_NONE;
    g_trig_val         = 0;
    g_triggered        = 0;
    g_prev_istate      = 0xFFu;
    g_trig_fire_head   = 0;
    g_post_trig_remain = 0;
    ring_tick_mask     = 0u;   // ベアメタル タイミング図: 1tick/sample

    ram_clear();

    // 重要: eval_initial__TOP は最初の eval() 呼び出し時に実行され、
    // initial_pc を Verilog の initial 値（0o173000）で上書きする。
    // そのため initial_pc の書き込みは最初の eval() の「後」に行う必要がある。
    SIM_BUTTON = 0;
    SIM_SYSCLK = 0;
    top->eval();  // eval_initial__TOP を起動（initial_pc = 0o173000 にリセット）

    // eval_initial 実行後に initial_pc を目的アドレスに設定する
    top->rootp->test_top_wasm__DOT__top__DOT__initial_pc = (uint32_t)start_pc;

    // リセットパルス（ポストリセットティックなし）:
    // ポストリセットティックを走らせると、RAM がゼロ（= HALT 命令）のため
    // CPU が HALT を実行して止まる。write_word で実プログラムを書いてから
    // resume でシミュレーションを開始するため、ここではリセット解除のみ行う。
    SIM_BUTTON = (1 << 3);           // リセットアサート
    for (int i = 0; i < 64; i++) tick();
    SIM_BUTTON = 0;                   // リセット解除
    top->eval();                      // 解除伝搬（ティックは走らせない）
}

// ベアメタル: バイトアドレス byte_addr に 16bit ワードを 1 つ書く
EMSCRIPTEN_KEEPALIVE void sim_write_word(uint32_t byte_addr, uint32_t word) {
    ram_write_word(byte_addr, (uint16_t)(word & 0xFFFFu));
}

// メモリプローブアドレスを設定する（0xFFFFFFFF でプローブ無効）
EMSCRIPTEN_KEEPALIVE void sim_set_mem_probe(uint32_t byte_addr) {
    mem_probe_addr = byte_addr;
}

// サンプリング間隔マスクを動的に変更する
//   mask=0  → 毎 tick（1tick/smpl: 式トリガーの取りこぼし防止）
//   mask=3  → 4tick に 1 回（4tick/smpl: デフォルト、Unix V6 速度優先）
EMSCRIPTEN_KEEPALIVE void sim_set_ring_tick_mask(uint32_t mask) {
    ring_tick_mask = mask;
}
EMSCRIPTEN_KEEPALIVE uint32_t sim_get_ring_tick_mask() {
    return ring_tick_mask;
}

// ベアメタル: トリガー・HALT 判定なしで n_ticks だけ進める（ポストトリガー用）
static inline void update_trapped_latch() {
    uint8_t cur = OBS_TRAPPED & 1u;
    if (cur && !trapped_prev) {
        trapped_latch = 1;
        trapped_word4 = (uint32_t)OBS_WORD4;  // ISN をエッジ瞬間にキャプチャ
        // TRAP 0 (sys 0 indir): User I-space PAR で仮想→物理変換し .word N を読む。
        // obs_trapped 立ち上がり時点で obs_cpu_cm がすでに Kernel に切り替わっている
        // 場合があるため、cm に依存せず TRAP 0 は常にユーザー空間からの呼び出しと
        // みなして User I-space PAR を使う。
        uint16_t isn = (trapped_word4 >> 5) & 0xFFFFu;
        if (isn == 0x8900u) {
            uint16_t virt_pc = (uint16_t)OBS_PC;
            uint32_t apf     = (virt_pc >> 13) & 7u;
            auto& _par_h = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__par_h;
            auto& _par_l = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__par_l;
            uint32_t par     = (((uint32_t)_par_h[48u + apf] << 8)
                                | (uint32_t)_par_l[48u + apf]) & 0x0FFFu;
            uint32_t phys_pc = (par << 6u) + (uint32_t)(virt_pc & 0x1FFFu);
            trapped_indirect_n = ram_read_word(phys_pc);
        } else {
            trapped_indirect_n = 0xFFFFu;
        }
    }
    trapped_prev = cur;
}

EMSCRIPTEN_KEEPALIVE void sim_step_bare(int n_ticks) {
    for (int i = 0; i < n_ticks; i++) {
        tick();
        update_trapped_latch();
        if ((sim_time & ring_tick_mask) == 0) sample_ring();
    }
    if (top) update_gpr();
}

EMSCRIPTEN_KEEPALIVE void step_n(int n) {
    for (int i = 0; i < n && !g_triggered; i++) {
        // ポストトリガー収集中は HALT を無視して収集を完走させる
        if (OBS_HALTED && g_post_trig_remain == 0) break;
        tick();
        update_trapped_latch();
        bool sampled = (sim_time & ring_tick_mask) == 0;
        if (sampled) sample_ring();

        if (g_post_trig_remain > 0) {
            // トリガー発火後のカウントダウン（ring サンプル単位）
            if (sampled && --g_post_trig_remain == 0) {
                g_triggered = 1;
            }
        } else if (g_trig_type != TRIG_NONE) {
            bool hit = false;
            switch (g_trig_type) {
                case TRIG_PC:
                    // obs_pc はフェッチ後 +2 済みのため仮想アドレスで検出
                    hit = OBS_RD
                       && ((uint32_t)(OBS_ADDR_V & 0xFFFFu) == g_trig_val);
                    break;
                case TRIG_PC_DATA: {
                    // VA と バスデータ(命令語) の両方一致でプロセスを一意に絞る。
                    // g_trig_val = (opcode << 16) | VA
                    uint16_t va = (uint16_t)(g_trig_val & 0xFFFFu);
                    uint16_t op = (uint16_t)((g_trig_val >> 16) & 0xFFFFu);
                    hit = OBS_RD
                       && ((uint16_t)(OBS_ADDR_V & 0xFFFFu) == va)
                       && ((uint16_t)(OBS_DATA  & 0xFFFFu) == op);
                    break;
                }
                case TRIG_ISTATE: {
                    uint8_t cur = (uint8_t)(OBS_WORD4 & 0x1Fu);
                    hit = (cur == (uint8_t)g_trig_val)
                       && (g_prev_istate != (uint8_t)g_trig_val);
                    g_prev_istate = cur;
                    break;
                }
                case TRIG_IOPAGE:
                    hit = (OBS_EXTRA1 & EXTRA1_IOPAGE) != 0;
                    break;
                case TRIG_TRAP:
                    hit = OBS_TRAPPED != 0;
                    break;
                case TRIG_BUSERR:
                    hit = (OBS_EXTRA1 & EXTRA1_BUS_ERROR) != 0;
                    break;
                default:
                    break;
            }
            if (hit && g_trigger_once) {
                // 発火位置を記録し、ポストトリガー収集を開始する
                g_trig_fire_head   = ring_head;
                g_post_trig_remain = POST_TRIG_SAMPLES;
            }
        }
    }
    if (top) update_gpr();
}

EMSCRIPTEN_KEEPALIVE void send_key(int ch) {
    int next = (con_in_tail + 1) % CON_IN_SIZE;
    if (next != con_in_head) {
        con_in_buf[con_in_tail] = (uint8_t)ch;
        con_in_tail = next;
    }
}

EMSCRIPTEN_KEEPALIVE int get_display_char() {
    if (con_out_head == con_out_tail) return -1;
    int ch = con_out_buf[con_out_head];
    con_out_head = (con_out_head + 1) % CON_OUT_SIZE;
    return ch;
}

// ring buffer
EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()   { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_head()  { return ring_head; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_size()  { return RING_SIZE; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_words() { return RING_WORDS; }

// PC 取得
EMSCRIPTEN_KEEPALIVE uint32_t get_pc() { return OBS_PC; }

// コンソール入力空き容量
EMSCRIPTEN_KEEPALIVE int sim_con_in_space() {
    int used = (con_in_tail - con_in_head + CON_IN_SIZE) % CON_IN_SIZE;
    return CON_IN_SIZE - used - 1;
}

// トリガー設定（type = TRIG_* 定数、val = 比較値）
EMSCRIPTEN_KEEPALIVE void sim_set_trigger(int type, uint32_t val) {
    g_trig_type   = type;
    g_trig_val    = val;
    g_triggered   = 0;
    g_prev_istate = 0xFFu;
}

// 後方互換: PC トリガー専用（Playwright テストが使用）
EMSCRIPTEN_KEEPALIVE void sim_set_pc_trigger(uint32_t pc) {
    sim_set_trigger(pc ? TRIG_PC : TRIG_NONE, pc);
}

// トリガーヒット確認（1 = ヒット）
EMSCRIPTEN_KEEPALIVE int      sim_trigger_hit()      { return g_triggered; }
EMSCRIPTEN_KEEPALIVE uint32_t get_trig_fire_head()   { return g_trig_fire_head; }

// トリガー解除
EMSCRIPTEN_KEEPALIVE void sim_clear_trigger() {
    g_trig_type        = TRIG_NONE;
    g_trig_val         = 0;
    g_triggered        = 0;
    g_prev_istate      = 0xFFu;
    g_trig_fire_head   = 0;
    g_post_trig_remain = 0;
}

// ── GPR アクセス ──────────────────────────────────────────────────────────
// 戻り値は uint16_t[7] = R0,R1,R2,R3,R4,R5,SP のバイトポインタ
EMSCRIPTEN_KEEPALIVE uint16_t* get_gpr_ptr()  { return gpr_snap; }

// ── MMU PAR/PDR アクセス ──────────────────────────────────────────────────
// mmu_snap[0-7]:  Kernel I-space APR 0-7 (pxr_index 0-7)
// mmu_snap[8-15]: User   I-space APR 0-7 (pxr_index 48-55)
// 各エントリ: upper16 = PAR[11:0] (12-bit page address register)
//             lower16 = PDR[15:0] (page descriptor register)
EMSCRIPTEN_KEEPALIVE void sim_update_mmu() {
    if (!top) return;
    auto& par_h = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__par_h;
    auto& par_l = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__par_l;
    auto& pdr_h = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__pdr_h;
    auto& pdr_l = top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__pdr_l;
    for (int i = 0; i < 8; i++) {
        uint16_t par = ((uint16_t)par_h[i]      << 8) | par_l[i];
        uint16_t pdr = ((uint16_t)pdr_h[i]      << 8) | pdr_l[i];
        mmu_snap[i] = ((uint32_t)par << 16) | pdr;
    }
    for (int i = 0; i < 8; i++) {
        uint16_t par = ((uint16_t)par_h[48 + i] << 8) | par_l[48 + i];
        uint16_t pdr = ((uint16_t)pdr_h[48 + i] << 8) | pdr_l[48 + i];
        mmu_snap[8 + i] = ((uint32_t)par << 16) | pdr;
    }
}
EMSCRIPTEN_KEEPALIVE uint32_t* get_mmu_ptr()  { return mmu_snap; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_mmu_size() { return 16; }

} // extern "C"
