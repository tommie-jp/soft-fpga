#include "Vtraffic_fsm.h"
#include "verilated.h"
#include <emscripten.h>
#include <stdint.h>

static Vtraffic_fsm* top;

// ring buffer — 1 サンプル = 1 uint32_t
//   bits[ 1: 0] = state   (2bit)
//   bit [    2] = green
//   bit [    3] = yellow
//   bit [    4] = red
//   bit [    5] = walk
//   bit [    6] = btn_req (o_btn_req)
//   bit [    7] = rst
//   bit [    8] = clk     (posedge サンプルなので常に 1)
//   bit [    9] = btn
//   bits[25:16] = timer   (o_timer, 10bit)
static const int RING_SIZE = 1024;
static uint32_t  ring[RING_SIZE];
static uint32_t  head = 0;

static uint8_t pending_btn = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    top = new Vtraffic_fsm();
    top->rst = 1; top->btn = 0;
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
    head        = 0;
    pending_btn = 0;
}

EMSCRIPTEN_KEEPALIVE void step() {
    top->btn    = pending_btn;
    pending_btn = 0;

    top->clk = 0; top->eval();
    top->clk = 1; top->eval();

    uint32_t d = 0;
    d |= (uint32_t)(top->o_state   & 0x3u);
    d |= (uint32_t)(top->green     & 0x1u) << 2;
    d |= (uint32_t)(top->yellow    & 0x1u) << 3;
    d |= (uint32_t)(top->red       & 0x1u) << 4;
    d |= (uint32_t)(top->walk      & 0x1u) << 5;
    d |= (uint32_t)(top->o_btn_req & 0x1u) << 6;
    d |= (uint32_t)(top->rst       & 0x1u) << 7;
    d |= (uint32_t)(top->clk       & 0x1u) << 8;
    d |= (uint32_t)(top->btn       & 0x1u) << 9;
    d |= (uint32_t)(top->o_timer   & 0x3FFu) << 16;
    ring[head & (RING_SIZE - 1)] = d;
    head++;
}

EMSCRIPTEN_KEEPALIVE void reset_sim() {
    top->rst = 1; top->btn = 0;
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
    head        = 0;
    pending_btn = 0;
}

EMSCRIPTEN_KEEPALIVE void press_btn() {
    pending_btn = 1;
}

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr() {
    return ring;
}

EMSCRIPTEN_KEEPALIVE uint32_t get_head() {
    return head;
}

EMSCRIPTEN_KEEPALIVE int get_ring_size() {
    return RING_SIZE;
}

} // extern "C"
