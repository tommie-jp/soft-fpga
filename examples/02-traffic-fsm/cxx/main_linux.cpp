// Linux ネイティブ自己検査: ring・リセット・FSM 遷移・トリガー・歩行者ボタンを確認する。
// 失敗時は理由を stderr に出して非 0 で終了する。

#include <cstdio>
#include <stdint.h>

extern "C" {
    void      sim_init();
    void      step();
    void      sim_run_n(int n);
    void      reset_sim();
    void      press_btn();
    uint32_t  get_head();
    uint32_t* get_ring_ptr();
    int       get_ring_size();
    int       get_ring_words();
    void      sim_thaw_ring();
    int       sim_ring_frozen();
    void      sim_set_post_delay(int n);
    void      sim_set_value_trigger(int word, int mask, int cmp);
    int       sim_trigger_hit();
}

static int failures = 0;
static void check(bool ok, const char* what) {
    if (!ok) { fprintf(stderr, "FAIL: %s\n", what); failures++; }
}
static uint32_t sample_at(uint32_t idx) {
    return get_ring_ptr()[(idx & (get_ring_size() - 1)) * get_ring_words()];
}
static uint32_t last() { return sample_at(get_head() - 1); }
static uint32_t state_of(uint32_t w) { return w & 0x3u; }

int main() {
    // 初期化: rst が 2 サンプル、状態は GREEN
    sim_init();
    check(get_head() == 2, "init records 2 reset samples");
    check((sample_at(0) & 0x80) && (sample_at(1) & 0x80), "rst bit set during reset");
    check(state_of(last()) == 0 && (last() & 0x4), "GREEN with green lamp on after reset");

    // 500 クロック弱は GREEN のまま
    for (int i = 0; i < 400; i++) step();
    check(state_of(last()) == 0, "stays GREEN for 400 clocks");

    // 値トリガー: state == YELLOW(1) で停止
    sim_set_post_delay(0);
    sim_set_value_trigger(0, 0x3, 0x1);
    sim_run_n(2000);
    check(sim_trigger_hit() && sim_ring_frozen(), "state==YELLOW trigger freezes");
    check(state_of(last()) == 1 && (last() & 0x8), "YELLOW with yellow lamp on");

    // Thaw 直後は、同じ条件が続いていても再発火しない。条件を抜けて入り直したとき発火する
    sim_thaw_ring();
    step();
    check(!sim_trigger_hit() && !sim_ring_frozen(), "value trigger does not re-fire while condition still holds");
    uint32_t first_hit = get_head();
    sim_run_n(3000);
    check(sim_trigger_hit() && state_of(last()) == 1 && get_head() - first_hit > 100,
          "re-fires on the next entry into YELLOW");

    // ボタンなしで YELLOW → RED
    sim_thaw_ring();
    sim_set_value_trigger(0, 0x3, 0x2);
    sim_run_n(2000);
    check(sim_trigger_hit() && state_of(last()) == 2, "YELLOW -> RED without button");

    // ボタンあり: GREEN 中に押すと YELLOW 後に WALK へ
    reset_sim();
    check(!sim_ring_frozen(), "reset thaws ring");
    for (int i = 0; i < 10; i++) step();
    press_btn();
    step();
    check(last() & 0x40, "btn_req latched after press_btn");
    sim_set_value_trigger(0, 0x3, 0x3);
    sim_run_n(3000);
    check(sim_trigger_hit() && state_of(last()) == 3 && (last() & 0x20), "button -> WALK with walk lamp");

    if (failures) { fprintf(stderr, "%d check(s) failed\n", failures); return 1; }
    printf("OK: all checks passed (head=%u)\n", get_head());
    return 0;
}
