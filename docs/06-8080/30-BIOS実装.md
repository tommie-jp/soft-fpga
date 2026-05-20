# 30. カスタム BIOS 実装

## 1. 概要

CP/M 2.2 の BIOS（Basic I/O System）は、OS とハードウェアの間を仲介する層。
実機では ROM に焼かれているが、本プロジェクトでは **C++ ハーネスと IN/OUT ポートで通信する
カスタム BIOS** を z80asm で実装し、64 KB RAM の末尾に配置する。

| 項目 | 内容 |
|------|------|
| ソース | `examples/06-8080/sw/cpm/bios/bios.asm` |
| アセンブラ | z80asm v1.8（8080 互換命令のみ使用） |
| 配置アドレス | `$F200–$FFFF`（最大 3.5 KB） |
| 通信手段 | 8080 IN / OUT 命令 → C++ ハーネスが処理 |

---

## 2. メモリ配置

```
$0000–$00FF  ページ 0（リスタートベクタ・BDOS エントリ）
$0100–$DBFF  TPA（ユーザプログラム領域）
$DC00–$E3FF  CCP（コマンドラインプロセッサ、2 KB）
$E400–$F1FF  BDOS（基本ディスク OS、3.5 KB）
$F200–$FFFF  BIOS ← このファイル
  $F200      ジャンプテーブル（17 エントリ × 3 B = 51 B）
  $F200+51   変数エリア（CUR_DRV / CUR_TRK / CUR_SEC / DMA_LO / DMA_HI）
  ...        BOOT / WBOOT / CONST / CONIN / CONOUT / ...
  末尾       DIR_BUF / CSV / ALV バッファ
```

---

## 3. ジャンプテーブル

BIOS の先頭 51 バイトはジャンプテーブル。BDOS がここを介して BIOS を呼び出す。

| オフセット | エントリ | 機能 |
|-----------|---------|------|
| +0 | BOOT | コールドブート |
| +3 | WBOOT | ウォームブート |
| +6 | CONST | コンソールステータス |
| +9 | CONIN | コンソール入力 |
| +12 | CONOUT | コンソール出力 |
| +15 | LIST | プリンタ出力（→ CONOUT にフォールバック） |
| +18 | PUNCH | 紙テープ穿孔（no-op） |
| +21 | READER | 紙テープ読み取り（EOF 返却） |
| +24 | HOME | トラック 0 へシーク |
| +27 | SELDSK | ディスク選択 |
| +30 | SETTRK | トラック番号設定 |
| +33 | SETSEC | セクタ番号設定 |
| +36 | SETDMA | DMA アドレス設定 |
| +39 | READ | セクタ読み取り |
| +42 | WRITE | セクタ書き込み |
| +45 | LISTST | プリンタステータス（常に ready） |
| +48 | SECTRAN | セクタ変換（スキューテーブル参照） |

---

## 4. 主要ルーティン

### 4.1 BOOT（コールドブート）

1. スタックポインタを `$F200 - 2` に設定
2. ページ 0 にジャンプベクタを書き込む
   - `$0000`: `JMP WBOOT`
   - `$0005`: `JMP BDOS+6`
3. サインオンメッセージを CONOUT に出力
4. ドライブ A: を選択（`SELDSK(0)`）
5. `JP CCP_BASE`（`$DC00`）でコールドエントリ

```
64K CP/M VERS 2.2 for vm80a soft-FPGA WASM
BIOS (C) 2026 tommie.jp
```

### 4.2 WBOOT（ウォームブート）

1. スタックポインタ・ページ 0 ベクタをコールドブートと同じ手順で再設定
2. `OUT (PORT_WBOOT), A` — ハーネスに CCP+BDOS の再ロードを要求
3. `$0004` に保存されたドライブ番号を引き継いで `SELDSK`
4. `JP CCP_BASE + 3`（ウォームエントリ）

> ウォームブートではサインオンメッセージを出さない。これは CP/M の標準動作。

### 4.3 CONST / CONIN / CONOUT

| ルーティン | ポート | 動作 |
|-----------|--------|------|
| CONST | `$02 IN` | 0=入力なし / 1=あり → A=0x00 / 0xFF |
| CONIN | `$02 IN` でポーリング後 `$00 IN` | 7 bit マスクして返却 |
| CONOUT | `$01 OUT` | C レジスタの 1 文字を出力 |

### 4.4 SELDSK（ドライブ選択）

```
引数 : C = ドライブ番号 (0=A, 1=B, 2=C, 3=D)
戻り値: HL = DPH アドレス（エラー時 HL=0）
```

