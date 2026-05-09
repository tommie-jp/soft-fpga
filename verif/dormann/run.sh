#!/bin/bash
# Klaus Dormann functional test — CMake ビルド & 実行
#
# 成功 → PC=$3469 でトラップ
#
# 注意:
#   65C02_extended_opcodes_test.bin は Rockwell 拡張命令（BBR/BBS/RMB/SMB）を
#   含むが、hoglet cpu_65c02.v はこれらを未実装（WDC 65C02 相当）のため省略。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

echo "=== CMake Build ==="
cmake -S "${SCRIPT_DIR}" -B "${BUILD_DIR}" -G Ninja
cmake --build "${BUILD_DIR}" --parallel "$(nproc)"

echo "=== Run: 6502 functional test ==="
"${BUILD_DIR}/test_dormann" \
    "${SCRIPT_DIR}/6502_functional_test.bin" \
    0x3469
