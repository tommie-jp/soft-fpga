# MC6800 / MC6809 — Verilog 資産調査と WASM シミュレーション計画

## 0. 前提：既存設計判断との関係

[`docs/01-soft-FPGA-WebAssembly-設計議論メモ.md`](../01-soft-FPGA-WebAssembly-設計議論メモ.md) §7 にて、
**MC6800 は「6502 と構造が似すぎ、後出し理由が薄い → 明示的に外す」** と判断済み。

本ドキュメントはその判断を再検討し、MC6809 を中心に実現可能性を評価する。

---

## 1. CPU 概要比較

| 項目 | MC6800 (1974) | MC6809 (1979) |
|------|--------------|--------------|
| 開発 | Motorola | Motorola |
| 前身 | — | MC6800 の完全改良版 |
| アーキテクチャ | 8bit accumulator A/B、8bit index reg X | 8bit A/B + 16bit D、2x index (X/Y)、2x stack (S/U) |
| バスサイクル | 2クロック/サイクル | 可変 (2〜20) |
| アドレス空間 | 64KB | 64KB |
| 特徴的命令 | 基本 ALU | Position-Independent Code、multiply/divide |
| 主な採用機 | SWTPC 6800、Kim-1 類似機 | TRS-80 CoCo、Dragon 32/64、Vectrex |
| ソフト資産 | MIKBUG、MEK6800D2 | OS-9、FLEX、NitrOS-9 |
| Verilog 資産 | **薄い**（VHDL 主体） | **cavnex/mc6809 が決定版** |

---

## 2. Verilog 実装調査結果

### 2-1. MC6809

#### cavnex/mc6809 ★★★★★（最有力）

- **URL:** <https://github.com/cavnex/mc6809>
- **Stars:** 100
- **最終更新:** 2021-06-06
- **ライセンス:** 未指定（要確認・商用利用注意）
- **言語:** Verilog（288 KB）

**特長:**

- **サイクル精度あり** — MAME の cycle-accurate 6809 エミュレータ・実機と比較検証済み
- 実機（Vectrex 1982、TRS-80 CoCo 3、Williams/Taito アーケード）で動作検証済み
- DMABREQ/TSC/MRDY/LIC といったバスプロトコル信号も実装
- Xilinx Spartan 6 LX9 / Altera Cyclone IV / Cyclone V のサンプル付き
- 単一著者（Greg Miller）による明快な設計

**Verilator 互換性:**

- 純 Verilog で SystemVerilog 拡張なし → Verilator で通る可能性が高い（要確認）
- `mc6809.v` のトップレベルが明確、ラッパが書きやすい

#### wdevore/Verilog-6809

- MIT ライセンス、Stars: 0、最終更新 2020
- 手書き実装だが検証が薄い → 補完的参照に留める

### 2-2. MC6800

| リポジトリ | 言語 | Stars | 状態 | メモ |
|-----------|------|-------|------|------|
| halferty/my_awesome_6800 | Verilog | 3 | **アーカイブ** | GPLv3、検証なし |
| EisernSchild/MC6800 | **VHDL** | 5 | 停止 2018 | Verilog 不可 |
| dominicbeesley/Ishbel6800 | **VHDL** | 0 | **活発 (2026-06)** | テスト付き、VHDL のみ |
| scottlbaker/6800-SOC | **VHDL** | 0 | 停止 2016 | SOC 構成 |

**結論:** MC6800 に信頼できる Verilog 実装は現存しない。
VHDL しか存在しないため Verilator で使うには Verilog への変換が必要で工数が大きい。
→ **6802の実装を自作するよりも MC6809 一本化が現実的。**

---

## 3. 可視化・体験価値の比較

| 観点 | MC6800 | MC6809 |
|------|--------|--------|
| バスサイクルの可視化映え | 単調（2クロック固定） | **豊か（命令で 2〜20 クロック）** |
| 信号の複雑さ | 少ない | E/Q クロック 2相、FIRQ/NMI、DMA/BREQ |
| ソフト体験 | MIKBUG（シンプル） | OS-9（マルチタスク）、NitrOS-9 |
| 実機エコシステム | 少数 | Vectrex、CoCo、Dragon → MAME 比較容易 |
| 6502/8080 との差別化 | **弱い**（設計議論の結論） | **強い**（2x index、2x stack、PIC） |

