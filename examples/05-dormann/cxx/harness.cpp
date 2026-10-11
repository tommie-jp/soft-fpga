// Dormann 6502 functional test — Emscripten harness
// Binary: /6502_functional_test.bin (64KB, embedded via --embed-file)
// Success: PC traps at $3469
#include "Vapple1_top.h"
#include "verilated.h"
#include "../../../cxx/rtlscope_ring.h"
#include <cstdio>
#include <cstdint>
#include <cstring>

static Vapple1_top* top;
static uint8_t  ram[0x10000];
static uint64_t total_cycles = 0;
static uint16_t prev_pc      = 0xFFFF;
static bool     trapped      = false;
static bool     passed       = false;

// ring buffer: 2 uint32_t per sample（04-6502 と同じレイアウト。cxx/rtlscope_ring.h が記録・Freeze・トリガーを担当）
// Word0: [15:0]=AB  [23:16]=DB  [24]=WE  [25]=SYNC  [26]=reset
// Word1: [7:0]=A  [15:8]=X  [23:16]=Y  [31:24]=SP
static rtlscope::Ring<4096, 2> ring;

static void do_step() {
    uint16_t ab = (uint16_t)top->o_ab;
    if (top->o_we) ram[ab] = top->o_do;

    top->clk = 1; top->eval();
    top->clk = 0; top->eval();

    top->i_di = ram[ab];
    top->eval();

    // SYNC=1 のサンプルでは DB（= i_di）がフェッチしたオペコードになる。WE=1 なら CPU が書く値。
    const uint8_t db = top->o_we ? top->o_do : top->i_di;
    const uint32_t w[2] = {
        (uint32_t)ab
            | ((uint32_t)db                   << 16)
            | ((uint32_t)(top->o_we    & 1u) << 24)
            | ((uint32_t)(top->o_sync  & 1u) << 25)
            | ((uint32_t)(top->reset   & 1u) << 26),
        (uint32_t)(top->o_a)
            | ((uint32_t)(top->o_x)  << 8)
            | ((uint32_t)(top->o_y)  << 16)
            | ((uint32_t)(top->o_sp) << 24)
    };
    ring.record(w);
    total_cycles++;
}

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    memset(ram, 0, sizeof(ram));
    FILE* f = fopen("/6502_functional_test.bin", "rb");
    if (f) { fread(ram, 1, sizeof(ram), f); fclose(f); }
    // 6502_functional_test は $0400 スタート。reset vector を上書き。
    ram[0xFFFC] = 0x00;
    ram[0xFFFD] = 0x04;

    if (!top) top = new Vapple1_top();
    total_cycles = 0;
    ring.start_session();
    prev_pc      = 0xFFFF;
    trapped      = false;
    passed       = false;

    // hoglet cpu_65c02: IRQ は active-HIGH、RDY=0 で停止するため明示的に設定する。
    top->i_irq = 0;
    top->i_nmi = 0;
    top->i_rdy = 1;
    top->i_di  = 0xFF;
    top->clk   = 0;
    top->eval();

    top->reset = 1;
    for (int i = 0; i < 8; i++) do_step();
    top->reset = 0;
    top->eval();
    // リセットベクタ取得サイクルに備えて DI を先読みする（04 の harness と同じ）。
    top->i_di = ram[(uint16_t)top->o_ab];
    top->eval();
}

EMSCRIPTEN_KEEPALIVE void step(int n) {
    if (trapped) return;
    for (int i = 0; i < n && !ring.hit(); i++) {   // LA トリガーで Freeze したら打ち切る
        do_step();
        if (top->o_sync) {
            // SYNC=1 時の o_ab は次サイクルのアドレスなので使えない。
            // PC は既に +1 されているため、オペコードアドレス = o_pc - 1。
            uint16_t pc = (uint16_t)top->o_pc - 1u;
            if (pc == prev_pc) {
                trapped = true;
                passed  = (pc == 0x3469);
                return;
            }
            prev_pc = pc;
        }
    }
}

EMSCRIPTEN_KEEPALIVE uint32_t get_pc()        { return top ? (uint16_t)top->o_ab : 0; }
EMSCRIPTEN_KEEPALIVE uint32_t get_cycles_lo() { return (uint32_t)(total_cycles & 0xFFFFFFFFu); }
EMSCRIPTEN_KEEPALIVE uint32_t get_cycles_hi() { return (uint32_t)(total_cycles >> 32); }
EMSCRIPTEN_KEEPALIVE int      is_trapped()    { return trapped ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE int      is_passed()     { return passed  ? 1 : 0; }
// n クロック進める（04 と同じ名前。Logic Analyzer 共通コードから呼ぶ）
EMSCRIPTEN_KEEPALIVE void sim_run_n(int n) { step(n); }

} // extern "C"

RTLSCOPE_EXPORT_RING(ring)
