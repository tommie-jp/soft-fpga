# 56. simh `altair` の CP/M — 参考になること

`altair` コマンドの `altcpm.dsk` から得られる知見のまとめ。
soft-FPGA の BIOS 実装・CP/M デバッグ・8080 開発の参考資料として使う。

---

## 1. ディスク収録ファイル

```text
sim> attach dsk0 altcpm.dsk
sim> go 177400
A> ls
```

```text
ABOOT62 ASM    1K   DDT     COM    5K   LOAD    COM    2K   STAT    COM    6K
ASM     COM    8K   DUMP    ASM    5K   LS      COM    3K   SUBMIT  COM    2K
CBIOS   ASM    8K   DUMP    COM    1K   MOVCPM  COM   12K   SURVEY  COM    2K
COPY    COM    1K   ED      COM    7K   PIP     COM    8K   SYSGEN  SUB    1K
CPM62   COM    9K   FORMAT  COM    2K   PTD     ASM    2K   XSUB    COM    1K
```

ユーティリティ（.COM）と **BIOS・ブートローダのアセンブラソース（.ASM）** が両方入っている。

---

## 2. CBIOS.ASM — BIOS ソースコードの参考

`CBIOS.ASM` は本プロジェクトの `bios.asm` と直接比較できる実物 BIOS ソース。

### メモリ配置（62 KB 構成）

```text
MSIZE  = 62           ; 62 KB RAM
BIAS   = (62-20)*1024 = 43008 = 0xA800

CCP    = 0x3400 + 0xA800 = 0xDC00   ← 本プロジェクトと同一
BDOS   = CCP + 0x806  = 0xE406
BIOS   = CCP + 0x1600 = 0xF200      ← 本プロジェクトと同一
```

### ジャンプテーブル構造（本プロジェクトと同一順序）

```text
BOOT / WBOOT / CONST / CONIN / CONOUT / LIST / PUNCH / READER
HOME / SELDSK / SETTRK / SETSEC / SETDMA / READ / WRITE / LISTST / SECTRN
```

### MITS 88-DISK パラメータ（本プロジェクトとの差異）

| 項目 | altcpm（MITS） | 本プロジェクト（IBM 3740） |
|------|:--------------:|:------------------------:|
| セクタ/トラック (SPT) | 32 | 26 |
| ブロックサイズシフト (BSH) | 3 | 3 |
| 予約トラック (OFF) | 6 | 2 |
| ディレクトリエントリ (DRM) | 255 | 63 |

### スキューテーブル（ATRANS）

```text
01 18 03 20 05 22 07 24 09 26 11 28 13 30 15 32
17 02 19 04 21 06 23 08 25 10 27 12 29 14 31 16
```

スキュー係数は実質 17（1 セクタ読み取り後、次の物理セクタが 17 番先に来る計算）。
IBM 3740 のスキュー係数 6 と比べて積極的にシーク待ちを最小化している。

---

## 3. SURVEY — システム状態の確認

`A> SURVEY`

```text
Drive A: 94K bytes in 20 files with 161K bytes remaining

Memory map:
0       8       16      24      32      40      48      56      64
|       |       |       |       |       |       |       |       |
 TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTCCCBBBB
T=TPA   C=CPM   B=BIOS or unassigned

BIOS at F203    iobyte 2E    drive 00    BDOS at E406

Active I/O ports:
08 09 0A          ← MITS 88-DISK コントローラ
10 11 12 13       ← 2SIO シリアル（コンソール）
FF
```

**本プロジェクトとの I/O ポート比較:**

| 役割 | 本プロジェクト | altair（simh） |
|------|:-------------:|:--------------:|
| コンソール入力 | `0x00` | `0x10` (2SIO) |
| コンソール出力 | `0x01` | `0x11` (2SIO) |
| コンソール状態 | `0x02` | `0x10` (2SIO status) |
| ディスクコマンド | `0x10` | `0x08` (88-DISK) |
| ディスクトラック | `0x11` | `0x09` |
| ディスクセクタ | `0x12` | `0x0A` |

---

## 4. DDT — 8080 インタラクティブデバッガ

### 起動

```text
A> DDT PROG.COM
DDT VERS 2.2
NEXT  PC
0280 0100
-
```

`NEXT` = 次の空きアドレス、`PC` = 実行開始アドレス（`0x0100` 固定）。

### DDT コマンド

