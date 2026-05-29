; 8080pre_cpm.asm — 8080 前段命令テスト (CP/M COM 版)
;
; 原典: verilog/vm80a/tst/8080pre.asm
;   prelim.z80  Copyright (C) 1994  Frank D. Cringle (GPL)
;   8080 移植: Ian Bartholomew
;
; CP/M 変換: org 0x0100, SP 初期化, allok を "Tests complete" 出力+ret に置換,
;            tcond マクロをインライン展開。z80asm v1.8 (8080 互換命令のみ使用)。
;
; ビルド:
;   z80asm --output=8080PRE.COM 8080pre_cpm.asm
;
; 実行:
;   cpm --exec 8080PRE  (成功: "Tests complete", 失敗: タイムアウト)
;
; テスト内容:
;   CPI/JZ/JNZ, CALL/RET (unconditional),
;   レジスタ一意性 (AF/BC/DE/HL), (HL) 間接アクセス,
;   ANI/RRC, LXI+PUSH+POP, 条件分岐 CALL/RET/JP (全 4 フラグ),
;   PCHL, DCR/INR ループ, INX ループ
;
; I/O ポート:
;   0x01 OUT - CONOUT: コンソール文字出力

CONOUT: equ     0x01
fault:  equ     0x8000          ; 失敗トラップ (CP/M 管理外 → タイムアウト = FAIL)

    org     0x0100

; ==============================================================
; エントリポイント
; ==============================================================
start:
    ld      sp, stack

    ; CPI/JZ/JNZ の基本動作確認
    ld      a, 1
    cp      2
    jp      z, fault+$
    cp      1
    jp      nz, fault+$
    jp      lab0
    halt
    defb    0xFF

lab0:
    call    lab2            ; CALL 命令の動作確認
lab1:
    jp      fault+$         ; ここへ到達したら FAIL

lab2:
    pop     hl              ; RET アドレスを取得して確認
    ld      a, h
    cp      lab1 >> 8
    jp      z, lab3
    jp      fault+$
lab3:
    ld      a, l
    cp      lab1 & 0xFF
    jp      z, lab4
    jp      fault+$

; ==============================================================
; レジスタ一意性テスト (AF/BC/DE/HL)
; ==============================================================
lab4:
    ld      sp, regs1
    pop     af
    pop     bc
    pop     de
    pop     hl
    ld      sp, regs2+8
    push    hl
    push    de
    push    bc
    push    af

    ld      a, (regs2+0)
    cp      2
    jp      nz, fault+$
    ld      a, (regs2+1)
    cp      4
    jp      nz, fault+$
    ld      a, (regs2+2)
    cp      6
    jp      nz, fault+$
    ld      a, (regs2+3)
    cp      8
    jp      nz, fault+$

    ld      a, (regs2+4)
    cp      10
    jp      nz, fault+$
    ld      a, (regs2+5)
    cp      12
    jp      nz, fault+$
    ld      a, (regs2+6)
    cp      14
    jp      nz, fault+$
    ld      a, (regs2+7)
    cp      16
    jp      nz, fault+$

; ==============================================================
; (HL) 間接アクセステスト
; ==============================================================
    ld      hl, hlval
    ld      a, (hl)
    cp      0xA5
    jp      nz, fault+$
    ld      hl, hlval+1
    ld      a, (hl)
    cp      0x3C
    jp      nz, fault+$

; ==============================================================
; RET 命令（無条件）テスト
; ==============================================================
    ld      sp, stack
    ld      hl, reta
    push    hl
    ret
    jp      fault+$

; ==============================================================
; ANI/RRC テスト (hex 出力に必要な命令の前段確認)
; ==============================================================
reta:
    ld      a, 0xFF
    and     0x0F
    cp      0x0F
    jp      nz, fault+$
    ld      a, 0x5A
    and     0x0F
    cp      0x0A
    jp      nz, fault+$
    rrca
    cp      0x05
    jp      nz, fault+$
    rrca
    cp      0x82
    jp      nz, fault+$
    rrca
    cp      0x41
    jp      nz, fault+$
    rrca
    cp      0xA0
    jp      nz, fault+$
    ld      hl, 0x1234
    push    hl
    pop     bc
    ld      a, b
    cp      0x12
    jp      nz, fault+$
    ld      a, c
    cp      0x34
    jp      nz, fault+$

; ==============================================================
; 条件付き CALL / RET / JP テスト (4 フラグ × 正/逆 = 8 命令)
; インライン展開: tcond flag, pcond, ncond
; ==============================================================

; ---- tcond 0x01, c, nc  (CY フラグ) ----
    ld      hl, 0x01
    push    hl
    pop     af
    call    c, tc_c_1
    jp      fault+$
tc_c_1:
    pop     hl
    ld      hl, 0xD6        ; 0xD7 ^ 0x01
    push    hl
    pop     af
    call    nc, tc_c_2
    jp      fault+$
tc_c_2:
    pop     hl
    ld      hl, tc_c_3
    push    hl
    ld      hl, 0x01
    push    hl
    pop     af
    ret     c
    jp      fault+$
