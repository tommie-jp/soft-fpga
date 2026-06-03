// harness.cpp — PDP-11 / Unix V6 WASM ハーネス
//
// 06-8080/cxx/harness.cpp と同じ構造。
// DPI 実装（dpi_tty_putc / dpi_tty_getc）、step_n、send_key、get_display_char、
// ring buffer、sim_init を提供する。

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
// test_top_wasm.v に /* verilator public_flat_rw */ で公開

#define SIM_SYSCLK  (top->rootp->test_top_wasm__DOT__sysclk)
#define SIM_BUTTON  (top->rootp->test_top_wasm__DOT__button)

// ring buffer 用観測信号
#define OBS_PC       (top->rootp->test_top_wasm__DOT__obs_pc)
#define OBS_PSW      (top->rootp->test_top_wasm__DOT__obs_psw)
#define OBS_ADDR_P   (top->rootp->test_top_wasm__DOT__obs_addr_p)
#define OBS_DATA     (top->rootp->test_top_wasm__DOT__obs_data)
#define OBS_WR       (top->rootp->test_top_wasm__DOT__obs_wr)
#define OBS_CPU_CM   (top->rootp->test_top_wasm__DOT__obs_cpu_cm)
#define OBS_RK_STATE (top->rootp->test_top_wasm__DOT__obs_rk_state)

// ── ring buffer ───────────────────────────────────────────────────────────
// 1 サンプル = 4 × uint32_t（RING_WORDS = 4）
//
// Word0 [31: 0]:
//   [17: 0] bus_addr_p — Unibus 物理アドレス（18 ビット）
//   [18]    bus_wr     — バス書き込みストローブ
//   [19]    bus_byte   — バイト操作フラグ（obs_wr の上位ビット）
//   [21:20] cpu_cm     — CPU モード (00=kernel, 11=user)
// Word1 [31: 0]:
//   [15: 0] bus_data   — バスデータ（読み書き共用）
//   [31:16] PSW        — プロセッサステータスワード
// Word2 [31: 0]:
//   [15: 0] PC         — プログラムカウンタ（仮想）
//   [20:16] rk_state   — RK11 ステート（非 0 = ディスク転送中）
// Word3 [31: 0]:
//   予備

#define RING_SIZE  4096
#define RING_WORDS 4

static uint32_t ring[RING_SIZE * RING_WORDS];
static uint32_t ring_head = 0;

static inline void sample_ring() {
    uint32_t* p = &ring[(ring_head % RING_SIZE) * RING_WORDS];
    p[0] = ((uint32_t)OBS_ADDR_P & 0x3FFFFu)
         | ((uint32_t)(OBS_WR & 1u) << 18)
         | ((uint32_t)(OBS_CPU_CM & 3u) << 20);
    p[1] = ((uint32_t)(OBS_DATA) & 0xFFFFu)
         | ((uint32_t)(OBS_PSW) << 16);
    p[2] = ((uint32_t)(OBS_PC) & 0xFFFFu)
         | ((uint32_t)(OBS_RK_STATE & 0x1Fu) << 16);
    p[3] = 0;
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

// ── DPI 実装（wasm_uart.v から呼ばれる） ─────────────────────────────────

extern "C" void dpi_tty_putc(int ch) {
    // bit 7 はパリティ/LCASEフラグ: 7-bit ASCII にマスク
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

// ── リセットシーケンス ────────────────────────────────────────────────────
// reset_btn.v は button[3] の立ち上がりを検出してリセット信号を生成する

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
    // ディスクイメージは MEMFS 上の /disk0.rk（JS の preRun フックで書き込む）
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

    do_reset();
}

// JS タイマーから呼ばれるシミュレーションステップ
EMSCRIPTEN_KEEPALIVE void step_n(int n) {
    for (int i = 0; i < n; i++) {
        tick();
        // 4 クロックに 1 サンプル（ring buffer のサンプリング間引き）
        if ((sim_time & 3u) == 0) sample_ring();
    }
}

// xterm.js → キーボード入力
EMSCRIPTEN_KEEPALIVE void send_key(int ch) {
    int next = (con_in_tail + 1) % CON_IN_SIZE;
    if (next != con_in_head) {
        con_in_buf[con_in_tail] = (uint8_t)ch;
        con_in_tail = next;
    }
}

// TTY 出力: -1 = キューが空、0-127 = 文字
EMSCRIPTEN_KEEPALIVE int get_display_char() {
    if (con_out_head == con_out_tail) return -1;
    int ch = con_out_buf[con_out_head];
    con_out_head = (con_out_head + 1) % CON_OUT_SIZE;
    return ch;
}

// ring buffer アクセサ（JS 側 TypedArray でゼロコピー参照）
EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()   { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_head()  { return ring_head; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_size()  { return RING_SIZE; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_words() { return RING_WORDS; }

// PC 取得（ブート進行表示用）
EMSCRIPTEN_KEEPALIVE uint32_t get_pc() { return OBS_PC; }

// コンソール入力バッファの空き容量（マクロ注入レート制御用）
EMSCRIPTEN_KEEPALIVE int sim_con_in_space() {
    int used = (con_in_tail - con_in_head + CON_IN_SIZE) % CON_IN_SIZE;
    return CON_IN_SIZE - used - 1;
}

} // extern "C"