---

## 4. WASM シミュレーション実装計画（MC6809）

### Phase 1 — 調査・PoC（1〜2日）

- [ ] cavnex/mc6809 を clone し Verilator で `--lint-only` → エラー確認
- [ ] `mc6809.v` の入出力ポートを確認（クロック、nRESET、アドレス/データバス、制御信号）
- [ ] ring buffer 9 ワード構成（PDP-11 と同様）の信号定義を策定
- [ ] メモリ（RAM 64KB）+ UART モデルを C++ ハーネスで実装
- [ ] MIKBUG ROM または Flex OS イメージで起動確認（ネイティブビルド）

### Phase 2 — WASM ビルド（2〜3日）

- [ ] `examples/08-mc6809/` ディレクトリ構成を 06-8080 から派生
- [ ] Emscripten ビルドスクリプト `scripts/build-wasm-08.sh` 作成
- [ ] Web Worker (`sim-worker.js`) に MC6809 固有メッセージ型を追加
- [ ] LA シグナル定義 (`sft-mc6809-la-defs.js`) 作成
  - E/Q クロック、アドレス/データバス、R/W、FIRQ/IRQ/NMI、バスサイクル種別
- [ ] xterm.js + UART ブリッジで対話端末を実現

### Phase 3 — OS-9 / NitrOS-9 起動（2〜4日）

- [ ] OS-9 Level 1 ディスクイメージの入手・確認（MAME 由来）
- [ ] RK ドライブエミュ相当の仮想ディスク実装（または FD 形式）
- [ ] OS-9 ブートローダーの起動確認
- [ ] NitrOS-9 コミュニティ版での動作確認（PDP-11 / Unix V6 に相当するショーケース）

### Phase 4 — 可視化 UI（1〜2日）

- [ ] Logic Analyzer で E/Q 2相クロックと バスサイクルを色分け表示
- [ ] レジスタパネル（A/B/D/X/Y/S/U/PC/DP/CC）
- [ ] 分岐命令の taken/not-taken カラーバー（8080 版のM-CYC 相当）

---

## 5. ライセンス・無料で使えるものの整理

### 5-1. 全コンポーネントの一覧

| コンポーネント | 種別 | ライセンス | 無料？ | 備考 |
|--------------|------|----------|-------|------|
| **cavnex/mc6809** | CPU Verilog コア | **未指定** | ❌ 要確認 | 最高品質だが著者に問い合わせ必要 |
| **wdevore/Verilog-6809** | CPU Verilog コア | **MIT** | ✅ 無料 | 検証が薄い、Stars:0 |
| **FUZIX** | OS | **GPL 系** | ✅ 無料 | Alan Cox 作、MC6809 対応済み、ビルド可能 |
| **NitrOS-9** | OS | **ライセンス未明記** | △ グレー | Microware 由来コード含む、コミュニティで広く共有 |
| **OS-9（Microware/Concurrent）** | OS | **プロプライエタリ** | ❌ 有償 | 現在も販売中 |
| **BASIC09** | 言語処理系 | **プロプライエタリ** | ❌ 有償 | バイナリのみ、ソース非公開 |
| **FLEX（TSC）** | OS | **プロプライエタリ** | ❌ 有償 | archive に存在するがグレー |
| **lwtools**（lwasm/lwlink） | アセンブラ/リンカ | **GPL** | ✅ 無料 | NitrOS-9 公式ビルドツール |
| **CMOC** | C クロスコンパイラ | **GPL** | ✅ 無料 | 6809 向け C コンパイラ |
| **ToolShed** | ディスクイメージツール | **GPL** | ✅ 無料 | OS-9/NitrOS-9 .dsk 操作 |

### 5-2. 「無料で使える」構成の現実的な選択肢

