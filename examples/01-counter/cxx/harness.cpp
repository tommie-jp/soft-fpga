// 01-counter ハーネス — Verilator カウンタを駆動し、波形を ring buffer へ記録する。
//
// ring buffer ビットレイアウト（1 サンプル = 1 uint32_t = 1 word）:
//   bits[ 7: 0] = count  (カウンタ出力 8bit)
//   bit [    8] = rst    (リセット入力)
//
// Logic Analyzer (js/rtlscope-la.js) 用に、フリーズ / エッジ・値トリガー /
// LA ON-OFF を持つ。API 名と意味は 06-8080 ハーネスに合わせている。

#include "Vcounter.h"
#include "verilated.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
#include <stdint.h>

static Vcounter* top;

static const int      RING_SIZE  = 4096;   // 2 のべき乗（& で巻き戻す）
static const int      RING_WORDS = 1;      // ワード/サンプル
static uint32_t       ring[RING_SIZE * RING_WORDS];
static uint32_t       head = 0;            // 書き込んだサンプルの総数（単調増加）

static bool           la_enabled  = true;  // false: ring へ書かない（トリガー判定は継続）
static bool           ring_frozen = false; // true : ring へ書かない（シミュレーションは継続）

// ── トリガー ────────────────────────────────────────────────
// type: 0=off  4=エッジ  6=値一致（06-8080 と同じ番号）
static int       trig_type       = 0;
static int       trig_edge_word  = 0;
static int       trig_edge_bit   = 0;
static int       trig_edge_dir   = 0;      // 0=立ち上がり 1=立ち下がり
static uint32_t  prev_edge_val   = 0;
static int       trig_val_word   = 0;
static uint32_t  trig_val_mask   = 0;
static uint32_t  trig_val_cmp    = 0;
static uint32_t  trig_post_delay = 0;      // 発火後に記録するクロック数
static bool      trig_fired      = false;  // 発火済み（Freeze 前の中間状態を含む）
static bool      trig_hit        = false;  // post delay 消化済み = Freeze 完了
static uint32_t  trig_fire_head  = 0;      // 発火時点の head（赤縦線の位置）

// 現在の出力から 1 サンプル分の word を組み立てる。
static uint32_t sample_word() {
    return ((uint32_t)top->count & 0xFFu) | ((uint32_t)(top->rst & 1u) << 8);
}

static void reset_trigger_state() {
    trig_fired     = false;
    trig_hit       = false;
    trig_fire_head = 0;
    ring_frozen    = false;
}

static uint32_t word_bit(uint32_t w, int bit) { return (w >> bit) & 1u; }

// 1 サンプルを記録し、トリガーを判定する。
static void record_sample() {
    const uint32_t w = sample_word();

    if (!ring_frozen && la_enabled) {
        ring[(head & (RING_SIZE - 1)) * RING_WORDS] = w;
    }
    if (!ring_frozen) head++;

    if (!trig_fired && !ring_frozen) {
        if (trig_type == 4 && trig_edge_word == 0) {
            const uint32_t cur = word_bit(w, trig_edge_bit);
            const bool hit = trig_edge_dir ? (prev_edge_val && !cur) : (!prev_edge_val && cur);
            prev_edge_val = cur;
            if (hit) { trig_fired = true; trig_fire_head = head; }
        } else if (trig_type == 6 && trig_val_word == 0) {
            if ((w & trig_val_mask) == trig_val_cmp) {
                trig_fired = true; trig_fire_head = head;
            }
        }
    }

    // ポストトリガー: 発火後 trig_post_delay クロック記録したら Freeze
    if (trig_fired && !trig_hit && head - trig_fire_head >= trig_post_delay) {
        trig_hit    = true;
        ring_frozen = true;
    }
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

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    if (!top) top = new Vcounter();
    top->clk = 0;
    top->rst = 0;
    top->eval();
    head = 0;
    reset_trigger_state();
    trig_type = 0;
    apply_reset();
}

EMSCRIPTEN_KEEPALIVE void step() {
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    record_sample();
}

// n クロック進める。トリガーで Freeze したらその場で打ち切る。
EMSCRIPTEN_KEEPALIVE void sim_run_n(int n) {
    for (int i = 0; i < n && !trig_hit; i++) step();
}

// カウンタをリセットする。履歴は残し、Freeze とトリガー発火状態だけ解除する。
EMSCRIPTEN_KEEPALIVE void reset_sim() {
    reset_trigger_state();
    prev_edge_val = 0;
    apply_reset();
}

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()   { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_head()       { return head; }
EMSCRIPTEN_KEEPALIVE int       get_ring_size()  { return RING_SIZE; }
EMSCRIPTEN_KEEPALIVE int       get_ring_words() { return RING_WORDS; }

// ── Logic Analyzer 制御 ──────────────────────────────────────
EMSCRIPTEN_KEEPALIVE void sim_freeze_ring() { ring_frozen = true; }
// Thaw はトリガーも再武装する（発火済みのまま残すと直後に再 Freeze されるため）。
EMSCRIPTEN_KEEPALIVE void sim_thaw_ring() {
    reset_trigger_state();
    prev_edge_val = word_bit(sample_word(), trig_edge_bit);
}
EMSCRIPTEN_KEEPALIVE int  sim_ring_frozen() { return ring_frozen ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE void sim_set_la(int on) { la_enabled = (on != 0); }

EMSCRIPTEN_KEEPALIVE void sim_set_post_delay(int n) {
    trig_post_delay = (n > 0) ? (uint32_t)n : 0;
}

EMSCRIPTEN_KEEPALIVE void sim_clear_trigger() {
    trig_type = 0;
    reset_trigger_state();
}

// word: Word インデックス（本ハーネスは 0 のみ）, bit: ビット番号, dir: 0=立ち上がり 1=立ち下がり
EMSCRIPTEN_KEEPALIVE void sim_set_edge_trigger(int word, int bit, int dir) {
    trig_type      = 4;
    trig_edge_word = word;
    trig_edge_bit  = bit & 31;
    trig_edge_dir  = dir ? 1 : 0;
    reset_trigger_state();
    prev_edge_val  = word_bit(sample_word(), trig_edge_bit);  // 設定直後の偽エッジを防ぐ
}

// word: Word インデックス（本ハーネスは 0 のみ）, mask: ビットマスク, cmp: mask 適用後の比較値
EMSCRIPTEN_KEEPALIVE void sim_set_value_trigger(int word, int mask, int cmp) {
    trig_type     = 6;
    trig_val_word = word;
    trig_val_mask = (uint32_t)mask;
    trig_val_cmp  = (uint32_t)cmp & (uint32_t)mask;
    reset_trigger_state();
}

EMSCRIPTEN_KEEPALIVE int sim_trigger_hit()   { return trig_hit   ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE int sim_trigger_fired() { return trig_fired ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE int sim_get_trig_fire_head() {
    return trig_fired ? (int)trig_fire_head : -1;
}

} // extern "C"
