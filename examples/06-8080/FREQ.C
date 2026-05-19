/*
 * freq.c -- equivalent clock frequency measurement
 *
 * BDS C 1.60: no float. Hz shown as MHz,kHz,Hz integer triple.
 *
 * Compile: CC CYCL.C, CC FREQ.C, CLINK FREQ CYCL
 */

#include "cycl.h"

#define N 5000

pr_hz(mhz, khz, hz)
int mhz, khz, hz;
{
    /* Right-align in 16-char field: X,YYY,ZZZ Hz */
    /* mhz > 0: "    8,183,192 Hz" */
    /* mhz = 0: "       86,219 Hz" (suppress leading 0,) */
    if (mhz > 0) {
        if      (mhz <    10) printf("    ");
        else if (mhz <   100) printf("   ");
        else if (mhz <  1000) printf("  ");
        else if (mhz < 10000) printf(" ");
        printf("%d,", mhz);
        if (khz < 100) printf("0");
        if (khz <  10) printf("0");
        printf("%d,", khz);
        if (hz < 100) printf("0");
        if (hz <  10) printf("0");
        printf("%d Hz", hz);
    } else if (khz > 0) {
        if      (khz <   10) printf("        ");
        else if (khz <  100) printf("       ");
        else                  printf("      ");
        printf("%d,", khz);
        if (hz < 100) printf("0");
        if (hz <  10) printf("0");
        printf("%d Hz", hz);
    } else {
        if      (hz <  10) printf("            ");
        else if (hz < 100) printf("           ");
        else               printf("          ");
        printf("%d Hz", hz);
    }
}

main()
{
    int i, mhz, khz, hz, total;
    printf("=== Equivalent Clock Frequency Ver. 0.1.2 ===\n");
    printf("  Measuring : %d-iter loop (~%d kT)\n\n", N, N / 40);
    freq_start();
    for (i = 0; i < N; i++)
        ;
    freq_latch();
    mhz = freq_mhz();
    khz = freq_khz();
    hz  = freq_hz();
    /* total in kHz; cap at 30000 to avoid 16-bit overflow (30*1000=30000) */
    total = (mhz > 30) ? 30000 : mhz * 1000 + khz;
    printf("  Simulated : "); pr_hz(mhz, khz, hz); printf("\n");
    printf("  Real 8080A: "); pr_hz(2, 0, 0);       printf("\n");
    /* pct = total_kHz / 20  (== total_kHz * 100 / 2000) */
    if (total > 0)
        printf("  vs 8080A  : %d%%\n", total / 20);
    else
        printf("  vs 8080A  : <1%%\n");
}
