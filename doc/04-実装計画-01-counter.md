# 実装計画：01-counter

## 方針

- 8 ビット二進カウンタ（clk / rst / count のみ）
- メインスレッド直実行（Worker・SharedArrayBuffer は後回し）
- `requestAnimationFrame` 1 本で step × N ＋ draw（`setInterval` は使わない）
- Logic Analyzer は各ビットを横トラックに高/低の折れ線で描画（Canvas のみ、ライブラリなし）
- Docker は不要（ホスト直インストールの Verilator ＋ Emscripten を使用）

## 作成ファイル

```text
examples/01-counter/
├── verilog/counter.v      ← DUT
├── cxx/harness.cpp        ← ring buffer + Emscripten エクスポート
└── web/index.html         ← requestAnimationFrame ループ + Canvas 描画

scripts/build-wasm.sh      ← Verilator → em++ の一発スクリプト
```

## ビルドパイプライン

```text
examples/01-counter/verilog/counter.v
  │
  ▼ verilator --cc --Mdir obj_dir
  │
obj_dir/V*.cpp + $VERILATOR_ROOT/include/verilated.cpp
  + examples/01-counter/cxx/harness.cpp
  │
  ▼ em++ -O2 -s EXPORTED_FUNCTIONS=[...] -s EXIT_RUNTIME=0
  │
examples/01-counter/web/sim.js + sim.wasm
```

## エクスポート関数（C → JS）

| 関数 | 役割 |
| --- | --- |
| `sim_init()` | Vcounter 生成・初期リセット |
| `step()` | 1 クロック進める・ring buffer に書く |
| `reset_sim()` | カウンタをリセット・head を 0 に戻す |
| `get_ring_ptr()` | ring buffer の先頭アドレス（バイト） |
| `get_head()` | 書き込み済みサンプル数（ラップなし） |
| `get_ring_size()` | ring buffer のサイズ（= 1024） |

## Logic Analyzer 描画

- 各ビット（bit7 〜 bit0）を独立した横トラックで表示
- 高 → 上端付近、低 → 下端付近の折れ線（Canvas `lineTo`）
- 表示幅 = canvas.width − ラベル幅 ぶんの最新サンプルをスクロール表示
- 速度スライダーで `stepsPerFrame` を 1〜2000 に変更

## 実行手順（完成版）

### 1. ビルド

```bash
cd ~/36-soft-FPGA
bash scripts/build-wasm.sh
```

- Verilator が `obj_dir/` に C++ を生成
- 初回のみ `cxx/verilated.cpp` をシステムからコピー
- `examples/01-counter/web/sim.js` と `sim.wasm` が生成される

### 2. Web サーバ起動

```bash
cd examples/01-counter/web
python3 -m http.server 8080
```

### 3. ブラウザで開く

```text
http://localhost:8080/
```

| 操作 | 内容 |
| --- | --- |
| **Run / Pause** | シミュレーション開始・停止 |
| **Reset** | カウンタをリセット |
| **速度スライダー** | 1 フレームあたりのクロック数（1〜2000） |

---

## Wasm ビルドで解決した問題

### 問題 1: emsdk のパス

`~/emsdk/emsdk_env.sh` ではなく `~/emsdk/emsdk/emsdk_env.sh` が正しい。
`build-wasm.sh` は複数候補を探して自動ソースする。

### 問題 2: verilated.cpp のバージョン不一致

29-project の verilated.cpp は Verilator 5.042 より新しいため API 不一致でコンパイルエラー。
ビルド時にシステムから `cxx/verilated.cpp` へコピーする方式に変更（`.gitignore` 追加）。

### 問題 3: `pthread_getaffinity_np` リンクエラー

`verilatedos_c.h` がシステムの verilated.cpp 末尾でインクルードされ、
Emscripten の `<thread>` → `<pthread.h>` → `<sched.h>` 経由で `CPU_ZERO` が定義されると
Linux 用の `pthread_getaffinity_np` 呼び出しがコンパイルされてしまう。

**解決**: `cxx/verilatedos_c.h` に Wasm 向けスタブを作成し、
`-I$ROOT/cxx` をコンパイルパス先頭に追加してシステム版より優先させる。
（`getProcessAvailableParallelism` は 1 固定、`memUsageBytes` は 0 固定）

---

## 実装ステップ

| # | 作業 | 完了条件 |
| --- | --- | --- |
| 1 | `counter.v` | `verilator --lint-only` が通る |
| 2 | `harness.cpp` | `em++` でビルドできる |
| 3 | `build-wasm.sh` | `sim.js` + `sim.wasm` が生成される |
| 4 | `index.html` | ブラウザで 8 ビット波形が動く ✅ |
