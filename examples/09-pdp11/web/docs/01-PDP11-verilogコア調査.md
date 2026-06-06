# PDP-11 Verilog 実装の調査メモ

rtlscope（Verilator → C++ → Emscripten/WASM パイプライン）への組み込み検討資料。

---

## 1. 既存実装の全体像

PDP-11 を **Verilog** で実装し、かつ **実績がある**（OS ブート確認済み）プロジェクトは以下の3件。VHDL 版を含めると4件。

### 1.1 Brad Parker `cpus-pdp11`（Verilog・本命）

- **リポジトリ**: <https://github.com/lisper/cpus-pdp11>
- **オリジナル解説**: <https://www.heeltoe.com/download/pdp11/README.html>
- **モデル**: PDP-11/34 相当 + 11/44 風 MMU + EIS
- **動作実績**: RT-11、Unix V6、RSTS V4、2.9BSD がシミュレーションでブート
- **HDL**: 純 Verilog
- **特徴**: 単純なスカラー設計、マイクロコードなし、直接デコード
- **Verilator 対応**: あり（後述）

### 1.2 POP-11（清水尚彦, 東海大学）

- **モデル**: PDP-11/40 + MMU + EIS
- **動作実績**: UNIX 6th Edition を IDE ディスクからブート
- **HDL**: SFL（独自言語）→ sfl2vl で Verilog 変換
- **問題点**: SFL→Verilog 変換ツールが非公開。変換済み Verilog の入手性が不明
- **参考**: ASP-DAC 2004 論文あり

### 1.3 EasyComp_PDP-11（digitalinvitro）

- **リポジトリ**: <https://github.com/digitalinvitro/EasyComp_PDP-11>
- **モデル**: 最も単純な PDP-11 コンピュータ
- **由来**: ソ連の 1801ВМ1（LSI-11 クローン）のリバースエンジニアリングコードベース
- **HDL**: Verilog
- **特徴**: Forth 風モニタ搭載、ISE WebPACK 向け
- **懸念**: リバースエンジニアリング由来の法的グレーゾーン

### 1.4 wfjm `w11`（VHDL・最も実績がある）

- **リポジトリ**: <https://github.com/wfjm/w11>
- **モデル**: PDP-11/70 + MMU（FPU なし）
- **動作実績**: 5th Edition UNIX、2.11BSD、各種 DEC OS をブート
- **HDL**: **VHDL**（Verilator 直接利用不可）
- **ライセンス**: GPL V3（SPDX 明記）
- **対応 FPGA**: Digilent Arty A7、Basys3、Cmod A7、Nexys A7/4/3/2、S3board
- **位置づけ**: PDP-11 FPGA 実装としては最も成熟。だが Verilog ではない

---

## 2. Brad Parker `cpus-pdp11` 詳細

### 2.1 リポジトリ概要

| 項目 | 値 |
|---|---|
| 総サイズ | 177 MB |
| Verilog 総行数 | 9,789 行（35 ファイル） |
| 最大ファイル | `pdp11.v` 2,113 行、`execute.v` 1,259 行 |
| 最終コミット | 2016-01-02（"added README.md" の **1 コミットのみ**） |
| 開発期間 | 2009–2010（heeltoe.com から GitHub に投下） |
| ステータス | 実質的に**メンテされていないコードダンプ** |

### 2.2 RTL 構成

```text
rtl/
├── pdp11.v       (2113 行) ─ CPU 本体、命令デコード
├── execute.v     (1259 行) ─ 実行ユニット
├── rk_regs.v      (835 行) ─ RK11 ディスクコントローラ
├── mmu.v          (703 行) ─ MMU（11/44 風）
├── bootrom.v      (526 行) ─ 手書き Verilog のブート ROM
├── fake_uart.v    (435 行)
├── bus.v          (363 行) ─ バスアービタ
├── tt_regs.v      (333 行) ─ コンソール TTY (DL11)
├── top.v          (320 行) ─ FPGA 向けトップ
└── ... 他 26 ファイル
```

設計はモジュラーで、各機能が単独ファイルに分離されている。rtlscope の信号観測には適した構造。

### 2.3 検証範囲

`verif/Makefile` から読み取れる階層的テスト構成:

