; 8080ex1_cpm.asm — 8080 instruction exerciser (CP/M COM 版)
;
; アセンブラ: z80asm v1.8 (8080 互換命令のみ使用)
; ビルド:    z80asm --output=8080EX1.COM 8080ex1_cpm.asm
;
; CP/M A> プロンプトから 8080EX1 で実行する。
; 全 20 グループをテストし "Tests complete" で終了する。
; 出力フォーマット例:
;   8080 instruction exerciser
;   ld r,n (MVI).................OK
;   ...
;   Tests complete
;
; テストロジックは test/test_all.asm (G01-G20) と同等。
;
; I/O ポート:
;   0x01 OUT - CONOUT: コンソール文字出力

CONOUT:  equ 0x01
SCRATCH: equ 0x3000      ; 作業メモリ (TPA 内、コードと重ならない領域)

    org 0x0100

; ==============================================================
; エントリポイント
; ==============================================================
start:
    ld sp, 0x7F00

    ld hl, msg_header
    call print_str

; ==============================================================
; G01: LD r,n (MVI) — 全 7 レジスタ
; ==============================================================
g01:
    ld hl, msg_g01
    call print_str
    ld a, 0xAA
    cp 0xAA
    jp nz, g01_f
    ld b, 0xBB
    ld a, b
    cp 0xBB
    jp nz, g01_f
    ld c, 0xCC
    ld a, c
    cp 0xCC
    jp nz, g01_f
    ld d, 0xDD
    ld a, d
    cp 0xDD
    jp nz, g01_f
    ld e, 0xEE
    ld a, e
    cp 0xEE
    jp nz, g01_f
    ld h, 0x30
    ld a, h
    cp 0x30
    jp nz, g01_f
    ld l, 0x01
    ld a, l
    cp 0x01
    jp nz, g01_f
    ld hl, msg_ok
    call print_str
    jp g02
g01_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G02: LD r,r (MOV) — 全レジスタ間
; ==============================================================
g02:
    ld hl, msg_g02
    call print_str
    ld a, 0x5A
    ld b, a
    ld c, b
    ld d, c
    ld e, d
    ld h, e
    ld l, h
    ld a, l
    cp 0x5A
    jp nz, g02_f
    ld b, 0x3C
    ld c, b
    ld d, b
    ld e, b
    ld h, b
    ld l, b
    ld a, b
    cp 0x3C
    jp nz, g02_f
    ld a, c
    cp 0x3C
    jp nz, g02_f
    ld a, d
    cp 0x3C
    jp nz, g02_f
    ld a, e
    cp 0x3C
    jp nz, g02_f
    ld a, h
    cp 0x3C
    jp nz, g02_f
    ld a, l
    cp 0x3C
    jp nz, g02_f
    ld hl, msg_ok
    call print_str
    jp g03
g02_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G03: LXI + PUSH/POP 全 4 ペア (BC/DE/HL/AF)
; ==============================================================
g03:
    ld hl, msg_g03
    call print_str
    ; BC
    ld bc, 0x1234
    push bc
    ld bc, 0x0000
    pop bc
    ld a, b
    cp 0x12
    jp nz, g03_f
    ld a, c
    cp 0x34
    jp nz, g03_f
    ; DE
    ld de, 0x5678
    push de
    ld de, 0x0000
    pop de
    ld a, d
    cp 0x56
    jp nz, g03_f
    ld a, e
    cp 0x78
    jp nz, g03_f
    ; HL
    ld hl, 0x9ABC
    push hl
    ld hl, 0x0000
    pop hl
    ld a, h
    cp 0x9A
    jp nz, g03_f
    ld a, l
    cp 0xBC
    jp nz, g03_f
    ; AF
    ld a, 0x00
    scf
    ld a, 0x01
    push af
    ld a, 0x00
    scf
    ccf
    pop af
    cp 0x01
    jp nz, g03_f
    ld hl, msg_ok
    call print_str
    jp g04
