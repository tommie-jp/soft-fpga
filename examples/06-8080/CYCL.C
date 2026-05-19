/*
 * cycl.c -- T-state counter for soft-FPGA CP/M simulator
 *
 * BDS C 1.60 has no "long" type: 16-bit int only (max 65535 T).
 *
 * Compile once:  CC CYCL.C
 * Link with:     CLINK myprog CYCL
 */

cycl_read()
{
    int lo, hi;
    lo = inp(0x30);   /* latch counter, read byte 0 */
    hi = inp(0x31);   /* read byte 1 */
    return (hi << 8) | lo;
}

freq_mhz()
{
    int lo, hi;
    lo = inp(0x34);   /* total MHz bits 0-7 */
    hi = inp(0x35);   /* total MHz bits 8-15 */
    return (hi << 8) | lo;
}

freq_khz()
{
    return inp(0x36);   /* kHz fraction 0-999 */
}

freq_hz()
{
    return inp(0x37);   /* Hz fraction 0-999 */
}
