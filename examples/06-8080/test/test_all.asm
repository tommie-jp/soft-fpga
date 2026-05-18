; test_all.asm — 8080 全命令テストスイート (20グループ)
;
; OUT 0x01 (CONOUT) に P (PASS) / F (FAIL) を 20 グループ分出力する。
; z80asm v1.8 でアセンブル。8080 互換命令のみ使用。
;
; G01 LD r,n       (MVI A/B/C/D/E/H/L all 7)
; G02 LD r,r       (MOV 全レジスタ間)
; G03 LXI+PUSH/POP (BC/DE/HL/AF 全 4 ペア)
; G04 EX/XTHL/PCHL/SPHL
; G05 ADD A,r      (全 8 ソース + ADI)
; G06 ADC A,r      (全 8 ソース + ACI)
; G07 SUB r        (全 8 ソース + SUI)
; G08 SBC A,r      (全 8 ソース + SBI)
; G09 AND r        (全 8 ソース + ANI)
; G10 OR/XOR r     (全 8 ソース + ORI/XRI)
; G11 CP r         (全 8 ソース + CPI)
; G12 INC r        (全 8 レジスタ)
; G13 DEC r        (全 8 レジスタ)
; G14 INX/DCX/DAD  (BC/DE/HL/SP)
; G15 メモリ転送   (STA/LDA/STAX/LDAX/SHLD/LHLD)
; G16 回転/フラグ  (RLCA/RRCA/RLA/RRA/SCF/CCF/CPL/DAA/NOP/DI/EI)
; G17 JP 全 8 条件 (Z/NZ/C/NC/M/P/PE/PO)
; G18 CALL 全 8 条件
; G19 RET 全 8 条件
; G20 RST          (RST 1, RST 7)
;
; スタック:  SP = 0x1F00
; 作業メモリ: SCRATCH = 0x2000
; RST 1 ハンドラ: 0x0008  → ld b,0x81 / ret
; RST 7 ハンドラ: 0x0038  → ld b,0x87 / ret

CONOUT:  equ 0x01
SCRATCH: equ 0x2000

        org 0x0000

; --- RST ベクタ領域 (0x0000-0x005F) ---
        jp main_start           ; 0x0000 (3 bytes)
        nop                     ; 0x0003
        nop                     ; 0x0004
        nop                     ; 0x0005
        nop                     ; 0x0006
        nop                     ; 0x0007
rst1_handler:                   ; 0x0008
        ld b, 0x81
        ret
        nop                     ; 0x000B
        nop
        nop
        nop
        nop                     ; 0x000F
        nop                     ; 0x0010
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x0017
        nop                     ; 0x0018
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x001F
        nop                     ; 0x0020
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x0027
        nop                     ; 0x0028
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x002F
        nop                     ; 0x0030
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x0037
rst7_handler:                   ; 0x0038
        ld b, 0x87
        ret
        nop                     ; 0x003B
        nop
        nop
        nop
        nop                     ; 0x003F
        nop                     ; 0x0040
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x0047
        nop                     ; 0x0048
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x004F
        nop                     ; 0x0050
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x0057
        nop                     ; 0x0058
        nop
        nop
        nop
        nop
        nop
        nop
        nop                     ; 0x005F

; ==============================================================
; メイン開始 (0x0060)
; ==============================================================
main_start:                     ; 0x0060
        ld sp, 0x1F00

; ==============================================================
; G01: LD r,n (MVI) — 全 7 レジスタ
; ==============================================================
g01:
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
        ld h, 0x20
        ld a, h
        cp 0x20
        jp nz, g01_f
        ld l, 0x00
        ld a, l
        cp 0x00
        jp nz, g01_f
        ld a, 'P'
        out (CONOUT), a
        jp g02
g01_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G02: LD r,r (MOV) — 全レジスタ間
; ==============================================================
g02:
        ; A→B→C→D→E→H→L→A の連鎖コピー
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
        ; B→各レジスタ
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
        ld a, 'P'
        out (CONOUT), a
        jp g03
