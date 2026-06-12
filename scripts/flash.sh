#!/usr/bin/env bash
set -euo pipefail

# Flash an ELF to Pico 2 (RP2350) via Pico Debug Probe (CMSIS-DAP).
#
# Prerequisites:
#   - usbipd-win on Windows has already attached the Probe to WSL2:
#       usbipd attach --wsl --busid <BUSID>
#   - Probe SWD/UART is wired to Pico 2
#
# Usage:
#   scripts/flash.sh                               # firmware_lsb (default)
#   scripts/flash.sh firmware/build/firmware_max_gain.elf
#   scripts/flash.sh path/to/other.elf             # any ELF

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

ELF="${1:-firmware/build/firmware_lsb.elf}"
if [[ ! -f "${ELF}" ]]; then
    echo "ELF not found: ${ELF}" >&2
    echo "Run scripts/build-pico.sh first." >&2
    exit 1
fi

USER_UID="$(id -u)"
USER_GID="$(id -g)"
export USER_UID USER_GID ELF

# Windows path visible from PowerShell (\\wsl.localhost\Ubuntu-24.04\...)
WIN_PATH="$(wslpath -w "${REPO_ROOT}" 2>/dev/null || echo "<WSL path unavailable>")"

# Check USB bus is visible in WSL2
if [[ ! -d /dev/bus/usb ]]; then
    echo "" >&2
    echo "Error: /dev/bus/usb not found." >&2
    echo "" >&2
    echo "  No USB devices are attached to WSL2." >&2
    echo "  Please check:" >&2
    echo "" >&2
    echo "  1. Connect the Debug Probe and Pico 2 to your PC via USB" >&2
    echo "  2. Attach with usbipd:" >&2
    echo "" >&2
    echo "     [From WSL]" >&2
    echo "       scripts/wsl-attach.sh" >&2
    echo "" >&2
    echo "     [From PowerShell (Administrator)]" >&2
    echo "       cd \"${WIN_PATH}\"" >&2
    echo "       .\\scripts\\wsl-attach.ps1" >&2
    echo "" >&2
    echo "     [Specify busid manually]" >&2
    echo "       usbipd attach --wsl --busid <BUSID>  # specify the Probe BUSID" >&2
    echo "" >&2
    exit 1
fi

# Check Debug Probe (VID:PID = 2e8a:000c) is visible
if ! lsusb 2>/dev/null | grep -q "2e8a:000c"; then
    echo "" >&2
    echo "Error: Debug Probe (CMSIS-DAP) not found." >&2
    echo "" >&2
    echo "  2e8a:000c is not listed in lsusb." >&2
    echo "  Please check:" >&2
    echo "" >&2
    echo "  1. Verify Debug Probe is connected to your PC" >&2
    echo "  2. Attach with usbipd:" >&2
    echo "" >&2
    echo "     [From WSL]" >&2
    echo "       scripts/wsl-attach.sh" >&2
    echo "" >&2
    echo "     [From PowerShell (Administrator)]" >&2
    echo "       cd \"${WIN_PATH}\"" >&2
    echo "       .\\scripts\\wsl-attach.ps1" >&2
    echo "" >&2
    echo "  3. Check currently attached devices:" >&2
    echo "       lsusb" >&2
    echo "" >&2
    exit 1
fi

docker compose -f docker/compose.yml run --rm flash

echo ""
echo "Flash complete: firmware.elf written to Pico 2."
echo "  Pico 2 has auto-reset and is booting the new firmware."
