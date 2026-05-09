#!/usr/bin/env bash
set -euo pipefail

# examples/<EXAMPLE> をネイティブ Linux バイナリ (build/sim) にビルドする。
#
# 使い方:
#   scripts/build-sim.sh 04-6502
#   scripts/build-sim.sh 01-counter

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

EXAMPLE="${1:?Usage: build-sim.sh <example> (e.g. 04-6502)}"

USER_UID="$(id -u)"
USER_GID="$(id -g)"
export USER_UID USER_GID

exec docker compose -f docker/compose.yml run --rm \
    -e "EXAMPLE=${EXAMPLE}" \
    build-sim
