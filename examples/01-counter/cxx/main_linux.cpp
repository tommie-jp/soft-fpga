// Linux ネイティブ動作確認用スタブ: 100 サイクル実行して終了する

#include <cstdio>
#include <stdint.h>

extern "C" {
    void     sim_init();
    void     step();
    uint32_t get_head();
    uint32_t* get_ring_ptr();
}

int main() {
    sim_init();
    for (int i = 0; i < 100; i++) step();
    uint32_t h = get_head();
    uint32_t* r = get_ring_ptr();
    printf("OK: %u cycles, last count=%u\n", h, r[(h - 1) & 1023]);
    return 0;
}