g02_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G03: LXI + PUSH/POP 全 4 ペア (BC/DE/HL/AF)
; ==============================================================
g03:
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
        ; AF (PUSH PSW / POP PSW)
        ; フラグ確定: SCF → CY=1, AND A をスキップして A=0x01 S=0 Z=0 P=0 CY=1
        ld a, 0x00
        scf                     ; CY=1
        ld a, 0x01
        push af                 ; A=0x01, F には CY=1 が入る
        ld a, 0x00
        scf
        ccf                     ; CY=0 に戻す（以降の判定に影響しないよう）
        pop af                  ; A=0x01 が復元されるはず
        cp 0x01
        jp nz, g03_f
        ld a, 'P'
        out (CONOUT), a
        jp g04
g03_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G04: EX DE,HL / XTHL / PCHL / SPHL (LD SP,HL)
; ==============================================================
g04:
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
        push hl                 ; (SP)=0xABCD
        ld hl, 0x1234
        ex (sp), hl             ; HL=0xABCD, (SP)=0x1234
        ld a, h
        cp 0xAB
        jp nz, g04_f
        ld a, l
        cp 0xCD
        jp nz, g04_f
        pop hl                  ; スタック回収 (0x1234)
        ; LD SP,HL (SPHL) + ADD HL,SP (DAD SP) で検証
        ld hl, 0x1F00
        ld sp, hl               ; SP=0x1F00
        ld hl, 0x0000
        add hl, sp              ; HL = SP = 0x1F00
        ld sp, 0x1F00           ; 元に戻す
        ld a, h
        cp 0x1F
        jp nz, g04_f
        ld a, l
        cp 0x00
        jp nz, g04_f
        ; PCHL (JP HL): HL にジャンプ先をセットしてジャンプ
        ld hl, g04_pchl_ok
        jp (hl)
        jp g04_f                ; ここには来ないはず
g04_pchl_ok:
        ld a, 'P'
        out (CONOUT), a
        jp g05
g04_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G05: ADD A,r 全 8 ソース + ADI
; ==============================================================
g05:
        ; SCRATCH = 0x2000 に被演算子 0x07 を配置
        ; H=0x20, L=0x00 として使う (ADD A,H → +0x20, ADD A,L → +0x00)
        ld hl, SCRATCH
        ld (hl), 0x07
        ld b, 0x01
        ld c, 0x02
        ld d, 0x03
        ld e, 0x04
        ; H=0x20, L=0x00 は ld hl, SCRATCH で設定済み
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
        ld a, 0x10
        add a, h                ; H=0x20
        cp 0x30
        jp nz, g05_f
        ld a, 0x10
        add a, l                ; L=0x00
        cp 0x10
        jp nz, g05_f
        ld a, 0x10
        add a, (hl)             ; (SCRATCH)=0x07
        cp 0x17
        jp nz, g05_f
        ld a, 0x08
        add a, a                ; ADD A,A
        cp 0x10
        jp nz, g05_f
        ld a, 0x10
        add a, 0x09             ; ADI n
        cp 0x19
        jp nz, g05_f
        ld a, 'P'
        out (CONOUT), a
        jp g06
g05_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G06: ADC A,r 全 8 ソース + ACI (CY=1)
; ==============================================================
g06:
        ld hl, SCRATCH
        ld (hl), 0x07
        ld b, 0x01
        ld c, 0x02
        ld d, 0x03
        ld e, 0x04
        scf                     ; CY=1
        ld a, 0x10
        adc a, b                ; 0x10+0x01+1=0x12
        cp 0x12
        jp nz, g06_f
        scf
        ld a, 0x10
        adc a, c                ; 0x10+0x02+1=0x13
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
        scf
        ld a, 0x10
        adc a, h                ; H=0x20, result=0x31
        cp 0x31
        jp nz, g06_f
        scf
        ld a, 0x10
        adc a, l                ; L=0x00, result=0x11
        cp 0x11
        jp nz, g06_f
        scf
        ld a, 0x10
        adc a, (hl)             ; (SCRATCH)=0x07, result=0x18
        cp 0x18
        jp nz, g06_f
        scf
        ld a, 0x08
        adc a, a                ; 0x08+0x08+1=0x11
        cp 0x11
        jp nz, g06_f
        scf
        ld a, 0x10
        adc a, 0x09             ; ACI: 0x10+0x09+1=0x1A
        cp 0x1A
        jp nz, g06_f
        ld a, 'P'
        out (CONOUT), a
        jp g07
