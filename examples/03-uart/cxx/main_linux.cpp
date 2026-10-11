// Linux ネイティブ自己検査: UART ループバック・ring・トリガー・リセットを確認する。
// 失敗時は理由を stderr に出して非 0 で終了する。

#include <cstdio>
#include <stdint.h>

extern "C" {
    void      sim_init();
    void      step();
    void      sim_run_n(int n);
    void      reset_sim();
    void      send_byte(uint8_t b);
    uint8_t   get_rx_data();
    uint32_t  get_rx_valid_count();
    uint32_t  get_head();
    uint32_t* get_ring_ptr();
    int       get_ring_size();
    int       get_ring_words();
    void      sim_thaw_ring();
    int       sim_ring_frozen();
    void      sim_set_post_delay(int n);
    void      sim_set_edge_trigger(int word, int bit, int dir);
    int       sim_trigger_hit();
}

static int failures = 0;
static void check(bool ok, const char* what) {
    if (!ok) { fprintf(stderr, "FAIL: %s\n", what); failures++; }
}
// word: 0 または 1
static uint32_t sample_at(uint32_t idx, int word) {
    return get_ring_ptr()[(idx & (get_ring_size() - 1)) * get_ring_words() + word];
}

int main() {
    sim_init();
    check(get_ring_words() == 2, "ring has 2 words per sample");
    check(get_head() == 2, "init records 2 reset samples");
    check((sample_at(0, 1) & 1) && (sample_at(1, 1) & 1), "rst bit (word1) set during reset");

    // ループバック: 'H' を送ると 1 フレーム (10bit * 16clk) 後に受信される
    send_byte('H');
    sim_set_post_delay(0);
    sim_set_edge_trigger(0, 4, 0);          // rx_valid の立ち上がりで停止
    sim_run_n(1000);
    check(sim_trigger_hit() && sim_ring_frozen(), "rx_valid rising edge freezes");
    check(get_rx_valid_count() == 1 && get_rx_data() == 'H', "loopback delivers 'H'");
    uint32_t w = sample_at(get_head() - 1, 0);
    check(((w >> 24) & 0xFF) == 'H', "rx_data in ring is 'H' at trigger");
    check((w >> 4) & 1, "rx_valid set at trigger sample");

    // 送信中の tx_state が START/DATA/STOP を取っていること
    bool seen[4] = {false, false, false, false};
    for (uint32_t i = 0; i < get_head(); i++) seen[(sample_at(i, 0) >> 6) & 3] = true;
    check(seen[1] && seen[2] && seen[3], "tx_state visits START, DATA and STOP");

    // Thaw で再開し、リセットで履歴が残ること
    sim_thaw_ring();
    check(!sim_ring_frozen(), "thaw unfreezes");
    uint32_t before = get_head();
    reset_sim();
    check(get_head() == before + 2, "reset appends 2 rst samples");
    check(get_rx_valid_count() == 0, "reset clears rx count");

    if (failures) { fprintf(stderr, "%d check(s) failed\n", failures); return 1; }
    printf("OK: all checks passed (head=%u)\n", get_head());
    return 0;
}
