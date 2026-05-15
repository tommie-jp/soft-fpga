# soft-FPGA × WebAssembly

Verilog で書いたレトロ CPU / デジタル回路を Verilator で C++ 化し、Emscripten で WebAssembly に変換して
ブラウザ上で動かすプロジェクト。速度より**内部信号のリアルタイム可視化**（T-state・マイクロシーケンサ・
バス波形など）が核心価値。

## 可視化ライブラリ rtlscope

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

| フェーズ | 題材 | 目的 | 状態 |
| --- | --- | --- | --- |
| 基礎 1 | 二進カウンタ | ring buffer → TypedArray → Canvas の最小検証 | ✅ 完了 |
| 基礎 2 | 信号機 FSM | State Diagram ビューお披露目 | ✅ 完了 |
| 基礎 3 | UART 送受信機 | Logic Analyzer ビューの威力確認 | ✅ 完了 |
| CPU 第一弾 | 6502 / Apple-I | 対話体験（wozmon → Integer BASIC） | ✅ 完了 |
| 基礎 4〜10 | LFSR / シーケンス検出器 / PWM / FIFO / SPI / I2C | 教材網羅 | 🔲 予定 |
| ゲーム | Pong / Breakout | ディスクリート論理回路の可視化ショーケース | 🔲 予定 |
| CPU 第二弾 | 4004 / Busicom | 命令エミュに作れない可視化の決定的証明 | 🔲 予定 |
| CPU 第三弾 | 8080+CP/M または Z80 | Pico 2 側ロードマップと同期 | 🔲 予定 |

## Getting started

```bash
git clone https://github.com/tommie-jp/soft-fpga.git
cd soft-fpga
git submodule update --init
```

## Build

```bash
# Docker 開発環境を起動
docker compose -f docker/compose.yml run --rm dev

# ネイティブ Linux シミュレーション
scripts/build-host.sh

# WebAssembly ビルド（例：04-6502）
scripts/build-wasm-04.sh    # → examples/04-6502/web/sim.js, sim.wasm
```

## Directory layout

| Path | 役割 |
| --- | --- |
| [`examples/`](examples/) | 回路サンプル（各 example に verilog / cxx / web / verif） |
| [`cxx/`](cxx/) | C++ ハーネス共通ヘッダ（libRTLScope） |
| [`verif/`](verif/) | ライブラリレベル検証（cocotb / Dormann / wozmon） |
| [`scripts/`](scripts/) | ビルド・テスト・フラッシュ補助スクリプト |
| [`docker/`](docker/) | 開発環境（Ubuntu 24.04 + Verilator + Emscripten + cocotb） |
| [`firmware/`](firmware/) | Pico SDK ファームウェア（将来の Pico 2 ターゲット） |
| [`docs/`](docs/) | 設計ドキュメント |

## 関連資料

- [`docs/01-soft-FPGA-WebAssembly-設計議論メモ.md`](docs/01-soft-FPGA-WebAssembly-設計議論メモ.md) — 設計方針・ロードマップ・ライブラリ構想

## License

MIT
