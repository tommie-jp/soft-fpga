#!/usr/bin/env bash
set -euo pipefail

# Bidirectional serial communication wrapper for Pico (picocom).
#
# Usage:
#   scripts/serial.sh                 # auto-select first /dev/ttyACM* at 115200
#   scripts/serial.sh /dev/ttyACM0    # specify port directly
#   scripts/serial.sh /dev/ttyACM0 9600
#
# CRLF:
#   TX: CR → CR+LF conversion (--omap crcrlf)  * Enter key sends CR
#   RX: CR+LF handled as-is by the terminal (no --imap)
#
# Exit: Ctrl-A → Ctrl-X. dialout group membership required.

BAUD="${2:-115200}"

if [[ -n "${1:-}" ]]; then
    PORT="${1}"
else
    # Auto-select the first device found under /dev/ttyACM*
    PORT="$(ls /dev/ttyACM* 2>/dev/null | head -1)"
    if [[ -z "${PORT}" ]]; then
        echo "" >&2
        echo "Error: /dev/ttyACM* not found." >&2
        echo "" >&2
        echo "  Pico 2 is not recognized by WSL2." >&2
        echo "  Please check:" >&2
        echo "" >&2
        echo "  1. Connect Pico 2 to your PC via USB" >&2
        echo "  2. Attach with usbipd:" >&2
        echo "       scripts/wsl-attach.sh" >&2
        echo "  3. Check current devices:" >&2
        echo "       ls /dev/ttyACM*" >&2
        echo "" >&2
        exit 1
    fi
    echo "Port auto-selected: ${PORT}"
fi

if [[ ! -e "${PORT}" ]]; then
    echo "" >&2
    echo "Error: port not found: ${PORT}" >&2
    echo "  Possibly forgot to run usbipd attach. Check scripts/wsl-attach.sh" >&2
    echo "" >&2
    exit 1
fi

if ! command -v picocom &>/dev/null; then
    echo "Error: picocom is not installed." >&2
    echo "  sudo apt-get install -y picocom" >&2
    exit 1
fi

echo "Connecting: ${PORT}  ${BAUD}bps  (exit: Ctrl-A → Ctrl-X)"
exec picocom -b "${BAUD}" --omap crcrlf --echo --quiet "${PORT}"
