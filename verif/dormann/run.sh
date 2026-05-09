#!/bin/bash
# Klaus Dormann functional test — ネイティブ Verilator ビルド & 実行
#
# Usage: ./run.sh [6502]
#   6502   : 6502_functional_test.bin を実行（デフォルト）
#            成功 → PC=$3469 でトラップ
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

echo "=== Compile ==="
CFLAGS="-O2 -std=c++17 -I$VERILATOR_ROOT/include -I$OBJ_DIR"

g++ $CFLAGS \
    -c "$VERILATOR_ROOT/include/verilated.cpp" \
    -o "$OBJ_DIR/verilated.o"

g++ $CFLAGS \
    -c "$VERILATOR_ROOT/include/verilated_threads.cpp" \
    -o "$OBJ_DIR/verilated_threads.o"

g++ $CFLAGS \
    "$OBJ_DIR"/V*.cpp \
    "$OBJ_DIR/verilated.o" \
    "$OBJ_DIR/verilated_threads.o" \
    "$SCRIPT_DIR/test_dormann.cpp" \
    -lpthread \
    -o "$OBJ_DIR/test_dormann"

echo "=== Run: 6502 functional test ==="
"$OBJ_DIR/test_dormann" \
    "$SCRIPT_DIR/6502_functional_test.bin" \
    0x3469
