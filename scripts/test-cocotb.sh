#!/bin/bash
# cocotb + pytest によるテストを Docker コンテナ内で実行する。
# 使い方: scripts/test-cocotb.sh [pytest オプション]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/.."

docker compose -f docker/compose.yml run --rm test-cocotb "$@"