g03_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G04: EX DE,HL / XTHL / PCHL / SPHL
; ==============================================================
g04:
    ld hl, msg_g04
    call print_str
    ; EX DE,HL (XCHG)
    ld hl, 0x1111
    ld de, 0x2222
    ex de, hl
    ld a, h
    cp 0x22
    jp nz, g04_f
    ld a, d
    cp 0x11
    jp nz, g04_f
    ; XTHL: (SP) ↔ HL
    ld hl, 0xABCD
    push hl
    ld hl, 0x1234
    ex (sp), hl
    ld a, h
    cp 0xAB
    jp nz, g04_f
    ld a, l
    cp 0xCD
    jp nz, g04_f
    pop hl
    ; LD SP,HL (SPHL) + ADD HL,SP (DAD SP) で検証
    ld hl, 0x6789
    ld sp, hl
    ld hl, 0x0000
    add hl, sp
    ld sp, 0x7F00
    ld a, h
    cp 0x67
    jp nz, g04_f
    ld a, l
    cp 0x89
    jp nz, g04_f
    ; PCHL (JP HL)
    ld hl, g04_pchl_ok
    jp (hl)
    jp g04_f
g04_pchl_ok:
    ld hl, msg_ok
    call print_str
    jp g05
g04_f:
    ld sp, 0x7F00
    ld hl, msg_fail
    call print_str

; ==============================================================
; G05: ADD A,r 全 8 ソース + ADI
; ==============================================================
g05:
    ld hl, msg_g05
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x07
    ld b, 0x01
    ld c, 0x02
    ld d, 0x03
    ld e, 0x04
    ld a, 0x10
    add a, b
    cp 0x11
    jp nz, g05_f
    ld a, 0x10
    add a, c
    cp 0x12
    jp nz, g05_f
    ld a, 0x10
    add a, d
    cp 0x13
    jp nz, g05_f
    ld a, 0x10
    add a, e
    cp 0x14
    jp nz, g05_f
    ld hl, SCRATCH
    ld a, 0x10
    add a, h
    cp 0x40
    jp nz, g05_f
    ld hl, SCRATCH
    ld a, 0x10
    add a, l
    cp 0x10
    jp nz, g05_f
    ld hl, SCRATCH
    ld a, 0x10
    add a, (hl)
    cp 0x17
    jp nz, g05_f
    ld a, 0x08
    add a, a
    cp 0x10
    jp nz, g05_f
    ld a, 0x10
    add a, 0x09
    cp 0x19
    jp nz, g05_f
    ld hl, msg_ok
    call print_str
    jp g06
g05_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G06: ADC A,r 全 8 ソース + ACI (CY=1)
; ==============================================================
g06:
    ld hl, msg_g06
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x07
    ld b, 0x01
    ld c, 0x02
    ld d, 0x03
    ld e, 0x04
    scf
    ld a, 0x10
    adc a, b
    cp 0x12
    jp nz, g06_f
    scf
    ld a, 0x10
    adc a, c
    cp 0x13
    jp nz, g06_f
    scf
    ld a, 0x10
    adc a, d
    cp 0x14
    jp nz, g06_f
    scf
    ld a, 0x10
    adc a, e
    cp 0x15
    jp nz, g06_f
    ld hl, SCRATCH
    scf
    ld a, 0x10
    adc a, h
    cp 0x41
    jp nz, g06_f
    ld hl, SCRATCH
    scf
    ld a, 0x10
    adc a, l
    cp 0x11
    jp nz, g06_f
    ld hl, SCRATCH
    scf
    ld a, 0x10
    adc a, (hl)
    cp 0x18
    jp nz, g06_f
    scf
    ld a, 0x08
    adc a, a
    cp 0x11
    jp nz, g06_f
    scf
    ld a, 0x10
    adc a, 0x09
    cp 0x1A
    jp nz, g06_f
    ld hl, msg_ok
    call print_str
    jp g07
