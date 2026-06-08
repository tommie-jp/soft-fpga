# 54. Ubuntu (WSL2) で使える CP/M 関連ホストツール

WSL2 Ubuntu 24 で `apt install` できる CP/M 関連ツールのまとめ。

---

## 1. cpmtools — CP/M ディスクイメージ操作

```bash
sudo apt install cpmtools   # v2.23
```

本プロジェクトのディスクフォーマット: **`ibm-3740`**（8 インチ SSSD、26 セクタ/トラック）

### 1.1 ファイル一覧

```bash
cpmls -f ibm-3740 sw/cpm/disks/cpm22.dsk
```

オプション:

| オプション | 動作 |
|-----------|------|
| `-l` | 詳細表示（サイズ・属性付き） |
| `-c` | チェックサム表示 |
| `-A` | 全属性ユーザ含む |

### 1.2 ファイルコピー

```bash
# ホスト → CP/M ディスク
cpmcp -f ibm-3740 sw/cpm/disks/cpm22.dsk ./hello.asm 0:HELLO.ASM

# CP/M ディスク → ホスト
cpmcp -f ibm-3740 sw/cpm/disks/cpm22.dsk 0:RESULT.TXT ./result.txt

# テキストモード（改行変換あり）
cpmcp -f ibm-3740 -t sw/cpm/disks/cpm22.dsk 0:FOO.TXT ./foo.txt
```

- `0:` は CP/M のユーザ番号（通常 0〜15）
- CP/M ファイル名は英大文字・8+3 文字以内

### 1.3 ファイル削除

```bash
cpmrm -f ibm-3740 sw/cpm/disks/cpm22.dsk 0:OLD.COM
```

### 1.4 新規ディスクイメージ作成

```bash
# 256 KB 空ディスクを作る
dd if=/dev/zero bs=256k count=1 of=blank.dsk
mkfs.cpm -f ibm-3740 blank.dsk
```

### 1.5 ファイルシステム検査

```bash
fsck.cpm -f ibm-3740 sw/cpm/disks/cpm22.dsk
```

### 1.6 属性変更

```bash
# Read-Only フラグを付ける
cpmchattr -f ibm-3740 sw/cpm/disks/cpm22.dsk R 0:TURBO.COM

# System フラグを付ける
cpmchattr -f ibm-3740 sw/cpm/disks/cpm22.dsk s 0:BIOS.SYS
```

属性フラグ:

| フラグ | 意味 |
|--------|------|
| `R` / `r` | Read-Only オン / オフ |
| `S` / `s` | System オン / オフ |
| `A` / `a` | Archive オン / オフ |

---

## 2. z80asm — Z80/8080 アセンブラ

```bash
sudo apt install z80asm   # v1.8
```

本プロジェクトの BIOS（`sw/cpm/bios/bios.asm`）のビルドに使用。
8080 互換命令のみ使用すれば 8080 バイナリを生成できる。

```bash
# バイナリ生成（デフォルト出力: a.out）
z80asm -o bios.bin bios.asm

# リスト出力付き
z80asm -l -o bios.bin bios.asm

# ラベルファイルも出力
z80asm -l -L -o bios.bin bios.asm
```

主なオプション:

| オプション | 動作 |
|-----------|------|
| `-o <file>` | 出力ファイル名 |
| `-l` | `.lst` リストファイルを出力 |
| `-L` | `.lbl` ラベルファイルを出力 |
| `-v` | 詳細表示 |
| `-i <file>` | 入力ファイル指定（`-i` 省略可） |

---

## 3. simh — 歴史的コンピュータシミュレータ

```bash
sudo apt install simh   # v3.8.1
```

8080 / Z80 関連:

| コマンド | 説明 |
|---------|------|
| `altair8800` | Altair 8800（Intel 8080）エミュレータ |
| `z80pack` ※ | Z80 エミュレータ群（別パッケージ） |
| `pdp11` | PDP-11 エミュレータ（09-PDP11 向け） |

※ z80pack は `sudo apt install z80pack` で別途インストール

> **注意**: simh は CP/M ブートの動作確認用。本プロジェクトの soft-FPGA
> シミュレータ（`cpm` コマンド）とは別物。

---

## 4. その他の便利コマンド

| コマンド | 用途 | 例 |
|---------|------|----|
| `xxd` | バイナリ HEX ダンプ | `xxd bios.bin \| head -20` |
| `hexdump -C` | 同上（別形式） | `hexdump -C cpm22.bin` |
| `file` | ファイル形式判定 | `file *.bin` |
| `dd` | ディスクイメージ操作 | `dd if=/dev/zero bs=256k count=1 of=blank.dsk` |
| `od -x` | 8進/16進ダンプ | `od -x bios.bin \| head` |

---

## 5. まとめ: 用途別早引き

| やりたいこと | コマンド |
|------------|---------|
| ディスク内ファイル一覧 | `cpmls -f ibm-3740 <dsk>` |
| ホスト→ディスクへコピー | `cpmcp -f ibm-3740 <dsk> ./src 0:DST` |
| ディスク→ホストへ取り出し | `cpmcp -f ibm-3740 <dsk> 0:SRC ./dst` |
| ファイル削除 | `cpmrm -f ibm-3740 <dsk> 0:FILE` |
| 空ディスク作成 | `dd … of=blank.dsk && mkfs.cpm -f ibm-3740 blank.dsk` |
| BIOS アセンブル | `z80asm -o bios.bin bios.asm` |
| バイナリ確認 | `xxd bios.bin` |

---

## 6. 関連ドキュメント

- [03-開発ツール.md](03-開発ツール.md) — cpmtools のセットアップ手順
- [15-ファイル構成とファイル交換.md](15-ファイル構成とファイル交換.md) — ディスク交換の詳細フロー
- [30-BIOS実装.md](30-BIOS実装.md) — z80asm による BIOS ビルド