g06_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G07: SUB r 全 8 ソース + SUI
; ==============================================================
g07:
        ld hl, SCRATCH
        ld (hl), 0x03
        ld b, 0x01
        ld c, 0x02
        ld d, 0x03
        ld e, 0x04
        ; H=0x20, L=0x00
        ld a, 0x10
        sub b                   ; 0x10-0x01=0x0F
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
        ld a, 0x30
        sub h                   ; 0x30-0x20=0x10
        cp 0x10
        jp nz, g07_f
        ld a, 0x10
        sub l                   ; 0x10-0x00=0x10
        cp 0x10
        jp nz, g07_f
        ld a, 0x10
        sub (hl)                ; 0x10-0x03=0x0D
        cp 0x0D
        jp nz, g07_f
        ld a, 0x10
        sub a                   ; 0
        cp 0x00
        jp nz, g07_f
        ld a, 0x10
        sub 0x09                ; SUI: 0x10-0x09=0x07
        cp 0x07
        jp nz, g07_f
        ld a, 'P'
        out (CONOUT), a
        jp g08
g07_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G08: SBC A,r 全 8 ソース + SBI (CY=1 borrow)
; ==============================================================
g08:
        ld hl, SCRATCH
        ld (hl), 0x03
        ld b, 0x01
        ld c, 0x02
        ld d, 0x03
        ld e, 0x04
        scf                     ; CY=1 (borrow)
        ld a, 0x10
        sbc a, b                ; 0x10-0x01-1=0x0E
        cp 0x0E
        jp nz, g08_f
        scf
        ld a, 0x10
        sbc a, c                ; 0x10-0x02-1=0x0D
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
        scf
        ld a, 0x30
        sbc a, h                ; 0x30-0x20-1=0x0F
        cp 0x0F
        jp nz, g08_f
        scf
        ld a, 0x10
        sbc a, l                ; 0x10-0x00-1=0x0F
        cp 0x0F
        jp nz, g08_f
        scf
        ld a, 0x10
        sbc a, (hl)             ; 0x10-0x03-1=0x0C
        cp 0x0C
        jp nz, g08_f
        scf
        ld a, 0x10
        sbc a, a                ; 0x10-0x10-1=0xFF
        cp 0xFF
        jp nz, g08_f
        scf
        ld a, 0x10
        sbc a, 0x09             ; SBI: 0x10-0x09-1=0x06
        cp 0x06
        jp nz, g08_f
        ld a, 'P'
        out (CONOUT), a
        jp g09
g08_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G09: AND r 全 8 ソース + ANI
; ==============================================================
g09:
        ld hl, SCRATCH
        ld (hl), 0x0F
        ld b, 0xF0
        ld c, 0x3C
        ld d, 0xFF
        ld e, 0xAA
        ; H=0x20, L=0x00
        ld a, 0xFF
        and b                   ; 0xFF & 0xF0 = 0xF0
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
        ld a, 0xFF
        and h                   ; 0xFF & 0x20 = 0x20
        cp 0x20
        jp nz, g09_f
        ld a, 0xFF
        and l                   ; 0xFF & 0x00 = 0x00
        cp 0x00
        jp nz, g09_f
        ld a, 0xFF
        and (hl)                ; 0xFF & 0x0F = 0x0F
        cp 0x0F
        jp nz, g09_f
        ld a, 0xAA
        and a                   ; AND A,A = 0xAA
        cp 0xAA
        jp nz, g09_f
        ld a, 0xFF
        and 0x55                ; ANI: 0xFF & 0x55 = 0x55
        cp 0x55
        jp nz, g09_f
        ld a, 'P'
        out (CONOUT), a
        jp g10
