# 11. PDP-11 CPU テスト仕様書 <a class="qr-link" href="../../../docs/09-PDP11/40-cpu-テスト計画-QR.png">QR</a>

8080（[06/10](../06-8080/10-テスト仕様書.md)・[06/61](../06-8080/61-全命令タイミングテスト計画.md)）のテスト体系を参考に整備した。

---

## 1. テスト全体像

| レベル | テスト | ツール | 状態 |
|--------|--------|--------|------|
| RTL | Verilator lint | `verilator --lint-only` | ✅ PASS |
| CPU 基本 | basic tests（test0–17） | `pdp11_sim --run-test <.mem>` | ✅ PASS 18/18 |
| CPU 診断 | FKAAC0 Basic CPU Test | `pdp11_sim --diag FKAAC0` | ✅ PASS |
| CPU 診断 | FKABD0 Trap Test | `pdp11_sim --diag FKABD0` | ✅ PASS |
| CPU 診断 | FKACA0 EIS 命令テスト | `pdp11_sim --diag FKACA0` | ✅ PASS |
| MMU | FKTHB0 メモリ管理テスト | `pdp11_sim --diag FKTHB0` | ✅ PASS |
| 診断（I/O） | FKTGC0 命令・I/O エクササイザ | `pdp11_sim --diag FKTGC0` | ✅ PASS |
| OS ブート | Unix V6 ブート確認 | `./doPDP11-unix-v6.sh` | ✅ 手動確認済み |
| OS コマンド | Unix V6 シナリオ自動化 | `scripts/test-pdp11-v6.sh`（`--v6-script`）| ✅ PASS |
| 信号/タイミング | GPR・PSW・MMU・ring の Vitest | `examples/09-pdp11/tests/` で `npm test` | ✅ PASS 7/7 |
| ブラウザ UI | Logic Analyzer / MMU パネル | `verif/web/test_pdp11.py`（Playwright）| ✅ PASS 6/6 |

---

## 2. 前提: ハーネス改造

現在の `main_linux.cpp` は Unix V6 インタラクティブ起動専用。
8080 の `--run-test` / `--exec` に相当するモードを追加する。

### 2.1 必要な機能

```text
pdp11_sim --run-test <file.mem>   .mem ファイルをロードして HALT まで実行
pdp11_sim --diag <name>           MAINDEC 診断プログラムを実行
pdp11_sim --v6-script <file>      Unix V6 を起動してシナリオを流す
```

### 2.2 .mem ファイル形式（basic tests）

`vendor/cpus-pdp11/tests/basic/` の形式:

```text
<8進アドレス> <8進値>
...
```

- ロード後に PC = 0500（8進）から実行
- `HALT` 命令（`0000000`）でシミュレーション停止
- `obs_halted` 信号（`SIM_HALTED`）が 1 になったら exit 0
- タイムアウト（例: 10M クロック）で exit 1

---

## 3. Phase 1: Verilator lint（現状維持）

```bash
cd examples/09-pdp11
verilator --lint-only \
  verilog/test_top_wasm.v \
  --top-module test_top_wasm \
  -Wno-WIDTHEXPAND
```

**合格基準**: 警告ゼロ（または既知の第三者 RTL 警告のみ抑制）。

---

## 4. Phase 2: basic tests（vendor 付属, test0–17 + inttest）

`vendor/cpus-pdp11/tests/basic/` に 19 本のテストが .mem 形式で存在する。
ハーネスが `--run-test` に対応すれば即実行可能。

### 4.1 テスト一覧

| テスト | 内容（推定） |
|--------|-------------|
| test0 | MOV r,r の最小確認（HALT のみ） |
| test1 | 即値ロード + ループ加算 |
| test2–9 | アドレッシングモード・条件分岐・スタック |
| test10–17 | サブルーチン・トラップ・EIS 等（要確認） |
| inttest | 割り込み（TTY/CLK ベクタ・`spl` 命令） |
| ttytest | TTY 文字送受信 |

### 4.2 実行コマンド（実装後）

```bash
for t in $(seq 0 17) inttest ttytest; do
    echo -n "test$t: "
    ./build/pdp11_sim --run-test vendor/cpus-pdp11/tests/basic/test${t}.mem
done
```

**合格基準**: 全テストが `HALT` に達し exit 0 になること。

---

## 5. Phase 3: MAINDEC 診断プログラム

