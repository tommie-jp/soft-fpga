/* Apple-1 での文字出力（cc65 / llvm-mos 共通） */
#define DSP  (*(volatile unsigned char *)0xD012)
#define DSPCR (*(volatile unsigned char *)0xD013)

void __fastcall__ putch(char c) {
    DSP = c | 0x80;
    while (DSP & 0x80)  /* busy wait */
        ;
}

void main() {
    putch('H');
    putch('e');
    putch('l');
    putch('l');
    putch('o');
    putch(',');
    putch(' ');
    putch('W');
    putch('o');
    putch('r');
    putch('l');
    putch('d');
    putch('!');
}
