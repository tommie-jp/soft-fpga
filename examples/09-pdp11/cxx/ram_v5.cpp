// ram_v5.cpp — Brad Parker ram.cpp を Verilator 5.x svLogicVecVal* 署名に適合させた版。

#include <stdint.h>  // uint8_t — svdpi.h より前に必要
#include "svdpi.h"

#include <stdio.h>

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

#ifdef __cplusplus
}
#endif
