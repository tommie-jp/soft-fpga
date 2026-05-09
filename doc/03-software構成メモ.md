# software 構成メモ

verilog ソース → Verilator → C++ → Emscripten → WebAssembly バイナリ、
および WebAssembly をブラウザで動かす web アプリの構成。

---

## ビルドパイプライン

```text
examples/XX/verilog/top.v
  │
  ▼ verilator --cc --Mdir obj_dir
  │
obj_dir/V*.cpp
  │
  + cxx/verilated.cpp  ← Verilator ランタイム（Wasm 向けビルド、後述）
  + examples/XX/cxx/harness.cpp  ← ring buffer サンプリング・エクスポート関数
  │
  ▼ em++ -O2 -s EXPORTED_FUNCTIONS=[...] -s EXIT_RUNTIME=0
  │
examples/XX/web/sim.js + sim.wasm  ← Emscripten グルー
```

---

## verilated.cpp の Wasm 向けビルド

システムの Verilator ランタイム（`$VERILATOR_ROOT/include/verilated.cpp`）はそのままでは
Emscripten でビルドできない。主な理由は以下の 2 点。

### 問題 1: スレッド／トレースヘッダ

`verilated.cpp` は `verilated_threads.h` と `verilated_trace.h` をインクルードするが、
これらはホスト OS 依存の型を要求する。

**対策**: `cxx/wasm_compat.h` を `-include` で差し込み、両ヘッダのインクルードガードを
先取りして取り込みを防ぐ。同時に `VlThreadPool` / `VerilatedTraceBaseC` の
最小スタブを定義する。

### 問題 2: `pthread_getaffinity_np`（Linux 専用）

`verilated.cpp` 末尾でインクルードされる `verilatedos_c.h` が
`getProcessAvailableParallelism()` 内で `pthread_getaffinity_np` を呼び出す。
Emscripten の `<thread>` → `<pthread.h>` → `<sched.h>` 経由で `CPU_ZERO` が定義され、
Linux 向けのコードパスがコンパイルされてリンクエラーになる。

**対策**: `cxx/verilatedos_c.h` に Wasm 向けスタブを用意し、
コンパイル時に `-I$ROOT/cxx` を先頭に追加してシステム版より優先させる。

| 関数 | Wasm スタブの動作 |
| --- | --- |
| `getProcessAvailableParallelism()` | 1 を返す（シングルスレッド） |
| `getProcessDefaultParallelism()` | 1 を返す |
| `memUsageBytes()` | 0 を返す（`/proc/self/status` 不在） |
| `getcpu()` | 0 を返す |
| `DeltaCpuTime::gettime()` | `clock_gettime` を使用（Emscripten 提供） |
| `DeltaWallTime::gettime()` | `clock_gettime` を使用 |
| `getenvStr()` | `getenv()` を使用（Emscripten 提供） |

### 実際のコンパイル手順（`build-wasm.sh` 抜粋）

```bash
# 1. verilated.cpp をシステムからコピー（バージョンを Verilator に合わせる）
cp "$VERILATOR_ROOT/include/verilated.cpp" "$ROOT/cxx/verilated.cpp"

# 2. verilated.cpp のみ Wasm 互換フラグ付きで個別コンパイル
em++ $COMMON_FLAGS \
    -I"$ROOT/cxx" \           # cxx/verilatedos_c.h を優先
    -include "$ROOT/cxx/wasm_compat.h" \
    -c "$ROOT/cxx/verilated.cpp" \
    -o "$OBJ_DIR/verilated.wasm.o"

# 3. 生成済み V*.cpp + harness.cpp とリンク
em++ $COMMON_FLAGS \
    "$OBJ_DIR"/V*.cpp \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    -s EXPORTED_FUNCTIONS='[...]' \
    -o "$EXAMPLE/web/sim.js"
```

`cxx/verilated.cpp` はビルド生成物のため `.gitignore` に追加済み。
`cxx/wasm_compat.h` と `cxx/verilatedos_c.h` はリポジトリで管理する。

---

## ランタイム構成（ブラウザ）

```text
index.html
  ├─ new Worker('sim-worker.js')
  │     └─ sim.js (Emscripten グルー) をロード
  │           Module.onRuntimeInitialized
  │             └─ setInterval / requestAnimationFrame で step() 呼び出し
  │                  └─ Wasm 内 ring buffer に毎クロック書き込み
  │
  ├─ SharedArrayBuffer (or postMessage fallback)
  │     └─ ring buffer の TypedArray ビュー
  │
  └─ js/views/ コンポーネント群
        ├─ LogicAnalyzer     → <canvas> に波形描画（60Hz）
        ├─ StateDiagram      → 現在状態をハイライト
        ├─ RegisterPanel     → 数値ライブ表示
        └─ MemoryHeatmap     → アドレスアクセス頻度
```

---

## コンポーネント一覧

| 場所 | ファイル | 役割 |
| --- | --- | --- |
| `cxx/` | `rtlscope.h/cpp` | RTLScope クラス・ring buffer・`bind()` / `sample()` |
| `cxx/` | `emscripten_exports.cpp` | Wasm エクスポート関数（`step`, `reset`, `get_ring_ptr`） |
| `js/core/` | `ring-buffer.js` | Wasm 線形メモリの TypedArray ビュー管理 |
| `js/core/` | `worker-bridge.js` | Worker ライフサイクル・`start/pause/reset` メッセージ |
| `js/views/` | `logic-analyzer.js` | Canvas 波形ビュー |
| `js/views/` | `state-diagram.js` | 状態遷移ハイライト |
| `js/views/` | `register-panel.js` | レジスタパネル |
| `js/views/` | `memory-heatmap.js` | メモリヒートマップ |
| `examples/XX/cxx/` | `harness.cpp` | DUT 固有：信号バインド・コンソール I/O コールバック |
| `examples/XX/web/` | `sim-worker.js` | Worker：Wasm ロード・クロック駆動ループ |
| `examples/XX/web/` | `index.html` | UI レイアウト・ビュー初期化 |

---

## データフロー（信号の流れ）

```text
Wasm（Worker スレッド）
  └─ step() 毎クロック
       └─ RTLScope::sample() → ring buffer[head++] = {pc, state, bus...}

JS（メインスレッド、60Hz）
  └─ TypedArray ビューで ring buffer を直接読む（ゼロコピー）
       └─ 各ビューが Canvas に描画
```