g06_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G07: SUB r 全 8 ソース + SUI
; ==============================================================
g07:
    ld hl, msg_g07
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x03
    ld b, 0x01
    ld c, 0x02
    ld d, 0x03
    ld e, 0x04
    ld a, 0x10
    sub b
    cp 0x0F
    jp nz, g07_f
    ld a, 0x10
    sub c
    cp 0x0E
    jp nz, g07_f
    ld a, 0x10
    sub d
    cp 0x0D
    jp nz, g07_f
    ld a, 0x10
    sub e
    cp 0x0C
    jp nz, g07_f
    ld hl, SCRATCH
    ld a, 0x40
    sub h
    cp 0x10
    jp nz, g07_f
    ld hl, SCRATCH
    ld a, 0x10
    sub l
    cp 0x10
    jp nz, g07_f
    ld hl, SCRATCH
    ld a, 0x10
    sub (hl)
    cp 0x0D
    jp nz, g07_f
    ld a, 0x10
    sub a
    cp 0x00
    jp nz, g07_f
    ld a, 0x10
    sub 0x09
    cp 0x07
    jp nz, g07_f
    ld hl, msg_ok
    call print_str
    jp g08
g07_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G08: SBC A,r 全 8 ソース + SBI (CY=1 borrow)
; ==============================================================
g08:
    ld hl, msg_g08
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x03
    ld b, 0x01
    ld c, 0x02
    ld d, 0x03
    ld e, 0x04
    scf
    ld a, 0x10
    sbc a, b
    cp 0x0E
    jp nz, g08_f
    scf
    ld a, 0x10
    sbc a, c
    cp 0x0D
    jp nz, g08_f
    scf
    ld a, 0x10
    sbc a, d
    cp 0x0C
    jp nz, g08_f
    scf
    ld a, 0x10
    sbc a, e
    cp 0x0B
    jp nz, g08_f
    ld hl, SCRATCH
    scf
    ld a, 0x40
    sbc a, h
    cp 0x0F
    jp nz, g08_f
    ld hl, SCRATCH
    scf
    ld a, 0x10
    sbc a, l
    cp 0x0F
    jp nz, g08_f
    ld hl, SCRATCH
    scf
    ld a, 0x10
    sbc a, (hl)
    cp 0x0C
    jp nz, g08_f
    scf
    ld a, 0x10
    sbc a, a
    cp 0xFF
    jp nz, g08_f
    scf
    ld a, 0x10
    sbc a, 0x09
    cp 0x06
    jp nz, g08_f
    ld hl, msg_ok
    call print_str
    jp g09
g08_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G09: AND r 全 8 ソース + ANI
; ==============================================================
g09:
    ld hl, msg_g09
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x0F
    ld b, 0xF0
    ld c, 0x3C
    ld d, 0xFF
    ld e, 0xAA
    ld a, 0xFF
    and b
    cp 0xF0
    jp nz, g09_f
    ld a, 0xFF
    and c
    cp 0x3C
    jp nz, g09_f
    ld a, 0xFF
    and d
    cp 0xFF
    jp nz, g09_f
    ld a, 0xFF
    and e
    cp 0xAA
    jp nz, g09_f
    ld hl, SCRATCH
    ld a, 0xFF
    and h
    cp 0x30
    jp nz, g09_f
    ld hl, SCRATCH
    ld a, 0xFF
    and l
    cp 0x00
    jp nz, g09_f
    ld hl, SCRATCH
    ld a, 0xFF
    and (hl)
    cp 0x0F
    jp nz, g09_f
    ld a, 0xAA
    and a
    cp 0xAA
    jp nz, g09_f
    ld a, 0xFF
    and 0x55
    cp 0x55
    jp nz, g09_f
    ld hl, msg_ok
    call print_str
    jp g10
