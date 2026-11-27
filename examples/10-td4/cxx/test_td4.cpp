// test_td4.cpp — 10-td4 のハーネスをネイティブで回し、命令表の模型と 1 クロックずつ突き合わせる。
//
// ブラウザと同じ関数 (sim_init / step / set_rom / set_in / reset_sim / get_state) を呼ぶ。
// 実行: scripts/test-td4.sh
#include <cstdint>
#include <cstdio>

extern "C" {
void     sim_init();
void     step();
void     reset_sim();
void     set_rom(int addr, int data);
void     set_in(int v);
uint32_t get_state(int word);
uint32_t* get_ring_ptr();
int      get_ring_size();
int      get_ring_words();
uint32_t get_head();
}

namespace {

int g_fail = 0;

void check(bool ok, const char* what) {
    if (!ok) {
        g_fail++;
        std::printf("  FAIL: %s\n", what);
    }
}

// 命令表の模型 (TD4 の 12 命令)。s は実行前の状態、code はその PC の命令
struct State { unsigned pc = 0, a = 0, b = 0, out = 0, c = 0; };

struct Decode { unsigned sel, load, alu, carry; };

// 命令 code を状態 s で実行する直前の、デコーダ・セレクタ・加算器の出口
Decode decode(const State& s, uint8_t code, unsigned in) {
    const unsigned op = code >> 4, im = code & 15u, dst = op >> 2;
    const unsigned sel = (dst == 3) ? 3 : (op & 3u);
    const unsigned x = sel == 0 ? s.a : sel == 1 ? s.b : sel == 2 ? in : 0;
    const unsigned r = x + im;
    unsigned load = 0;
    if (dst == 0) load = 1;                                     // A
    if (dst == 1) load = 2;                                     // B
    if (dst == 2) load = 4;                                     // OUT
    if (dst == 3 && ((op & 1u) || !s.c)) load = 8;              // JMP か、桁上げ無しの JNC
    return Decode{sel, load, r & 15u, (r >> 4) & 1u};
}

State execute(const State& s, uint8_t code, unsigned in) {
    const Decode d = decode(s, code, in);
    State n = s;
    n.pc = (s.pc + 1) & 15u;
    if (d.load & 1u) n.a = d.alu;
    if (d.load & 2u) n.b = d.alu;
    if (d.load & 4u) n.out = d.alu;
    if (d.load & 8u) n.pc = d.alu;
    n.c = d.carry;
    return n;
}

// いまの状態が模型と合うか (word0 のレジスタと word1 のデコード結果の両方)
bool matches(const State& s, const uint8_t* rom, unsigned in) {
    const uint32_t w0 = get_state(0), w1 = get_state(1);
    const uint8_t code = rom[s.pc];
    const Decode d = decode(s, code, in);
    return (w0 & 15u) == s.pc && ((w0 >> 4) & 15u) == s.out && ((w0 >> 8) & 15u) == s.a
        && ((w0 >> 12) & 15u) == s.b && ((w0 >> 16) & 0xFFu) == code && ((w0 >> 24) & 1u) == s.c
        && ((w0 >> 26) & 15u) == in
        && (w1 & 3u) == d.sel && ((w1 >> 2) & 15u) == d.load && ((w1 >> 6) & 15u) == d.alu
        && ((w1 >> 10) & 1u) == d.carry;
}

void load_rom(const uint8_t* rom) {
    for (int i = 0; i < 16; i++) set_rom(i, rom[i]);
}

// 1. 既定のプログラム (教科書 11-2) を 3 巡回し、毎クロック模型と比べる
void test_default_program() {
    std::printf("[1] 既定のプログラム (11-2) を 45 クロック\n");
    static const uint8_t ROM[16] = {0x35, 0x40, 0x03, 0x5C, 0xE0, 0x20, 0x10, 0x60,
                                    0x90, 0x79, 0xB6, 0x3E, 0x01, 0xEF, 0xBF, 0xF0};
    sim_init();
    State s;
    check(matches(s, ROM, 0xA), "リセット直後が PC=0・レジスタ 0");
    int bad = 0, e_runs = 0, wraps = 0;
    for (int n = 1; n <= 45; n++) {
        if (s.pc == 0xE) e_runs++;
        s = execute(s, ROM[s.pc], 0xA);
        step();
        if (!matches(s, ROM, 0xA)) {
            bad++;
            std::printf("  step %d: 食い違い (word0=%08X word1=%08X)\n", n, get_state(0), get_state(1));
        }
        if (s.pc == 0) wraps++;
    }
    check(bad == 0, "45 クロックすべてが模型と一致");
    check(e_runs == 0, "番地 E (OUT 1111) は跳び越されて実行されない");
    check(wraps == 3, "15 クロックで 1 巡する (45 クロックで PC が 0 に 3 回戻る)");

    // ring にも同じ値が残っている (リセットの 2 サンプル + 45 サンプル)
    check(get_head() == 47u, "ring に 47 サンプル記録されている");
    const uint32_t* ring = get_ring_ptr();
    const int words = get_ring_words();
    const uint32_t last = ring[((get_head() - 1) & (uint32_t)(get_ring_size() - 1)) * (uint32_t)words];
    check(last == get_state(0), "ring の最後のサンプルが get_state(0) と同じ");
    check(((ring[0] >> 25) & 1u) == 1u, "最初のサンプルは rst=1");
}

// 2. ROM を書き換えて LED の点き方のプログラム (教科書 6 の led.s) を回す
void test_led_program() {
    std::printf("[2] ROM を書き換える (led.s)\n");
    static const uint8_t ROM[16] = {0xB3, 0xB6, 0xBC, 0xB8, 0xB8, 0xBC, 0xB6, 0xB3,
                                    0xB1, 0xF0, 0, 0, 0, 0, 0, 0};
    static const unsigned OUTS[9] = {3, 6, 12, 8, 8, 12, 6, 3, 1};
    sim_init();
    load_rom(ROM);
    reset_sim();
    int bad = 0;
    for (int lap = 0; lap < 2; lap++) {
        for (int i = 0; i < 9; i++) {
            step();
            if (((get_state(0) >> 4) & 15u) != OUTS[i]) bad++;
        }
        step();   // JMP start
        if ((get_state(0) & 15u) != 0u) bad++;
    }
    check(bad == 0, "OUT が 0011 0110 1100 1000 1000 1100 0110 0011 0001 の順に出て頭に戻る");
}

// 3. 入力ポートを替えると IN A の結果が替わる
void test_input_port() {
    std::printf("[3] 入力ポートを替える\n");
    static const uint8_t ROM[16] = {0x20, 0x41, 0xF0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    sim_init();
    load_rom(ROM);
    set_in(0x5);
    reset_sim();
    check(((get_state(1) >> 6) & 15u) == 5u, "IN A の加算器の出口がすぐ 5 になる (クロック前)");
    step();   // IN A
    check(((get_state(0) >> 8) & 15u) == 5u, "IN=0101 で A=5");
    step();   // MOV B,A + 1 (0x41)
    check(((get_state(0) >> 12) & 15u) == 6u, "MOV B,A に即値 1 を足して B=6");
    step();   // JMP 0
    set_in(0xF);
    step();   // IN A
    check(((get_state(0) >> 8) & 15u) == 15u, "IN=1111 に替えると A=15");
}

// 4. JNC は桁上げのあったクロックの次だけ跳ばない (timer.s)
void test_jnc_timer() {
    std::printf("[4] JNC で桁上げを見分ける (timer.s)\n");
    static const uint8_t ROM[16] = {0x90, 0x51, 0xE0, 0xBF, 0xF4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    sim_init();
    load_rom(ROM);
    reset_sim();
    State s;
    int bad = 0;
    for (int n = 0; n < 60; n++) {
        s = execute(s, ROM[s.pc], 0xA);
        step();
        if (!matches(s, ROM, 0xA)) bad++;
    }
    check(bad == 0, "60 クロックすべてが模型と一致");
    check((get_state(0) & 15u) == 4u && ((get_state(0) >> 4) & 15u) == 15u, "B が 15 を越えたら OUT=1111 で番地 4 に止まる");
}

}  // namespace

int main() {
    test_default_program();
    test_led_program();
    test_input_port();
    test_jnc_timer();
    std::printf("%s (失敗 %d)\n", g_fail ? "FAIL" : "PASS", g_fail);
    return g_fail ? 1 : 0;
}
