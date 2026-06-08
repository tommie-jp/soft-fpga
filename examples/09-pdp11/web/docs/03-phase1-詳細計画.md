# Phase 1 詳細計画 — Verilator ネイティブで Unix V6 ブート確認 <a class="qr-link" href="../../../docs/09-PDP11/03-phase1-詳細計画-QR.png">QR</a>

## 1. ゴールと完了定義

### 1.1 具体的な成功状態

以下のコマンドを実行した結果、ターミナルに Unix V6 ログインプロンプトが表示される。

```bash
./scripts/build-host-09.sh
./examples/09-pdp11/build/pdp11_sim
```

期待される出力（ブート完了時）:

```text
login: root
#
```

「`#`」が表示された状態で `ls /` を打ち返し、ファイルリストが返ればフル成功とする。

### 1.2 完了条件チェックリスト

- [ ] `git submodule add` で `vendor/cpus-pdp11` を取り込み済み
- [ ] `verilator --lint-only -Wall rtl/top.v` がエラーゼロ（警告は `-Wno-` で明示的に抑制済み）
- [ ] `ide.cpp` の VPI/PLI 呼び出しがないことを確認（または C++ で置き換え済み）
- [ ] `scripts/build-host-09.sh` を実行して `pdp11_sim` バイナリが生成される
- [ ] RT-11 ディスクイメージで起動してモニタプロンプト（`>`）が表示される
- [ ] Unix V6 ディスクイメージで起動して `login:` プロンプトが表示される
- [ ] `sh` から `ls /` が返る（MMU + ユーザモードの動作確認）

---

## 2. 前提条件・環境

### 2.1 必要ツールと確認済みバージョン

このプロジェクトは `docker/` 以下の Docker コンテナで開発環境を統一している。
ネイティブ Linux ビルドも同じコンテナ内で行う。

| ツール | 必要バージョン | 確認方法 |
| --- | --- | --- |
| Verilator | 5.x（`5.020` 以上推奨） | `verilator --version` |
| g++ / clang++ | C++17 対応（GCC 11 以上） | `g++ --version` |
| GNU Make | 4.x | `make --version` |
| Git | サブモジュール対応済み | `git --version` |

Verilator のバージョンは `build-wasm-06.sh` と同じ環境を使うため、Docker コンテナ内では
`verilator --version` で `5.x` 系が返ることを前提とする。

Docker コンテナ外でビルドする場合は `build-wasm-04.sh` の `VERILATOR_ROOT` 取得パターンを踏襲する。

```bash
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"
```

### 2.2 使用するコミット/リビジョン

`cpus-pdp11` は 2016-01-02 の最終コミット（SHA: `master` ブランチ先端）を使う。
サブモジュールとして固定することでリビジョンを再現可能にする。

```bash
# 取り込み時に SHA を記録
git submodule add https://github.com/lisper/cpus-pdp11 vendor/cpus-pdp11
git -C vendor/cpus-pdp11 log --oneline -1
# 例: a1b2c3d added README.md
```

`.gitmodules` にコミット SHA が固定される。将来のリベースに備えて
`git submodule update --init` で完全に再現できる状態を維持する。

### 2.3 ディスクイメージの入手

