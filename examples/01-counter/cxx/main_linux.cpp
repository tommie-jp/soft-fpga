// Linux ネイティブ自己検査: ring buffer・リセット・トリガー・Freeze の挙動を確認する。
// 失敗時は理由を stderr に出して非 0 で終了する。

#include <cstdio>
#include <stdint.h>

extern "C" {
    void      sim_init();
    void      step();
    void      sim_run_n(int n);
    void      reset_sim();
    uint32_t  get_head();
    uint32_t* get_ring_ptr();
    int       get_ring_size();
    int       get_ring_words();
    void      sim_freeze_ring();
    void      sim_thaw_ring();
    int       sim_ring_frozen();
    void      sim_set_la(int on);
    void      sim_set_post_delay(int n);
    void      sim_clear_trigger();
    void      sim_set_edge_trigger(int word, int bit, int dir);
    void      sim_set_value_trigger(int word, int mask, int cmp);
    int       sim_trigger_hit();
    int       sim_trigger_fired();
    int       sim_get_trig_fire_head();
}

static int failures = 0;

static void check(bool ok, const char* what) {
    if (!ok) { fprintf(stderr, "FAIL: %s\n", what); failures++; }
}

static uint32_t sample_at(uint32_t idx) {
    return get_ring_ptr()[(idx & (get_ring_size() - 1)) * get_ring_words()];
}

int main() {
    // 初期化直後: rst=1 が 2 サンプル記録される
    sim_init();
    check(get_head() == 2, "init records 2 reset samples");
    check((sample_at(0) & 0x100) && (sample_at(1) & 0x100), "rst bit set during reset");
    check((sample_at(0) & 0xFF) == 0, "count is 0 during reset");

    // 100 クロック後のカウント値
    for (int i = 0; i < 100; i++) step();
    check(get_head() == 102, "head advances per step");
    check((sample_at(101) & 0xFF) == 100, "count after 100 steps");
    check(!(sample_at(101) & 0x100), "rst low while running");

    // 値トリガー: count == 0x80 で発火し、post=0 で即 Freeze
    sim_set_post_delay(0);
    sim_set_value_trigger(0, 0xFF, 0x80);
    sim_run_n(1000);
    check(sim_trigger_hit() && sim_ring_frozen(), "value trigger freezes");
    check((sample_at(get_head() - 1) & 0xFF) == 0x80, "frozen on count==0x80");
    check(sim_get_trig_fire_head() == (int)get_head(), "fire head equals head at fire");
    uint32_t frozen_head = get_head();
    step();
    check(get_head() == frozen_head, "ring does not advance while frozen");

    // Thaw で再武装: 直後に再 Freeze されず、次の 0x80 まで走る
    sim_thaw_ring();
    check(!sim_ring_frozen(), "thaw unfreezes");
    step();
    check(!sim_ring_frozen(), "thaw does not refreeze immediately");
    sim_run_n(1000);
    check(sim_trigger_hit() && (sample_at(get_head() - 1) & 0xFF) == 0x80, "re-armed trigger fires on next match");

    // LA OFF → ON: OFF 区間に残った古いサンプルは消える（偽の波形を見せない）
    sim_clear_trigger();
    for (int i = 0; i < 40; i++) step();
    sim_set_la(0);
    uint32_t off_start = get_head();
    for (int i = 0; i < 20; i++) step();
    sim_set_la(1);
    bool stale = false;
    for (uint32_t i = off_start; i < get_head(); i++) if (sample_at(i) != 0) stale = true;
    check(!stale, "LA OFF span is blank after re-enable");
    sim_set_value_trigger(0, 0xFF, 0x10);   // 次の post delay 検査のために戻す
    sim_thaw_ring();

    // post delay: 発火後 16 クロック記録してから Freeze
    sim_thaw_ring();
    sim_set_post_delay(16);
    sim_set_value_trigger(0, 0xFF, 0x10);
    sim_run_n(1000);
    check(sim_trigger_hit(), "post-delay trigger freezes");
    check((int)get_head() - sim_get_trig_fire_head() == 16, "records 16 samples after fire");

    // エッジトリガー: b7 立ち上がり
    sim_clear_trigger();
    sim_set_post_delay(0);
    sim_set_edge_trigger(0, 7, 0);
    sim_run_n(1000);
    check(sim_trigger_hit(), "edge trigger freezes");
    check((sample_at(get_head() - 1) & 0xFF) == 0x80, "b7 rising edge at count==0x80");

    // リセット: 履歴を保持し、Freeze を解除し、count=0 に戻る
    uint32_t before = get_head();
    reset_sim();
    check(!sim_ring_frozen(), "reset thaws ring");
    check(get_head() == before + 2, "reset appends 2 rst samples");
    check((sample_at(get_head() - 1) & 0x100) != 0, "rst sample recorded");
    step();
    check((sample_at(get_head() - 1) & 0xFF) == 1, "count restarts at 1 after reset");

    if (failures) { fprintf(stderr, "%d check(s) failed\n", failures); return 1; }
    printf("OK: all checks passed (head=%u)\n", get_head());
    return 0;
}
