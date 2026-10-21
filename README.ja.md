# soft-FPGA × WebAssembly

[English](README.md) | [日本語](README.ja.md)

[![CI](https://github.com/tommie-jp/soft-fpga/actions/workflows/ci.yml/badge.svg)](https://github.com/tommie-jp/soft-fpga/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Verilog で書いたレトロ CPU とデジタル回路を Verilator で C++ に変換し、Emscripten で WebAssembly にしてブラウザで動かすプロジェクトです。
狙いは速度ではなく、**内部信号をリアルタイムに見ること**にあります。T-state・マイクロシーケンサ・バス波形は命令エミュレータには存在しない信号で、回路そのものを動かすからこそ観測できます。

![soft-FPGA — RTL 波形のリアルタイム可視化（01-counter）](docs/img/ss/01-counter-demo.gif)

*Verilog の二進カウンタをブラウザで実行した波形。レジスタ 8 ビットを毎クロック記録し、60 Hz で描いている（画面は 2026-10-21 時点、Logic Analyzer v1.3.0）。[ライブで試す ▶](https://tommie-jp.github.io/soft-fpga/01-counter/)*

## ライブデモ

**[https://tommie-jp.github.io/soft-fpga/](https://tommie-jp.github.io/soft-fpga/)**

| 例 | 題材 | 見どころ |
| --- | --- | --- |
| [01-counter](https://tommie-jp.github.io/soft-fpga/01-counter/) | 二進カウンタ | ring buffer → TypedArray → Canvas の最小構成 |
| [02-traffic-fsm](https://tommie-jp.github.io/soft-fpga/02-traffic-fsm/) | 信号機 FSM | State Diagram が現在状態をハイライト |
| [03-uart](https://tommie-jp.github.io/soft-fpga/03-uart/) | UART 送受信機（loopback） | スタート/データ/ストップビットと TX・RX の状態機械 |
| [04-6502](https://tommie-jp.github.io/soft-fpga/04-6502/) | Apple-I / 6502 | wozmon → Integer BASIC の対話、マイクロシーケンサ状態 |
| [05-dormann](https://tommie-jp.github.io/soft-fpga/05-dormann/) | 6502 Dormann 命令テスト | Klaus Dormann の機能テストを RTL 上で完走 |
| [06-8080](https://tommie-jp.github.io/soft-fpga/06-8080/) | Intel 8080 / CP/M 2.2 | MBASIC・BDS C・Turbo Pascal 3、I/O バスアナライザ |
| [09-pdp11](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web/) | PDP-11 / Unix V6 | Unix V6 ブート、MMU パネル、逆アセンブル、63 命令のタイミング図 |
| [91-pong](https://tommie-jp.github.io/soft-fpga/91-pong/) | Pong（CPU なし） | カウンタと比較器だけのゲーム。1 クロック 1 画素、音つき、スマホ対応 |

## 題材を選ぶ基準

- **歴史的価値があるアーキテクチャ** — 当時の産業や文化を変えた CPU・回路であること
- **実績のある Verilog ソースが公開されている** — デキャップ起こしや MiSTer 実装など、検証済みの RTL が手に入ること
- **私（tommie.jp）が楽しめる** — 作っていて面白く、動かして感動があること

## 可視化ライブラリ rtlscope

RTL の内部信号をブラウザで宣言的に観測するためのライブラリです。C++ ハーネスが毎クロック ring buffer に書き、JS が TypedArray ビュー越しにゼロコピーで読んで 60 Hz で描きます。

| 層 | 役割 |
| --- | --- |
| C++ ハーネス（[`cxx/`](cxx/)） | 毎クロック ring buffer にサンプリング |
| JS 描画（[`js/`](js/)） | TypedArray ビュー経由のゼロコピー読取、60 Hz 描画 |

JS 側の中心は全例共用の Logic Analyzer [`js/rtlscope-la.js`](js/rtlscope-la.js)（v1.3.0）です。式トリガーとそのプリセット、Hold / Resume、信号名のツールチップ（日本語・英語のフルネーム）を備えます。仕様は [docs/91](docs/91-rtlscope-la-LogicAnalyzerライブラリ.md) にあります。

## アーキテクチャ

![soft-FPGA アーキテクチャ](docs/img/00-softfpga-arch.png)

## ギャラリー

| 01-counter | 02-traffic-fsm | 04-6502 Woz Monitor | 04-6502 Integer BASIC |
| --- | --- | --- | --- |
| [![二進カウンタ — Logic Analyzer](docs/img/ss/01-counter.png)](docs/img/ss/01-counter.png) | [![信号機 FSM — State Diagram](docs/img/ss/02-traffic-fsm.png)](docs/img/ss/02-traffic-fsm.png) | [![Apple-I — Woz Monitor + CPU レジスタ](docs/img/ss/04-6502-wozmon.png)](docs/img/ss/04-6502-wozmon.png) | [![Apple-I — Integer BASIC](docs/img/ss/04-6502-basic.png)](docs/img/ss/04-6502-basic.png) |
| 8 ビットカウンタの波形を Logic Analyzer で観測 | 現在の FSM 状態をリアルタイムにハイライト | 6502 のレジスタとバス信号をリアルタイム表示 | シミュレーション上の 6502 で Integer BASIC を実行 |

### 動作キャプチャ（アニメーション）

**02 — 信号機 FSM** — 歩行者ボタン付きの 3 相信号機。State Diagram が現在状態（`GREEN`→`YELLOW`→`RED`→`WALK`）をハイライトし、同じ遷移を出力信号の波形でも追えます。[開く ▶](https://tommie-jp.github.io/soft-fpga/02-traffic-fsm/)

![信号機 FSM — State Diagram + ロジックアナライザ](docs/img/ss/traffic-fsm-demo.gif)

**03 — UART（loopback）** — `soft-FPGA` の文字列をシリアル送信。`txd`/`rxd` のスタート/データ/ストップビット、TX・RX の状態機械、データバス上のバイトをすべてライブに記録します。[開く ▶](https://tommie-jp.github.io/soft-fpga/03-uart/)

![UART loopback — ロジックアナライザ表示](docs/img/ss/uart-demo.gif)

**04 — Apple-I / 6502** — 6502 の RTL コア上で Integer BASIC を実行。`A=1`・`B=20` を代入し、`A+B = 21` を計算して終了します。CPU レジスタ、**マイクロシーケンサ状態**（`JSR2`・`BRA0` など）、アドレス/データ/we/sync のバスが毎クロック更新されます。命令エミュレータには存在しない信号です。[開く ▶](https://tommie-jp.github.io/soft-fpga/04-6502/)

![Apple-I / 6502 — レジスタ・マイクロシーケンサ状態・バスアナライザ](docs/img/ss/6502-demo.gif)

**06 — Intel 8080 / CP/M 2.2** — デキャップ起こしの vm80a RTL 上で CP/M 2.2 を起動し、BDS C でコンパイルから実行まで通します。`DIR` → `B:` → `TYPE HELLO.C` → `CC HELLO` → `CLINK HELLO` → `HELLO`。処理中も CPU レジスタと **I/O バスアナライザ**が更新され続けます。[開く ▶](https://tommie-jp.github.io/soft-fpga/06-8080/)

![Intel 8080 / CP/M 2.2 — BDS C: DIR → CC HELLO → CLINK HELLO → Hello, CP/M!](docs/img/ss/8080-cpm-demo.gif)

**09 — PDP-11 / Unix V6** — Brad Parker の `cpus-pdp11` RTL で Unix V6 をブートし、Thompson シェルから `ed`・`cc`・`db` を使えます。MMU の PAR/PDR、R0〜R5/SP、逆アセンブル、バスサイクルを Logic Analyzer で観測でき、全 63 命令のタイミング図を添えました。[開く ▶](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web/)

![PDP-11 / Unix V6 — ログイン・ls -l、レジスタ・MMU・ロジックアナライザ](docs/img/ss/09-pdp11.png)

**91 — Pong（CPU なし）** — 1972 年の Pong にならい、カウンタと比較器だけで 160 × 120 画素を 1 クロック 1 画素で描きます。球・ラケット・点・当たりの信号を Logic Analyzer で見ながら遊べます。音は垂直カウンタの 1 ビットをそのままスピーカーに通しています。回路の作り方は教科書 [12-3「Pong — ゲートだけで動くゲーム」](https://github.com/tommie-jp/tommie-circuit-workbook/blob/main/06-fpga/12-projects/03-pong.md) にあります。[開く ▶](https://tommie-jp.github.io/soft-fpga/91-pong/)

![Pong — ゲーム画面と、球・ラケット・点・当たりの波形](docs/img/ss/91-pong.png)

## 実機（Pico 2）

ブラウザだけでなく、Raspberry Pi Pico 2（RP2350）でも同じ RTL を動かします。

- [`firmware/`](firmware/) — Verilator が出した Apple-I（6502 + wozmon + Integer BASIC）を Pico 2 で動かすファームウェア。core1 でシミュレーション、core0 でコンソールと LED パネルを担当し、バス信号を GPIO に出します。ホスト単体テストと実機 HIL テスト（[`verif/hil`](verif/hil)）つき。
- [`examples/07-pico2-web-serial`](examples/07-pico2-web-serial/) — Pico 2 の ADC を Web Serial でブラウザに取り込むオシロスコープ。
- 2026-11-28 の自作 CPU 勉強会で対面デモを行います。構成は [docs/07](docs/07-Pico2実機デモ構想%282026-11-28自作CPU勉強会%29.md)、発表案は [docs/08](docs/08-発表構成案%282026-11-28自作CPU勉強会%29.md)、配布パンフレットは [docs/08-pamphlet](docs/08-pamphlet/) にあります。

## 設計の難所

「RTL をブラウザで動かすだけ」に見えて、裏にはいくつか自明でない問題があります。詳細は [docs/01-soft-FPGA-WebAssembly-設計議論メモ.md](docs/01-soft-FPGA-WebAssembly-設計議論メモ.md) に書きました。

- **毎サイクル Wasm↔JS の境界をまたがない。** 毎サイクルの `EM_ASM`/`EM_JS` コールバックは呼び出しのオーバーヘッドで破綻します。rtlscope は各サンプルを Wasm メモリ上の ring buffer に書き、JS は `HEAP8.buffer` 上の `TypedArray` ビュー越しにゼロコピーで読んで、`requestAnimationFrame` で 60 Hz 描画します。
- **`ALLOW_MEMORY_GROWTH=1` がそのビューを静かに無効化する。** Wasm のヒープが伸びると古い `ArrayBuffer` が detach され、実行中に表示が消えます。そこで JS は読み口を持ち続けず、描くたびに `Module.HEAPU32` を取り直してから読みます。Worker で回す例では、Worker の中で ring buffer を `slice()` で写してから送ります。
- **Verilator の階層信号名は安定しない。** `top->cpu__DOT__regs__DOT__pc` のような名前は Verilator のバージョンで変わり、`--public-flat-rw` は脆いです。観測したい信号はトップ直下の薄い Verilog ラッパーで引き出し、C++ ハーネスで bind します。JS 側は内部の命名に依存しません。
- **VCD ダンプは Wasm では成立しない。** Wasm 内の仮想ファイルシステムが即座に詰まるため、トレースはすべてカスタムの ring buffer に振ります。
- **シミュレーションは Web Worker で動かす。** メインスレッドで回すと UI が固まります。02・03・04・06・09 は Worker 化済みで、Worker 側の共通部品は [`js/sft-la-worker-core.js`](js/sft-la-worker-core.js) に切り出しました（01・05 はまだメインスレッド）。高速版は `SharedArrayBuffer` + Atomics が要り、COOP/COEP ヘッダを伴います。
- **核心の主張を正確に言うと、** 命令エミュレータには T-state・マイクロシーケンサ・組合せ伝播の信号が**存在しません**。隠れているのではなく、無いのです。soft-FPGA は回路を動かしているので、それらの信号が実在し、観測できます（上の 6502 のキャプチャ参照）。

## ロードマップ

| フェーズ | 題材 | 目的 | 状態 |
| --- | --- | --- | --- |
| 基礎 1 | 二進カウンタ | ring buffer → TypedArray → Canvas の最小検証 | ✅ 完了 |
| 基礎 2 | 信号機 FSM | State Diagram ビューのお披露目 | ✅ 完了 |
| 基礎 3 | UART 送受信機 | Logic Analyzer ビューの威力確認 | ✅ 完了 |
| CPU 第一弾 | 6502 / Apple-I | 対話体験（wozmon → Integer BASIC）、Dormann 命令テスト | ✅ 完了 |
| CPU 第二弾 | 8080 / CP/M 2.2 | vm80a RTL + CP/M 2.2 + BDS C コンパイラ | ✅ 完了 |
| CPU 第三弾 | PDP-11 / Unix V6 | `cpus-pdp11` RTL で Unix V6 ブート、MMU と全命令タイミング図 | ✅ 完了 |
| ゲーム | Pong | ディスクリート論理回路の可視化ショーケース（教科書 12-3 と連動） | ✅ 完了 |
| 実機 | Pico 2 で Apple-I | 同じ RTL を実機で動かし、バス信号を LED に出す | 🔧 進行中（11/28 勉強会向け） |
| ゲーム | Breakout | Pong の足回りを流用 | 🔲 予定 |
| 基礎 4〜10 | LFSR / シーケンス検出器 / PWM / FIFO / SPI / I2C | 教材網羅 | 🔲 予定 |
| CPU 第四弾 | Z80 | CP/M 資産を流用（[docs/07-z80](docs/07-z80/)） | 🔲 予定 |
| CPU 第五弾 | MC6809 | [docs/08-mc6809](docs/08-mc6809/) で調査中 | 🔲 予定 |
| CPU 第六弾 | 4004 / Busicom | 命令エミュレータには作れない可視化の決定的な証明 | 🔲 予定 |

## Getting started

```bash
git clone https://github.com/tommie-jp/soft-fpga.git
cd soft-fpga
git submodule update --init
```

サブモジュールは 6502（hoglet の `verilog-6502`）・8080（`vm80a`）・PDP-11（`cpus-pdp11`）の RTL です。

## ビルド

```bash
# Docker 開発環境を起動
docker compose -f docker/compose.yml run --rm dev

# ネイティブ Linux シミュレーション
scripts/build-host.sh
scripts/build-host-09.sh    # PDP-11

# WebAssembly ビルド（例ごと）
scripts/build-wasm.sh       # → examples/01-counter/web/
scripts/build-wasm-06.sh    # → examples/06-8080/web/sim.js, sim.wasm
scripts/build-wasm-09.sh    # → examples/09-pdp11/web/
scripts/build-wasm-91.sh    # → examples/91-pong/web/

# ローカルブラウザ確認（ソース更新時に自動リビルド + HTTP サーバ起動）
cd examples/06-8080/web && ./doStart.sh
# ブラウザで http://localhost:8000/ を開く

# GitHub Pages へのデプロイ（全例、または番号指定）
scripts/doDeployPages.sh
scripts/doDeployPages.sh 09

# Pico 2 ファームウェア
scripts/build-pico.sh       # Docker でビルド → firmware/build/*.uf2
scripts/flash.sh            # Debug Probe 経由で書き込み
```

手順の詳細は [docs/04](docs/04-docker-ビルド手順.md)（Docker）と [docs/05](docs/05-deploy-gh-pages.md)（Pages）にあります。

## テスト

```bash
scripts/test-unit.sh        # verif/tb_unit のユニットテスト（Docker 内）
scripts/test-cocotb.sh      # cocotb + pytest
scripts/test-pdp11-v6.sh    # PDP-11: Unix V6 ブート
scripts/test-fw-unit.sh     # Pico 2 ファームウェアのホスト単体テスト
scripts/test-hil.sh         # Pico 2 実機の HIL テスト
```

## ディレクトリ構成

| Path | 役割 |
| --- | --- |
| [`examples/`](examples/) | 回路サンプル（各例に verilog / cxx / web） |
| [`web/`](web/) | GitHub Pages のルート目次ページ |
| [`cxx/`](cxx/) | C++ ハーネス共通ヘッダ（libRTLScope） |
| [`js/`](js/) | 全例共用の JS（Logic Analyzer、トリガー、Worker 共通部品、xterm 周り） |
| [`firmware/`](firmware/) | Pico 2（RP2350）ファームウェア |
| [`verif/`](verif/) | 検証コード（cocotb / ネイティブ / Dormann / HIL） |
| [`vendor/`](vendor/) | 外部 RTL のサブモジュール（`cpus-pdp11`） |
| [`scripts/`](scripts/) | ビルド・デプロイ・テストの補助スクリプト |
| [`docker/`](docker/) | 開発環境（Ubuntu 24.04 + Verilator + Emscripten + cocotb） |
| [`docs/`](docs/) | 設計ドキュメント（目次は [docs/00-目次.md](docs/00-目次.md)） |

## 関連資料

- [`docs/01-soft-FPGA-WebAssembly-設計議論メモ.md`](docs/01-soft-FPGA-WebAssembly-設計議論メモ.md) — 設計方針・ロードマップ・ライブラリ構想
- [`docs/91-rtlscope-la-LogicAnalyzerライブラリ.md`](docs/91-rtlscope-la-LogicAnalyzerライブラリ.md) — Logic Analyzer ライブラリの仕様
- [tommie-circuit-workbook](https://github.com/tommie-jp/tommie-circuit-workbook) — 教科書。動くページ（01・02・03・04・06・91）には教科書の中の位置を示す共通ヘッダーを付け、教科書の章から開けるようにしてあります

## License

MIT
