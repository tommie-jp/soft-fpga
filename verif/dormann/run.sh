#!/bin/bash
# Klaus Dormann functional test — ネイティブ Verilator ビルド & 実行
#
# Usage: ./run.sh
#   成功 → PC=$3469 でトラップ
#
# 注意:
#   65C02_extended_opcodes_test.bin は Rockwell 拡張命令（BBR/BBS/RMB/SMB）を
#   含むが、hoglet cpu_65c02.v はこれらを未実装（WDC 65C02 相当）のため省略。
#   hoglet の README には 6502_functional_test を通過すると記載されており、
#   本スクリプトでその確認を行う。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/../.."
EXAMPLE="$ROOT/examples/04-6502"
HOGLET="$EXAMPLE/verilog/hoglet"
OBJ_DIR="$SCRIPT_DIR/obj_dir"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

mkdir -p "$OBJ_DIR"

echo "=== Verilator (native) ==="
verilator --cc \
    "$EXAMPLE/verilog/apple1_top.v" \
    "$HOGLET/cpu_65c02.v" \
    "$HOGLET/ALU.v" \
    --top-module apple1_top \
    -Wno-CASEX \
    -Wno-CASEINCOMPLETE \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-CASEOVERLAP \
    --Mdir "$OBJ_DIR"

echo "=== Build (Verilator Makefile) ==="
make -C "$OBJ_DIR" -f Vapple1_top.mk -j"$(nproc)" \
    OPT_FAST="-O3" OPT_SLOW="-O3" OPT_GLOBAL="-O3"

echo "=== Link test harness ==="
CFLAGS="-O3 -std=c++17 -I$VERILATOR_ROOT/include -I$OBJ_DIR"

g++ $CFLAGS \
    "$SCRIPT_DIR/test_dormann.cpp" \
    "$OBJ_DIR/Vapple1_top__ALL.a" \
    "$OBJ_DIR/libverilated.a" \
    -lpthread \
    -o "$OBJ_DIR/test_dormann"

echo "=== Run: 6502 functional test ==="
"$OBJ_DIR/test_dormann" \
    "$SCRIPT_DIR/6502_functional_test.bin" \
    0x3469
