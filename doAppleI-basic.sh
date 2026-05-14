#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SIM="${SCRIPT_DIR}/examples/04-6502/build/sim"

if [[ ! -x "${SIM}" ]]; then
    echo "sim が見つかりません。先にビルドしてください:" >&2
    echo "  scripts/build-sim.sh 04-6502" >&2
    exit 1
fi

exec "${SIM}" "E000R"