1. **ユニットテスト**: `test_bus, test_rk, test_tt, test_ide, test_div, test_mul, test_shift`
2. **基本テスト**: `tests/basic/*.mem`（test17 は壊れていてコメントアウト）
3. **DEC 公式診断**:
   - `FKAAC0` — 11/34 基本命令テスト（PDF マニュアル同梱）
   - `FKABD0` — 命令テスト
   - `FKACA0` — 命令テスト
   - `FKTHB0` — MMU 診断
   - `FKTGC0` — フィルタアウト（パスしない）
4. **OS ブートテスト**: RT-11、Unix V6、2.9BSD、RSTS V4 がシミュレーション上で確認済み

### 2.4 Verilator 対応状況

**すでに Verilator を意識した実装になっている。**

#### Verilator プラグマが埋め込み済み

```verilog
// rtl/execute.v
output [15:0] e1_result /* verilator isolate_assignments */;

// rtl/top.v
wire [31:0] initial_pc /* verilator public_flat */;
wire clk /* verilator public_flat_rw @(sysclk) */;

// rtl/mmu.v
/* verilator lint_off CASEX */
/* verilator lint_off CASEINCOMPLETE */
```

#### C++ ハーネス（`verilator/` ディレクトリ）

- `test.cpp` — 84 行の Verilator メインドライバ。クロック生成、リセット、メモリロード、引数処理を実装
- `ide.cpp` — IDE ディスクの PLI 代替 C++ モデル
- `ram.cpp` — RAM の C++ モデル

#### ビルドスクリプト（`verif/verilator.sh`）

```sh
verilator -cc -exe --trace --Mdir ./tmp \
    test_top.v ../verilator/test.cpp \
    ../verilator/ide.cpp ../verilator/ram.cpp
```

**重要な注意**: Brad 本人が実証した BSD ブートは **cver + VPI 経由**。Verilator 単独で BSD ブートが確認されたという明示的な記述はない。`verilator/` ディレクトリは後から追加されたもので、ユニットテストレベルで止まっている可能性がある。

### 2.5 EIS（Extended Instruction Set）対応状況

本プロジェクトでの cpus-pdp11 は **EIS を実装済み**。WASM 版を含め正常動作する。

| 命令 | 動作 |
|------|------|
| `MUL Rn, src` | 符号付き 16×16 bit 乗算 → 32 bit 結果を Rn/Rn+1 に |
| `DIV Rn, src` | 符号付き 32÷16 bit 除算 → 商 Rn・余り Rn+1 |
| `ASH Rn, src` | 算術シフト（正=左、負=右、最大 ±31 bit） |
| `ASHC Rn, src` | 32 bit 算術シフト（Rn:Rn+1 を一体シフト） |

動作確認: DEC 公式診断 **FKACA0**（11/34 EIS 命令テスト、MUL/DIV/ASH）が **PASS**。

#### 実機 PDP-11/40 における EIS の位置づけ

実機の PDP-11/40 では、EIS は**オプションの拡張基板**（KE11-E）として追加する仕様だった。
標準搭載された機種は PDP-11/45 以降。

| 機種 | EIS |
|------|-----|
| PDP-11/20, /15 | なし |
| **PDP-11/40** | **オプション**（KE11-E 基板） |
| PDP-11/45, /70 | 標準搭載 |
| LSI-11（PDP-11/03） | オプション |

cpus-pdp11 は PDP-11/34 相当と説明されているが、EIS を標準で含む点では
PDP-11/45 相当の機能セットを持つ。

---

## 3. ライセンス状況

### 3.1 Brad Parker `cpus-pdp11`

**LICENSE ファイルが存在しない**。

オリジナル README の本人の言葉:

> "I put my copyright on the code but I put it out there for anyone to look at or use."

これは非公式な意思表示であり、OSI ライセンスではない。法的には:

- 再配布権: 明示されていない
- 改変権: 明示されていない
- 商用利用: 明示されていない
- デフォルトでは著作権法上「all rights reserved」状態

**実務的影響**: rtlscope でブラウザに埋め込んで配布する場合、Verilog → WASM 変換物は派生著作物。再配布には Brad 本人への確認が望ましい。

### 3.2 同梱物のライセンス状況