DEC が PDP-11/34 向けに公開した診断プログラムが .mem 形式に変換済みで
`vendor/cpus-pdp11/tests/diags/` に存在する。

### 5.1 診断プログラム一覧

| ファイル | 内容 | 開始 PC | 優先度 |
|---------|------|---------|--------|
| FKAAC0 | 11/34 Basic CPU Test | 0200 | ★★★ |
| FKABD0 | 11/34 CPU Trap Test | 0200 | ★★★ |
| FKACA0 | 11/34 EIS 命令テスト（MUL/DIV/ASH） | 0200 | ★★☆ |
| FKTHB0 | 11/34 メモリ管理テスト（MMU） | 0200 | ★★☆ |
| FKTGC0 | 11/34 命令・I/O エクササイザ | 0200 | ★☆☆ |
| EKBAD0 | 11/70 CPU 診断 Part 1 | 0200 | ★☆☆ |

### 5.2 参考資料

各診断の詳細仕様は PDF で入手済み（diags/ ディレクトリ内）:

- `AC-8041C-MC_CFKAAC0-1134-Bsc-Inst-Tst_Oct78.pdf`
- `AC-8045D-MC_CFKABD0-1134-Traps-Tst_Apr77.pdf`
- `MAINDEC-11-DFKAC-A-D_1134-EIS-Instruction-Tests_Dec75.pdf`

### 5.3 実行コマンド（実装後）

```bash
./build/pdp11_sim --diag FKAAC0   # Basic CPU
./build/pdp11_sim --diag FKABD0   # Trap
./build/pdp11_sim --diag FKACA0   # EIS
```

**合格基準**: 診断プログラムがエラーコードなしで終了し、exit 0 になること。

---

## 6. Phase 4: Unix V6 ブートテスト自動化

現状は手動確認のみ。`--v6-script` モードで自動化する。
8080 の `--cpm-script` と同じ `!expect`/`!assert` 構文を流用。

### 6.1 最小シナリオ（boot.v6）

```text
rkunix
!expect login:
root
!expect #
```

**合格基準**: `login:` → `#` プロンプトが時間内に現れ exit 0。

### 6.2 拡張シナリオ

| シナリオ | 内容 |
|---------|------|
| `boot.v6` | ブート → root ログイン → `#` 確認 |
| `ls.v6` | `ls /` が正常終了 |
| `compile.v6` | `cc hello.c && ./a.out` が `Hello` を出力 |
| `dc.v6` | `dc` で `355 113 / p` → `3` を含む応答 |
| `ps.v6` | `ps -ag` でプロセス一覧が表示される |

---

## 7. Phase 5: 信号/タイミングテスト（Vitest）

8080 の `tests/timing/` に相当する層。PDP-11 固有の観測点を対象にする。

### 7.1 観測対象信号

| 信号 | 内容 |
|------|------|
| GPR R0–R5, SP, PC | 命令実行前後のレジスタ値 |
| PSW | N/Z/V/C フラグ・優先度 |
| MMU PAR/PDR（KS0–KI7, SS0–SI7） | カーネル/スーパー/ユーザーセグメント |
| バスサイクル（DATI/DATO/DATOB） | メモリアクセス種別 |

### 7.2 テストケース（例）

```javascript
// R0 に即値をロードして PSW の Z フラグを確認
it('CLR R0 sets Z=1', async () => {
    const sim = await loadSim()
    const snap = sim.captureInstruction([0x0A00]) // CLR R0
    expect(snap.psw & 0x04).toBe(0x04)            // Z bit
})
```

### 7.3 アドレッシングモード網羅方針

PDP-11 は 8 モード × 8 レジスタ = 最大 64 バリアントを持つ。
8080 の MOV r,r 全 49 件と同様に、代表命令（MOV）でモード網羅テストを作る。

| モード | 記法 | 説明 |
|--------|------|------|
| 0 | `Rn` | レジスタ直接 |
| 1 | `(Rn)` | レジスタ間接 |
| 2 | `(Rn)+` | 自動インクリメント |
| 3 | `@(Rn)+` | 自動インクリメント間接 |
| 4 | `-(Rn)` | 自動デクリメント |
| 5 | `@-(Rn)` | 自動デクリメント間接 |
| 6 | `X(Rn)` | インデックス |
| 7 | `@X(Rn)` | インデックス間接 |

