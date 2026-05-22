# 55. simh — 歴史的コンピュータシミュレータ

```bash
sudo apt install simh   # v3.8.1
```

soft-FPGA の動作比較・CP/M ソフトウェアの動作確認に使える命令セットエミュレータ。

---

## 1. CP/M 関連コマンド一覧

| コマンド | CPU | 用途 |
|---------|-----|------|
| `altair` | Intel 8080 | MITS Altair 8800 エミュレータ。CP/M 2.2 が動く |
| `altairz80` | Z80 + 8080 切替 | 上位互換版。デバイスが豊富 |
| `pdp11` | PDP-11 | Unix V6 / RT-11 が動く（09-PDP11 向け） |

---

## 2. `altair` — Intel 8080 / Altair 8800

### 2.1 構成

```text
CPU    Intel 8080、64 KB RAM + 2 KB EPROM ブート ROM
2SIO   シリアル I/O（ターミナル接続） ← コンソール
DSK    MITS 88-DISK フロッピー 8ドライブ（337 KB/ドライブ）
PTR    ペーパーテープリーダ
PTP    ペーパーテープパンチャ
```

### 2.2 ディスクイメージの入手

| ファイル | 用途 | 入手先 |
|---------|------|--------|
| `altcpm.dsk` | `altair`（8080）用 CP/M 2.2 | [ceoaltair.zip](http://simh.trailing-edge.com/kits/ceoaltair.zip)（208 KB） |
| `altdos.dsk` | `altair`用 Altair DOS 1.0 | 同上 |
| `cpm2.dsk` | `altairz80`用 CP/M 2.2 | [cpm2.zip](https://schorn.ch/cpm/zip/cpm2.zip)（641 KB） |

```bash
# altair 用（ceoaltair.zip に altcpm.dsk が入っている）
wget http://simh.trailing-edge.com/kits/ceoaltair.zip
unzip ceoaltair.zip   # → altcpm.dsk, altdos.dsk, cpm-key.txt

# altairz80 用（schorn.ch の最新版）
wget https://schorn.ch/cpm/zip/cpm2.zip
unzip cpm2.zip        # → cpm2.dsk, i.dsk, app.dsk, ...
```

### 2.3 CP/M を起動する

CP/M ディスクイメージ（`altcpm.dsk`）を入手して:

```text
sim> attach dsk0 altcpm.dsk
sim> go 177400
62K CP/M VERSION 2.2 (ALTAIR 8800)
A>
```

`177400`（8進数）= `0xFF00` がブート ROM のエントリポイント。

### 2.3 基本コマンド

| コマンド | 動作 |
|---------|------|
| `attach dsk0 <file>` | ドライブ 0 にディスクイメージを接続 |
| `detach dsk0` | ドライブ 0 を切り離す |
| `go 177400` | ブート ROM から起動 |
| `go 0` | アドレス 0 から実行 |
| `step` / `step N` | 1 命令 / N 命令ステップ実行 |
| `cont` | 実行再開 |
| `examine PC` | レジスタ表示 |
| `deposit A FF` | レジスタに値を書き込む |
| `examine 0100` | メモリアドレス 0x100 の内容を表示 |
| `break 0F200` | ブレークポイント設定 |
| `nobreak 0F200` | ブレークポイント解除 |
| `save session.sav` | シミュレータ状態を保存 |
| `restore session.sav` | 状態を復元 |
| `quit` | 終了 |

### 2.4 CPU 設定

```text
sim> set cpu 8080      # Intel 8080（デフォルト）
sim> set cpu z80       # Z80（非推奨、未完装）
sim> set cpu 64k       # メモリ 64 KB（デフォルト）
sim> set cpu itrap     # 不正命令で停止
sim> set cpu noitrap   # 不正命令を無視（実機動作）
```

### 2.5 レジスタ一覧

| 名前 | サイズ | 内容 |
|------|--------|------|
| `PC` | 16 bit | プログラムカウンタ |
| `A` | 8 bit | アキュムレータ |
| `BC` | 16 bit | BC レジスタペア |
| `DE` | 16 bit | DE レジスタペア |
| `HL` | 16 bit | HL レジスタペア |
| `C` | 1 bit | キャリーフラグ |
| `Z` | 1 bit | ゼロフラグ |
| `S` | 1 bit | サインフラグ |
| `P` | 1 bit | パリティフラグ |
| `AC` | 1 bit | 補助キャリーフラグ |

---

## 3. `altairz80` — Z80 + 拡張デバイス版

### 3.1 altair との違い

| 項目 | `altair` | `altairz80` |
|------|---------|------------|
| CPU | 8080 固定 | Z80 / 8080 切替可 |
| ディスク容量 | 337 KB/ドライブ | 1,113 KB/ドライブ |
| ハードディスク | なし | HDSK（8 ユニット）あり |
| ディスクフォーマット | MITS 88-DISK | 拡張 Altair format |
| 追加デバイス | なし | Cromemco / IMSAI / Vector Graphic 等 |

### 3.2 CPU モード切替

```text
sim> set cpu 8080    # Intel 8080 モード
sim> set cpu z80     # Z80 モード
sim> show cpu
```

---

## 4. `.ini` ファイルで自動起動

同じディレクトリに `altair.ini`（または `altairz80.ini`）を置くと起動時に自動実行される。

```text
; altair.ini — CP/M 自動起動例
set cpu 8080
set cpu noitrap
attach dsk0 altcpm.dsk
go 177400
```

起動:

```bash
altair    # カレントディレクトリの altair.ini を自動読み込み
```

または明示的に:

```bash
altair altair.ini
```

---

## 5. ⚠️ 本プロジェクトとの互換性

> **ディスクイメージは直接流用できない。**

| 項目 | 本プロジェクト | altair（simh） |
|------|--------------|----------------|
| ディスクフォーマット | IBM 3740（ibm-3740） | MITS 88-DISK |
| ディスクサイズ | 256 KB | 337 KB |
| セクタ数/トラック | 26 | 32 |
| コンソール I/O ポート | IN/OUT 0x00-0x02 | 2SIO: 0x10-0x13 |

→ `cpm22.dsk` は `altair` に attach しても正しくブートしない。

CP/M ソフトの **動作確認のみ**の用途で使うなら、Altair 向けの CP/M ディスクイメージを別途入手する。

---

## 6. `pdp11` — PDP-11（09-PDP11 向け）

```text
sim> attach rk0 rt11.dsk   # RK11 ディスクに接続
sim> boot rk0              # ブート
```

詳細は [09-PDP11/01-PDP11-verilogコア調査.md](../../docs/09-PDP11/01-PDP11-verilogコア調査.md) 参照。

---

## 7. まとめ

### `altair`（Intel 8080）vs `altairz80`（Z80 + 拡張）

| 項目 | `altair` | `altairz80` |
|------|---------|------------|
| CPU | 8080 固定 | Z80/8080 切替 |
| ディスク | 337 KB/ドライブ | 1,113 KB/ドライブ |
| 追加デバイス | なし | Cromemco, IMSAI 等多数 |

### CP/M 起動の流れ

```text
sim> attach dsk0 altcpm.dsk
sim> go 177400
```

### `.ini` ファイルで自動起動

同ディレクトリに `altair.ini` を置けば `altair` 起動時に自動実行。

### ⚠️ 本プロジェクトと非互換

- ディスクフォーマットが違う（IBM 3740 ≠ MITS 88-DISK）
- I/O ポートが違う（本プロジェクト: 0x00–0x02、altair: 0x10–0x13）
- `cpm22.dsk` をそのまま attach しても動かない
- 用途は動作比較・CP/M ソフトの動作確認のみ

---

## 8. 参考

- `/usr/share/doc/simh/altair.txt.gz` — altair コマンドリファレンス（ローカル）
- `/usr/share/doc/simh/altairz80_doc.pdf` — altairz80 詳細ドキュメント（ローカル）
- [54-Ubuntu-ホストツール.md](54-Ubuntu-ホストツール.md) — cpmtools など他のホストツール
