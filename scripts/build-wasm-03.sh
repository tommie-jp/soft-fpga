#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
source "$SCRIPT_DIR/_la-exports.inc.sh"   # LA_EXPORTS（Logic Analyzer 共通 API）
EXAMPLE="$ROOT/examples/03-uart"
OBJ_DIR="$ROOT/obj_dir_03"
source "$SCRIPT_DIR/_build-wasm-common.sh"
wasm_sync_verilated_cpp if-missing
wasm_require_emsdk

echo "=== Verilator ==="
verilator --cc \
    "$EXAMPLE/verilog/uart_top.v" \
    "$EXAMPLE/verilog/uart_tx.v" \
    "$EXAMPLE/verilog/uart_rx.v" \
    --top-module uart_top \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH -I$VERILATOR_ROOT/include -I$OBJ_DIR"

echo "=== Emscripten: verilated.cpp ==="
wasm_compile_verilated_cpp

echo "=== Emscripten: link ==="
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    "$OBJ_DIR"/V*.cpp \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    -s EXPORTED_FUNCTIONS="[\"_sim_init\",\"_step\",\"_reset_sim\",\"_send_byte\",\"_get_rx_data\",\"_get_rx_valid_count\",\"_get_rx_byte\",\"_get_ring_ptr\",\"_get_head\",\"_get_ring_size\",${LA_EXPORTS}]" \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server"