| 項目 | 出所 | 配布性 |
|---|---|---|
| `rtl/bootrom.v` | Brad 自作、Verilog で手書き | ✅ Brad 著作物（曖昧） |
| `tests/diags/*.BIC` | XXDP25.rl02 から抽出した DEC 公式診断 | ⚠️ DEC/HP 著作物 |
| `xxdp/xxdp25.rl02` | XXDP ディスクイメージ全体 (8.6MB) | ⚠️ DEC/HP 著作物 |
| `data/bsd/` (35MB) | 2.9BSD ディスクイメージ | ⚠️ BSD ライセンス、要確認 |
| `simhv36-1/` | SIMH v3.6-1 スナップショット | ✅ SIMH ライセンス（MIT 風） |
| `utils/macro11/` | Richard Krehbiel の MACRO-11 | ✅ おそらくオープン |

**XXDP 診断の問題**: TK-80 や Space Invaders で議論したのと同種の問題。HP（DEC の権利継承者）の著作物扱いで、再配布の明示的許諾は存在しない。レトロコンピューティングコミュニティでは流通しているが、公式には未許諾。

**ただし rtlscope のデモに XXDP は必須ではない**。RT-11 か Unix V6 が動けば見栄えは十分。

---

## 4. 3 ターゲットへの移植見込み

### 4.1 Ubuntu 24 ホスト（ネイティブ Verilator）

#### 見込み: ◎ 高確率で動く（要 Verilator 互換性対応）

| 項目 | 評価 |
|---|---|
| Verilog 規模 | 9,789 行（小規模） |
| メモリ要求 | エミュレート RAM 256KB + Verilator 状態 ~数MB → 余裕 |
| 性能 | 現代 x86 で Verilator 経由なら 10-50 MHz 実効シム速度 |
| BSD ブート時間予測 | 10-60 秒 |

#### 最大のリスク: Verilator バージョン互換性

Brad のコードは 2009-2010 年（Verilator 3.7 時代）。現在の Verilator 5.x との非互換ポイント:

1. **シグナルアクセスの名前マングリング変更**

   ```cpp
   // Brad のコード（旧）
   top->v__DOT__top__DOT__reset = 1;
   top->v__DOT__sysclk = ~top->v__DOT__sysclk;
   ```

   Verilator 4.0+ では `rootp->` API か `--public-flat-rw` 経由になり、この記法は通らない。要修正。

2. **lint 厳格化** — `CASEX`, `CASEINCOMPLETE`, `STMTDLY` は既に対処済みだが、新しい警告が追加されている可能性

3. **古い `always @` 列挙形式** — 動くが警告は出る

**作業見積もり**: Verilator 5.x で動かすのに半日〜2 日。一度動けば安定するはず。

### 4.2 WASM 版（rtlscope 本命）

#### 見込み: ○ 動く可能性が高い、ただし周辺整備が必要

| 項目 | 評価 |
|---|---|
| エミュレート RAM | 256KB-2MB → WASM 線形メモリで余裕 |
| Verilator → Emscripten | 技術的問題は基本的にない |
| 性能 | ネイティブの 50-70%、実効 5-25 MHz シム速度 |
| BSD ブート時間予測 | 30-90 秒（フェッチ時間別） |

**必要な改変**:

1. **`ide.cpp` の I/O 層差し替え** — `fopen` → `fetch()` の `ArrayBuffer` を `Module.HEAPU8` 経由で読む、または Emscripten MEMFS への事前ロード

2. **コンソール I/O** — `tt_regs.v` の出力を xterm.js などに接続。Emscripten の stdin/stdout を JS 側に橋渡し

3. **メインループ** — `while (!Verilated::gotFinish())` のブロッキングループを `requestAnimationFrame` ベースに改造

4. **rtlscope 観測点の差し込み** — `public_flat` プラグマを各信号に追加。PC、PSW、バスアドレス/データ、MMU 状態などをトレースバッファに記録

**ディスクイメージサイズ**:

- Unix V6: 約 2.5MB → 初回フェッチで実用範囲
- RT-11: 約 1MB → 軽快
- 2.9BSD: 約 5-35MB → 大きい

**rtlscope のデモ価値**: 「ブラウザで Unix V6 がブートする様子を PDP-11 バス信号レベルで観測できる」というのは教育コンテンツとして強力。

### 4.3 Pico2 (RP2350) 版

#### 見込み: △ Unix V6 なら可能性あり、BSD は厳しい

| 項目 | 評価 |
|---|---|
| RP2350 SRAM | 520KB（内蔵） |
| 動作クロック | Cortex-M33 @ 150 MHz |
| 性能予測 | 実効 100 kHz - 1 MHz シム速度 |