| OS | 入手先 | サイズ | 備考 |
| --- | --- | --- | --- |
| RT-11 v5.3 | [TUHS](https://www.tuhs.org/) または Brad リポジトリ内 `data/` | ~1 MB | 軽量、ブートが速い |
| Unix V6 | TUHS `Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/` | ~2.5 MB | デモ本命 |

ライセンス確認が完了するまで Unix V6 イメージを GitHub に push しない。
ローカルに `examples/09-pdp11/disk/` を作成し `.gitignore` に追記する。

---

## 3. Step 1: リポジトリ取り込みと構成確認

### 3.1 サブモジュールとして追加する手順

```bash
# プロジェクトルートから実行
cd /home/tommie/36-soft-FPGA

git submodule add https://github.com/lisper/cpus-pdp11 vendor/cpus-pdp11
git submodule update --init --recursive

# サブモジュール追加をステージ
git add .gitmodules vendor/cpus-pdp11
```

取り込み後のディレクトリ配置:

```text
36-soft-FPGA/
├── vendor/
│   └── cpus-pdp11/
│       ├── rtl/          ← Verilog RTL（本体）
│       ├── verilator/    ← Brad の既存 Verilator ハーネス
│       ├── verif/        ← テスト・診断・Makefile
│       └── data/         ← ディスクイメージ（RT-11・Unix V6 など）
└── examples/
    └── 09-pdp11/
        ├── cxx/          ← 新規作成するハーネス
        ├── web/          ← WASM 成果物（Phase 2 以降）
        └── disk/         ← ディスクイメージ（.gitignore）
```

### 3.2 ディレクトリ構成の確認方法

RTL の重要ファイルを確認する:

```bash
# 主要 RTL ファイルの行数確認
wc -l vendor/cpus-pdp11/rtl/*.v | sort -n

# 期待値（調査メモより）:
# pdp11.v   2113 行  CPU 本体・命令デコード
# execute.v 1259 行  実行ユニット
# rk_regs.v  835 行  RK11 ディスクコントローラ
# mmu.v      703 行  MMU（11/44 風）
# bootrom.v  526 行  ブート ROM

# Brad の既存 Verilator ハーネスを確認
cat vendor/cpus-pdp11/verilator/test.cpp     # 84 行のメインドライバ
cat vendor/cpus-pdp11/verilator/ide.cpp      # IDE ディスクモデル
cat vendor/cpus-pdp11/verilator/ram.cpp      # RAM C++ モデル
cat vendor/cpus-pdp11/verif/verilator.sh     # Brad のビルドスクリプト
```

`verif/verilator.sh` に記載のコマンド形式（Verilator 3.7 時代）を確認し、
`build-host-09.sh` で Verilator 5.x 向けに書き直す差分を把握する。

---

## 4. Step 2: Verilator 5.x lint チェックと互換パッチ

### 4.1 `verilator --lint-only` の具体的コマンド

```bash
cd /home/tommie/36-soft-FPGA

verilator --lint-only -Wall \
    vendor/cpus-pdp11/rtl/top.v \
    +incdir+vendor/cpus-pdp11/rtl \
    2>&1 | tee /tmp/pdp11_lint.log

# エラー数とカテゴリを集計
grep -E '^\%Error|^\%Warning' /tmp/pdp11_lint.log | \
    sed 's/-.*//' | sort | uniq -c | sort -rn
```

`top.v` がすべての RTL をインクルードまたは `\`include` 経由で参照している場合は
`top.v` 一つ指定で全 RTL が対象になる。
`rk_regs.v`・`mmu.v` 等が独立している場合は個別にリストする。

### 4.2 予想される警告リスト

調査メモ（`01-PDP11-verilogコア調査.md` §2.4）に記載の既知非互換と、
Verilator 5.x の新規厳格化から予想される警告:

| 警告コード | 発生源 | 原因 | 対処方針 |
| --- | --- | --- | --- |
| `CASEX` | `mmu.v`, `pdp11.v` | `casex` 使用 | `lint_off` 済みだが 5.x で再確認 |
| `CASEINCOMPLETE` | `mmu.v` | `casex` のデフォルトなし | 同上 |
| `STMTDLY` | 複数ファイル | `#delay` 記述 | `lint_off` 追加 |
| `WIDTHEXPAND` | `execute.v` | 暗黙の符号拡張 | `lint_off` または明示キャスト |
| `WIDTHTRUNC` | 各所 | ビット幅縮小代入 | 同上 |
| `UNOPTFLAT` | `pdp11.v` | 組合せループ | `verilator isolate_assignments` 追加 |
| `TIMESCALEMOD` | `top.v` など | `timescale` 宣言 | Verilator 5.x では `-Wno-TIMESCALEMOD` |
| `INITIALDLY` | テストベンチ系 | `initial` 内の delay | RTL 本体には少ないはず |

`execute.v` の `e1_result /* verilator isolate_assignments */` は Brad が既に対処している。
`top.v` の `/* verilator public_flat */` / `/* verilator public_flat_rw */` プラグマも記述済み。

### 4.3 パッチ方針

**方針: `lint_off` で黙らせることを優先し、RTL 本体は最小限の修正にとどめる。**

Verilator 5.x で RTL を書き直すと動作の正確性を損なうリスクがある。
`lint_off` はコンパイル時のみ適用され、シミュレーション動作には影響しない。

```verilog
// 例: mmu.v の先頭に追加するパッチ
/* verilator lint_off CASEX */
/* verilator lint_off CASEINCOMPLETE */
/* verilator lint_off WIDTHEXPAND */
/* verilator lint_off WIDTHTRUNC */
```

一方、シグナルアクセスの名前マングリング（`top->v__DOT__top__DOT__reset`）は
Brad の `verilator/test.cpp` を使わず新規ハーネスを書くことで回避する。
新ハーネスではトップレベルポートを直接参照する（`top->reset = 1`）。

---

## 5. Step 3: `ide.cpp` の PLI/VPI 依存調査

### 5.1 VPI 呼び出しの有無を grep で確認する方法

```bash
# VPI/PLI 関連のシンボルを全ファイルで検索
grep -rn \
    -e 'vpi_' \
    -e 'tf_' \
    -e 'PLI' \
    -e 'VPI' \
    -e '#include.*vpi' \
    -e '#include.*pli' \
    vendor/cpus-pdp11/verilator/ \
    vendor/cpus-pdp11/rtl/

# ide.cpp 単独でチェック
grep -n 'vpi_\|tf_\|PLI\|VPI\|veriuser' \
    vendor/cpus-pdp11/verilator/ide.cpp
```

`ide.cpp` が純粋 C++ モデルであれば VPI 呼び出しはなく、そのまま流用できる。
Brad のコード（84 行のメインドライバ `test.cpp`）は `#include "verilated.h"` のみを
使っており、VPI 非依存で書かれている可能性が高い。

### 5.2 純粋 C++ モデルに書き直す方針

`ide.cpp` に VPI が含まれていた場合の対処:

1. VPI 呼び出し箇所をリストアップ（`grep` 結果から）
2. 各 VPI 関数の役割を確認（主に「Verilog 側からホスト関数を呼ぶ」コールバック機構）
3. Verilator では `VerilatedContext::internalsDump()` やトップレベルポート経由で
   同等の機能を実現できる

`ide.cpp` が担う RK11 ディスク DMA のエミュレーションは以下の構成に書き直す:

```cpp
// VPI コールバックの代替: ハーネスのメインループで毎クロック呼ぶ
void ide_tick(Vtest_top* top) {
    // rk_regs.v が要求する DMA 転送をホスト側でエミュレート
    if (top->rk_dma_req) {
        // ディスクイメージから読み出し → top->rk_dma_data に流す
    }
}
```

### 5.3 代替手段: cver で参照実装を先に動かす方法

`ide.cpp` の書き直しが複雑になった場合、cver（GPL ライセンス）を使って
Unix V6 ブートが通る参照実装を先に確立する。

```bash
# cver をビルド（Brad のリポジトリに simhv36-1/ が同梱されているが
# cpus-pdp11 の cver ディレクトリを使う）
cd vendor/cpus-pdp11
make -C verif unix_v6   # または cver ターゲット

# cver 実行（VPI 経由でブートを確認）
# この出力を Verilator 実装の正解ログとして保存する
```

cver での確認ログと Verilator での出力を比較することで、
C++ ハーネスのどこに差異があるかを特定しやすくなる。

---

## 6. Step 4: 最小ハーネス (`main_linux.cpp`) の作成

### 6.1 `04-6502` の `main_linux.cpp` を参考にした最小構成

`examples/04-6502/cxx/main_linux.cpp` のパターンを踏襲する。
PDP-11 版の最小構成では以下の変更が必要:

| 6502 ハーネスの要素 | PDP-11 版での対応 |
| --- | --- |
| `Vapple1_top` | `Vtest_top`（Brad の `test_top.v` がルート） |
| `ram[0x10000]` | `ram[0x40000]`（18 ビットアドレス、256 KB） |
| PIA エミュレーション | Unibus デコード（TTY・RK11） |
| `kbd_queue` / `disp_queue` | 同じパターンで流用 |
| `i_di` / `o_ab` / `o_we` | `bus_data` / `bus_addr` / `bus_wr` に相当するポート |

新規ファイル: `examples/09-pdp11/cxx/main_linux.cpp`

```cpp
// PDP-11 / Unix V6 Linux ターミナルフロントエンド
// examples/04-6502/cxx/main_linux.cpp のパターンを踏襲

#include "Vtest_top.h"
#include "verilated.h"
#include <cstdio>
#include <cstdlib>
#include <csignal>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdint.h>

static Vtest_top* top;

// PDP-11/34 の物理アドレス空間: 18 ビット = 256 KB
// Unibus I/O ページ: 0760000–0777777（8 進）= 0x1F000–0x1FFFF（物理）
static const uint32_t IO_PAGE_BASE = 0x1F000u;
static const uint32_t MEM_SIZE     = 0x40000u;   // 256 KB
static uint8_t ram[MEM_SIZE];

// コンソール TTY (DL11) キューパターン（6502 版から流用）
static uint8_t  kbd_queue[256];
static int      kbd_q_head = 0, kbd_q_tail = 0;
static uint8_t  disp_queue[4096];
static int      disp_q_head = 0, disp_q_tail = 0;
```

### 6.2 クロック生成・リセット・メモリマップの実装方針

PDP-11/34 のリセットシーケンスは 6502 より複雑で、リセット後に
ブートROM（`bootrom.v`）がアドレス `0173000`（8 進）= `0xF600`（物理）に
ブートストラップルーチンを配置する。

```cpp
void sim_init() {
    top = new Vtest_top();
    memset(ram, 0, sizeof(ram));

    // ディスクイメージをロード
    FILE* f = fopen("disk/unixv6.rk", "rb");
    if (!f) { fprintf(stderr, "ERROR: disk/unixv6.rk not found\n"); exit(1); }
    // ide_init(f) で ide.cpp に渡す

    // リセット: PDP-11 は reset 信号をアサートして複数クロック維持
    top->reset = 1;
    top->clk = 0;
    top->eval();
    for (int i = 0; i < 16; i++) {
        top->clk = 1; top->eval();
        top->clk = 0; top->eval();
    }
    top->reset = 0;
    top->eval();
}
```

### 6.3 Unibus デコード（TTY・RK11 レジスタのアドレス範囲）

Unibus I/O アドレスは 18 ビットアドレス空間の上位 4 KB に集中する。
主要デバイスのアドレス（8 進 / 16 進対応表）:

| デバイス | Unibus アドレス（8 進） | 物理アドレス（16 進） | 意味 |
| --- | --- | --- | --- |
| KW11 ラインクロック CSR | `0177546` | `0x1FFAE6` | ラインクロック制御 |
| DL11 受信 CSR | `0177560` | `0x1FFAF0` | コンソール TTY 受信制御 |
| DL11 受信バッファ | `0177562` | `0x1FFAF2` | キーボードデータ |
| DL11 送信 CSR | `0177564` | `0x1FFAF4` | コンソール TTY 送信制御 |
| DL11 送信バッファ | `0177566` | `0x1FFAF6` | 表示出力データ |
| RK11 DS | `0177400` | `0x1FFC00` | ディスクステータス |
| RK11 ER | `0177402` | `0x1FFC02` | エラーレジスタ |
| RK11 CS | `0177404` | `0x1FFC04` | コントロール/ステータス |
| RK11 WC | `0177406` | `0x1FFC06` | ワードカウント |
| RK11 BA | `0177410` | `0x1FFC08` | バスアドレス |
| RK11 DA | `0177412` | `0x1FFC0A` | ディスクアドレス |

`rk_regs.v` と `tt_regs.v` は RTL 内で Unibus アドレスデコードを行う。
ハーネス側での追加デコードは `bus.v` がバスアービタとして処理するため基本不要。
ただし `ide.cpp`（ディスクイメージの実データ読み書き）はハーネス側で実装する。

---

## 7. Step 5: ビルドスクリプト作成

### 7.1 `scripts/build-host-09.sh` の具体的な内容

`build-wasm-04.sh` と `build-wasm-06.sh` の形式を踏襲する。

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/09-pdp11"
VENDOR="$ROOT/vendor/cpus-pdp11"
OBJ_DIR="$ROOT/obj_dir_09_host"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

echo "=== Verilator ==="
rm -rf "$OBJ_DIR"
verilator --cc \
    "$VENDOR/rtl/test_top.v" \
    +incdir+"$VENDOR/rtl" \
    --top-module test_top \
    -Wno-CASEX \
    -Wno-CASEINCOMPLETE \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-STMTDLY \
    -Wno-TIMESCALEMOD \
    -Wno-UNOPTFLAT \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O2 -std=c++17 -I$VERILATOR_ROOT/include -I$OBJ_DIR"

echo "=== C++ build ==="
g++ $COMMON_FLAGS \
    "$OBJ_DIR"/V*.cpp \
    "$VERILATOR_ROOT/include/verilated.cpp" \
    "$VENDOR/verilator/ide.cpp" \
    "$VENDOR/verilator/ram.cpp" \
    "$EXAMPLE/cxx/main_linux.cpp" \
    -o "$EXAMPLE/build/pdp11_sim"

echo "=== Done ==="
echo "  $EXAMPLE/build/pdp11_sim"
echo ""
echo "Usage: $EXAMPLE/build/pdp11_sim disk/unixv6.rk"
```

**注意点**: `ide.cpp` と `ram.cpp` の関数シグネチャが Verilator 5.x のトップクラス名
（`Vtest_top` vs 旧 `Vtop`）と合わない場合は `main_linux.cpp` 側でラップする。

### 7.2 CMakeLists.txt の構成

ビルドスクリプトの複雑化を防ぐため Phase 1 は Bash スクリプトを使う。
CMake は Phase 2（WASM ビルド）以降で必要になった場合に追加する。
現状の `build-wasm-04.sh` および `build-wasm-06.sh` も CMake を使っていないため
このプロジェクトの慣例に沿っている。

---

## 8. Step 6: 動作確認シーケンス

### 8.1 RT-11 で先に動作確認する理由

RT-11 は Unix V6 より軽量で以下の優位点がある:

- ブートまでのクロック数が少ない（数秒〜30 秒程度）
- MMU を使わないため `mmu.v` のバグが隠れない（逆説的に問題を切り分けやすい）
- ディスクコントローラ（RK11）の基本動作確認に十分
- ハーネスの TTY パスが正しく動いているか早期に確認できる

```bash
./examples/09-pdp11/build/pdp11_sim disk/rt11.rk

# 期待出力（RT-11 モニタ起動）:
# RT-11FB V05.03  ...
# .DIR
```

RT-11 で `.DIR`（ディレクトリリスト）が返ったら RK11 ディスク読み出しが正常。

### 8.2 Unix V6 ブートの確認手順

```bash
./examples/09-pdp11/build/pdp11_sim disk/unixv6.rk

# ブートシーケンス（Brad の heeltoe.com ドキュメントより）:
# 1. bootrom.v が起動 → RK11 ブートブロックをアドレス 0 にロード
# 2. ブートブロックが /unix カーネルをロード
# 3. カーネル init が /etc/ttys を読み、getty を起動
# 4. "login:" プロンプト表示
#
# 期待出力:
# login: root
# #
```

ブート中の標準的な出力パターン（Unix V6）:

```text
mem = XXXXX
RESTRICTED RIGHTS: USE, DUPLICATION, OR DISCLOSURE
IS SUBJECT TO RESTRICTIONS STATED IN YOUR CONTRACT WITH
WESTERN ELECTRIC COMPANY, INC.
WED JAN  1 00:00:00 1970

login:
```

`mem = XXXXX` の行が出たらカーネルが RAM 検出に成功している。
この行が出ない場合は RK11 DMA かブート ROM に問題がある。

### 8.3 DEC 診断テスト（FKAAC0、FKTHB0）の実行方法

DEC 公式診断は XXDP 形式の `.BIC` バイナリ。
`vendor/cpus-pdp11/tests/diags/` に同梱されている（著作権上の問題から外部配布しない）。

```bash
# FKAAC0: 11/34 基本命令テスト
./examples/09-pdp11/build/pdp11_sim diag/FKAAC0.BIC --xxdp

# FKTHB0: MMU 診断
./examples/09-pdp11/build/pdp11_sim diag/FKTHB0.BIC --xxdp

# Brad の verif/Makefile を参考に、--xxdp オプションで診断モードに切り替える
# 診断結果は "PASS" または "FAIL" の文字列で判定する
```

`verif/Makefile` の `test_diag` ターゲットを確認して正確な起動手順を合わせる:

```bash
cat vendor/cpus-pdp11/verif/Makefile | grep -A5 'FKAAC0\|FKTHB0'
```

診断は Unix V6 ブート確認の後に実施する。
Unix V6 が動けば基本命令は通っている可能性が高いが、
MMU 診断（FKTHB0）はユーザモードプロセスの安定動作に必須。

---

## 9. リスクと判断ポイント

### 9.1 Phase 1 で詰まった場合の判断基準

各ステップで詰まったときの判断フロー:

| 詰まりポイント | 具体的症状 | 判断 |
| --- | --- | --- |
| lint エラーが多すぎる | 50 件超の `%Error` | Verilator 4.x 系を試す（後退） |
| `ide.cpp` に大量の VPI | 10 行超の VPI 呼び出し | cver で参照確認を先行させる |
| ビルドは通るがブートしない | 出力なし or ゴミ文字 | `test17` 相当のバグか TTY デコードミス |
| RT-11 は動くが Unix V6 が動かない | `login:` が出ない | MMU バグの可能性 → FKTHB0 を先に実行 |
| MMU 診断が失敗する | FAIL が返る | `mmu.v` の Verilator 互換性問題 → w11（VHDL）への切り替えを検討 |

### 9.2 進む / 諦める / 方針転換の基準

**進む**: RT-11 が動いた時点で Phase 2（WASM 化）に進む価値がある。
Unix V6 ブートが Phase 1 の最終目標だが、RT-11 動作確認で RK11・TTY のパスが
通ることを確認できれば大半の実装は完成している。

**諦める（cpus-pdp11 から撤退）**:
`mmu.v` に Verilator で再現できない根本的なバグが見つかり、
かつ Brad への問い合わせ（§ライセンス確認と兼ねる）でも情報が得られない場合。
この場合の代替は `w11`（VHDL → Verilator を介さない方向）または
`EasyComp_PDP-11`（機能は限定的）となる。

**方針転換（cver 経由での正解確認）**:
Verilator ハーネスと cver での動作に差異が発生した場合は cver のログを正解として
C++ ハーネスのデバッグを進める。具体的には:

1. cver でブートした際の TTY 出力をファイルに保存
2. Verilator 実装の出力と diff で比較
3. 差異が最初に発生するクロックタイミングを特定
4. その時点のバスサイクルを `--trace` で VCD 出力して比較

```bash
# Verilator の --trace オプションで VCD 生成
verilator --cc --trace ... 

# ハーネス側で VCD 書き出し（デバッグ用のみ、通常時は無効化）
# ※ WASM 版では VCD は使わない（ring buffer に統一）
Verilated::traceEverOn(true);
VerilatedVcdC* tfp = new VerilatedVcdC;
top->trace(tfp, 99);
tfp->open("/tmp/pdp11_trace.vcd");
// 各クロックで tfp->dump(sim_time++) を呼ぶ
```

### 9.3 cver 参照実装と Verilator 実装の差異への対処

差異が発生した場合の典型的な原因と対処:

| 差異の種類 | 原因 | 対処 |
| --- | --- | --- |
| RK11 割り込みタイミングのずれ | `ide.cpp` のコールバックタイミング差 | `rk_done` 信号の立ち上がりを確認、1 クロック調整 |
| KW11 ラインクロックの欠落 | ハーネスが 60 Hz 割り込みを生成していない | `step()` の呼び出し回数で疑似的に割り込みを生成 |
| MMU 変換エラー | Verilator の初期値問題（vm80a の `reset バグ` と同種） | `top->reset` アサート期間を延長、PAR/PDR レジスタをゼロ初期化 |
| コンソール文字化け | TTY ボーレートのビットストリーム解釈差 | `tt_regs.v` は `fake_uart.v` 経由か確認 |

---

## 10. 所要時間見積もり

### 10.1 各ステップの工数

| ステップ | 楽観 | 悲観 | 主なリスク要因 |
| --- | --- | --- | --- |
| Step 1: サブモジュール取り込みと確認 | 0.5 時間 | 1 時間 | ネットワーク速度（177 MB） |
| Step 2: Verilator lint と互換パッチ | 1 時間 | 4 時間 | 未知の警告カテゴリ数 |
| Step 3: `ide.cpp` の VPI 依存調査 | 0.5 時間 | 8 時間 | VPI 依存が深かった場合の書き直し |
| Step 4: 最小ハーネス作成 | 2 時間 | 5 時間 | Unibus デコードの細部 |
| Step 5: ビルドスクリプト作成 | 1 時間 | 2 時間 | リンクエラー解消 |
| Step 6: 動作確認（RT-11） | 0.5 時間 | 3 時間 | RK11 DMA タイミング |
| Step 6: 動作確認（Unix V6） | 1 時間 | 8 時間 | MMU 診断失敗時 |
| Step 6: DEC 診断（FKAAC0/FKTHB0） | 1 時間 | 4 時間 | 診断ツール読み込み調整 |

楽観合計: **7.5 時間**（集中して 1 日）  
悲観合計: **35 時間**（`ide.cpp` の全書き直し + MMU デバッグが重なった場合）

### 10.2 Phase 1 全体の見込み

- **`ide.cpp` が純粋 C++ の場合**: 2〜3 日（実作業 8〜12 時間）
- **`ide.cpp` に VPI が含まれ書き直しが必要な場合**: 1〜2 週間（実作業 20〜40 時間）
- **MMU 診断が通らない場合**: Phase 1 の完了を「RT-11 動作確認」に下げて Phase 2 に進む選択肢も取る

実務的には `ide.cpp` の VPI 依存調査（Step 3）を最初に行い、
「VPI がある = 悲観シナリオ」として計画を組み直すかどうかを判断する。
VPI がなければ楽観シナリオで進める。

---

## 参考リンク

- [Brad Parker cpus-pdp11 README](https://www.heeltoe.com/download/pdp11/README.html)
- [GitHub: lisper/cpus-pdp11](https://github.com/lisper/cpus-pdp11)
- [wfjm/w11（VHDL 参考実装）](https://github.com/wfjm/w11)
- [TUHS Unix V6 アーカイブ](https://www.tuhs.org/Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/)
- [調査メモ](./01-PDP11-verilogコア調査.md)
- [WASM 実装計画](./02-wasm実装計画.md)

---

## 11. 実行ログ（2026-06-03）

### 実施した作業

| ステップ | 結果 |
| --- | --- |
| Step 1: サブモジュール取り込み | ✅ `vendor/cpus-pdp11/` に追加 |
| Step 2: Verilator lint | ✅ エラー 1 件（`PROCASSWIRE`）を `dout: wire→reg` パッチで解消 |
| Step 3: VPI 依存調査 | ✅ **VPI なし**。DPI (`svdpi.h`) 使用 — Verilator 5.x ネイティブ対応 |
| Step 4: ハーネス作成 | ✅ `examples/09-pdp11/cxx/main_linux.cpp` + DPI シム作成 |
| Step 5: ビルドスクリプト | ✅ `scripts/build-host-09.sh` — ビルド成功 |
| Step 6: RT-11 起動確認 | ✅ **RT-11 V04.00C 起動・DIR コマンド応答確認** |
| Step 6: Unix V6 起動確認 | ✅ **Unix V6 ブート・root ログイン・`ls /` 実行確認** |

### 適用したパッチ（`vendor/cpus-pdp11/verif/test_top.v`）

```diff
- wire [31:0] din, dout;
+ wire [31:0] din;
+ reg  [31:0] dout;

- reg [3:0] button;
+ reg [3:0] button /* verilator public_flat_rw */;
- reg sysclk;
+ reg sysclk /* verilator public_flat_rw */;
```

### 追加パッチ（2026-06-04）

#### `vendor/cpus-pdp11/rtl/top.v` — MMU 有効化

```diff
- `define no_mmu
+ // `define no_mmu  // disabled: simulation uses real mmu for Unix V6
```

**根本原因**: `top.v` 先頭の `` `define no_mmu `` が Verilator preprocessing 順序の都合で
`test_top.v` の `ifdef no_mmu` より後に評価され、常に `null_mmu`（MMU パススルー）が
インスタンス化されていた。Unix V6 カーネルはユーザプロセス起動に MMU が必須なため、
スケジューラループから抜けられずブートが完了しなかった。

#### `vendor/cpus-pdp11/rtl/fake_uart.v` — 自動 login 拡張

`fake_v6_unix` シーケンスを拡張：

- `rkunix\r` → 15M サイクル待機 → `ROOT\r`（LCASE 大文字入力）→ 10M サイクル待機 → `ls /\r`
- LCASE モード: 大文字入力をカーネルが小文字に変換 → `root` としてログイン成功

#### `scripts/build-host-09.sh` — C++ ファイルリストをグロブ化

```diff
- "$OBJ_DIR"/Vtest_top___024root__0.cpp \
- "$OBJ_DIR"/Vtest_top___024root__0__Slow.cpp \
- "$OBJ_DIR"/Vtest_top___024root__Slow.cpp \
- "$OBJ_DIR"/Vtest_top__ConstPool_0.cpp \
+ "$OBJ_DIR"/Vtest_top*.cpp \
```

MMU 有効化で `Vtest_top___024root__1.cpp` が追加生成されるため。

### 作成ファイル

- `examples/09-pdp11/cxx/main_linux.cpp` — Verilator 5.x ハーネス
- `examples/09-pdp11/cxx/ide_v5.cpp` — DPI IDE エミュレータ（`svLogicVecVal*` 対応）
- `examples/09-pdp11/cxx/ram_v5.cpp` — DPI RAM エミュレータ（同上）
- `scripts/build-host-09.sh` — ビルドスクリプト

### Phase 1 完了

`unix_v6_rk05.dsk` (2.4 MB RK05 イメージ) で確認した実行ログ:

```text
@rkunix
login: ROOT
# LS /
BIN   DEV   ETC   HPUNIX  LIB   MNT
RKUNIX  RPUNIX  TMP  UNIX  USR
#
```

（LCASE モード: 大文字表示、内部は小文字処理）

全完了条件を達成。次フェーズ: Phase 2（WebAssembly 化）へ。
