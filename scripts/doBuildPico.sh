#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    cat <<'USAGE'
使い方:
  scripts/doBuildPico.sh                        # ビルドのみ
  scripts/doBuildPico.sh --flash                # ビルド後 apple1_hello を Debug Probe 経由で書き込む
  scripts/doBuildPico.sh --flash apple1         # ビルド後 apple1 を書き込む

ビルド成果物:
  firmware/build/apple1_hello.{elf,uf2}  -- Phase 0: GP25 点滅 + USB-CDC/UART エコー
  firmware/build/apple1.{elf,uf2}        -- Apple-1 (6502) + wozmon + Integer BASIC

BOOTSEL で書き込む場合:
  1. Pico 2 の BOOTSEL ボタンを押しながら USB 接続
  2. RPI-RP2350 ドライブに .uf2 をドラッグ＆ドロップ
USAGE
}

FLASH_ELF=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage; exit 0 ;;
        --flash)
            FLASH_ELF="firmware/build/apple1_hello.elf"
            shift
            case "${1:-}" in
                hello)  FLASH_ELF="firmware/build/apple1_hello.elf"; shift ;;
                apple1) FLASH_ELF="firmware/build/apple1.elf";       shift ;;
            esac
            ;;
        *)
            echo "Unknown option: '$1'" >&2; usage >&2; exit 2 ;;
    esac
done

cd "${SCRIPT_DIR}"
./build-pico.sh

if [[ -n "${FLASH_ELF}" ]]; then
    ./flash.sh "${FLASH_ELF}"
fi