**メモリ収支**:

```text
RP2350 SRAM 520KB の内訳予想:
├── Verilator 生成 C++ の RTL 状態: 50-150 KB
├── エミュレート RAM: ??? KB ← ここが勝負
├── ホスト側コード（Pico SDK、UART、ファイル系）: 50-80 KB
├── Verilator ランタイム: 20-30 KB
└── スタック・ヒープ: 30-50 KB
```

エミュレート RAM に使える残り: **200-300 KB 程度**

| OS | 必要 RAM | RP2350 内蔵で可能か |
|---|---|---|
| RT-11 | 56-64 KB | ✅ 余裕 |
| Unix V6 | 64-128 KB | ✅ 可能 |
| 2.9BSD | 256 KB 以上 | ❌ 内蔵だけでは厳しい |
| 2.11BSD | 数 MB | ❌ 不可能 |

**外付け PSRAM (8MB) を使えば 2.9BSD も可能だが**、QSPI 経由のアクセスはレイテンシが大きく、Verilator 生成コードはメモリアクセス頻発のため、性能がさらに 5-10 倍遅くなる見込み。2.9BSD ブートに 30 分〜2 時間。

**Pico2 で現実的なシナリオ**:

1. **RT-11 デモ** — 内蔵 SRAM で快適に動く
2. **Unix V6** — 内蔵 SRAM ギリギリ。ブート 5-15 分の見込み
3. **rtlscope 観測** — 信号観測のメモリオーバーヘッドが追加で必要。リングバッファは外部 PSRAM へ

その他の Pico2 固有の課題:

- Verilator ランタイム（`verilated.h/cpp`）はベアメタル前提でない
- C++ 例外・RTTI を切る
- ディスクイメージは flash に焼くか SD カードから
- KW11 ラインクロック割り込みのジッタ管理

---

## 5. 移植見込みサマリー

| ターゲット | OS | 見込み | 主な障壁 |
|---|---|---|---|
| Ubuntu 24 | RT-11 | ◎ | Verilator 5.x 互換性パッチのみ |
| Ubuntu 24 | Unix V6 | ◎ | 同上 |
| Ubuntu 24 | 2.9BSD | ◎ | 同上、Brad 実証環境に近い |
| WASM | RT-11 | ○ | I/O 層と JS 統合 |
| WASM | Unix V6 | ○ | 同上、デモ価値高 |
| WASM | 2.9BSD | ○ | ディスクイメージ転送量 |
| Pico2 内蔵 | RT-11 | ◎ | Verilator ランタイム軽量化 |
| Pico2 内蔵 | Unix V6 | △ | メモリギリギリ、要チューニング |
| Pico2 内蔵 | 2.9BSD | ✕ | メモリ不足 |
| Pico2 + PSRAM | 2.9BSD | △ | 動くが体感極遅 |

---

## 6. 開発戦略の提案

### 推奨順序

1. **Ubuntu で Verilator 5.x 移植** — リスク最小、ベースライン確立
2. **WASM 版** — rtlscope 本命、デモ作成
3. **Pico2 版** — RT-11 / Unix V6 ターゲット

### コンテンツ的見立て

「Pico2 で BSD」は無理筋だが、「Pico2 で **Unix V6 が動く** PDP-11/34」なら歴史的にも美しい構成（V6 は実機 11/34 で動いた最初期の Unix のひとつ）。

「ブラウザ vs マイコン」の対比デモとして、WASM 版と Pico2 版を並べる構成は教育的価値が高い。

### ライセンスの先行確認

技術的検証と並行して **Brad Parker への連絡** を行うのが望ましい:

- メールアドレスは heeltoe.com に掲載あり
- MIT または BSD-2-Clause での明文化を依頼
- 配布物に XXDP 診断を含めない構成を明確化

---

## 7. 参考リンク

- Brad Parker オリジナル: <https://www.heeltoe.com/download/pdp11/README.html>
- GitHub ミラー: <https://github.com/lisper/cpus-pdp11>
- wfjm w11（参考用 VHDL 実装）: <https://github.com/wfjm/w11>
- DEC FPGA 実装まとめ: <https://www.avanthar.com/healyzh/decemulation/pdp_fpga.html>
- POP-11 論文: ASP-DAC 2004
  