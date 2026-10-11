// 01-counter ハーネス — Verilator カウンタを駆動し、波形を ring buffer へ記録する。
//
// ring buffer ビットレイアウト（1 サンプル = 1 uint32_t = 1 word）:
//   bits[ 7: 0] = count  (カウンタ出力 8bit)
//   bit [    8] = rst    (リセット入力)
//
// 記録・Freeze・トリガーは cxx/rtlscope_ring.h が担当する。

#include "Vcounter.h"
#include "verilated.h"
#include "../../../cxx/rtlscope_ring.h"

static Vcounter* top;
static rtlscope::Ring<4096, 1> ring;

// 現在の出力から 1 サンプル分の word を記録する。
static void record_sample() {
    const uint32_t w[1] = {
        ((uint32_t)top->count & 0xFFu) | ((uint32_t)(top->rst & 1u) << 8)
    };
    ring.record(w);
}

// rst を 2 サイクル保持してリセットする。リセット区間も波形に残す。
static void apply_reset() {
    top->rst = 1;
    for (int i = 0; i < 2; i++) {
        top->clk = 0; top->eval();
        top->clk = 1; top->eval();
        record_sample();
    }
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
}

RTLSCOPE_EXPORT_RING(ring)

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    if (!top) top = new Vcounter();
    top->clk = 0;
    top->rst = 0;
    top->eval();
    ring.start_session();
    apply_reset();
}

EMSCRIPTEN_KEEPALIVE void step() {
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    record_sample();
}

// n クロック進める。トリガーで Freeze したらその場で打ち切る。
EMSCRIPTEN_KEEPALIVE void sim_run_n(int n) {
    for (int i = 0; i < n && !ring.hit(); i++) step();
}

// カウンタをリセットする。履歴は残し、Freeze とトリガー発火状態だけ解除する。
EMSCRIPTEN_KEEPALIVE void reset_sim() {
    ring.thaw();
    apply_reset();
}

} // extern "C"
