// Linux ネイティブ動作確認用スタブ: 100 サイクル実行して終了する

#include <cstdio>
#include <stdint.h>

extern "C" {
    void     sim_init();
    void     step();
    uint32_t get_head();
}

int main() {
    sim_init();
    for (int i = 0; i < 100; i++) step();
    printf("OK: %u cycles\n", get_head());
    return 0;
}
