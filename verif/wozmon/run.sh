#!/bin/bash
# Woz Monitor インテグレーションテスト — CMake ビルド & 実行
#
# 成功 → test_wozmon: 13 PASS / 0 FAIL
#         test_programs: 34 PASS / 0 FAIL
#         test_basic:    24 PASS / 0 FAIL
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

echo "=== CMake Build ==="
# ホスト/Docker でパスが異なる場合にキャッシュが合わなくなるため削除して再構成する
rm -f "${BUILD_DIR}/CMakeCache.txt"
cmake --log-level=WARNING -S "${SCRIPT_DIR}" -B "${BUILD_DIR}" -G Ninja
cmake --build "${BUILD_DIR}" --parallel "$(nproc)"

echo ""
echo "=== Run: Woz Monitor テスト ==="
"${BUILD_DIR}/test_wozmon"

echo ""
echo "=== Run: §3.1 動作確認プログラム + §3.2 BASIC テスト ==="
"${BUILD_DIR}/test_programs"

echo ""
echo "=== Run: doc/13 Integer BASIC 動作検証サンプル ==="
"${BUILD_DIR}/test_basic"
