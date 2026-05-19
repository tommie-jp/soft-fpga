; bios.asm — CP/M 2.2 BIOS for soft-FPGA 8080 simulator
;
; アセンブラ: z80asm v1.8 (8080 互換命令のみ使用)
; ビルド: z80asm --output=bios.bin bios.asm
;
; メモリ配置 (64KB):
;   0x0000-0x00FF  ページ 0 (リスタートベクタ・BDOS エントリ)
;   0x0100-0xDBFF  TPA (Transient Program Area)
;   0xDC00-0xE3FF  CCP  (2KB)
;   0xE400-0xF1FF  BDOS (3.5KB)
;   0xF200-0xFFFF  BIOS (このファイル)
;
; I/O ポート:
;   0x00 IN  - CONIN:  コンソール文字読み取り
;   0x01 OUT - CONOUT: コンソール文字出力
;   0x02 IN  - CONST:  コンソールステータス (0=空, 1=ready)
;   0x10 OUT - DCMD:   ディスクコマンド (0=READ, 1=WRITE)
;   0x10 IN  - DSTS:   ディスク結果    (0=OK, 1=error)
;   0x11 OUT - DTRK:   トラック番号
;   0x12 OUT - DSEC:   セクタ番号
;   0x13 OUT - DDMA_L: DMA アドレス低バイト
;   0x14 OUT - DDMA_H: DMA アドレス高バイト
;   0x20 OUT - WBOOT:  ハーネスに CCP 再ロードを要求 (WBOOT 専用)

BIOS_BASE:  equ 0xF200
BDOS_BASE:  equ 0xE400
CCP_BASE:   equ 0xDC00

PORT_CONIN:  equ 0x00
PORT_CONOUT: equ 0x01
PORT_CONST:  equ 0x02
PORT_DCMD:   equ 0x10
PORT_DTRK:   equ 0x11
PORT_DSEC:   equ 0x12
PORT_DDMA_L: equ 0x13
PORT_DDMA_H: equ 0x14
PORT_DDRV:   equ 0x15   ; ドライブ番号 (0=A, 1=B, 2=C, 3=D)
PORT_WBOOT:  equ 0x20   ; WBOOT 信号: ハーネスに CCP 再ロードを要求

N_DRIVES:    equ 4

    org BIOS_BASE

; ==============================================================
; ジャンプテーブル — 17 エントリ × 3 バイト = 51 バイト
; ==============================================================
    jp  BOOT        ; 0: コールドブート
    jp  WBOOT       ; 1: ウォームブート
    jp  CONST       ; 2: コンソールステータス
    jp  CONIN       ; 3: コンソール入力
    jp  CONOUT      ; 4: コンソール出力
    jp  LIST        ; 5: プリンタ出力
    jp  PUNCH       ; 6: 紙テープ穿孔
    jp  READER      ; 7: 紙テープ読み取り
    jp  HOME        ; 8: トラック 0 シーク
    jp  SELDSK      ; 9: ディスク選択
    jp  SETTRK      ; 10: トラック番号設定
    jp  SETSEC      ; 11: セクタ番号設定
    jp  SETDMA      ; 12: DMA アドレス設定
    jp  READ        ; 13: セクタ読み取り
    jp  WRITE       ; 14: セクタ書き込み
    jp  LISTST      ; 15: プリンタステータス
    jp  SECTRAN     ; 16: セクタ変換

; ==============================================================
; 変数エリア
; ==============================================================
CUR_DRV: defb 0
CUR_TRK: defw 0
CUR_SEC: defb 0
DMA_LO:  defb 0x80
DMA_HI:  defb 0x00

; ==============================================================
; BOOT: コールドブート
; ==============================================================
BOOT:
    ld  sp, BIOS_BASE - 2

    ; 0x0000: JMP WBOOT
    ld  a, 0xC3
    ld  (0x0000), a
    ld  hl, BIOS_BASE + 3
    ld  (0x0001), hl

    ; 0x0005: JMP BDOS+6
    ld  (0x0005), a
    ld  hl, BDOS_BASE + 6
    ld  (0x0006), hl

    ld  c, 0
    call SELDSK
    jp  CCP_BASE

