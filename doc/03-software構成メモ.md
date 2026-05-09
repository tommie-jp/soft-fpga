# software 構成メモ

verilog ソース → Verilator → C++ → Emscripten → WebAssembly バイナリ、
および WebAssembly をブラウザで動かす web アプリの構成。

---

## ビルドパイプライン

```text
examples/01-counter/verilog/counter.v
  │
  ▼ verilator --cc --exe
  │
obj_dir/Vcounter.cpp + verilated.cpp
  │
  + cxx/rtlscope.cpp          ← 共有ライブラリ（ring buffer, RTLScope クラス）
  + examples/01-counter/cxx/harness.cpp  ← 観測信号バインド・I/O コールバック
  │
  ▼ em++ -O3 -s EXPORTED_FUNCTIONS=[step,reset,get_ring_ptr,...]
  │
examples/01-counter/web/sim.wasm + sim.js  ← Emscripten グルー
```

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