#### 選択肢 A：完全クリーン（公開・再配布可能）

```text
CPU コア : wdevore/Verilog-6809（MIT）
OS      : FUZIX（GPL）
開発ツール: lwtools + CMOC（GPL）
```

- ライセンス上の問題がゼロ
- **弱点**: CPU コアの品質が低い（未検証）、FUZIX は起動確認が別途必要

#### 選択肢 B：実用重視（現プロジェクトの Unix V6 と同じ扱い）

```text
CPU コア : cavnex/mc6809（著者確認待ち or 個人利用と割り切り）
OS      : NitrOS-9（コミュニティの慣行に従う）
ソフト   : NitrOS-9 付属の BASIC09 バイナリ
```

- PDP-11/Unix V6 と同じ「非商用個人利用の範囲で実績がある」形態
- 公開時は Unix V6 と同様「起動デモのみ、ダウンロード不可」構成が現実的

> **参考：** このプロジェクトの PDP-11/Unix V6 は Caldera の
> [Ancient Unix ライセンス](https://www.tuhs.org/Archive/Caldera-license.pdf)（非商用無料）を根拠にしている。
> NitrOS-9 には同等の公式許諾はなく、より法的グレーゾーン。

### 5-3. Verilog コアのライセンス詳細

cavnex/mc6809 はライセンスが未指定。
MIT/Apache/GPL ではないため、使用前に著者に問い合わせるか、
パブリックドメインであることを確認する必要がある。

### 5-4. Verilator 互換性

- `mc6809.v` が Verilog-2001 準拠かどうか未確認
- `initial` ブロックや `$display` がある場合は Wasm ビルドで除去が必要
- E/Q 2クロック駆動の場合、Verilator の `eval()` 設計に影響する可能性がある

### 5-5. 6800 との関係

6800 を「追加で」実装するメリットはない。6809 は 6800 の上位互換命令セット（一部例外あり）なので、
6809 コアで 6800 バイナリを動かすことは理論上可能。

---

## 6. MC6809 エコシステム — Intel 8080/CP/M に相当するものは何か

### 6-1. 位置付けの対応表

| Intel 8080 側 | MC6809 側 | 備考 |
|--------------|----------|------|
| **CP/M** | **OS-9 Level I/II** | 8bit 時代の標準 OS。CP/M より高機能 |
| CP/M の単純な代替 | **FLEX** | 単一タスク・ディスクベース、CP/M に最も近い |
| CP/M 上の Unix 風拡張 | **UniFLEX** | TSC 製、マルチユーザー・Unix 互換シェル |
| CP/M ソフト（MBASIC・BDS C） | **BASIC09・CMOC** | 構造化 BASIC・C コンパイラ |
| Altair 8800 / IMSAI 8080 | **SWTPC 6809** | 当時の代表的ホビーマシン |
| CP/M 互換機各種 | **TRS-80 Color Computer（CoCo）・Dragon 32/64** | 大量普及した 6809 機 |
| Zork / WordStar 等 | **Dungeons of Daggorath・Pyramid 2000** ほか | ゲーム・アプリが充実 |

### 6-2. OS-9 とは何か

**OS-9（Microware Systems Corporation、1979年）** は、MC6809 上で動く
**リアルタイム・マルチタスク・マルチユーザー OS** であり、CP/M とは一世代上の設計思想を持つ。

| 機能 | CP/M | OS-9 |
|------|------|------|
| タスクモデル | シングルタスク・シングルユーザー | **リアルタイムマルチタスク・マルチユーザー** |
| ファイルシステム | フラット（ディレクトリなし） | **階層型ディレクトリ**（Unix 同様） |
| I/O モデル | ファイル専用 | **すべてのデバイスをファイルとして扱う** |
| パイプ | なし | **名前付き／無名パイプ** |
| プロセス間同期 | なし | イベントプリミティブ（セマフォ相当） |
| リアルタイム性 | なし | あり（組み込み用途にも使用） |
| RAM 要件 | 〜64 KB (Level I) | 64 KB (Level I) / 1〜2 MB (Level II) |

- **Level I**：MMU 不要。64 KB に収まる小型システム向け。
- **Level II**：MMU 必須。最大 1〜2 MB（CoCo 3 では 2 MB）対応、真のマルチタスク。

### 6-3. NitrOS-9 とは何か

**NitrOS-9** は、Microware OS-9 をベースにしたコミュニティ主導の継承プロジェクト。

```text
Microware OS-9 (1979)
  │
  ├─→ 商用継続: Concurrent Real-Time（現在も組み込み向けに販売）
  │
  └─→ コミュニティが引き継ぎ改良
           = NitrOS-9（GitHub: nitros9project/nitros9）
```

#### 対応機種

| 機種 | Level | プロセッサ |
|------|-------|----------|
| TRS-80 Color Computer 1/2 | Level 1 | 6809 / 6309 |
| Tandy Color Computer 3（CoCo 3） | Level 2 | 6809 / 6309 |
| Dragon 64 / Tano Dragon | Level 1 | 6809 |
| Hitachi 6309 搭載機 | Level 1/2 | 6309（専用ビルド） |

#### Level 1 と Level 2 の違い

| | Level 1 | Level 2 |
|--|---------|---------|
| MMU | 不要 | **必要** |
| RAM | 〜64 KB | 最大 2 MB（CoCo 3） |
| マルチタスク | プロセス切り替えのみ | **真のマルチタスク** |

#### 使えるソフト

- **BASIC09**（Microware 製 p-code 構造化 BASIC、バイナリ同梱）
- シェル・パイプ（`shell`、`dir`、`copy` 等）
- CMOC / lwcc（C コンパイラ）
- ゲーム（Dungeons of Daggorath、CocoDle、Spacezap 等）
- CocoIRC、CocoWX、テキストエディタ等

#### ビルド方法

```bash
# 依存: lwtools（lwasm/lwlink）+ ToolShed
git clone https://github.com/nitros9project/nitros9
cd nitros9
make       # カーネル・モジュールをビルド
make dsk   # ディスクイメージ（.dsk）を生成
```

#### ライセンスの注意

Microware 由来のカーネルコードを含むが、正式なオープンソースライセンスは明記されていない。
Unix V6（Caldera Ancient Unix ライセンス）と同様の **「コミュニティ慣行として広く共有」** されている状態。
商用利用・再配布には法的確認が必要。

#### このプロジェクトでの位置づけ

PDP-11/Unix V6 が「16bit CPU 上のマルチタスク Unix」を可視化するように、
NitrOS-9 は **「8bit CPU（MC6809）上のマルチタスク OS」** を信号レベルで可視化できる素材。
E/Q 2相クロック・プロセス切り替え・パイプ処理の波形が Logic Analyzer で観察できる。

### 6-4. MC6809 で「できること」リスト

#### ターミナル・シェル体験

- **FLEX OS 起動** → ディスクベースの単一タスク OS、CP/M に最も近い体験
- **OS-9 Level I 起動** → シェル（`shell`）、ファイル操作（`dir`/`copy`/`delete`）
- **NitrOS-9 起動** → マルチウィンドウ（`mshell`）、パイプ、バックグラウンドプロセス

#### プログラミング

- **BASIC09**（Microware 製）— p-code コンパイル型の構造化 BASIC。`IF ... THEN ... ELSE`、`FOR`、手続き定義を持つ
- **CMOC**（C クロスコンパイラ）— Linux 上で MC6809 向け C をコンパイル
- **LWASM**（lwtools アセンブラ）— クロス開発ツールチェーン、OS-9 モジュール形式出力対応
- **GCC 6809 パッチ**（GCC 4.3.4）— C/C++ のフル規格対応

#### ゲーム（Vectrex）

- **Vectrex** は 6809 を搭載したベクタースキャン型ゲームコンソール（1982年）
- 公式ゲーム 29 本：Armor Attack、Scramble、Berzerk、Star Trek 等アーケード移植
- ベクタグラフィクスの波形が Logic Analyzer で**視覚的に非常に映える**

#### ゲーム・アプリ（CoCo / Dragon）

- Dungeons of Daggorath（ダンジョン RPG、1982年）— CoCo の代表作
- Pyramid 2000（Zork 風テキストアドベンチャー）
- NitrOS-9 版：CocoIRC、CocoWX、CCTPlay 等

#### FUZIX（完全オープンソース・Unix 互換）

- [EtchedPixels/FUZIX](https://github.com/EtchedPixels/FUZIX) — Alan Cox（Linux カーネル開発者）作
- Unix V6/UZI 由来のマルチタスク Unix 互換 OS、MC6809 サポート済み（`lwtools` でビルド）
- GPL 系ライセンスで法的にクリア → **soft-FPGA として公開する場合に最も安全な選択**
- CoCo / Dragon / SWTPC ポート存在

#### マルチタスクのショーケース

- OS-9 で複数の `shell` プロセスを起動し、パイプで繋ぐ様子を Logic Analyzer で観察
- PDP-11/Unix V6 のコンテキストスイッチと同様、**8bit CPU でのマルチタスクを信号レベルで可視化**できる

### 6-5. 採用機種とエコシステム

| 機種 | CPU | 特徴 | ソフト |
|------|-----|------|--------|
| TRS-80 CoCo 1/2 | MC6809E @ 0.89 MHz | 最量販。FLEX・OS-9 両対応 | 大量のゲーム・BASIC |
| TRS-80 CoCo 3 | MC6809E @ 1.78 MHz | 2 MB RAM、OS-9 Level II | NitrOS-9 が現在も動作 |
| Dragon 32/64 | MC6809E @ 0.89 MHz | 英国製 CoCo 互換機。Dragon 64 は FLEX・OS-9 対応 | CoCo ソフトの大半が動作 |
| Vectrex | MC68A09 @ 1.5 MHz | ベクタースキャンゲームコンソール | 29 本の公式ゲーム ROM |
| SWTPC 6809 | MC6809 @ 1 MHz | ホビーイスト向け自作機 | FLEX、UniFLEX |

### 6-6. ディスクイメージ・ROM の入手性

| OS | イメージ | 入手先 |
|----|---------|--------|
| OS-9 Level I v1.0 | `OS9L1V1B.DSK` / `OS9L1V1M.DSK` | [colorcomputerarchive.com](https://colorcomputerarchive.com/) |
| NitrOS-9 EOU Beta 6.0.1 | `68SDC.VHD` / `68EMU.dsk` | [lcurtisboyle.com/nitros9](http://lcurtisboyle.com/nitros9/nitros9.html) |
| Vectrex ROM | `vec.zip`（MAME） | colorcomputerarchive.com / MAME ROM セット |
| FLEX 6809 | 一部アーカイブに存在 | 要調査 |

MAME は 2024 年時点で CoCo OS-9 ファイルシステムのフォーマット・読み書きに対応。
`xroar`（Dragon/CoCo 1/2 エミュレータ）と `VCC`（CoCo 3 エミュレータ）で NitrOS-9 の動作確認が容易。

---

## 8. 判断サマリー

| | MC6800 | MC6809 |
|--|--------|--------|
| Verilog 資産 | ❌ 実質なし | ✅ cavnex/mc6809 決定版 |
| 可視化映え | △ 単調 | ✅ 豊富（E/Q 2相・2〜20クロック） |
| ソフト体験 | △ MIKBUG | ✅ OS-9/NitrOS-9・BASIC09・Vectrex |
| CP/M 相当の位置づけ | なし | **OS-9**（CP/M より高機能）/ FLEX（CP/M 相当） |
| 差別化（6502比） | ❌ 弱い（既存判断） | ✅ 2x index/stack、PIC、マルチタスク OS |
| 工数 | 高（自作必要） | 低〜中（PoC から始められる） |
| **採択** | **❌ 見送り** | **✅ 候補として調査継続** |

MC6809 は 6502・8080・PDP-11 の次候補として `docs/07-z80` と並行して検討する価値がある。
6800 は過去の判断どおり **引き続き見送り**。