; ==============================================================
; WBOOT: ウォームブート
; ==============================================================
WBOOT:
    ld  sp, BIOS_BASE - 2

    ld  a, 0xC3
    ld  (0x0000), a
    ld  hl, BIOS_BASE + 3
    ld  (0x0001), hl
    ld  (0x0005), a
    ld  hl, BDOS_BASE + 6
    ld  (0x0006), hl

    ; 実機 BIOS はここで CCP をディスクから再読み込みする。
    ; シミュレータでは PORT_WBOOT 出力でハーネスに CCP 再ロードを依頼する。
    ; これにより CCP 変数 (E3ABh=Submit フラグ等) が初期値にリセットされる。
    xor a
    out (PORT_WBOOT), a

    ld  a, (0x0004)     ; CCP が保存した現在ドライブ番号を継承
    ld  c, a
    call SELDSK
    jp  CCP_BASE + 3    ; ウォームエントリ: ディスク再読み込みをスキップ

; ==============================================================
; CONST: コンソールステータス
; 戻り値: A=0xFF=文字あり, A=0x00=空
; ==============================================================
CONST:
    in  a, (PORT_CONST)
    or  a
    ld  a, 0x00
    jp  z, CONST_RET
    ld  a, 0xFF
CONST_RET:
    ret

; ==============================================================
; CONIN: コンソール入力（ブロッキング）
; 戻り値: A=文字
; ==============================================================
CONIN:
    in  a, (PORT_CONST)
    or  a
    jp  z, CONIN
    in  a, (PORT_CONIN)
    and 0x7F
    ret

; ==============================================================
; CONOUT: コンソール出力 / C=文字
; ==============================================================
CONOUT:
    ld  a, c
    out (PORT_CONOUT), a
    ret

; ==============================================================
; LIST: プリンタ出力 — CONOUT にフォールバック
; ==============================================================
LIST:
    ld  a, c
    out (PORT_CONOUT), a
    ret

; ==============================================================
; LISTST: プリンタステータス — 常に ready
; ==============================================================
LISTST:
    ld  a, 0xFF
    ret

; ==============================================================
; PUNCH: 紙テープ穿孔 — no-op
; ==============================================================
PUNCH:
    ret

; ==============================================================
; READER: 紙テープ読み取り — EOF を返す
; ==============================================================
READER:
    ld  a, 0x1A
    ret

; ==============================================================
; HOME: トラック 0 へシーク → SETTRK(0) へ
; ==============================================================
HOME:
    ld  bc, 0

; ==============================================================
; SETTRK: トラック番号設定 / BC=トラック
; ==============================================================
SETTRK:
    ld  a, c
    ld  (CUR_TRK), a
    ld  a, b
    ld  (CUR_TRK+1), a
    ld  a, c
    out (PORT_DTRK), a
    ret

; ==============================================================
; SELDSK: ディスク選択 / C=ドライブ
; 戻り値: HL=DPH, HL=0 でエラー
; ==============================================================
SELDSK:
    ld  a, c
    ld  (CUR_DRV), a
    out (PORT_DDRV), a      ; ハーネスにドライブ番号を通知
    cp  N_DRIVES
    jp  nc, SELDSK_ERR
    ld  hl, DPH_TABLE
    ld  b, 0
    ld  e, c
    add hl, de
    add hl, de              ; HL = DPH_TABLE + drive*2
    ld  e, (hl)
    inc hl
    ld  d, (hl)
    ex  de, hl              ; HL = DPH アドレス
    ret
SELDSK_ERR:
    ld  hl, 0
    ret

; ==============================================================
; SETSEC: セクタ番号設定 / BC=セクタ
; ==============================================================
SETSEC:
    ld  a, c
    ld  (CUR_SEC), a
    out (PORT_DSEC), a
    ret

