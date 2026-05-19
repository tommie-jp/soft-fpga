/*
 * sort.c -- bubble sort vs insertion sort cycle benchmark
 *
 * N=16: worst case ~8000 T, fits in 16-bit int (N=32 overflows).
 *
 * Compile: CC CYCL.C, CC SORT.C, CLINK SORT CYCL
 */

#include "cycl.h"

#define N 16

char data[N];
char work[N];

fill_reverse()
{
    int i;
    for (i = 0; i < N; i++)
        work[i] = N - 1 - i;
}

fill_random()
{
    int i;
    char v;
    v = 42;
    for (i = 0; i < N; i++) {
        v = v * 109 + 89;
        work[i] = v;
    }
}

copy_in()
{
    int i;
    for (i = 0; i < N; i++)
        data[i] = work[i];
}

bubble_sort(a, n)
char *a;
int n;
{
    int i, j;
    char tmp;
    for (i = 0; i < n - 1; i++)
        for (j = 0; j < n - 1 - i; j++)
            if ((a[j] & 0xFF) > (a[j+1] & 0xFF)) {
                tmp    = a[j];
                a[j]   = a[j+1];
                a[j+1] = tmp;
            }
}

insertion_sort(a, n)
char *a;
int n;
{
    int i, j;
    char key;
    for (i = 1; i < n; i++) {
        key = a[i];
        j   = i - 1;
        while (j >= 0 && (a[j] & 0xFF) > (key & 0xFF)) {
            a[j+1] = a[j];
            j--;
        }
        a[j+1] = key;
    }
}

run_bench(label, fn, input)
char *label;
int (*fn)();
int input;
{
    int t0, t1;
    if (input == 0) fill_reverse(); else fill_random();
    copy_in();
    cycl_reset();
    t0 = cycl_read();
    (*fn)(data, N);
    t1 = cycl_read();
    printf("  %-20s: %d T\n", label, t1 - t0);
}

main()
{
    printf("=== Sort Benchmark  N=%d ===\n\n", N);

    printf("Worst case (reverse):\n");
    run_bench("bubble sort",    bubble_sort,    0);
    run_bench("insertion sort", insertion_sort, 0);

    printf("\nRandom data:\n");
    run_bench("bubble sort",    bubble_sort,    1);
    run_bench("insertion sort", insertion_sort, 1);
}