g09_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G10: OR r + XOR r 全 8 ソース + ORI/XRI
; ==============================================================
g10:
        ld hl, SCRATCH
        ld (hl), 0x0F
        ld b, 0x01
        ld c, 0x02
        ld d, 0x04
        ld e, 0x08
        ; --- OR ---
        ld a, 0x00
        or b                    ; 0x01
        cp 0x01
        jp nz, g10_f
        ld a, 0x01
        or c                    ; 0x03
        cp 0x03
        jp nz, g10_f
        ld a, 0x03
        or d                    ; 0x07
        cp 0x07
        jp nz, g10_f
        ld a, 0x07
        or e                    ; 0x0F
        cp 0x0F
        jp nz, g10_f
        ld a, 0x00
        or h                    ; 0x20
        cp 0x20
        jp nz, g10_f
        ld a, 0x00
        or l                    ; 0x00
        cp 0x00
        jp nz, g10_f
        ld a, 0x00
        or (hl)                 ; 0x0F
        cp 0x0F
        jp nz, g10_f
        ld a, 0x55
        or a                    ; 0x55
        cp 0x55
        jp nz, g10_f
        ld a, 0xF0
        or 0x0F                 ; ORI: 0xFF
        cp 0xFF
        jp nz, g10_f
        ; --- XOR ---
        ld a, 0xFF
        xor b                   ; 0xFE
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
        ld a, 0xFF
        xor h                   ; 0xFF^0x20=0xDF
        cp 0xDF
        jp nz, g10_f
        ld a, 0x00
        xor l                   ; 0x00^0x00=0x00
        cp 0x00
        jp nz, g10_f
        ld a, 0xFF
        xor (hl)                ; 0xFF^0x0F=0xF0
        cp 0xF0
        jp nz, g10_f
        ld a, 0xAA
        xor a                   ; 0x00 (自己XOR)
        cp 0x00
        jp nz, g10_f
        ld a, 0xFF
        xor 0x55                ; XRI: 0xAA
        cp 0xAA
        jp nz, g10_f
        ld a, 'P'
        out (CONOUT), a
        jp g11
g10_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G11: CP r 全 8 ソース + CPI (フラグ Z/CY/P)
; ==============================================================
g11:
        ; SCRATCH に 0x10 を配置 (CP (HL) 用)
        ld hl, SCRATCH
        ld (hl), 0x10
        ld b, 0x10
        ld c, 0x20
        ld d, 0x10
        ld e, 0x30
        ; H と L には SCRATCH と独立した値をセット (HL は後でリストアする)
        ld h, 0x10
        ld l, 0x00
        ; A==B → Z=1
        ld a, 0x10
        cp b
        jp nz, g11_f
        ; A<C → CY=1 (borrow)
        ld a, 0x10
        cp c
        jp nc, g11_f
        ; A==D → Z=1
        ld a, 0x10
        cp d
        jp nz, g11_f
        ; A<E → CY=1
        ld a, 0x10
        cp e
        jp nc, g11_f
        ; A==H (H=0x10) → Z=1
        ld a, 0x10
        cp h
        jp nz, g11_f
        ; A>L (L=0x00): CY=0, Z=0
        ld a, 0x10
        cp l
        jp z, g11_f
        jp c, g11_f
        ; A==(HL): HL を SCRATCH に戻してから比較
        ld hl, SCRATCH          ; HL = 0x2000, (HL)=0x10
        ld a, 0x10
        cp (hl)
        jp nz, g11_f
        ; A==A → Z=1
        ld a, 0x55
        cp a
        jp nz, g11_f
        ; CPI: A=0x10, n=0x10 → Z=1
        ld a, 0x10
        cp 0x10
        jp nz, g11_f
        ; CPI: A=0x10, n=0x20 → CY=1
        ld a, 0x10
        cp 0x20
        jp nc, g11_f
        ; パリティフラグ: AND で P をチェック
        ; 0xFF & 0x03 = 0x03 (bits: 00000011) → 2ビット立っている → P=1 (even parity)
        ld a, 0xFF
        and 0x03                ; A=0x03, parity even → P=1
        jp po, g11_f            ; P=0 (odd) ならジャンプ → P=1 (even) なら通過
        ; 0xFF & 0x01 = 0x01 (bits: 00000001) → 1ビット → P=0 (odd)
        ld a, 0xFF
        and 0x01                ; A=0x01, parity odd → P=0
        jp pe, g11_f            ; P=1 (even) ならジャンプ → P=0 (odd) なら通過
        ld a, 'P'
        out (CONOUT), a
        jp g12
