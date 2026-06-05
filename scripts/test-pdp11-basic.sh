#!/usr/bin/env bash
# test-pdp11-basic.sh — PDP-11 基本命令テスト（vendor/cpus-pdp11/tests/basic/）
#
# 使い方:
#   bash scripts/test-pdp11-basic.sh
#
# 合格基準: 全テストが HALT に達して exit 0 になること。
# ttytest / inttest は TTY/割り込み依存のため skip する。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SIM="$ROOT/examples/09-pdp11/build/pdp11_sim"
SIM_DIAG="$ROOT/examples/09-pdp11/build/pdp11_sdiag_sim"
MEM_DIR="$ROOT/vendor/cpus-pdp11/tests/basic"
ROM_MEM_DIR="$ROOT/vendor/cpus-pdp11/tests/rom"

if [[ ! -x "$SIM" ]]; then
    echo "ERROR: $SIM が見つかりません。先にビルドしてください。" >&2
    echo "  bash scripts/build-host-09.sh" >&2
    exit 1
fi

PASS=0
FAIL=0
SKIP=0

# TTY/割り込みハードウェアを使うテストは CPU テストのみではパスできないのでスキップ
SKIP_TESTS="ttytest inttest"

run_test() {
    local name="$1"
    local mem="$MEM_DIR/${name}.mem"

    for skip in $SKIP_TESTS; do
        if [[ "$name" == "$skip" ]]; then
            printf "  %-12s SKIP\n" "$name"
            SKIP=$((SKIP + 1))
            return
        fi
    done

    if [[ ! -f "$mem" ]]; then
        printf "  %-12s SKIP (no .mem)\n" "$name"
        SKIP=$((SKIP + 1))
        return
    fi

    # 標準出力を取得（stderr は捨てる）
    local out
    out="$("$SIM" --run-test "$mem" 2>/dev/null)"

    if echo "$out" | grep -q "PASS"; then
        printf "  %-12s PASS\n" "$name"
        PASS=$((PASS + 1))
    else
        printf "  %-12s FAIL\n" "$name"
        echo "$out" | sed 's/^/    /'
        FAIL=$((FAIL + 1))
    fi
}

# ROM テスト: boot_diag bootrom を持つ pdp11_sdiag_sim を使い、
# UART 出力に期待文字列が現れたら PASS（HALT は失敗を意味する）。
# 引数: <表示名> <mem_file> <開始PC(8進)>
run_rom_test() {
    local name="$1"
    local mem="$2"
    local pc="$3"

    if [[ ! -x "$SIM_DIAG" ]]; then
        printf "  %-12s SKIP (pdp11_sdiag_sim not built)\n" "$name"
        SKIP=$((SKIP + 1))
        return
    fi

    if [[ ! -f "$mem" ]]; then
        printf "  %-12s SKIP (no .mem)\n" "$name"
        SKIP=$((SKIP + 1))
        return
    fi

    local out
    out="$("$SIM_DIAG" --rom-test "$mem" "$pc" 2>/dev/null)"

    if echo "$out" | grep -q "PASS"; then
        printf "  %-12s PASS\n" "$name"
        PASS=$((PASS + 1))
    else
        printf "  %-12s FAIL\n" "$name"
        echo "$out" | sed 's/^/    /'
        FAIL=$((FAIL + 1))
    fi
}

echo "=== PDP-11 basic tests ==="
for t in test0 test1 test2 test3 test4 test5 test6 test7 test8 test9 \
         test10 test11 test12 test13 test14 test15 test16 test17 \
         ttytest inttest; do
    run_test "$t"
done

echo ""
echo "=== PDP-11 ROM tests ==="
# sdiag: ORG=0173000 の ROM モニタ。RAM 読み書き確認後 "Hello world!" を UART 出力。
run_rom_test "sdiag" "$ROM_MEM_DIR/sdiag/diag.mem" "173000"

echo ""
echo "結果: PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
