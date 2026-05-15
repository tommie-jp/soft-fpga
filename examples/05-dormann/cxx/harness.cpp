// Dormann 6502 functional test — Emscripten harness
// Binary: /6502_functional_test.bin (64KB, embedded via --embed-file)
// Success: PC traps at $3469
#include "Vapple1_top.h"
#include "verilated.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
#include <cstdio>
#include <cstdint>
#include <cstring>

static Vapple1_top* top;
static uint8_t  ram[0x10000];
static uint64_t total_cycles = 0;
static uint16_t prev_pc      = 0xFFFF;
static bool     trapped      = false;
static bool     passed       = false;

static const int RING_SIZE = 4096;
static uint32_t ring[RING_SIZE * 2];
static uint32_t head = 0;

static void do_step() {
    uint16_t ab = (uint16_t)top->o_ab;
    if (top->o_we) ram[ab] = top->o_do;

    top->clk = 1; top->eval();
    top->clk = 0; top->eval();

    top->i_di = ram[ab];
    top->eval();

    uint32_t idx = (head & (uint32_t)(RING_SIZE - 1)) * 2;
    ring[idx]     = (uint32_t)ab
                  | ((uint32_t)top->o_do  << 16)
                  | ((uint32_t)top->o_we  << 24)
                  | ((uint32_t)top->o_sync << 25);
    ring[idx + 1] = 0;
    head++;
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
    head         = 0;
    prev_pc      = 0xFFFF;
    trapped      = false;
    passed       = false;

    top->i_reset_n = 0;
    for (int i = 0; i < 8; i++) do_step();
    top->i_reset_n = 1;
}

EMSCRIPTEN_KEEPALIVE void step(int n) {
    if (trapped) return;
    for (int i = 0; i < n; i++) {
        do_step();
        if (top->o_sync) {
            uint16_t pc = (uint16_t)top->o_ab;
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
EMSCRIPTEN_KEEPALIVE uint32_t get_ring_ptr()  { return (uint32_t)(uintptr_t)ring; }
EMSCRIPTEN_KEEPALIVE uint32_t get_ring_size() { return RING_SIZE; }
EMSCRIPTEN_KEEPALIVE uint32_t get_head()      { return head; }

} // extern "C"