g09_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G10: OR r + XOR r 全 8 ソース + ORI/XRI
; ==============================================================
g10:
    ld hl, msg_g10
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x0F
    ld b, 0x01
    ld c, 0x02
    ld d, 0x04
    ld e, 0x08
    ; --- OR ---
    ld a, 0x00
    or b
    cp 0x01
    jp nz, g10_f
    ld a, 0x01
    or c
    cp 0x03
    jp nz, g10_f
    ld a, 0x03
    or d
    cp 0x07
    jp nz, g10_f
    ld a, 0x07
    or e
    cp 0x0F
    jp nz, g10_f
    ld hl, SCRATCH
    ld a, 0x00
    or h
    cp 0x30
    jp nz, g10_f
    ld hl, SCRATCH
    ld a, 0x00
    or l
    cp 0x00
    jp nz, g10_f
    ld hl, SCRATCH
    ld a, 0x00
    or (hl)
    cp 0x0F
    jp nz, g10_f
    ld a, 0x55
    or a
    cp 0x55
    jp nz, g10_f
    ld a, 0xF0
    or 0x0F
    cp 0xFF
    jp nz, g10_f
    ; --- XOR ---
    ld b, 0x01
    ld c, 0x02
    ld d, 0x04
    ld e, 0x08
    ld a, 0xFF
    xor b
    cp 0xFE
    jp nz, g10_f
    ld a, 0xFF
    xor c
    cp 0xFD
    jp nz, g10_f
    ld a, 0xFF
    xor d
    cp 0xFB
    jp nz, g10_f
    ld a, 0xFF
    xor e
    cp 0xF7
    jp nz, g10_f
    ld hl, SCRATCH
    ld a, 0xFF
    xor h
    cp 0xCF
    jp nz, g10_f
    ld hl, SCRATCH
    ld a, 0x00
    xor l
    cp 0x00
    jp nz, g10_f
    ld hl, SCRATCH
    ld a, 0xFF
    xor (hl)
    cp 0xF0
    jp nz, g10_f
    ld a, 0xAA
    xor a
    cp 0x00
    jp nz, g10_f
    ld a, 0xFF
    xor 0x55
    cp 0xAA
    jp nz, g10_f
    ld hl, msg_ok
    call print_str
    jp g11
g10_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G11: CP r 全 8 ソース + CPI + パリティ
; ==============================================================
g11:
    ld hl, msg_g11
    call print_str
    ld hl, SCRATCH
    ld (hl), 0x10
    ld b, 0x10
    ld c, 0x20
    ld d, 0x10
    ld e, 0x30
    ld h, 0x10
    ld l, 0x00
    ld a, 0x10
    cp b
    jp nz, g11_f
    ld a, 0x10
    cp c
    jp nc, g11_f
    ld a, 0x10
    cp d
    jp nz, g11_f
    ld a, 0x10
    cp e
    jp nc, g11_f
    ld a, 0x10
    cp h
    jp nz, g11_f
    ld a, 0x10
    cp l
    jp z, g11_f
    jp c, g11_f
    ld hl, SCRATCH
    ld a, 0x10
    cp (hl)
    jp nz, g11_f
    ld a, 0x55
    cp a
    jp nz, g11_f
    ld a, 0x10
    cp 0x10
    jp nz, g11_f
    ld a, 0x10
    cp 0x20
    jp nc, g11_f
    ld a, 0xFF
    and 0x03
    jp po, g11_f
    ld a, 0xFF
    and 0x01
    jp pe, g11_f
    ld hl, msg_ok
    call print_str
    jp g12
g11_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G12: INC r 全 8 レジスタ + INC (HL)
; ==============================================================
g12:
    ld hl, msg_g12
    call print_str
    ld a, 0x0F
    inc a
    cp 0x10
    jp nz, g12_f
    ld b, 0xFE
    inc b
    ld a, b
    cp 0xFF
    jp nz, g12_f
    ld c, 0x00
    inc c
    ld a, c
    cp 0x01
    jp nz, g12_f
    ld d, 0x7F
    inc d
    ld a, d
    cp 0x80
    jp nz, g12_f
    ld e, 0x01
    inc e
    ld a, e
    cp 0x02
    jp nz, g12_f
    ld h, 0x10
    inc h
    ld a, h
    cp 0x11
    jp nz, g12_f
    ld l, 0xFE
    inc l
    ld a, l
    cp 0xFF
    jp nz, g12_f
    ld hl, SCRATCH
    ld (hl), 0x0A
    inc (hl)
    ld a, (hl)
    cp 0x0B
    jp nz, g12_f
    ld a, 0xFF
    inc a
    jp nz, g12_f
    ld hl, msg_ok
    call print_str
    jp g13
