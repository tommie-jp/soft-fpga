# 70. 8080 CP/M → Pico 2 (RP2350) 実装計画

8080 + CP/M シミュレータを Raspberry Pi Pico 2 (RP2350) 実機へ移植する計画メモ。
現状は WebAssembly / Linux native ビルドのみで、Pico 実機ターゲットは未着手。

---

## 1. 既存の足場（再利用できるもの）

| 資産 | 再利用ポイント |
| --- | --- |
| [`cxx/harness.cpp`](../../examples/06-8080/cxx/harness.cpp)（1277 行） | Verilated vm80a + 64KB RAM + ディスクモデル + ポート I/O + `sim_init()/step()`。コア部はそのまま流用可 |
| [`cxx/main_linux.cpp`](../../examples/06-8080/cxx/main_linux.cpp)（838 行） | termios / stdin / stdout 依存。ここを `main_pico.cpp` に差し替える |
| [`examples/07-pico2-web-serial`](../../examples/07-pico2-web-serial) | Pico SDK ビルド・USB-CDC stdio・COBS・Web Serial フロント。コンソール経路の雛形 |
| [`firmware/README.md`](../../firmware/README.md) | ビルド方針確定済（`-Os -fno-exceptions -fno-rtti`、`<iostream>/<string>/<vector>` 禁止） |
| [`docs/03-ビルドターゲット設計メモ.md`](../03-ビルドターゲット設計メモ.md) | `Dockerfile.pico` 案（Verilator + arm-gcc + Pico SDK + OpenOCD） |

**設計上の利点**: コア（`harness.cpp`）とフロントエンド（`main_linux.cpp`）が分離済み。
Pico 移植はフロントエンドの差し替えが中心で、コアロジックは流用できる。

---

## 2. メモリ収支（RP2350 = SRAM 520KB / Flash 4MB）

| 項目 | サイズ | 配置 |
| --- | --- | --- |
| CP/M RAM（`cpm_top.ram[0x10000]`） | 64 KB | SRAM ✓ |
| Verilated vm80a 状態（単一 ~700 行コア） | 数十 KB | SRAM ✓ |
| **ディスク `disk_image[4][256256]`** | **約 1 MB** | **SRAM 不可 → Flash 必須** |
| LA リングバッファ（4096 × 7 × 4） | 112 KB | Pico では削減 or 廃止 |

- ディスクパラメータ: IBM 3740 SSSD = 77 トラック × 26 セクタ × 128 バイト = 256,256 バイト/ドライブ × 4 ドライブ（[`cpm_const.h`](../../examples/06-8080/cxx/cpm_const.h)）。
- 現状は 4 ドライブ全部を SRAM 常駐。Pico には載らないため**ディスク戦略が最大の設計課題**。

---

## 3. 要・設計判断

### 3.1 ディスク戦略

| 案 | 内容 | 評価 |
| --- | --- | --- |
| 案1（推奨） | `.dsk` を Flash(XIP) に焼き、読み取りはゼロコピー。書き込みは RAM のダーティセクタキャッシュに溜め、必要時に `flash_range_program` で書戻し | 複数ドライブ可。書込み寿命の管理が要る |
| 案2（最小） | A: 1 ドライブのみ SRAM 常駐（250KB）。残り ~200KB でギリギリ | 書込み即時だが容量制約大 |
| 案3（v1 簡易） | Flash 読み取り専用（SAVE/PIP 不可）。まず CP/M ブート + CCP を通すだけ | 実装最小、まず動かす段階向け |

### 3.2 Logic Analyzer 戦略

| 案 | 内容 | 評価 |
| --- | --- | --- |
| 案1（推奨） | Pico はコアだけ動かし、信号を COBS over USB-CDC でストリーム。ブラウザ側で `RTLScopeLA` が描画 | 07 の Web Serial パイプライン + [`docs/91`](../91-rtlscope-la-LogicAnalyzerライブラリ.md) をそのまま接続。「実機 vs ブラウザ」対比デモになる |
| 案2 | Pico ファームはコンソール専用、LA 省略 | 最小構成 |

---

## 4. 実装フェーズ

| Phase | 内容 | 完了条件 |
| --- | --- | --- |
| 0 | `Dockerfile.pico` 整備（arm-gcc + Pico SDK + Verilator） | `verilator --cc` → arm クロスビルド成功 |
| 1 | ROM / CP/M を配列化（`fopen` 廃止、`xxd` / objcopy で `.h` 化し Flash 配置） | `sim_init` のファイル依存除去 |
| 2 | `main_pico.cpp` 作成（USB-CDC ↔ CP/M コンソールポート橋渡し、07 の `stdio_usb` 流用） | 実機で CCP `A>` プロンプト表示 |
| 3 | ディスク Flash 配置（案1: 読取り XIP + ダーティキャッシュ） | `DIR`・ファイル読取り・SAVE が動く |
| 4 | 速度チューニング（`-O2` / `-Os` 試行、eval 回数削減） | 対話レスポンス実用域 |
| 5 | LA ストリーミング（COBS、3.2 案1） | ブラウザ `RTLScopeLA` に波形表示 |

---

## 5. リスク

- **性能**: Cortex-M33 @150MHz で Verilated 8080。実効数十〜数百 kHz 見込み。CCP 対話は快適だが、BDS C コンパイル等の重処理は遅い。
- **Flash 書込み寿命**: ディスク書戻しを `flash_range_program` で行う場合、頻度管理（バッチ flush）が要る。
- **host-file PIP 機能**: `harness.cpp` のポート経由 `fopen`（ホストファイル読み書き）は Linux 専用 → Pico では無効化する。
- **Verilator ランタイム**: ベアメタル非想定。例外 / RTTI を切る（firmware 方針どおり `-fno-exceptions -fno-rtti`）。
