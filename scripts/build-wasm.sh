#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/01-counter"
OBJ_DIR="$ROOT/obj_dir_01"
source "$SCRIPT_DIR/_build-wasm-common.sh"
wasm_sync_verilated_cpp if-missing
wasm_require_emsdk

echo "=== Verilator ==="
verilator --cc "$EXAMPLE/verilog/counter.v" \
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
    -s EXPORTED_FUNCTIONS='["_sim_init","_step","_sim_run_n","_reset_sim","_get_ring_ptr","_get_head","_get_ring_size","_get_ring_words","_sim_freeze_ring","_sim_thaw_ring","_sim_ring_frozen","_sim_set_la","_sim_set_post_delay","_sim_clear_trigger","_sim_set_edge_trigger","_sim_set_value_trigger","_sim_trigger_hit","_sim_trigger_fired","_sim_get_trig_fire_head"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server"