| コマンド | 動作 | 例 |
|---------|------|----|
| `d<addr>` | メモリ HEX ダンプ（16 行） | `d100` |
| `d<addr>,<addr>` | 範囲指定ダンプ | `d100,11F` |
| `x` | 全レジスタ表示 | `x` |
| `x<reg>` | レジスタ変更 | `xPC` → 新しいアドレスを入力 |
| `u<addr>` | 逆アセンブル（8 命令） | `u100` |
| `g<addr>` | アドレスから実行 | `g100` |
| `g,<bp>` | ブレークポイント付きで実行 | `g,0150` |
| `t` | 1 命令トレース | `t` |
| `t<n>` | n 命令トレース | `t10` |
| `s<addr>` | メモリ直接書き込み | `s100` → 対話入力 |
| `i<file>` | Intel HEX ファイルをロード | `ifoo.hex` |
| `r<offset>` | HEX を offset 付きでロード | `r2E00` |
| `^C` | DDT 終了、CP/M へ戻る | |

### 実行例

```text
-d100
0100 21 00 00 39 22 61 02 31 B7 02 CD 0D 02 FE FF C2  !..9"a.1........

-x
C0Z0M0E0I0 A=00 B=0000 D=0000 H=0000 S=0100 P=0100 LXI  H,0000

-u100
0100 21 00 00    LXI  H,0000
0103 39          DAD  SP
0104 22 61 02    SHLD 0261
0107 31 B7 02    LXI  SP,02B7
010A CD 0D 02    CALL 020D
```

---

## 5. ASM + LOAD — CP/M 上の 8080 開発ワークフロー

### 手順

```text
A> ED HELLO.ASM          ← ソース作成（または PIP でホストから転送）
A> ASM HELLO.AAZ         ← アセンブル（ソース.ASM → 中間.HEX + リスト.PRN）
A> LOAD HELLO            ← HEX → COM 変換
A> HELLO                 ← 実行
```

`ASM` の引数は `<name>.AAZ`（.ASM の代わりに .AAZ）。
出力: `<name>.HEX`（Intel HEX 形式）+ `<name>.PRN`（リスト）。

### 最小プログラム例

```text
; hello.asm  — CP/M Hello World
        ORG     100H
        MVI     C,9           ; BDOS function 9 = print string
        LXI     D,MSG
        CALL    5             ; BDOS entry
        RST     0             ; warm boot
MSG:    DB      'HELLO, WORLD!$'
        END
```

アセンブル後:

```text
=== ASM ===
CP/M ASSEMBLER - VER 2.0
010B
000H USE FACTOR
END OF ASSEMBLY

=== LOAD ===
FIRST ADDRESS 0100
LAST  ADDRESS 010A
BYTES READ    000B
RECORDS WRITTEN 01
```

---

## 6. simh ハードウェアデバッガとの併用

CP/M 実行中に `^E`（デフォルト WRU 文字）を押すと SIMH プロンプトへ割り込める。

```text
A> DIR
^E
Simulation stopped, PC: F234 (BIOS 内)
sim> examine PC
PC:     F234
sim> break F200       # BIOS BOOT エントリにブレークポイント
sim> cont             # CP/M 再開
```

soft-FPGA の `Ctrl+T` ステータス表示（[19-インタラクティブコマンド.md](19-インタラクティブコマンド.md)）と
同等の機能を simh 側でも持っており、CP/M のどこにいるか確認できる。

---

## 7. その他の便利ユーティリティ

### PIP — ファイルコピー

```text
A> PIP B:=A:PROG.COM    # A ドライブから B ドライブへ
A> PIP A:OUT.TXT=CON:   # コンソール入力をファイルへ（^Z で終了）
```

### STAT — ファイル・ドライブ情報

```text
A> STAT *.COM           # COM ファイルのサイズ一覧
A> STAT DSK:            # ドライブのパラメータ表示
A> STAT VAL:            # STAT のオプション一覧
```

### SUBMIT — バッチ実行

```text
A> SUBMIT SYSGEN        # SYSGEN.SUB を実行（CP/M イメージ再生成）
```

---

## 8. 参考

- `CBIOS.ASM` — ディスク上の Altair BIOS 完全ソース（`type cbios.asm` で閲覧）
- [30-BIOS実装.md](30-BIOS実装.md) — 本プロジェクトの BIOS との比較
- [55-simh-使い方.md](55-simh-使い方.md) — simh 基本操作・起動手順
