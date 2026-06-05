#!/usr/bin/env bash
# test-pdp11-v6.sh — PDP-11 / Unix V6 シナリオテスト（--v6-script）
#
# examples/09-pdp11/tests/v6-scripts/*.v6 を 1 つずつ実行し、PASS/FAIL を集計する。
# 各シナリオは V6 を起動して wait/send/expect を流す（cc コンパイル等）。
#
# 使い方:
#   bash scripts/test-pdp11-v6.sh                 # 全シナリオ
#   bash scripts/test-pdp11-v6.sh cc-hello        # 単一シナリオ（拡張子省略可）
#
# 注: 各実行は元ディスクのコピー上で行い、ソースディスクを汚さない。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SIM="$ROOT/examples/09-pdp11/build/pdp11_sim"
SCRIPT_DIR_V6="$ROOT/examples/09-pdp11/tests/v6-scripts"
DISK_SRC="${IDEIMAGE:-$ROOT/examples/09-pdp11/disk/unix_v6_rk05.dsk}"
TIMEOUT="${TIMEOUT:-300}"

if [[ ! -x "$SIM" ]]; then
    echo "ERROR: $SIM が見つかりません。先にビルドしてください。" >&2
    echo "  bash scripts/build-host-09.sh" >&2
    exit 1
fi
if [[ ! -f "$DISK_SRC" ]]; then
    echo "ERROR: V6 ディスクが見つかりません: $DISK_SRC" >&2
    echo "  examples/09-pdp11/disk/README.md を参照（または IDEIMAGE=<path> を指定）。" >&2
    exit 1
fi

# 対象シナリオの収集
declare -a SCRIPTS
if [[ $# -ge 1 ]]; then
    for arg in "$@"; do
        f="$SCRIPT_DIR_V6/${arg%.v6}.v6"
        [[ -f "$f" ]] || { echo "ERROR: シナリオが見つかりません: $f" >&2; exit 1; }
        SCRIPTS+=("$f")
    done
else
    shopt -s nullglob
    SCRIPTS=("$SCRIPT_DIR_V6"/*.v6)
    shopt -u nullglob
fi

if [[ ${#SCRIPTS[@]} -eq 0 ]]; then
    echo "実行するシナリオがありません: $SCRIPT_DIR_V6/*.v6" >&2
    exit 1
fi

TMP_DISK="$(mktemp /tmp/pdp11_v6_XXXXXX.dsk)"
trap 'rm -f "$TMP_DISK"' EXIT

PASS=0
FAIL=0
echo "=== PDP-11 / Unix V6 シナリオテスト（${#SCRIPTS[@]} 本） ==="

for sc in "${SCRIPTS[@]}"; do
    name="$(basename "$sc")"
    cp "$DISK_SRC" "$TMP_DISK"   # 毎回クリーンなディスクから開始
    log="$(mktemp)"
    if IDEIMAGE="$TMP_DISK" timeout "$TIMEOUT" "$SIM" --v6-script "$sc" >"$log" 2>&1; then
        printf "  %-24s PASS\n" "$name"
        PASS=$((PASS + 1))
    else
        printf "  %-24s FAIL\n" "$name"
        echo "    --- 末尾ログ ---"
        tr -d '\0' <"$log" | grep -avE "dpi_ide" | tail -8 | sed 's/^/    /'
        FAIL=$((FAIL + 1))
    fi
    rm -f "$log"
done

echo "---------------------------------------------"
echo "PASS=$PASS  FAIL=$FAIL"
[[ $FAIL -eq 0 ]]
