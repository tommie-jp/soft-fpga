# firmware/

Raspberry Pi Pico 2 (RP2350) 上で動く Pico SDK ファームウェア（将来ターゲット）。

## 役割

Verilator が出力した DUT を C++ ラッパに組み込み、Pico 2 実機上で動かす。
現フェーズ（WebAssembly ビルド）では使用しない。

## ビルド方針

- Pico SDK 標準（`pico_sdk_init()` → `add_executable()` → `target_link_libraries()`）。
- C++ フラグ: `-Os -fno-exceptions -fno-rtti -fno-unwind-tables -DNDEBUG`。
- `<iostream>` `<string>` `<vector>` を引き込まないこと（flash・SRAM 節約）。
