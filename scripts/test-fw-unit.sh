#!/usr/bin/env bash
set -euo pipefail

# firmware/test/ のホスト単体テストを Pico 用コンテナ内でビルドして実行する。
# Pico SDK / Probe / 実機には依存しない。
#
# 使い方:
#   scripts/test-fw-unit.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

USER_UID="$(id -u)"
USER_GID="$(id -g)"
export USER_UID USER_GID

exec docker compose -f docker/compose.yml run --rm firmware bash -c '
set -euo pipefail
out=/tmp/fw-unit
mkdir -p "${out}"
for src in firmware/test/test_*.cpp; do
    name="$(basename "${src}" .cpp)"
    g++ -std=c++17 -Wall -Wextra -Werror -I firmware/common "${src}" -o "${out}/${name}"
    "${out}/${name}"
done
'
