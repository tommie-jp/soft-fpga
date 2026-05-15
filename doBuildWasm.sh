#!/bin/bash
# 全 example の WebAssembly ビルド（GitHub Pages / ローカル確認用）
# 前提: Verilator・emsdk がインストール済み
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== build-wasm: 01-counter ==="
"$SCRIPT_DIR/scripts/build-wasm.sh"

echo "=== build-wasm: 02-traffic-fsm ==="
"$SCRIPT_DIR/scripts/build-wasm-02.sh"

echo "=== build-wasm: 03-uart ==="
"$SCRIPT_DIR/scripts/build-wasm-03.sh"

echo "=== build-wasm: 04-6502 Apple-I ==="
"$SCRIPT_DIR/scripts/build-wasm-04.sh"

echo ""
echo "All WASM builds done."