g11_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G12: INC r 全 8 レジスタ
; ==============================================================
g12:
        ; INC A
        ld a, 0x0F
        inc a
        cp 0x10
        jp nz, g12_f
        ; INC B
        ld b, 0xFE
        inc b
        ld a, b
        cp 0xFF
        jp nz, g12_f
        ; INC C
        ld c, 0x00
        inc c
        ld a, c
        cp 0x01
        jp nz, g12_f
        ; INC D
        ld d, 0x7F
        inc d
        ld a, d
        cp 0x80
        jp nz, g12_f
        ; INC E
        ld e, 0x01
        inc e
        ld a, e
        cp 0x02
        jp nz, g12_f
        ; INC H
        ld h, 0x10
        inc h
        ld a, h
        cp 0x11
        jp nz, g12_f
        ; INC L
        ld l, 0xFE
        inc l
        ld a, l
        cp 0xFF
        jp nz, g12_f
        ; INC (HL): HL=SCRATCH
        ld hl, SCRATCH
        ld (hl), 0x0A
        inc (hl)
        ld a, (hl)
        cp 0x0B
        jp nz, g12_f
        ; INC A → 0xFF+1=0x00, Z=1
        ld a, 0xFF
        inc a
        jp nz, g12_f
        ld a, 'P'
        out (CONOUT), a
        jp g13
g12_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G13: DEC r 全 8 レジスタ
; ==============================================================
g13:
        ; DEC A
        ld a, 0x10
        dec a
        cp 0x0F
        jp nz, g13_f
        ; DEC B
        ld b, 0x01
        dec b
        ld a, b
        cp 0x00
        jp nz, g13_f
        ; DEC C
        ld c, 0xFF
        dec c
        ld a, c
        cp 0xFE
        jp nz, g13_f
        ; DEC D
        ld d, 0x80
        dec d
        ld a, d
        cp 0x7F
        jp nz, g13_f
        ; DEC E
        ld e, 0x02
        dec e
        ld a, e
        cp 0x01
        jp nz, g13_f
        ; DEC H
        ld h, 0x11
        dec h
        ld a, h
        cp 0x10
        jp nz, g13_f
        ; DEC L
        ld l, 0xFF
        dec l
        ld a, l
        cp 0xFE
        jp nz, g13_f
        ; DEC (HL): HL=SCRATCH
        ld hl, SCRATCH
        ld (hl), 0x05
        dec (hl)
        ld a, (hl)
        cp 0x04
        jp nz, g13_f
        ; DEC B: 0x01 → 0x00, Z=1
        ld b, 0x01
        dec b
        jp nz, g13_f
        ld a, 'P'
        out (CONOUT), a
        jp g14
g13_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G14: INX/DCX/DAD (BC/DE/HL/SP)
; ==============================================================
g14:
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
        ; INX HL
        ld hl, 0xFFFF
        inc hl
        ld a, h
        cp 0x00
        jp nz, g14_f
        ld a, l
        cp 0x00
        jp nz, g14_f
        ; DCX HL
        ld hl, 0x0000
        dec hl
        ld a, h
        cp 0xFF
        jp nz, g14_f
        ld a, l
        cp 0xFF
        jp nz, g14_f
        ; DAD BC: HL=0x1000 + BC=0x0234 = 0x1234
        ld hl, 0x1000
        ld bc, 0x0234
        add hl, bc
        ld a, h
        cp 0x12
        jp nz, g14_f
        ld a, l
        cp 0x34
        jp nz, g14_f
        ; DAD DE: HL=0x1234 + DE=0x0001 = 0x1235
        ld de, 0x0001
        add hl, de
        ld a, h
        cp 0x12
        jp nz, g14_f
        ld a, l
        cp 0x35
        jp nz, g14_f
        ; DAD SP: SP=0x1F00, HL=0x0000 → HL=0x1F00
        ld hl, 0x0000
        add hl, sp
        ld a, h
        cp 0x1F
        jp nz, g14_f
        ld a, l
        cp 0x00
        jp nz, g14_f
        ; INX SP / DCX SP
        ld sp, 0x1F00
        inc sp                  ; SP=0x1F01
        dec sp                  ; SP=0x1F00
        ld hl, 0x0000
        add hl, sp
        ld a, h
        cp 0x1F
        jp nz, g14_f
        ld a, l
        cp 0x00
        jp nz, g14_f
        ld sp, 0x1F00
        ld a, 'P'
        out (CONOUT), a
        jp g15
