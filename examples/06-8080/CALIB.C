/*
 * calib.c -- cycle counter calibration  Ver. 0.10
 *
 * Compile: CC CYCL.C, CC CALIB.C, CLINK CALIB CYCL
 *
 * BDS C 1.60: identifiers significant to 8 chars only.
 * do_empty must NOT return a value -- using global base_per instead.
 * (return value changes BDS C's calling convention, adding loop overhead)
 */

#include "cycl.h"

#define N 100

int base_per;

do_ovhd()
{
    int t0, t1;
    cycl_reset();
    t0 = cycl_read();
    t1 = cycl_read();
    printf("overhead   t0=%-6d t1=%-6d diff=%d T\n", t0, t1, t1 - t0);
}

do_empty()
{
    int i, t0, t1;
    cycl_reset();
    t0 = cycl_read();
    for (i = 0; i < N; i++)
        ;
    t1 = cycl_read();
    base_per = (t1 - t0) / N;
    printf("empty %dx  t0=%-6d t1=%-6d diff=%d T  (%d T/iter)\n",
           N, t0, t1, t1 - t0, base_per);
}

do_in()
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
    per = (t1 - t0) / N;
    printf("4x IN %dx  t0=%-6d t1=%-6d diff=%d T  (%d T/iter)\n",
           N, t0, t1, t1 - t0, per);
    printf("  => +%d T/iter vs empty (~40 expected)\n", per - base_per);
}

main()
{
    printf("=== Cycle Counter Calibration  Ver. 0.10 ===\n\n");
    do_ovhd();
    do_empty();
    do_in();
}
