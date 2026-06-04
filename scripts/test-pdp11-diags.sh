#!/usr/bin/env bash
# test-pdp11-diags.sh — PDP-11 MAINDEC 診断プログラム実行
#
# 使い方:
#   bash scripts/test-pdp11-diags.sh [FKAAC0 ...]
#   引数なしで全診断を実行する。
#
# 診断プログラム一覧:
#   FKAAC0  11/34 Basic CPU Test
#   FKABD0  11/34 CPU Trap Test
#   FKACA0  11/34 EIS 命令テスト（MUL/DIV/ASH）
#   FKTHB0  11/34 メモリ管理テスト（MMU）
#   FKTGC0  11/34 命令・I/O エクササイザ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SIM="$ROOT/examples/09-pdp11/build/pdp11_sim"
DIAG_DIR="$ROOT/vendor/cpus-pdp11/tests/diags"

if [[ ! -x "$SIM" ]]; then
    echo "ERROR: $SIM が見つかりません。先にビルドしてください。" >&2
    echo "  bash scripts/build-host-09.sh" >&2
    exit 1
fi

# 引数で診断名が指定されていない場合は全診断を実行
DIAGS=("${@:-FKAAC0 FKABD0 FKACA0 FKTHB0 FKTGC0}")
if [[ $# -eq 0 ]]; then
    DIAGS=(FKAAC0 FKABD0 FKACA0 FKTHB0 FKTGC0)
fi

PASS=0
FAIL=0
SKIP=0

run_diag() {
    local name="$1"
    local mem="$DIAG_DIR/${name}.mem"

    if [[ ! -f "$mem" ]]; then
        printf "  %-12s SKIP (no .mem)\n" "$name"
        SKIP=$((SKIP + 1))
        return
    fi

    printf "  %-12s " "$name"

    local out
    out="$("$SIM" --diag "$name" 2>/dev/null)"

    if echo "$out" | grep -q "PASS"; then
        echo "PASS"
        PASS=$((PASS + 1))
    else
        echo "FAIL"
        echo "$out" | sed 's/^/    /'
        FAIL=$((FAIL + 1))
    fi
}

echo "=== PDP-11 MAINDEC 診断 ==="
for d in "${DIAGS[@]}"; do
    run_diag "$d"
done

echo ""
echo "結果: PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
