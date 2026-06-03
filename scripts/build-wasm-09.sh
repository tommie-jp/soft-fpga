#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/09-pdp11"
VENDOR="$ROOT/vendor/cpus-pdp11"
OBJ_DIR="$ROOT/obj_dir_09_wasm"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

VERILATED_CPP="$ROOT/cxx/verilated.cpp"
cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
WASM_COMPAT="$ROOT/cxx/wasm_compat.h"

# emsdk が PATH にない場合は自動検索
if ! command -v em++ &>/dev/null; then
    EMSDK_ENV=""
    for candidate in \
        "$HOME/emsdk/emsdk_env.sh" \
        "$HOME/emsdk/emsdk/emsdk_env.sh"; do
        [ -f "$candidate" ] && EMSDK_ENV="$candidate" && break
    done
    if [ -n "${EMSDK_ENV:-}" ]; then
        # shellcheck disable=SC1090
        source "$EMSDK_ENV" 2>/dev/null
    else
        echo "ERROR: em++ not found. Install emsdk and source emsdk_env.sh" >&2
        exit 1
    fi
fi

echo "=== Verilator ==="
rm -rf "$OBJ_DIR"
verilator --cc \
    --no-timing \
    --top-module test_top_wasm \
    -Wno-DECLFILENAME \
    -Wno-MULTITOP \
    -Wno-UNUSEDSIGNAL \
    -Wno-UNOPTFLAT \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-STMTDLY \
    -Wno-TIMESCALEMOD \
    -Wno-CASEX \
    -Wno-CASEINCOMPLETE \
    "$EXAMPLE/verilog/test_top_wasm.v" \
    +incdir+"$EXAMPLE/verilog" \
    +incdir+"$VENDOR/rtl" \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH \
  -I$VERILATOR_ROOT/include \
  -I$VERILATOR_ROOT/include/vltstd \
  -I$OBJ_DIR"

echo "=== Emscripten: verilated.cpp ==="
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    -I"$ROOT/cxx" \
    -include "$WASM_COMPAT" \
    -c "$VERILATED_CPP" \
    -o "$OBJ_DIR/verilated.wasm.o"

mkdir -p "$EXAMPLE/web"

echo "=== Emscripten: link ==="
# __Dpi.cpp は DPI export 専用（当プロジェクトは import のみ）。
# svdpi.h が uint8_t を要求するが WASM ターゲットでは解決できないため除外する。
# DPI import の実装は harness.cpp / ide_v5.cpp / ram_v5.cpp に含まれる。
V_SRCS=$(ls "$OBJ_DIR"/Vtest_top_wasm*.cpp | grep -v '__Dpi\.cpp')

# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    $V_SRCS \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    "$EXAMPLE/cxx/ide_v5.cpp" \
    "$EXAMPLE/cxx/ram_v5.cpp" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_step_n","_send_key","_get_display_char",
                            "_get_ring_ptr","_get_ring_head","_get_ring_size","_get_ring_words",
                            "_get_pc","_sim_con_in_space",
                            "_sim_set_pc_trigger","_sim_trigger_hit","_sim_clear_trigger",
                            "_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32","HEAPU8","FS"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=67108864 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server 8080"
echo "Open : http://localhost:8080"
echo ""
echo "ディスクイメージを配置:"
echo "  cp examples/09-pdp11/disk/unix_v6_rk05.dsk examples/09-pdp11/web/disk/unix_v6_rk05.dsk"