---

## 8. Phase 6: ブラウザ UI（Playwright）

| テスト | 確認内容 |
|--------|---------|
| Logic Analyzer 表示 | バスサイクルが LA に表示される |
| GPR パネル | R0–R5/SP が `cc hello.c` 実行中に変化する |
| MMU パネル | Unix V6 ブート中に PAR が更新される |

---

## 9. 優先順位と工数見積もり

| Phase | 優先度 | 前提 | 概算工数 |
|-------|--------|------|---------|
| 1: lint | ★★★ | なし | 維持のみ |
| 2: basic tests | ★★★ | ハーネス `--run-test` 追加 | 3h |
| 3: MAINDEC FKAAC0/FKABD0 | ★★★ | `--diag` モード追加 | 4h |
| 3: MAINDEC FKACA0/FKTHB0 | ★★☆ | Phase 2 完了後 | 2h |
| 4: V6 ブート自動化 | ★★☆ | `--v6-script` 追加 | 3h |
| 5: Vitest タイミング | ★★☆ | wasm ビルド安定後 | 4h |
| 6: Playwright UI | ★☆☆ | Phase 5 完了後 | 3h |

**推奨着手順序**: Phase 2（basic tests）→ Phase 3 FKAAC0 → Phase 3 FKABD0 →
Phase 4 V6 自動化 → Phase 5 Vitest。

---

## 10. 参考

- [10-unix-v6-コマンドリファレンス.md](10-unix-v6-コマンドリファレンス.md) — Unix V6 コマンド一覧
- [06/10-テスト仕様書.md](../06-8080/10-テスト仕様書.md) — 8080 テスト仕様（参考構造）
- [06/61-全命令タイミングテスト計画.md](../06-8080/61-全命令タイミングテスト計画.md) — 8080 タイミングテスト計画
- `vendor/cpus-pdp11/tests/` — basic tests / MAINDEC 診断（.mem 変換済み）
- `vendor/cpus-pdp11/verif/README` — Brad Parker の検証方針

---

## 実装状況（2026-06-05 追記）— テスト自動化 3 種を実装

計画していた 3 つのテスト自動化を実装した。実行方法:

### 1. Unix V6 シナリオ（`--v6-script`）

`main_linux.cpp` に `--v6-script <file>` モードを追加。`wait` / `expect` / `send` /
`timeout` ディレクティブで V6 を起動して操作し、PASS/FAIL を返す。

```bash
bash scripts/build-host-09.sh          # ネイティブ sim をビルド
bash scripts/test-pdp11-v6.sh          # examples/09-pdp11/tests/v6-scripts/*.v6 を実行
```

- 例: [`cc-hello.v6`](../../examples/09-pdp11/tests/v6-scripts/cc-hello.v6)
  — 起動 → root ログイン → printf プログラムを `cc` コンパイル＆実行を検証
  （cc バスエラー修正・ディスク健全性の回帰テスト）。
- 各実行はディスクのコピー上で行い、ソースディスクを汚さない。

### 2. 信号 Vitest（GPR / PSW / MMU / ring）

`build-wasm-09.sh` が Node.js 用 ES Module `examples/09-pdp11/tests/sim-test.mjs`
（`MODULARIZE` + `EXPORT_ES6`、ディスク埋め込み）も生成する。Vitest で V6 を起動し、
リングバッファ・GPR・MMU スナップショットに信号が反映されることを確認する。

```bash
bash scripts/build-wasm-09.sh          # sim-test.mjs を生成
cd examples/09-pdp11/tests && npm install && npm test
```

- テスト: [`tests/signals/boot-signals.test.mjs`](../../examples/09-pdp11/tests/signals/boot-signals.test.mjs)（7 件）。

### 3. ブラウザ UI（Playwright）

[`verif/web/test_pdp11.py`](../../verif/web/test_pdp11.py)（6 件）。ブート→login、
ブート進行インジケータ、レジスタパネルのライブ更新、MMU パネルの PAR 表示、
Logic Analyzer canvas の描画、root シェル到達を検証する。

```bash
# サーバー起動 + 全 web テスト（04/06/09）をまとめて実行
bash scripts/_doTestAll-web.sh
# 単体:
.venv/bin/pytest verif/web/test_pdp11.py -v \
    --base-url http://localhost:8080/examples/09-pdp11/web/index.html
```