g14_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G15: STA/LDA/STAX/LDAX(DE)/SHLD/LHLD
; ==============================================================
g15:
        ; STA / LDA
        ld a, 0xCD
        ld (0x2100), a
        ld a, 0x00
        ld a, (0x2100)
        cp 0xCD
        jp nz, g15_f
        ; STAX DE / LDAX DE
        ld de, 0x2200
        ld a, 0xEF
        ld (de), a
        ld a, 0x00
        ld a, (de)
        cp 0xEF
        jp nz, g15_f
        ; STAX BC / LDAX BC
        ld bc, 0x2300
        ld a, 0xA1
        ld (bc), a
        ld a, 0x00
        ld a, (bc)
        cp 0xA1
        jp nz, g15_f
        ; SHLD / LHLD
        ld hl, 0x5678
        ld (0x2400), hl
        ld hl, 0x0000
        ld hl, (0x2400)
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
        ld a, 'P'
        out (CONOUT), a
        jp g16
g15_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G16: 回転/フラグ/NOP/DI/EI
; ==============================================================
g16:
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
        ; SCF: CY=1
        scf
        jp nc, g16_f
        ; CCF: CY → 0
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
        ; NOP — 実行するだけ (何もしない命令の確認)
        nop
        nop
        nop
        ; DI / EI — クラッシュしなければ OK
        di
        ei
        ld a, 'P'
        out (CONOUT), a
        jp g17
g16_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G17: JP 全 8 条件 (Z/NZ/C/NC/M/P/PE/PO)
; ==============================================================
g17:
        ; JP Z
        ld a, 0x00
        and a                   ; Z=1
        jp z, g17_z_ok
        jp g17_f
g17_z_ok:
        ; JP NZ
        ld a, 0x01
        and a                   ; Z=0
        jp nz, g17_nz_ok
        jp g17_f
g17_nz_ok:
        ; JP C
        scf
        jp c, g17_c_ok
        jp g17_f
g17_c_ok:
        ; JP NC
        and a                   ; CY=0
        jp nc, g17_nc_ok
        jp g17_f
g17_nc_ok:
        ; JP M (S=1)
        ld a, 0x80
        and a
        jp m, g17_m_ok
        jp g17_f
g17_m_ok:
        ; JP P (S=0)
        ld a, 0x7F
        and a
        jp p, g17_p_ok
        jp g17_f
g17_p_ok:
        ; JP PE (P=1 even parity): 0x03 = 00000011 (2 bits) → even
        ld a, 0xFF
        and 0x03                ; P=1 (even)
        jp pe, g17_pe_ok
        jp g17_f
g17_pe_ok:
        ; JP PO (P=0 odd parity): 0x01 = 00000001 (1 bit) → odd
        ld a, 0xFF
        and 0x01                ; P=0 (odd)
        jp po, g17_po_ok
        jp g17_f
g17_po_ok:
        ld a, 'P'
        out (CONOUT), a
        jp g18
