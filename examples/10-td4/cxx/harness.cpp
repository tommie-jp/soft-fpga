// 10-td4 ハーネス — TD4 を駆動し、波形を ring buffer へ記録する。
//
// ROM はここに置く (16 番地 × 8 ビット)。クロックの後に PC が変わったら、ROM[PC] を rom_data に与えて
// もう一度 eval し、組合せ回路 (デコーダ・セレクタ・加算器) を落ち着かせてから記録する。
// だから 1 サンプルは「クロックの後の状態」と「その状態で次のクロックが何をするか」を表す。
//
// ring buffer ビットレイアウト（1 サンプル = 2 word）:
//   word0 bits[ 3: 0] = pc
//         bits[ 7: 4] = out_port
//         bits[11: 8] = reg_a
//         bits[15:12] = reg_b
//         bits[23:16] = op      (ROM[pc] = いまの命令)
//         bit [   24] = c_flag  (1 で桁上げあり)
//         bit [   25] = rst
//         bits[29:26] = in_port
//   word1 bits[ 1: 0] = sel     (0=A 1=B 2=IN 3=0)
//         bit [    2] = load_a
//         bit [    3] = load_b
//         bit [    4] = load_out
//         bit [    5] = load_pc
//         bits[ 9: 6] = alu_out (次のクロックで書く値)
//         bit [   10] = alu_carry
//
// 記録・Freeze・トリガーは cxx/rtlscope_ring.h が担当する。

#include "Vtd4_top.h"
#include "verilated.h"
#include "../../../cxx/rtlscope_ring.h"

static Vtd4_top* top;
static rtlscope::Ring<4096, 2> ring;

static const int ROM_SIZE = 16;
static const uint8_t IN_DEFAULT = 0xA;   // 教科書 11-2 と同じ 1010 (画面のスイッチで替える)

// 教科書 11-2 のプログラム。12 種類の命令を全部 1 回は通り、15 クロックで 1 巡する
static const uint8_t ROM_DEFAULT[ROM_SIZE] = {
    0x35, 0x40, 0x03, 0x5C, 0xE0, 0x20, 0x10, 0x60,
    0x90, 0x79, 0xB6, 0x3E, 0x01, 0xEF, 0xBF, 0xF0,
};

static uint8_t  rom[ROM_SIZE];
static uint32_t cur[2];   // いまの状態 (記録していなくても画面に出せるように持つ)

static void pack_state() {
    cur[0] = ((uint32_t)top->pc       & 0xFu)
           | ((uint32_t)top->out_port & 0xFu) << 4
           | ((uint32_t)top->reg_a    & 0xFu) << 8
           | ((uint32_t)top->reg_b    & 0xFu) << 12
           | ((uint32_t)top->rom_data & 0xFFu) << 16
           | ((uint32_t)top->c_flag   & 0x1u) << 24
           | ((uint32_t)top->rst      & 0x1u) << 25
           | ((uint32_t)top->in_port  & 0xFu) << 26;
    cur[1] = ((uint32_t)top->sel       & 0x3u)
           | ((uint32_t)top->load      & 0xFu) << 2
           | ((uint32_t)top->alu_out   & 0xFu) << 6
           | ((uint32_t)top->alu_carry & 0x1u) << 10;
}

// ROM[pc] を与えて組合せ回路を落ち着かせ、いまの状態を詰め直す
static void settle() {
    top->rom_data = rom[top->pc & 0xFu];
    top->eval();
    pack_state();
}

static void clock_once() {
    top->clk = 0; settle();
    top->clk = 1; top->eval();   // ここでレジスタと PC が変わる
    settle();
    ring.record(cur);
}

// rst を 2 クロック保持してリセットする。リセット区間も波形に残す。
static void apply_reset() {
    top->rst = 1;
    for (int i = 0; i < 2; i++) clock_once();
    top->clk = 0;
    top->rst = 0;
    settle();
}

RTLSCOPE_EXPORT_RING(ring)

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    if (!top) top = new Vtd4_top();
    for (int i = 0; i < ROM_SIZE; i++) rom[i] = ROM_DEFAULT[i];
    top->rst = 0; top->clk = 0;
    top->in_port = IN_DEFAULT;
    settle();
    ring.start_session();
    apply_reset();
}

EMSCRIPTEN_KEEPALIVE void step() {
    clock_once();
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

// ROM の 1 番地を書き換える。いまの PC の命令が替わったら、組合せ回路の出口もすぐ替わる
EMSCRIPTEN_KEEPALIVE void set_rom(int addr, int data) {
    if (addr < 0 || addr >= ROM_SIZE) return;
    rom[addr] = (uint8_t)(data & 0xFF);
    settle();
}

EMSCRIPTEN_KEEPALIVE int get_rom(int addr) {
    if (addr < 0 || addr >= ROM_SIZE) return -1;
    return rom[addr];
}

// 入力ポート (4 ビット) を替える
EMSCRIPTEN_KEEPALIVE void set_in(int v) {
    top->in_port = (uint8_t)(v & 0xF);
    settle();
}

// いまの状態 (ring と同じビットの並び)
EMSCRIPTEN_KEEPALIVE uint32_t get_state(int word) {
    return (word == 1) ? cur[1] : cur[0];
}

} // extern "C"
