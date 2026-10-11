// 02-traffic-fsm ハーネス — 信号機 FSM を駆動し、波形を ring buffer へ記録する。
//
// ring buffer ビットレイアウト（1 サンプル = 1 uint32_t = 1 word）:
//   bits[ 1: 0] = state   (2bit: 0=GREEN 1=YELLOW 2=RED 3=WALK)
//   bit [    2] = green
//   bit [    3] = yellow
//   bit [    4] = red
//   bit [    5] = walk
//   bit [    6] = btn_req (o_btn_req)
//   bit [    7] = rst
//   bit [    8] = clk     (posedge サンプルなので常に 1)
//   bit [    9] = btn
//   bits[25:16] = timer   (o_timer, 10bit)
//
// 記録・Freeze・トリガーは cxx/rtlscope_ring.h が担当する。

#include "Vtraffic_fsm.h"
#include "verilated.h"
#include "../../../cxx/rtlscope_ring.h"

static Vtraffic_fsm* top;
static rtlscope::Ring<4096, 1> ring;

static uint8_t pending_btn = 0;

static void record_sample() {
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
    const uint32_t w[1] = { d };
    ring.record(w);
}

// rst を 2 サイクル保持してリセットする。リセット区間も波形に残す。
static void apply_reset() {
    top->rst = 1; top->btn = 0;
    for (int i = 0; i < 2; i++) {
        top->clk = 0; top->eval();
        top->clk = 1; top->eval();
        record_sample();
    }
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
    pending_btn = 0;
}

RTLSCOPE_EXPORT_RING(ring)

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    if (!top) top = new Vtraffic_fsm();
    top->rst = 0; top->btn = 0;
    top->clk = 0; top->eval();
    ring.start_session();
    apply_reset();
}

EMSCRIPTEN_KEEPALIVE void step() {
    top->btn    = pending_btn;
    pending_btn = 0;

    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    record_sample();
}

// n クロック進める。トリガーで Freeze したらその場で打ち切る。
EMSCRIPTEN_KEEPALIVE void sim_run_n(int n) {
    for (int i = 0; i < n && !ring.hit(); i++) step();
}

// リセットする。履歴は残し、Freeze とトリガー発火状態だけ解除する。
EMSCRIPTEN_KEEPALIVE void reset_sim() {
    ring.thaw();
    apply_reset();
}

EMSCRIPTEN_KEEPALIVE void press_btn() {
    pending_btn = 1;
}

} // extern "C"
