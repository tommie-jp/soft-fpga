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
verilator --cc \
    --no-timing \
    --top-module test_top \
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
    "$VENDOR/verif/test_top.v" \
    +incdir+"$VENDOR/rtl" \
    --Mdir "$OBJ_DIR"

echo "=== C++ build ==="
mkdir -p "$EXAMPLE/build"

CXX_FLAGS="-O2 -std=c++17 \
  -I$VERILATOR_ROOT/include \
  -I$VERILATOR_ROOT/include/vltstd \
  -I$OBJ_DIR"

g++ $CXX_FLAGS \
    "$OBJ_DIR"/Vtest_top*.cpp \
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
echo "  IDEIMAGE=examples/09-pdp11/disk/unixv6.rk $EXAMPLE/build/pdp11_sim"
echo "  IDEIMAGE=examples/09-pdp11/disk/rt11.dsk  $EXAMPLE/build/pdp11_sim"
