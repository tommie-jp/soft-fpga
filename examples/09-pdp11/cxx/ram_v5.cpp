// ram_v5.cpp — Brad Parker ram.cpp を Verilator 5.x svLogicVecVal* 署名に適合させた版。

#include <stdint.h>  // uint8_t — svdpi.h より前に必要
#include "svdpi.h"

#include <stdio.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

static unsigned char ram_h[262144];
static unsigned char ram_l[262144];
static int last_r_v, last_w_v;

void dpi_ram(const svLogicVecVal* a, const svLogicVecVal* r,
             const svLogicVecVal* w, const svLogicVecVal* u,
             const svLogicVecVal* l, const svLogicVecVal* in,
             svLogicVecVal* out)
{
    int av = (int)a->aval;
    int rv = (int)r->aval;
    int wv = (int)w->aval;
    int uv = (int)u->aval;
    int lv = (int)l->aval;
    int iv = (int)in->aval;

    int assert_r = rv && !last_r_v;
    int assert_w = wv && !last_w_v;
    last_r_v = rv; last_w_v = wv;

    int o = 0;
    if (rv) {
        if (uv) o |= ram_h[av] << 8;
        if (lv) o |= ram_l[av];
        (void)assert_r;
    }
    out->aval = (uint32_t)o;
    out->bval = 0;

    if (wv) {
        if (uv) ram_h[av] = iv >> 8;
        if (lv) ram_l[av] = iv;
        (void)assert_w;
    }
}

// ── テスト支援 ───────────────────────────────────────────────────────────────

void ram_clear(void) {
    memset(ram_h, 0, sizeof(ram_h));
    memset(ram_l, 0, sizeof(ram_l));
}

// .mem ファイル（<8進バイトアドレス> <8進ワード値>）を RAM にロードする。
// 戻り値: ロードしたワード数（エラー時 -1）
int ram_load_mem(const char *filename) {
    FILE *f = fopen(filename, "r");
    if (!f) { perror(filename); return -1; }
    char line[64];
    int count = 0;
    while (fgets(line, sizeof(line), f)) {
        const char *p = line;
        while (*p == ' ' || *p == '\t') p++;
        if (*p == '\0' || *p == '\n' || *p == ';' || *p == '/') continue;
        // <octal_byte_addr> <octal_word>
        uint32_t addr = 0;
        while (*p >= '0' && *p <= '7') addr = addr * 8u + (uint32_t)(*p++ - '0');
        while (*p == ' ' || *p == '\t') p++;
        if (*p == '\0' || *p == '\n') continue;
        uint32_t word = 0;
        while (*p >= '0' && *p <= '7') word = word * 8u + (uint32_t)(*p++ - '0');
        // ワードアドレス（PDP-11 は 16bit ワード; 最大 256K ワード = 18bit addr）
        uint32_t wa = (addr >> 1) & 0x1FFFFu;
        ram_l[wa] = (unsigned char)(word & 0xFFu);
        ram_h[wa] = (unsigned char)((word >> 8) & 0xFFu);
        count++;
    }
    fclose(f);
    return count;
}

#ifdef __cplusplus
}
#endif
