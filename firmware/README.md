# firmware/

Raspberry Pi Pico 2 (RP2350) 上で動く Pico SDK ファームウェア。
計画の全体は [docs/07-Pico2実機デモ構想](../docs/07-Pico2実機デモ構想(2026-11-28自作CPU勉強会).md) §12。

## 役割

Verilator が出力した DUT を C++ ハーネスに組み込み、Pico 2 実機上で動かす。
現ターゲットは Apple‑1（6502 + wozmon + Integer BASIC）。

## 構成

| パス | 内容 |
| --- | --- |
| `CMakeLists.txt` | ターゲット定義。`APPLE1_DEBUG_UART` で UART0 コンソールの有無を切り替える |
| `apple1/hello.cpp` | Phase 0 の疎通確認（GP25 点滅 + エコー + `XI` 応答） |
| `apple1/main_pico.cpp` | core0: コンソール（USB‑CDC / UART0）と LED。`Ctrl‑]` `i` / `b` / `r` |
| `apple1/sim_core.cpp` | core1: `harness.cpp` の `step()` ループ。core0 とは queue で連携 |
| `apple1/led_panel.cpp` | バス信号を GPIO（LED）に出す。`sim_bus_observe()` の実体 |
| `common/panel_logic.h` | LED に出す GPIO ワードの決定（SYNC サンプル / 全サイクル / ポート、SDK 非依存） |
| `common/run_control.h` | 実速 / 低速 / 固定クロック / ステップの切り替え（SDK 非依存） |
| `common/input_filter.h` | 端末入力 → Apple‑1 のキー / 本体コマンド（SDK 非依存） |
| `common/display_filter.h` | Apple‑1 の表示出力 → 端末へ書くバイト列（SDK 非依存） |
| `common/diag.cpp` | `XI` 応答（ビルド情報） |
| `test/` | SDK 非依存部分のホスト単体テスト（`scripts/test-fw-unit.sh`） |
| `common/verilator-runtime/` | Verilator 5.048 のベアメタル向けランタイム（`<iostream>` 除去済み）と `stub_mutex.h` |
| `common/cxx_minimal.cpp` | 例外 / demangler を引かないための stub（到達すると BKPT） |

`common/` の Verilator ランタイムは `~/29-soft-FPGA-reversi` の実績あるものを持ち込んだ。
[cxx/verilated.cpp](../cxx/verilated.cpp) は WebAssembly 向けの別物で、ここでは使わない。

## ビルド・書き込み・テスト

```bash
scripts/build-pico.sh                  # Docker でビルド → firmware/build/*.uf2 / *.elf
scripts/wsl-attach.sh                  # Debug Probe を WSL2 に attach (usbipd)
scripts/flash.sh                       # Probe 経由で書き込み (既定: apple1_hello)
scripts/test-hil.sh                    # 実機に対する pytest (verif/hil)。ELF はモジュールごとに自動で書き込む
scripts/test-fw-unit.sh                # ホスト単体テスト (firmware/test)。実機不要
```

Probe を使わない場合は BOOTSEL を押しながら USB 接続し、`.uf2` をドラッグ＆ドロップする。

## コンソールのコマンド

`Ctrl‑]` に続く 1 文字。それ以外の入力は Apple‑1 のキーボードへ送られる。

| キー | 動作 |
| --- | --- |
| `g` / `w` / `c` / `n` | 実速 / 低速 4 Hz / 固定クロック 10 kHz / 次の命令（ステップ） |
| `y` / `a` / `o` | LED 表示: SYNC サンプル / 全サイクル / ポート（`$C000`） |
| `t` | LED 自己診断（約 2 秒） |
| `r` / `i` / `b` | リセット / ビルド情報 / 実効クロックの実測 |

詳細は [docs/07](../docs/07-Pico2実機デモ構想(2026-11-28自作CPU勉強会).md) §9.3。

## ビルド方針

- Pico SDK 標準（`pico_sdk_init()` → `add_executable()` → `target_link_libraries()`）。
- C++ フラグ: `-Os -fno-unwind-tables -DNDEBUG`、例外は無効。
- **RTTI は有効のままにする。** Verilator 出力が `dynamic_cast` を使うため。
- **LTO は使わない。** Pico SDK の `--wrap=printf` と衝突する。
- `<iostream>` `<string>` `<vector>` を引き込まないこと（flash・SRAM 節約）。
- `PICO_BOARD=pico2` は Docker イメージの ENV で固定している。