g12_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G13: DEC r 全 8 レジスタ + DEC (HL)
; ==============================================================
g13:
    ld hl, msg_g13
    call print_str
    ld a, 0x10
    dec a
    cp 0x0F
    jp nz, g13_f
    ld b, 0x01
    dec b
    ld a, b
    cp 0x00
    jp nz, g13_f
    ld c, 0xFF
    dec c
    ld a, c
    cp 0xFE
    jp nz, g13_f
    ld d, 0x80
    dec d
    ld a, d
    cp 0x7F
    jp nz, g13_f
    ld e, 0x02
    dec e
    ld a, e
    cp 0x01
    jp nz, g13_f
    ld h, 0x11
    dec h
    ld a, h
    cp 0x10
    jp nz, g13_f
    ld l, 0xFF
    dec l
    ld a, l
    cp 0xFE
    jp nz, g13_f
    ld hl, SCRATCH
    ld (hl), 0x05
    dec (hl)
    ld a, (hl)
    cp 0x04
    jp nz, g13_f
    ld b, 0x01
    dec b
    jp nz, g13_f
    ld hl, msg_ok
    call print_str
    jp g14
g13_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G14: INX/DCX/DAD (BC/DE/HL/SP)
; ==============================================================
g14:
    ld hl, msg_g14
    call print_str
    ; INX BC
    ld bc, 0x00FF
    inc bc
    ld a, b
    cp 0x01
    jp nz, g14_f
    ld a, c
    cp 0x00
    jp nz, g14_f
    ; DCX DE
    ld de, 0x0100
    dec de
    ld a, d
    cp 0x00
    jp nz, g14_f
    ld a, e
    cp 0xFF
    jp nz, g14_f
    ; INX HL → wrap
    ld hl, 0xFFFF
    inc hl
    ld a, h
    cp 0x00
    jp nz, g14_f
    ld a, l
    cp 0x00
    jp nz, g14_f
    ; DCX HL → wrap
    ld hl, 0x0000
    dec hl
    ld a, h
    cp 0xFF
    jp nz, g14_f
    ld a, l
    cp 0xFF
    jp nz, g14_f
    ; DAD BC
    ld hl, 0x1000
    ld bc, 0x0234
    add hl, bc
    ld a, h
    cp 0x12
    jp nz, g14_f
    ld a, l
    cp 0x34
    jp nz, g14_f
    ; DAD DE
    ld de, 0x0001
    add hl, de
    ld a, h
    cp 0x12
    jp nz, g14_f
    ld a, l
    cp 0x35
    jp nz, g14_f
    ; DAD SP: SP=0x7F00
    ld hl, 0x0000
    add hl, sp
    ld a, h
    cp 0x7F
    jp nz, g14_f
    ld a, l
    cp 0x00
    jp nz, g14_f
    ; INX SP / DCX SP
    ld sp, 0x7E00
    inc sp
    dec sp
    ld hl, 0x0000
    add hl, sp
    ld sp, 0x7F00
    ld a, h
    cp 0x7E
    jp nz, g14_f
    ld a, l
    cp 0x00
    jp nz, g14_f
    ld hl, msg_ok
    call print_str
    jp g15
g14_f:
    ld sp, 0x7F00
    ld hl, msg_fail
    call print_str

; ==============================================================
; G15: STA/LDA/STAX/LDAX/SHLD/LHLD/LD(HL)
; ==============================================================
g15:
    ld hl, msg_g15
    call print_str
    ; STA / LDA
    ld a, 0xCD
    ld (0x3100), a
    ld a, 0x00
    ld a, (0x3100)
    cp 0xCD
    jp nz, g15_f
    ; STAX DE / LDAX DE
    ld de, 0x3200
    ld a, 0xEF
    ld (de), a
    ld a, 0x00
    ld a, (de)
    cp 0xEF
    jp nz, g15_f
    ; STAX BC / LDAX BC
    ld bc, 0x3300
    ld a, 0xA1
    ld (bc), a
    ld a, 0x00
    ld a, (bc)
    cp 0xA1
    jp nz, g15_f
    ; SHLD / LHLD
    ld hl, 0x5678
    ld (0x3400), hl
    ld hl, 0x0000
    ld hl, (0x3400)
    ld a, h
    cp 0x56
    jp nz, g15_f
    ld a, l
    cp 0x78
    jp nz, g15_f
    ; LD (HL),n / LD A,(HL)
    ld hl, SCRATCH
    ld (hl), 0xBB
    ld a, (hl)
    cp 0xBB
    jp nz, g15_f
    ld hl, msg_ok
    call print_str
    jp g16
