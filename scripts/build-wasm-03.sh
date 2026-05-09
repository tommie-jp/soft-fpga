#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/03-uart"
OBJ_DIR="$ROOT/obj_dir"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

VERILATED_CPP="$ROOT/cxx/verilated.cpp"
if [ ! -f "$VERILATED_CPP" ]; then
    cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
fi
WASM_COMPAT="$ROOT/cxx/wasm_compat.h"

# emsdk が未設定なら自動でソース
if ! command -v em++ &>/dev/null; then
    EMSDK_ENV=""
    for candidate in \
        "$HOME/emsdk/emsdk_env.sh" \
        "$HOME/emsdk/emsdk/emsdk_env.sh"; do
        [ -f "$candidate" ] && EMSDK_ENV="$candidate" && break
    done
    if [ -n "$EMSDK_ENV" ]; then
        # shellcheck disable=SC1090
        source "$EMSDK_ENV" 2>/dev/null
    else
        echo "ERROR: em++ not found. Install emsdk and source emsdk_env.sh" >&2
        exit 1
    fi
fi

echo "=== Verilator ==="
verilator --cc \
    "$EXAMPLE/verilog/uart_top.v" \
    "$EXAMPLE/verilog/uart_tx.v" \
    "$EXAMPLE/verilog/uart_rx.v" \
    --top-module uart_top \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH -I$VERILATOR_ROOT/include -I$OBJ_DIR"

echo "=== Emscripten: verilated.cpp ==="
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    -I"$ROOT/cxx" \
    -include "$WASM_COMPAT" \
    -c "$VERILATED_CPP" \
    -o "$OBJ_DIR/verilated.wasm.o"

echo "=== Emscripten: link ==="
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    "$OBJ_DIR"/V*.cpp \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_step","_reset_sim","_send_byte","_get_rx_data","_get_rx_valid_count","_get_ring_ptr","_get_head","_get_ring_size"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server"