; ==============================================================
; SETDMA: DMA アドレス設定 / BC=アドレス
; ==============================================================
SETDMA:
    ld  a, c
    ld  (DMA_LO), a
    out (PORT_DDMA_L), a
    ld  a, b
    ld  (DMA_HI), a
    out (PORT_DDMA_H), a
    ret

; ==============================================================
; READ: セクタ読み取り / 戻り値: A=0 正常
; ==============================================================
READ:
    ld  a, 0
    out (PORT_DCMD), a
    in  a, (PORT_DCMD)
    ret

; ==============================================================
; WRITE: セクタ書き込み / 戻り値: A=0 正常
; ==============================================================
WRITE:
    ld  a, 1
    out (PORT_DCMD), a
    in  a, (PORT_DCMD)
    ret

; ==============================================================
; SECTRAN: セクタ変換 (IBM 3740 スキューテーブル使用)
; BC=論理セクタ (0-indexed), DE=XLT テーブルアドレス
; HL=物理セクタ を返す
; ==============================================================
SECTRAN:
    ld  h, d
    ld  l, e        ; HL = XLT テーブルアドレス
    ld  d, 0
    ld  e, c        ; DE = 論理セクタ番号
    add hl, de      ; HL = XLT + logical_sector
    ld  l, (hl)     ; L = 物理セクタ番号
    ld  h, 0
    ret

; ==============================================================
; DPH テーブル — ドライブ A-D (各エントリ 2 バイト LE ポインタ)
; ==============================================================
DPH_TABLE:
    defw DPH_A
    defw DPH_B
    defw DPH_C
    defw DPH_D

; ==============================================================
; DPH — ドライブ A
; ==============================================================
DPH_A:
    defw SKEW_TABLE ; XLT (IBM 3740 スキューテーブル)
    defw 0          ; scratch 1
    defw 0          ; scratch 2
    defw 0          ; scratch 3
    defw DIR_BUF    ; DIRBUF (全ドライブ共用 — 同時アクセスなし)
    defw DPB_A      ; DPB    (全ドライブ共用 — 同一フォーマット)
    defw CSV_A      ; CSV
    defw ALV_A      ; ALV

; DPH — ドライブ B
DPH_B:
    defw SKEW_TABLE
    defw 0
    defw 0
    defw 0
    defw DIR_BUF
    defw DPB_A
    defw CSV_B
    defw ALV_B

; DPH — ドライブ C
DPH_C:
    defw SKEW_TABLE
    defw 0
    defw 0
    defw 0
    defw DIR_BUF
    defw DPB_A
    defw CSV_C
    defw ALV_C

; DPH — ドライブ D
DPH_D:
    defw SKEW_TABLE
    defw 0
    defw 0
    defw 0
    defw DIR_BUF
    defw DPB_A
    defw CSV_D
    defw ALV_D

; ==============================================================
; DPB — 標準 8インチ SSSD
; ==============================================================
DPB_A:
    defw 26         ; SPT
    defb 3          ; BSH
    defb 7          ; BLM
    defb 0          ; EXM
    defw 242        ; DSM
    defw 63         ; DRM
    defb 0xC0       ; AL0
    defb 0x00       ; AL1
    defw 16         ; CKS
    defw 2          ; OFF

; ==============================================================
; IBM 3740 セクタスキューテーブル (factor=6, SPT=26, 0-indexed)
; 論理セクタ 0-25 → 物理セクタ (0-indexed)
; ==============================================================
SKEW_TABLE:
    defb 0, 6, 12, 18, 24, 4, 10, 16, 22, 2, 8, 14, 20
    defb 1, 7, 13, 19, 25, 5, 11, 17, 23, 3, 9, 15, 21

; ==============================================================
; バッファ
; ==============================================================
DIR_BUF: defs 128
CSV_A:   defs 16
CSV_B:   defs 16
CSV_C:   defs 16
CSV_D:   defs 16
ALV_A:   defs 31
ALV_B:   defs 31
ALV_C:   defs 31
ALV_D:   defs 31
