// examples/91-pong/cxx/harness.cpp — 1 画面ぶんクロックを回し、画素を 160 × 120 の配列に書く。
// Logic Analyzer 用に、主要な信号を ring buffer (1 サンプル = 3 word) へ記録する。
//
// ring buffer ビットレイアウト（js/sft-pong-la-defs.js と一致させる）:
//   word 0: [ 7: 0] bx      球の左端      [14: 8] by    球の上端
//           [21:15] pl      左ラケットの上端  [28:22] pr    右ラケットの上端
//           [   29] left    球は左へ      [   30] up    球は上へ     [31] fast  縦に 2 画素ずつ
//   word 1: [ 3: 0] sl      左の点         [ 7: 4] sr    右の点
//           [    8] hit_l   左ラケットで返す [   9] hit_r  右ラケットで返す
//           [   10] out_l   左の端を越えた   [  11] out_r  右の端を越えた
//           [   12] up_l [13] dn_l [14] up_r [15] dn_r   ボタン
//           [   16] auto_l [17] auto_r                   AUTO のスイッチ
//           [   18] frame_end   [19] line_end
//           [   20] sound (スピーカーへの矩形波)   [22:21] snd_kind (0 無音・1 ヒット 450 Hz・2 壁と点 225 Hz)
//   word 2: [ 7: 0] h  いま出している画素の横   [14: 8] v  縦   [15] pixel
//
// 記録のしかたは 2 通り (set_la_mode)。
//   0: 1 クロックごと。h・v・pixel が走査線のとおりに動くのが見える (1 画面 = 19 200 クロック。ring は 4096)
//   1: 1 画面ごと (画面の最後の画素の次のクロック)。球とラケットと点の動きを 4096 画面ぶん見る (約 68 秒)
//
// 球・ラケット・点は pong.v の中のレジスタ。pong.v は変えず、Verilator が公開する rootp から読む。

#include "Vpong.h"
#include "Vpong___024root.h"
#include "verilated.h"
#include "../../../cxx/rtlscope_ring.h"
#include <stdint.h>

static Vpong*   top;
static uint8_t  fb[160 * 120];     // 1 画素 1 バイト (0 か 1)
static uint32_t keys   = 0;        // bit0 左上 bit1 左下 bit2 右上 bit3 右下 bit4 左 auto bit5 右 auto
static uint32_t frames = 0;
static int      la_mode = 1;       // 上の 2 通りのどちらか
static bool     snd_prev = false;  // 直前のクロックの sound (画面をまたいで覚える)
static uint32_t snd_edges = 0, snd_clocks = 0;   // この画面で sound が 0 → 1 になった数・1 だったクロックの数

static rtlscope::Ring<4096, 3> ring;

static void tick() {
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
}

static void record_sample() {
    const auto* r = top->rootp;
    uint32_t w[3];
    w[0] = (uint32_t)(r->pong__DOT__bx)
         | (uint32_t)(r->pong__DOT__by)   << 8
         | (uint32_t)(r->pong__DOT__pl)   << 15
         | (uint32_t)(r->pong__DOT__pr)   << 22
         | (uint32_t)(r->pong__DOT__left & 1) << 29
         | (uint32_t)(r->pong__DOT__up   & 1) << 30
         | (uint32_t)(r->pong__DOT__fast & 1) << 31;
    w[1] = (uint32_t)(r->pong__DOT__sl)
         | (uint32_t)(r->pong__DOT__sr)   << 4
         | (uint32_t)(r->pong__DOT__hit_l & 1) << 8
         | (uint32_t)(r->pong__DOT__hit_r & 1) << 9
         | (uint32_t)(r->pong__DOT__out_l & 1) << 10
         | (uint32_t)(r->pong__DOT__out_r & 1) << 11
         | (uint32_t)(keys & 0x3Fu) << 12
         | (uint32_t)(top->frame_end & 1) << 18
         | (uint32_t)(top->line_end  & 1) << 19
         | (uint32_t)(top->sound     & 1) << 20
         | (uint32_t)(top->snd_kind  & 3) << 21;
    w[2] = (uint32_t)(top->hpos)
         | (uint32_t)(top->vpos)  << 8
         | (uint32_t)(top->pixel & 1) << 15;
    ring.record(w);
}

RTLSCOPE_EXPORT_RING(ring)

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    top = new Vpong();
    top->rst = 1; tick();
    top->rst = 0; top->clk = 0; top->eval();
    frames = 0; snd_prev = false;
    ring.start_session();
}

EMSCRIPTEN_KEEPALIVE void set_keys(uint32_t k) { keys = k; }

// 記録のしかたを選ぶ (0: 1 クロックごと、1: 1 画面ごと)。履歴は捨てる。
EMSCRIPTEN_KEEPALIVE void set_la_mode(int mode) {
    la_mode = mode ? 1 : 0;
    ring.thaw();
    ring.start_session();
}

// 1 画面 = 160 × 120 = 19 200 クロック。画素は立ち上がりの前の (hpos, vpos) の値。
// トリガーで Freeze したら、画面の途中でも打ち切る。
EMSCRIPTEN_KEEPALIVE void run_frame() {
    top->up_l = keys & 1;         top->dn_l = (keys >> 1) & 1;
    top->up_r = (keys >> 2) & 1;  top->dn_r = (keys >> 3) & 1;
    top->auto_l = (keys >> 4) & 1; top->auto_r = (keys >> 5) & 1;
    snd_edges = snd_clocks = 0;
    for (int i = 0; i < 160 * 120; i++) {
        top->clk = 0; top->eval();
        fb[top->vpos * 160 + top->hpos] = top->pixel;
        const bool snd = top->sound;
        snd_clocks += snd;
        if (snd && !snd_prev) snd_edges++;
        snd_prev = snd;
        const bool last = top->frame_end;
        if (la_mode == 0) record_sample();
        top->clk = 1; top->eval();
        if (last) {
            if (la_mode == 1) record_sample();   // 球とラケットが動いた後の値
            frames++;
            break;
        }
        if (ring.hit()) break;
    }
}

// n 画面進める (LA の共通 API の名前に合わせた。ほかの例では n クロック)。Freeze したら打ち切る。
EMSCRIPTEN_KEEPALIVE void sim_run_n(int n) {
    for (int i = 0; i < n && !ring.hit(); i++) run_frame();
}

EMSCRIPTEN_KEEPALIVE uint8_t* get_fb()      { return fb; }
EMSCRIPTEN_KEEPALIVE uint32_t get_score()   { return (uint32_t)top->score_l << 4 | top->score_r; }
EMSCRIPTEN_KEEPALIVE uint32_t get_frames()  { return frames; }
// 音。JS は画面ごとに get_snd_kind() を読み、次の 1 画面ぶんの音を鳴らす (0 無音・1 ヒット 450 Hz・2 壁と点 225 Hz)
EMSCRIPTEN_KEEPALIVE uint32_t get_snd_kind()   { return top->snd_kind; }
EMSCRIPTEN_KEEPALIVE uint32_t get_snd_edges()  { return snd_edges; }
EMSCRIPTEN_KEEPALIVE uint32_t get_snd_clocks() { return snd_clocks; }

} // extern "C"
