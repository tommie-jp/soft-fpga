#include "Vcounter.h"
#include "verilated.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
#include <stdint.h>

static Vcounter* top;

struct Sample { uint32_t count; };
static const int RING_SIZE = 1024;
static Sample ring[RING_SIZE];
static uint32_t head = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    top = new Vcounter();
    top->clk = 0;
    top->rst = 1;
    top->eval();
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->rst = 0;
    top->eval();
    head = 0;
}

EMSCRIPTEN_KEEPALIVE void step() {
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    ring[head & (RING_SIZE - 1)].count = top->count;
    head++;
}

EMSCRIPTEN_KEEPALIVE void reset_sim() {
    top->rst = 1;
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->rst = 0;
    top->eval();
    head = 0;
}

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr() {
    return reinterpret_cast<uint32_t*>(ring);
}

EMSCRIPTEN_KEEPALIVE uint32_t get_head() {
    return head;
}

EMSCRIPTEN_KEEPALIVE int get_ring_size() {
    return RING_SIZE;
}

} // extern "C"
