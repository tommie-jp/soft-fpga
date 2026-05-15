#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/05-dormann"
EXAMPLE_04="$ROOT/examples/04-6502"
OBJ_DIR="$ROOT/obj_dir_05"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

VERILATED_CPP="$ROOT/cxx/verilated.cpp"
if [ ! -f "$VERILATED_CPP" ]; then
    cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
fi
WASM_COMPAT="$ROOT/cxx/wasm_compat.h"

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
        echo "ERROR: em++ not found." >&2; exit 1
    fi
fi

HOGLET="$EXAMPLE_04/verilog/hoglet"

echo "=== Verilator ==="
verilator --cc \
    "$EXAMPLE_04/verilog/apple1_top.v" \
    "$HOGLET/cpu_65c02.v" \
    "$HOGLET/ALU.v" \
    --top-module apple1_top \
    -Wno-CASEX \
    -Wno-CASEINCOMPLETE \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-CASEOVERLAP \
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
BIN="$ROOT/verif/dormann/6502_functional_test.bin"
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    "$OBJ_DIR"/V*.cpp \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    -I"$ROOT/cxx" \
    -include "$WASM_COMPAT" \
    --embed-file "$BIN@/6502_functional_test.bin" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_step","_get_pc","_get_cycles_lo","_get_cycles_hi","_is_trapped","_is_passed","_get_ring_ptr","_get_ring_size","_get_head"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
