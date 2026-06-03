// harness.cpp — PDP-11 / Unix V6 WASM ハーネス（Phase 3）
//
// DPI 実装（dpi_tty_putc / dpi_tty_getc）、step_n、send_key、
// get_display_char、ring buffer（RING_WORDS=5）、PC トリガー、sim_init を提供する。

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

// ── ring buffer（RING_WORDS = 5）─────────────────────────────────────────
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
//   [ 7: 0] int_vec     — 割り込みベクタ（8 ビット）
//   [15: 8] int_ipl     — 割り込み優先レベル（8 ビット）
// Word4 [31:0]:
//   予備

#define RING_SIZE  4096
#define RING_WORDS 5

static uint32_t ring[RING_SIZE * RING_WORDS];
static uint32_t ring_head = 0;

static inline void sample_ring() {
    uint32_t* p = &ring[(ring_head % RING_SIZE) * RING_WORDS];
    p[0] = ((uint32_t)OBS_ADDR_P   & 0x3FFFFu)
         | ((uint32_t)(OBS_WR      & 1u) << 18)
         | ((uint32_t)(OBS_RD      & 1u) << 19)
         | ((uint32_t)(OBS_CPU_CM  & 3u) << 20)
         | ((uint32_t)(OBS_BYTE_OP & 1u) << 22)
         | ((uint32_t)(OBS_TRAPPED & 1u) << 23)
         | ((uint32_t)(OBS_HALTED  & 1u) << 24)
         | ((uint32_t)(OBS_BUS_INT & 1u) << 25)
         | ((uint32_t)(OBS_RK_STATE & 0x1Fu) << 26);
    p[1] = ((uint32_t)(OBS_DATA) & 0xFFFFu)
         | ((uint32_t)(OBS_PSW)  << 16);
    p[2] = ((uint32_t)(OBS_PC)     & 0xFFFFu)
         | ((uint32_t)(OBS_ADDR_V) << 16);
    p[3] = ((uint32_t)(OBS_INT_VEC & 0xFFu))
         | ((uint32_t)(OBS_INT_IPL & 0xFFu) << 8);
    p[4] = 0;
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

// ── PC トリガー ────────────────────────────────────────────────────────────

static uint32_t g_trigger_pc   = 0;
static int      g_triggered    = 0;
static int      g_trigger_once = 1;  // 1 回ヒットしたら停止

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

// ── エクスポート関数 ──────────────────────────────────────────────────────

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    setenv("IDEIMAGE", "/disk0.rk", 1);

    VerilatedContext* ctx = new VerilatedContext;
    top = new Vtest_top_wasm(ctx);

    memset(ring, 0, sizeof(ring));
    memset(con_out_buf, 0, sizeof(con_out_buf));
    memset(con_in_buf,  0, sizeof(con_in_buf));
    con_out_head = con_out_tail = 0;
    con_in_head  = con_in_tail  = 0;
    ring_head    = 0;
    sim_time     = 0;
    g_trigger_pc = 0;
    g_triggered  = 0;

    do_reset();
}

EMSCRIPTEN_KEEPALIVE void step_n(int n) {
    for (int i = 0; i < n && !g_triggered; i++) {
        if (OBS_HALTED) break;   // CPU halt: stop simulation
        tick();
        if ((sim_time & 3u) == 0) sample_ring();
        // PC トリガー判定
        if (g_trigger_pc && ((uint32_t)OBS_PC == g_trigger_pc)) {
            if (g_trigger_once) {
                g_triggered = 1;
                break;
            }
        }
    }
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

// PC トリガー設定: pc=0 で解除
EMSCRIPTEN_KEEPALIVE void sim_set_pc_trigger(uint32_t pc) {
    g_trigger_pc = pc;
    g_triggered  = 0;
}

// トリガーヒット確認（1 = ヒット）
EMSCRIPTEN_KEEPALIVE int sim_trigger_hit() { return g_triggered; }

// トリガー解除してシム再開
EMSCRIPTEN_KEEPALIVE void sim_clear_trigger() {
    g_triggered  = 0;
    g_trigger_pc = 0;
}

} // extern "C"
