#!/usr/bin/env bash
set -euo pipefail

# コンテナ内で実行される。直接呼ばず scripts/build-sim.sh から呼び出す。
# Env: EXAMPLE — 対象サンプル名 (例: 04-6502)

EXAMPLE="${EXAMPLE:?EXAMPLE env var required (e.g. 04-6502)}"
EXAMPLE_DIR="/work/examples/${EXAMPLE}"
BUILD_DIR="${EXAMPLE_DIR}/build"

echo "=== Build: ${EXAMPLE} ===" >&2
cmake -S "${EXAMPLE_DIR}" -B "${BUILD_DIR}" -G Ninja
cmake --build "${BUILD_DIR}" --parallel "$(nproc)"
echo "=== Done: ${BUILD_DIR}/sim ===" >&2