g15_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G16: 回転/フラグ/NOP/DI/EI
; ==============================================================
g16:
    ld hl, msg_g16
    call print_str
    ; RLCA: 0x80 → 0x01, CY=1
    ld a, 0x80
    rlca
    jp nc, g16_f
    cp 0x01
    jp nz, g16_f
    ; RRCA: 0x01 → 0x80, CY=1
    ld a, 0x01
    rrca
    jp nc, g16_f
    cp 0x80
    jp nz, g16_f
    ; RLA (CY=1 in): 0x40 → 0x81, CY=0
    scf
    ld a, 0x40
    rla
    jp c, g16_f
    cp 0x81
    jp nz, g16_f
    ; RRA (CY=1 in): 0x02 → 0x81, CY=0
    scf
    ld a, 0x02
    rra
    jp c, g16_f
    cp 0x81
    jp nz, g16_f
    ; SCF → CY=1
    scf
    jp nc, g16_f
    ; CCF → CY=0
    ccf
    jp c, g16_f
    ; CPL: 0x55 → 0xAA
    ld a, 0x55
    cpl
    cp 0xAA
    jp nz, g16_f
    ; DAA: BCD 09+01=10
    ld a, 0x09
    add a, 0x01
    daa
    cp 0x10
    jp nz, g16_f
    ; NOP x3
    nop
    nop
    nop
    ; DI / EI
    di
    ei
    ld hl, msg_ok
    call print_str
    jp g17
g16_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G17: JP 全 8 条件 (Z/NZ/C/NC/M/P/PE/PO)
; ==============================================================
g17:
    ld hl, msg_g17
    call print_str
    ld a, 0x00
    and a
    jp z, g17_z_ok
    jp g17_f
g17_z_ok:
    ld a, 0x01
    and a
    jp nz, g17_nz_ok
    jp g17_f
g17_nz_ok:
    scf
    jp c, g17_c_ok
    jp g17_f
g17_c_ok:
    and a
    jp nc, g17_nc_ok
    jp g17_f
g17_nc_ok:
    ld a, 0x80
    and a
    jp m, g17_m_ok
    jp g17_f
g17_m_ok:
    ld a, 0x7F
    and a
    jp p, g17_p_ok
    jp g17_f
g17_p_ok:
    ld a, 0xFF
    and 0x03
    jp pe, g17_pe_ok
    jp g17_f
g17_pe_ok:
    ld a, 0xFF
    and 0x01
    jp po, g17_po_ok
    jp g17_f
g17_po_ok:
    ld hl, msg_ok
    call print_str
    jp g18
g17_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G18: CALL 全 8 条件
; ==============================================================
g18:
    ld hl, msg_g18
    call print_str
    ld a, 0x00
    and a
    call z, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0x00
    ld a, 0x01
    and a
    call nz, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0xAA
    ld a, 0x01
    and a
    call z, sub_set_b_01
    ld a, b
    cp 0xAA
    jp nz, g18_f
    ld b, 0x00
    scf
    call c, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0x00
    and a
    call nc, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0x00
    ld a, 0x80
    and a
    call m, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0x00
    ld a, 0x01
    and a
    call p, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0x00
    ld a, 0xFF
    and 0x03
    call pe, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld b, 0x00
    ld a, 0xFF
    and 0x01
    call po, sub_set_b_01
    ld a, b
    cp 0x01
    jp nz, g18_f
    ld hl, msg_ok
    call print_str
    jp g19
g18_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G19: RET 全 8 条件
; ==============================================================
g19:
    ld hl, msg_g19
    call print_str
    ld b, 0x00
    call sub_ret_z
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_nz
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_c
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_nc
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_m
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_p
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_pe
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld b, 0x00
    call sub_ret_po
    ld a, b
    cp 0x19
    jp nz, g19_f
    ld hl, msg_ok
    call print_str
    jp g20
