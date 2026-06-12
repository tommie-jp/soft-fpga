#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  scripts/doRunHost.sh [--algo lsb|max_gain|corner] [--serial [device]] [--tcp [host:]port]

Options:
  --algo lsb|max_gain|corner  Algorithm selection (default: lsb)
  --serial [device]           Launch via serial port
                                device default: /dev/ttyS1 (Windows COM2)
                                COM3 = /dev/ttyS2, COM4 = /dev/ttyS3
                                Bridged with socat, run directly on WSL2 (outside Docker)
  --tcp [host:]port           Launch via TCP (e.g. HHD Virtual Serial Port)
                                host default: 127.0.0.1
                                Example: --tcp 4000  or  --tcp 127.0.0.1:4000
  -h, --help                  Show this help and exit

Examples:
  scripts/doRunHost.sh                               # stdin/stdout, pick_lsb
  scripts/doRunHost.sh --algo corner                 # stdin/stdout, pick_corner
  scripts/doRunHost.sh --serial                      # COM2, pick_lsb
  scripts/doRunHost.sh --serial /dev/ttyS2           # COM3, pick_lsb
  scripts/doRunHost.sh --algo corner --serial        # COM2, pick_corner
  scripts/doRunHost.sh --tcp 4000                    # TCP localhost:4000, pick_lsb
  scripts/doRunHost.sh --algo corner --tcp 4000      # TCP localhost:4000, pick_corner
  printf 'PI\r\nVE\r\n' | scripts/doRunHost.sh       # pipe a scenario from stdin

Using TCP with HHD Virtual Serial Port:
  1. In HHD, map "TCP/IP Ports (RFC2217, Raw)" → COM1 or COM2 to localhost:4000
  2. scripts/doRunHost.sh --tcp 4000

Windows COM ↔ WSL2 device mapping (for physical ports):
  COM2 → /dev/ttyS1  (default)
  COM3 → /dev/ttyS2
  COM4 → /dev/ttyS3

Prerequisites (first time only):
  sudo apt-get install -y socat
  sudo chmod a+rw /dev/ttyS1   # or: sudo usermod -aG dialout $USER
EOF
}

ALGO_OPT=""
SERIAL_DEV=""
TCP_ADDR=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --algo)
            ALGO_OPT="${2:?--algo requires lsb|max_gain|corner}"
            shift 2 ;;
        --serial)
            SERIAL_DEV="/dev/ttyS1"  # default: COM2
            shift
            if [[ "${1:-}" != "" && "${1:-}" != --* ]]; then
                SERIAL_DEV="$1"; shift
            fi
            ;;
        --tcp)
            shift
            if [[ "${1:-}" == "" || "${1:-}" == --* ]]; then
                echo "Error: --tcp requires a port or host:port argument." >&2; exit 2
            fi
            # if only a port number, prepend 127.0.0.1
            if [[ "${1}" =~ ^[0-9]+$ ]]; then
                TCP_ADDR="127.0.0.1:${1}"
            else
                TCP_ADDR="${1}"
            fi
            shift
            ;;
        *) echo "Unknown option: '$1'" >&2; usage >&2; exit 2 ;;
    esac
done

if [[ -n "${SERIAL_DEV}" && -n "${TCP_ADDR}" ]]; then
    echo "Error: --serial and --tcp cannot be used together." >&2; exit 2
fi

cd "${SCRIPT_DIR}"
./doVersionUp.sh

if [[ -n "${SERIAL_DEV}" ]]; then
    # Build only (inside Docker). Launch via socat on WSL2.
    if [[ -n "${ALGO_OPT}" ]]; then
        ./build-host.sh --algo "${ALGO_OPT}"
    else
        ./build-host.sh
    fi

    if ! command -v socat &>/dev/null; then
        echo "Error: socat not found." >&2
        echo "  sudo apt-get install -y socat" >&2
        exit 1
    fi
    if [[ ! -e "${SERIAL_DEV}" ]]; then
        echo "Error: ${SERIAL_DEV} does not exist." >&2
        echo "  COM2 = /dev/ttyS1, COM3 = /dev/ttyS2 ..." >&2
        exit 1
    fi

    stty -F "${SERIAL_DEV}" 115200 raw -echo -echoe -echok 2>/dev/null || true
    echo "Connected: ${SERIAL_DEV} (115200bps) ↔ reversi_host [${ALGO_OPT:-lsb}]" >&2
    exec socat "${SERIAL_DEV},b115200,raw,echo=0" \
               "EXEC:${REPO_ROOT}/host/build/reversi_host"
elif [[ -n "${TCP_ADDR}" ]]; then
    # Build only (inside Docker). Launch via socat on WSL2.
    if [[ -n "${ALGO_OPT}" ]]; then
        ./build-host.sh --algo "${ALGO_OPT}"
    else
        ./build-host.sh
    fi

    if ! command -v socat &>/dev/null; then
        echo "Error: socat not found." >&2
        echo "  sudo apt-get install -y socat" >&2
        exit 1
    fi

    echo "Connected: TCP ${TCP_ADDR} ↔ reversi_host [${ALGO_OPT:-lsb}]" >&2
    exec socat "TCP:${TCP_ADDR}" \
               "EXEC:${REPO_ROOT}/host/build/reversi_host"
else
    if [[ -n "${ALGO_OPT}" ]]; then
        exec ./build-host.sh --algo "${ALGO_OPT}" -- run
    else
        exec ./build-host.sh -- run
    fi
fi
