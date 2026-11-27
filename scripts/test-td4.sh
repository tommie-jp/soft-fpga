#!/bin/bash
# test-td4.sh — 10-td4 のハーネスをネイティブでビルドし、命令表の模型と突き合わせるテストを回す
#
# 使い方: scripts/test-td4.sh
# 終了コード: 0 = PASS、1 = FAIL
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/10-td4"
OBJ_DIR="$ROOT/obj_dir_10_host"
LOG="$OBJ_DIR/build.log"
mkdir -p "$OBJ_DIR"

verilator --cc --exe --build -j 0 -Wall \
    --top-module td4_top \
    --Mdir "$OBJ_DIR" \
    -CFLAGS "-std=c++17" \
    -o test_td4 \
    "$EXAMPLE/verilog/td4.v" \
    "$EXAMPLE/cxx/harness.cpp" \
    "$EXAMPLE/cxx/test_td4.cpp" > "$LOG" 2>&1 || {
    echo "ERROR: ビルドに失敗しました (ログ: $LOG)" >&2
    tail -30 "$LOG" >&2
    exit 1
}

"$OBJ_DIR/test_td4"
