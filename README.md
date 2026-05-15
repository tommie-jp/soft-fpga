# soft-FPGA × WebAssembly

Verilog で書いたレトロ CPU / デジタル回路を Verilator で C++ 化し、Emscripten で WebAssembly に変換して
ブラウザ上で動かすプロジェクト。速度より**内部信号のリアルタイム可視化**（T-state・マイクロシーケンサ・
バス波形など）が核心価値。

## 可視化ライブラリ rtlscope（構想中）

RTL 内部信号をブラウザで宣言的に観測するライブラリ。

| 層 | 役割 |
| --- | --- |
| Verilog 側 | `` `OBSERVE `` マクロで観測ポイント宣言 |
| C++ ハーネス層 | 毎クロック ring buffer にサンプリング |
| JS 描画層 | TypedArray ビュー経由でゼロコピー読取、60Hz 描画 |

## アーキテクチャ

```text
Verilog (RTL)
  └─ Verilator ──▶ C++ harness (ring buffer)
                     └─ Emscripten ──▶ .wasm
                                        └─ Web Worker
                                             ├─ xterm.js（コンソール I/O）
                                             └─ Canvas（Logic Analyzer / State Diagram / Memory Heatmap）
```

## ロードマップ

| フェーズ | 題材 | 目的 |
| --- | --- | --- |
| 基礎 1 | 二進カウンタ | ring buffer → TypedArray → Canvas の最小検証 |
| 基礎 2 | 信号機 FSM | State Diagram ビューお披露目 |
| 基礎 3 | UART 送受信機 | Logic Analyzer ビューの威力確認 |
| 基礎 4〜10 | LFSR / シーケンス検出器 / PWM / FIFO / SPI / I2C | 教材網羅 |
| CPU 第一弾 | 6502 / Apple-I | 対話体験（wozmon → Integer BASIC）、工数最小 |
| CPU 第二弾 | 4004 / Busicom | 命令エミュに作れない可視化の決定的証明 |
| CPU 第三弾 | 8080+CP/M または Z80 | Pico 2 側ロードマップと同期 |

## Directory layout

| Path | 役割 |
| --- | --- |
| [`verilog/`](verilog/) | Verilog ソース（CPU コア・デモ回路） |
| [`cxx/`](cxx/) | C++ ハーネス・Emscripten ビルド（libRTLScope） |
| [`js/`](js/) | JavaScript ビューレイヤ（Logic Analyzer / State Diagram 等） |
| [`examples/`](examples/) | 回路サンプル（各 example に verilog / cxx / web / verif） |
| [`verif/`](verif/) | ライブラリレベル検証（cocotb / ネイティブ） |
| [`firmware/`](firmware/) | Pico SDK ファームウェア（将来の Pico 2 ターゲット） |
| [`scripts/`](scripts/) | ビルド補助スクリプト |
| [`docker/`](docker/) | 開発環境（Verilator + Emscripten + cocotb） |
| [`docs/`](docs/) | 設計ドキュメント |

## Getting started

```bash
git clone https://github.com/tommie-jp/soft-fpga.git
cd soft-fpga
git submodule update --init
```

## Build (planned)

```bash
# ネイティブ Linux シミュレーション
scripts/build-host.sh

# WebAssembly ビルド（Emscripten）
scripts/build-wasm.sh    # → host/wasm/
```

## 関連資料

- [`docs/01-soft-FPGA-WebAssembly-設計議論メモ.md`](docs/01-soft-FPGA-WebAssembly-設計議論メモ.md) — 設計方針・ロードマップ・ライブラリ構想

## License

MIT
