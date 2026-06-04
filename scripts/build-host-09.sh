#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/09-pdp11"
VENDOR="$ROOT/vendor/cpus-pdp11"
OBJ_DIR="$ROOT/obj_dir_09_host"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

echo "=== Verilator 5.x ==="
rm -rf "$OBJ_DIR"
# test_top_wasm.v を使用: wasm_uart.v（DPI ベース）で TTY I/O を行う
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

echo "=== C++ build ==="
mkdir -p "$EXAMPLE/build"

CXX_FLAGS="-O2 -std=c++17 \
  -I$VERILATOR_ROOT/include \
  -I$VERILATOR_ROOT/include/vltstd \
  -I$OBJ_DIR"

# __Dpi.cpp は DPI export 専用のため除外（DPI import のみ使用）
V_SRCS=$(ls "$OBJ_DIR"/Vtest_top_wasm*.cpp | grep -v '__Dpi\.cpp')

# shellcheck disable=SC2086
g++ $CXX_FLAGS \
    $V_SRCS \
    "$VERILATOR_ROOT/include/verilated.cpp" \
    "$VERILATOR_ROOT/include/verilated_threads.cpp" \
    "$EXAMPLE/cxx/ide_v5.cpp" \
    "$EXAMPLE/cxx/ram_v5.cpp" \
    "$EXAMPLE/cxx/main_linux.cpp" \
    -o "$EXAMPLE/build/pdp11_sim"

echo "=== Done ==="
echo "  $EXAMPLE/build/pdp11_sim"
echo ""
echo "Usage:"
echo "  IDEIMAGE=examples/09-pdp11/disk/unix_v6_rk05.dsk $EXAMPLE/build/pdp11_sim"
echo "  ./doPDP11-unix-v6.sh"
