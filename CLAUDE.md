# CLAUDE.md

- `.env` や機微ファイルは読まない、出力しない。
- `~/` への直接アクセスは禁止（プロジェクト配下のみ参照・編集する）。

## Project Overview

soft-FPGA × WebAssembly — Verilog で書いたレトロ CPU / デジタル回路を Verilator で C++ 化し、
Emscripten で WebAssembly に変換してブラウザ上で動かすプロジェクト。
核心価値は**速度ではなく可視化**。命令エミュレータには存在しない内部信号（T-state・マイクロシーケンサ・
組合せ伝播・バスサイクル）をブラウザ上でリアルタイム観測できることが固有の優位性。

設計方針の詳細は [`doc/01-soft-FPGA-WebAssembly-設計議論メモ.md`](doc/01-soft-FPGA-WebAssembly-設計議論メモ.md)。

## Build & Dev Commands (planned)

```bash
# ネイティブ Linux シミュレーション
scripts/build-host.sh

# WebAssembly ビルド（Emscripten）
scripts/build-wasm.sh    # → host/wasm/
```

開発環境は [`docker/`](docker/) の Dockerfile で固定（Verilator + Emscripten + cocotb）。

## Architecture

```text
Verilog (RTL)
  └─ Verilator ──▶ C++ harness (ring buffer)
                     └─ Emscripten ──▶ .wasm
                                        └─ Web Worker
                                             ├─ xterm.js（コンソール I/O）
                                             └─ Canvas（Logic Analyzer / State Diagram / Memory Heatmap）
```

| 層 | 担当 |
| --- | --- |
| Verilog RTL ([`verilog/`](verilog/)) | CPU コア・デジタル回路（Verilator 互換） |
| C++ ハーネス ([`cxx/`](cxx/)) | `eval()` 制御・ring buffer サンプリング・I/O コールバック |
| Emscripten グルー ([`cxx/`](cxx/)) | Wasm エクスポート・TypedArray ブリッジ |
| JS 層 | Web Worker + xterm.js + Canvas 描画 |

## Directory Layout

| Path | 役割 |
| --- | --- |
| [`verilog/`](verilog/) | Verilog ソース |
| [`cxx/`](cxx/) | C++ ハーネス・Emscripten ビルド（libRTLScope） |
| [`js/`](js/) | JavaScript ビューレイヤ |
| [`examples/`](examples/) | 回路サンプル（01-counter / 02-fsm / 03-uart / …） |
| [`verif/`](verif/) | ライブラリレベル検証（cocotb / ネイティブ） |
| [`firmware/`](firmware/) | Pico SDK ファームウェア（将来の Pico 2 ターゲット） |
| [`scripts/`](scripts/) | ビルド補助スクリプト |
| [`docker/`](docker/) | 開発環境 |
| `doc/` | 設計ドキュメント |

## ロードマップ（現在地）

1. **二進カウンタ** — ring buffer → TypedArray → Canvas の最小構成を通す ← 今ここ
2. 信号機 FSM — State Diagram ビュー
3. UART 送受信機 — Logic Analyzer ビュー
4. LFSR / シーケンス検出器 / PWM / FIFO / SPI / I2C（基礎 4〜10）
5. **6502 / Apple-I** — 対話体験（wozmon → Integer BASIC）、CPU 第一弾
6. 4004 / Busicom — 可視化ショーケース
7. 8080+CP/M または Z80 — Pico 2 ロードマップと同期

## Key Conventions

- **応答は日本語** — Claude の応答・説明・コミットメッセージは日本語で書く。
- **自動コミットしない** — コミットはユーザーが明示的に指示した場合のみ。
- **エラーハンドリング** — `catch` や戻り値チェックでエラーを握りつぶさない。必ずログ出力する。
- **VCD ダンプは無効化** — Wasm 内の仮想ファイルシステムが即詰まるため、カスタム ring buffer に振る。
- **ring buffer パターン** — Wasm↔JS の信号転送は毎クロック `EM_JS`/`EM_ASM` コールバックを使わず、
  Wasm 線形メモリ上の ring buffer に書き、JS 側は TypedArray ビューでゼロコピー読取りする。
- **Web Worker 前提** — Wasm シミュレーション本体はメインスレッド上で動かさない。
  SharedArrayBuffer が使えない環境では `postMessage` + コピー方式にフォールバック。
- **Verilator 階層名のラップ** — `--public-flat-rw` は使わず、観測したい信号はトップレベルで
  `/* verilator public */` または Verilog ラッパモジュールに引き出す。
- **Markdown の文法チェック** — `*.md` 編集後は `npx markdownlint-cli <file>` で lint を通す。
- **PlantUML** — `*.puml` を編集したら `plantuml -checkonly <file>` で構文チェックしてから PNG 化する。
- **lint / 型チェック / sed の実行** — 許可不要。

## Documentation

- [`doc/01-soft-FPGA-WebAssembly-設計議論メモ.md`](doc/01-soft-FPGA-WebAssembly-設計議論メモ.md) — 設計方針・ロードマップ・ライブラリ構想