tc_c_3:
    ld      hl, tc_c_4
    push    hl
    ld      hl, 0xD6
    push    hl
    pop     af
    ret     nc
    jp      fault+$
tc_c_4:
    ld      hl, 0x01
    push    hl
    pop     af
    jp      c, tc_c_5
    jp      fault+$
tc_c_5:
    ld      hl, 0xD6
    push    hl
    pop     af
    jp      nc, tc_c_6
    jp      fault+$
tc_c_6:

; ---- tcond 0x04, pe, po  (P フラグ) ----
    ld      hl, 0x04
    push    hl
    pop     af
    call    pe, tc_pe_1
    jp      fault+$
tc_pe_1:
    pop     hl
    ld      hl, 0xD3        ; 0xD7 ^ 0x04
    push    hl
    pop     af
    call    po, tc_pe_2
    jp      fault+$
tc_pe_2:
    pop     hl
    ld      hl, tc_pe_3
    push    hl
    ld      hl, 0x04
    push    hl
    pop     af
    ret     pe
    jp      fault+$
tc_pe_3:
    ld      hl, tc_pe_4
    push    hl
    ld      hl, 0xD3
    push    hl
    pop     af
    ret     po
    jp      fault+$
tc_pe_4:
    ld      hl, 0x04
    push    hl
    pop     af
    jp      pe, tc_pe_5
    jp      fault+$
tc_pe_5:
    ld      hl, 0xD3
    push    hl
    pop     af
    jp      po, tc_pe_6
    jp      fault+$
tc_pe_6:

; ---- tcond 0x40, z, nz  (Z フラグ) ----
    ld      hl, 0x40
    push    hl
    pop     af
    call    z, tc_z_1
    jp      fault+$
tc_z_1:
    pop     hl
    ld      hl, 0x97        ; 0xD7 ^ 0x40
    push    hl
    pop     af
    call    nz, tc_z_2
    jp      fault+$
tc_z_2:
    pop     hl
    ld      hl, tc_z_3
    push    hl
    ld      hl, 0x40
    push    hl
    pop     af
    ret     z
    jp      fault+$
tc_z_3:
    ld      hl, tc_z_4
    push    hl
    ld      hl, 0x97
    push    hl
    pop     af
    ret     nz
    jp      fault+$
tc_z_4:
    ld      hl, 0x40
    push    hl
    pop     af
    jp      z, tc_z_5
    jp      fault+$
tc_z_5:
    ld      hl, 0x97
    push    hl
    pop     af
    jp      nz, tc_z_6
    jp      fault+$
tc_z_6:

; ---- tcond 0x80, m, p  (S フラグ) ----
    ld      hl, 0x80
    push    hl
    pop     af
    call    m, tc_m_1
    jp      fault+$
tc_m_1:
    pop     hl
    ld      hl, 0x57        ; 0xD7 ^ 0x80
    push    hl
    pop     af
    call    p, tc_m_2
    jp      fault+$
tc_m_2:
    pop     hl
    ld      hl, tc_m_3
    push    hl
    ld      hl, 0x80
    push    hl
    pop     af
    ret     m
    jp      fault+$
tc_m_3:
    ld      hl, tc_m_4
    push    hl
    ld      hl, 0x57
    push    hl
    pop     af
    ret     p
    jp      fault+$
tc_m_4:
    ld      hl, 0x80
    push    hl
    pop     af
    jp      m, tc_m_5
    jp      fault+$
tc_m_5:
    ld      hl, 0x57
    push    hl
    pop     af
    jp      p, tc_m_6
    jp      fault+$
tc_m_6:

; ==============================================================
; PCHL (JP (HL)) テスト
; ==============================================================
    ld      hl, lab7
    jp      (hl)
    jp      fault+$

; ==============================================================
; DCR/INR ループ + INX ループ
; ==============================================================
lab7:
    ld      a, 0xA5
    ld      b, 4
lab8:
    rrca
    dec     b
    jp      nz, lab8
    cp      0x5A
    call    nz, fault+$
    ld      b, 16
lab9:
    inc     a
    dec     b
    jp      nz, lab9
    cp      0x6A
    call    nz, fault+$
    ld      b, 0
    ld      hl, 0
lab10:
    inc     hl
    dec     b
    jp      nz, lab10
    ld      a, h
    cp      1
    call    nz, fault+$
    ld      a, l
    cp      0
    call    nz, fault+$

; ==============================================================
; 全テスト通過 → "Tests complete" 出力して CP/M に戻る
; ==============================================================
allok:
    ld      hl, msg_done
    call    print_str
    ret

; ==============================================================
; print_str: HL の 0 終端文字列を CONOUT に出力
; ==============================================================
print_str:
    ld      a, (hl)
    or      a
    ret     z
    out     (CONOUT), a
    inc     hl
    jp      print_str

; ==============================================================
; データ
; ==============================================================
msg_done:
    defm    "Tests complete"
    defb    0x0D, 0x0A, 0

regs1:  defb    2, 4, 6, 8, 10, 12, 14, 16
regs2:  defs    8, 0

hlval:  defb    0xA5, 0x3C

    defs    120
stack:  equ     $
