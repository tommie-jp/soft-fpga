#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/../../.."
EXAMPLE="$SCRIPT_DIR/.."
WASM="$SCRIPT_DIR/sim.wasm"

# 再ビルドが必要なソース群
SOURCES=(
    "$EXAMPLE/cxx/harness.cpp"
    "$EXAMPLE/sw/cpm/disks/cpm22.dsk"
    "$EXAMPLE/sw/cpm/disks/bdsc.dsk"
    "$EXAMPLE/sw/cpm/bios/bios.bin"
    "$EXAMPLE/rom/cpm22.bin"
    "$EXAMPLE/verilog/cpm_top.v"
    "$ROOT/scripts/build-wasm-06.sh"
)

need_build=0
if [ ! -f "$WASM" ]; then
    need_build=1
else
    for src in "${SOURCES[@]}"; do
        if [ -f "$src" ] && [ "$src" -nt "$WASM" ]; then
            echo "更新検出: $(basename "$src")"
            need_build=1
            break
        fi
    done
fi

if [ "$need_build" -eq 1 ]; then
    bash "$ROOT/scripts/build-wasm-06.sh"
else
    echo "ビルド済み (sim.wasm は最新)"
fi

cd "$SCRIPT_DIR"
python3 serve.py
