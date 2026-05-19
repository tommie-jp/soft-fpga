#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/06-8080"
OBJ_DIR="$ROOT/obj_dir_06_wasm"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

VERILATED_CPP="$ROOT/cxx/verilated.cpp"
# Verilator バージョンと obj_dir の生成コードを常に合わせるため上書きコピーする
cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
WASM_COMPAT="$ROOT/cxx/wasm_compat.h"

# source emsdk if em++ not in PATH
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
    "$EXAMPLE/verilog/cpm_top.v" \
    "$EXAMPLE/verilog/vm80a/org/rtl/vm80a.v" \
    --top-module cpm_top \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-UNOPTFLAT \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH -I$VERILATOR_ROOT/include -I$VERILATOR_ROOT/include/vltstd -I$OBJ_DIR"

echo "=== Emscripten: verilated.cpp ==="
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    -I"$ROOT/cxx" \
    -include "$WASM_COMPAT" \
    -c "$VERILATED_CPP" \
    -o "$OBJ_DIR/verilated.wasm.o"

BIOS="$EXAMPLE/sw/cpm/bios/bios.bin"
CPM="$EXAMPLE/rom/cpm22.bin"
DSK="$EXAMPLE/sw/cpm/disks/cpm22.dsk"
BDSC="$EXAMPLE/sw/cpm/disks/bdsc.dsk"

echo "=== Emscripten: link ==="
# __Dpi.cpp は vm80a が DPI を使わないため不要。除外しないと svdpi.h の uint8_t エラーになる。
V_SRCS=$(ls "$OBJ_DIR"/V*.cpp | grep -v '__Dpi\.cpp')
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    $V_SRCS \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    --embed-file "$BIOS@/bios.bin" \
    --embed-file "$CPM@/cpm22.bin" \
    --embed-file "$DSK@/cpm22.dsk" \
    --embed-file "$BDSC@/bdsc.dsk" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_sim_init_wasm","_sim_init_disk","_step","_send_key","_get_display_char","_get_pc","_sim_read_byte","_load_disk","_load_disk_drive","_sim_load_disk_file","_sim_test","_sim_run_bare","_get_ring_ptr","_get_head","_get_ring_size"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server"