g17_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G18: CALL 全 8 条件
; ==============================================================
g18:
        ; CALL Z (Z=1 → 呼ばれる)
        ld a, 0x00
        and a
        call z, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL NZ (Z=0 → 呼ばれる)
        ld b, 0x00
        ld a, 0x01
        and a
        call nz, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL Z (Z=0 → 呼ばれない): B は変わらない
        ld b, 0xAA
        ld a, 0x01
        and a
        call z, sub_set_b_01
        ld a, b
        cp 0xAA
        jp nz, g18_f
        ; CALL C (CY=1 → 呼ばれる)
        ld b, 0x00
        scf
        call c, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL NC (CY=0 → 呼ばれる)
        ld b, 0x00
        and a                   ; CY=0
        call nc, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL M (S=1 → 呼ばれる)
        ld b, 0x00
        ld a, 0x80
        and a
        call m, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL P (S=0 → 呼ばれる)
        ld b, 0x00
        ld a, 0x01
        and a
        call p, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL PE (P=1 → 呼ばれる): 0x03 even parity
        ld b, 0x00
        ld a, 0xFF
        and 0x03
        call pe, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ; CALL PO (P=0 → 呼ばれる): 0x01 odd parity
        ld b, 0x00
        ld a, 0xFF
        and 0x01
        call po, sub_set_b_01
        ld a, b
        cp 0x01
        jp nz, g18_f
        ld a, 'P'
        out (CONOUT), a
        jp g19
g18_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G19: RET 全 8 条件
; ==============================================================
g19:
        ; RET Z: Z=1 → 戻る
        ld b, 0x00
        call sub_ret_z
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET NZ: Z=0 → 戻る
        ld b, 0x00
        call sub_ret_nz
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET C: CY=1 → 戻る
        ld b, 0x00
        call sub_ret_c
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET NC: CY=0 → 戻る
        ld b, 0x00
        call sub_ret_nc
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET M: S=1 → 戻る
        ld b, 0x00
        call sub_ret_m
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET P: S=0 → 戻る
        ld b, 0x00
        call sub_ret_p
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET PE: P=1 → 戻る
        ld b, 0x00
        call sub_ret_pe
        ld a, b
        cp 0x19
        jp nz, g19_f
        ; RET PO: P=0 → 戻る
        ld b, 0x00
        call sub_ret_po
        ld a, b
        cp 0x19
        jp nz, g19_f
        ld a, 'P'
        out (CONOUT), a
        jp g20
g19_f:
        ld a, 'F'
        out (CONOUT), a

; ==============================================================
; G20: RST (RST 1 @ 0x0008, RST 7 @ 0x0038)
; ==============================================================
g20:
        ; RST 1 → ハンドラが B=0x81 をセット
        ld b, 0x00
        rst 0x08
        ld a, b
        cp 0x81
        jp nz, g20_f
        ; RST 7 → ハンドラが B=0x87 をセット
        ld b, 0x00
        rst 0x38
        ld a, b
        cp 0x87
        jp nz, g20_f
        ld a, 'P'
        out (CONOUT), a
        jp done

g20_f:
        ld a, 'F'
        out (CONOUT), a

done:
        ld a, 0x0D
        out (CONOUT), a
        ld a, 0x0A
        out (CONOUT), a
        halt

; ==============================================================
; サブルーチン
; ==============================================================
sub_set_b_01:
        ld b, 0x01
        ret

sub_ret_z:
        ld b, 0x19
        ld a, 0x00
        and a                   ; Z=1
        ret z
        ld b, 0x00
        ret

sub_ret_nz:
        ld b, 0x19
        ld a, 0x01
        and a                   ; Z=0
        ret nz
        ld b, 0x00
        ret

sub_ret_c:
        ld b, 0x19
        scf                     ; CY=1
        ret c
        ld b, 0x00
        ret

sub_ret_nc:
        ld b, 0x19
        and a                   ; CY=0
        ret nc
        ld b, 0x00
        ret

sub_ret_m:
        ld b, 0x19
        ld a, 0x80
        and a                   ; S=1
        ret m
        ld b, 0x00
        ret

sub_ret_p:
        ld b, 0x19
        ld a, 0x01
        and a                   ; S=0
        ret p
        ld b, 0x00
        ret

sub_ret_pe:
        ld b, 0x19
        ld a, 0xFF
        and 0x03                ; P=1 (even)
        ret pe
        ld b, 0x00
        ret

sub_ret_po:
        ld b, 0x19
        ld a, 0xFF
        and 0x01                ; P=0 (odd)
        ret po
        ld b, 0x00
        ret