1. `CUR_DRV` に保存、`OUT (PORT_DDRV)` でハーネスに通知
2. 番号が N_DRIVES（4）以上なら HL=0 でエラー返却
3. `DPH_TABLE` から対応 DPH のポインタを返す

### 4.5 READ / WRITE

```asm
READ:
    ld  a, 0
    out (PORT_DCMD), a   ; コマンド送信（0=READ）
    in  a, (PORT_DCMD)   ; 結果取得（0=OK, 1=error）
    ret

WRITE:
    ld  a, 1
    out (PORT_DCMD), a   ; コマンド送信（1=WRITE）
    in  a, (PORT_DCMD)
    ret
```

SETTRK / SETSEC / SETDMA が事前にトラック・セクタ・転送先アドレスをポートに OUT しており、
`PORT_DCMD` への OUT が「確定・実行」のトリガーになる。

---

## 5. I/O ポートまとめ

| ポート | 方向 | 記号 | 用途 |
|--------|------|------|------|
| `$00` | IN | CONIN | コンソール 1 バイト読み取り |
| `$01` | OUT | CONOUT | コンソール 1 バイト出力 |
| `$02` | IN | CONST | コンソールステータス（0=なし, 1=あり） |
| `$10` | OUT | DCMD | ディスクコマンド（0=READ, 1=WRITE） |
| `$10` | IN | DSTS | ディスク結果（0=OK） |
| `$11` | OUT | DTRK | トラック番号 |
| `$12` | OUT | DSEC | セクタ番号（SECTRAN 変換後） |
| `$13` | OUT | DDMA_L | DMA アドレス低バイト |
| `$14` | OUT | DDMA_H | DMA アドレス高バイト |
| `$15` | OUT | DDRV | ドライブ番号（0=A, 1=B, 2=C, 3=D） |
| `$20` | OUT | WBOOT | CCP+BDOS 再ロード要求（ウォームブート専用） |

---

## 6. ディスクパラメータ構造

### 6.1 DPH（Disk Parameter Header）

4 ドライブ（A–D）それぞれに DPH を持つ。

```
DPH_A:
  defw SKEW_TABLE   ; XLT  スキューテーブルへのポインタ
  defw 0            ; scratch 1
  defw 0            ; scratch 2
  defw 0            ; scratch 3
  defw DIR_BUF      ; DIRBUF  全ドライブ共用（同時アクセスなし）
  defw DPB_A        ; DPB     全ドライブ共用（同一フォーマット）
  defw CSV_A        ; CSV     チェックサムベクタ（A 専用）
  defw ALV_A        ; ALV     アロケーションベクタ（A 専用）
```

### 6.2 DPB（Disk Parameter Block）— 標準 8 インチ SSSD

| フィールド | 値 | 意味 |
|-----------|-----|------|
| SPT | 26 | セクタ/トラック |
| BSH | 3 | ブロックサイズシフト（1 KB ブロック） |
| BLM | 7 | ブロックマスク |
| EXM | 0 | エクステントマスク |
| DSM | 242 | 最大ブロック番号 |
| DRM | 63 | 最大ディレクトリエントリ番号 |
| AL0 | 0xC0 | ディレクトリ占有ブロック |
| AL1 | 0x00 | |
| CKS | 16 | チェックサムサイズ |
| OFF | 2 | 予約トラック数 |

### 6.3 SECTRAN — IBM 3740 スキューテーブル

スキュー係数 6、SPT=26 の 0-indexed スキューテーブル。
論理セクタ→物理セクタの変換でヘッドシーク待ちを最小化する。

```
論理:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25
物理:  0  6 12 18 24  4 10 16 22  2  8 14 20  1  7 13 19 25  5 11 17 23  3  9 15 21
```

---

## 7. ハーネスとの連携フロー

```
CP/M アプリ
  ↓ BDOS 呼び出し ($0005)
BDOS
  ↓ BIOS ジャンプテーブル呼び出し
BIOS (bios.asm)
  ↓ OUT 命令でポートに値を書き込む
C++ ハーネス (harness.cpp) の port_out() / port_in()
  ↓ コンソール: xterm.js 経由でブラウザに表示
  ↓ ディスク: DSK イメージのセクタ読み書き
```

---

## 8. 参考

- [`bios.asm`](../../examples/06-8080/sw/cpm/bios/bios.asm) — BIOS ソース
- [01-実装計画.md](01-実装計画.md) — 全体アーキテクチャ
- [52-メモリマップ.md](52-メモリマップ.md) — I/O ポートマップ詳細・ディスクパラメータ
- [13-テスト手順.md](13-テスト手順.md) — BIOS 動作確認手順