g19_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; G20: RST (RST 1 @ 0x0008, RST 7 @ 0x0038)
; RST ハンドラを page0 に動的インストールしてからテスト
; ==============================================================
g20:
    ld hl, msg_g20
    call print_str
    ; RST 1 ハンドラ: 0x0008 = MVI B,0x81 / RET
    ld hl, 0x0008
    ld (hl), 0x06       ; MVI B, n  opcode
    inc hl
    ld (hl), 0x81       ; n = 0x81
    inc hl
    ld (hl), 0xC9       ; RET
    ; RST 7 ハンドラ: 0x0038 = MVI B,0x87 / RET
    ld hl, 0x0038
    ld (hl), 0x06
    inc hl
    ld (hl), 0x87
    inc hl
    ld (hl), 0xC9
    ; テスト
    ld b, 0x00
    rst 0x08
    ld a, b
    cp 0x81
    jp nz, g20_f
    ld b, 0x00
    rst 0x38
    ld a, b
    cp 0x87
    jp nz, g20_f
    ld hl, msg_ok
    call print_str
    jp done
g20_f:
    ld hl, msg_fail
    call print_str

; ==============================================================
; 完了
; ==============================================================
done:
    ld hl, msg_done
    call print_str
    ret             ; CP/M に返る

; ==============================================================
; print_str: HL の 0 終端文字列を CONOUT に出力
; ==============================================================
print_str:
    ld a, (hl)
    or a
    ret z
    out (CONOUT), a
    inc hl
    jp print_str

; ==============================================================
; サブルーチン (G18/G19 用)
; ==============================================================
sub_set_b_01:
    ld b, 0x01
    ret

sub_ret_z:
    ld b, 0x19
    ld a, 0x00
    and a
    ret z
    ld b, 0x00
    ret

sub_ret_nz:
    ld b, 0x19
    ld a, 0x01
    and a
    ret nz
    ld b, 0x00
    ret

sub_ret_c:
    ld b, 0x19
    scf
    ret c
    ld b, 0x00
    ret

sub_ret_nc:
    ld b, 0x19
    and a
    ret nc
    ld b, 0x00
    ret

sub_ret_m:
    ld b, 0x19
    ld a, 0x80
    and a
    ret m
    ld b, 0x00
    ret

sub_ret_p:
    ld b, 0x19
    ld a, 0x01
    and a
    ret p
    ld b, 0x00
    ret

sub_ret_pe:
    ld b, 0x19
    ld a, 0xFF
    and 0x03
    ret pe
    ld b, 0x00
    ret

sub_ret_po:
    ld b, 0x19
    ld a, 0xFF
    and 0x01
    ret po
    ld b, 0x00
    ret

; ==============================================================
; メッセージ文字列 (0x0D = CR で改行、0 = 終端)
; ==============================================================
msg_header:
    defm "8080 instruction exerciser"
    defb 0x0D, 0x0A, 0

msg_ok:
    defm "OK"
    defb 0x0D, 0x0A, 0

msg_fail:
    defm "FAIL"
    defb 0x0D, 0x0A, 0

msg_done:
    defm "Tests complete"
    defb 0x0D, 0x0A, 0

msg_g01:  defm "ld r,n (MVI)....................", 0
msg_g02:  defm "ld r,r (MOV)....................", 0
msg_g03:  defm "lxi/push/pop....................", 0
msg_g04:  defm "ex/xthl/pchl/sphl...............", 0
msg_g05:  defm "add a,r.........................", 0
msg_g06:  defm "adc a,r.........................", 0
msg_g07:  defm "sub r...........................", 0
msg_g08:  defm "sbc a,r.........................", 0
msg_g09:  defm "and r...........................", 0
msg_g10:  defm "or/xor r........................", 0
msg_g11:  defm "cp r............................", 0
msg_g12:  defm "inc r...........................", 0
msg_g13:  defm "dec r...........................", 0
msg_g14:  defm "inx/dcx/dad.....................", 0
msg_g15:  defm "sta/lda/stax/ldax/shld/lhld.....", 0
msg_g16:  defm "rlca/rrca/rla/rra/scf/ccf/cpl...", 0
msg_g17:  defm "jp cond (all 8).................", 0
msg_g18:  defm "call cond (all 8)...............", 0
msg_g19:  defm "ret cond (all 8)................", 0
msg_g20:  defm "rst 1/7.........................", 0
