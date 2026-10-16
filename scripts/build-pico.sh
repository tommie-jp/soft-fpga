#!/usr/bin/env bash
set -euo pipefail

# Pico 2 (RP2350) ファームウェアを Docker コンテナ内でビルドし、
# ビルド成功後に Debug Probe 経由で書き込む。
# 成果物: firmware/build/apple1_hello.{elf,uf2}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

USER_UID="$(id -u)"
USER_GID="$(id -g)"
export USER_UID USER_GID

docker compose -f docker/compose.yml run --rm firmware

echo ""
for UF2 in firmware/build/apple1_hello.uf2; do
    UF2_SIZE="$(du -h "${UF2}" 2>/dev/null | cut -f1 || echo "?")"
    echo "ビルド完了: ${UF2} (${UF2_SIZE})"
done
