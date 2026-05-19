/*
 * bench.c -- 8080 I/O and memory operation benchmark
 *
 * Compile: CC CYCL.C, CC BENCH.C, CLINK BENCH CYCL
 *
 * BDS C 1.60: identifiers significant to 8 chars.
 * N=500 keeps all measurements within 16-bit int (< 65535 T).
 *
 * I/O port 0x10 = disk status (read-only, safe to call repeatedly).
 * IN/OUT = 10 T each.
 */

#include "cycl.h"

#define N 100

int base;

char mbuf[8];

bm_in4()
{
    int i, t0, t1, per;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++) {
        inp(0x10);
        inp(0x10);
        inp(0x10);
        inp(0x10);
    }
    t1 = cycl_read();
    per = (t1 - t0) / N - base;
    printf("  4x IN           : %d T extra (exp 40)\n", per);
}

bm_out4()
{
    int i, t0, t1, per;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++) {
        outp(0x10, 0);
        outp(0x10, 0);
        outp(0x10, 0);
        outp(0x10, 0);
    }
    t1 = cycl_read();
    per = (t1 - t0) / N - base;
    printf("  4x OUT          : %d T extra (exp 40)\n", per);
}

bm_mrd4()
{
    int i, t0, t1, per;
    char v;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++) {
        v = mbuf[0];
        v = mbuf[1];
        v = mbuf[2];
        v = mbuf[3];
    }
    t1 = cycl_read();
    per = (t1 - t0) / N - base;
    printf("  4x mem rd       : %d T extra (exp ~28)\n", per);
}

bm_mwr4()
{
    int i, t0, t1, per;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++) {
        mbuf[0] = 0;
        mbuf[1] = 0;
        mbuf[2] = 0;
        mbuf[3] = 0;
    }
    t1 = cycl_read();
    per = (t1 - t0) / N - base;
    printf("  4x mem wr       : %d T extra (exp ~28)\n", per);
}

bm_add8()
{
    int i, t0, t1, per, a;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++) {
        a = a + 1; a = a + 1; a = a + 1; a = a + 1;
        a = a + 1; a = a + 1; a = a + 1; a = a + 1;
    }
    t1 = cycl_read();
    per = (t1 - t0) / N - base;
    printf("  8x int add      : %d T extra (exp ~32)\n", per);
}

dummy()
{
}

bm_call()
{
    int i, t0, t1, per;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++) {
        dummy();
    }
    t1 = cycl_read();
    per = (t1 - t0) / N - base;
    printf("  C func call     : %d T extra (exp ~27)\n", per);
}

main()
{
    int i, t0, t1;
    printf("=== 8080 Benchmark  N=%d ===\n\n", N);

    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++)
        ;
    t1 = cycl_read();
    base = (t1 - t0) / N;
    printf("Loop base: %d T/iter\n\n", base);

    bm_in4();
    bm_out4();
    bm_mrd4();
    bm_mwr4();
    bm_add8();
    bm_call();
}
