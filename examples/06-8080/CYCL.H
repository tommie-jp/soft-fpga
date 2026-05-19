/*
 * cycl.h -- T-state counter for soft-FPGA CP/M simulator
 *
 * BDS C 1.60: no long type; 16-bit int only (max 65535 T per measurement).
 *
 * I/O ports:
 *   OUT 30h   reset counter to 0
 *   IN  30h   latch + return bits 0-7
 *   IN  31h   return bits 8-15 (from latch)
 *
 * Link with CYCL.C:  CLINK myprog CYCL
 *
 * Usage:
 *   int t0, t1;
 *   cycl_reset();
 *   t0 = cycl_read();
 *   ... code (must complete in < 65535 T) ...
 *   t1 = cycl_read();
 *   printf("cycles: %d\n", t1 - t0);
 */

#define cycl_reset()   outp(0x30, 0)
/* cycl_read() is defined in cycl.c -- returns int (BDS C default) */

/* freq_start(): start wall clock timer (OUT 34h) */
#define freq_start()   outp(0x34, 0)
/* freq_latch(): latch measurement (OUT 38h) -- call before freq_read_* */
#define freq_latch()   outp(0x38, 0)
/* freq_mhz(): total MHz, defined in cycl.c */
/* freq_khz(): kHz fraction 0-999, defined in cycl.c */
/* freq_hz():  Hz fraction 0-999, defined in cycl.c */
