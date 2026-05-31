#!/usr/bin/env bash
# scripts/_test-8080-cpm-inner.sh — 8080 CP/M シミュレータ ビルド＋全テスト
#
# Docker コンテナ内で実行される。直接呼ばず doTestAll.sh (test-8080-cpm サービス)
# 経由で使用する。
#
# 実行内容:
#   cmake ビルド (examples/06-8080)
#   1. RTL lint (Verilator)
#   2. ハーネス スモークテスト         (--test)
#   3. 全命令テストスイート             (--run-test)
#   4. CP/M ブートテスト               (--boot-test)
#   5. 8080EX1 機能テスト 20 グループ  (--exec 8080EX1)
#   5b. 8080PRE 前段テスト             (--exec 8080PRE)
#   6. DDT Ctrl+C ウォームブートテスト (--ddt-ctrlc-test)
#   7. CP/M 標準コマンド + BDS C シナリオ群 (--cpm-script)
#
# 終了コード: 0 = 全 PASS、1 = 1 件以上 FAIL

set -uo pipefail

EXAMPLE_DIR="/work/examples/06-8080"
# ホストの build/ と CMakeCache パスが衝突しないよう /tmp を使う
BUILD_DIR="/tmp/build-8080-cpm"
CPM_BIN="${BUILD_DIR}/cpm"

# cpm のデフォルトパスはバイナリ位置基準になるため、/tmp ビルド時は明示指定する
BIOS_BIN="${EXAMPLE_DIR}/sw/cpm/bios/bios.bin"
CPM_ROM="${EXAMPLE_DIR}/rom/cpm22.bin"
DISK_A="${EXAMPLE_DIR}/sw/cpm/disks/cpm22.dsk"
TEST_BIN="${EXAMPLE_DIR}/test/test_all.bin"
CPM_ARGS=(--bios "${BIOS_BIN}" --cpm "${CPM_ROM}" --disk "${DISK_A}")

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

run_test() {
    local label="$1"; shift
    printf "${CYAN}[RUN]${RESET}  %s\n" "$label"
    if "$@"; then
        printf "${GREEN}[PASS]${RESET} %s\n\n" "$label"
        RESULTS+=("PASS  $label")
        (( PASS_COUNT++ )) || true
    else
        printf "${RED}[FAIL]${RESET} %s\n\n" "$label"
        RESULTS+=("FAIL  $label")
        (( FAIL_COUNT++ )) || true
    fi
}

# ---------------------------------------------------------------------------
# cmake ビルド (失敗時は即終了)
# ---------------------------------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " cmake ビルド: ${EXAMPLE_DIR}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
set -e
cmake -S "${EXAMPLE_DIR}" -B "${BUILD_DIR}" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "${BUILD_DIR}" --parallel "$(nproc)"
set +e
echo ""

cd "${EXAMPLE_DIR}"

# ---------------------------------------------------------------------------
# 1. RTL lint (Verilator)
# ---------------------------------------------------------------------------
run_test "RTL lint (Verilator)" \
    verilator --lint-only \
        verilog/cpm_top.v \
        verilog/vm80a/org/rtl/vm80a.v \
        --top-module cpm_top \
        -Wno-WIDTHEXPAND

# ---------------------------------------------------------------------------
# 2. ハーネス スモークテスト
# ---------------------------------------------------------------------------
run_test "ハーネス スモークテスト (--test)" \
    "${CPM_BIN}" --test

# ---------------------------------------------------------------------------
# 3. 全命令テストスイート (bare-metal)
# ---------------------------------------------------------------------------
run_test "全命令テストスイート 20 グループ (--run-test)" \
    "${CPM_BIN}" --run-test "${TEST_BIN}"

# ---------------------------------------------------------------------------
# 4. CP/M ブートテスト
# ---------------------------------------------------------------------------
run_test "CP/M ブートテスト (--boot-test)" \
    "${CPM_BIN}" "${CPM_ARGS[@]}" --boot-test

# ---------------------------------------------------------------------------
# 5. 8080EX1 機能テスト (CP/M 上)
# ---------------------------------------------------------------------------
run_test "8080EX1 機能テスト 20 グループ (--exec 8080EX1)" \
    "${CPM_BIN}" "${CPM_ARGS[@]}" --exec 8080EX1 --no-save

# ---------------------------------------------------------------------------
# 5b. 8080PRE 前段テスト (CP/M 上)
# ---------------------------------------------------------------------------
run_test "8080PRE 前段テスト (--exec 8080PRE)" \
    "${CPM_BIN}" "${CPM_ARGS[@]}" --exec 8080PRE --no-save

# ---------------------------------------------------------------------------
# 6. DDT Ctrl+C ウォームブートテスト
# ---------------------------------------------------------------------------
run_test "DDT Ctrl+C ウォームブートテスト (--ddt-ctrlc-test)" \
    "${CPM_BIN}" "${CPM_ARGS[@]}" --ddt-ctrlc-test

# ---------------------------------------------------------------------------
# 7. CP/M 標準コマンド + BDS C シナリオ群 (--cpm-script)
# ---------------------------------------------------------------------------
run_test "CP/M コマンド + BDS C シナリオ群 (--cpm-script)" \
    bash "/work/scripts/_test-8080-cpm-scenarios.sh" "${CPM_BIN}" "${EXAMPLE_DIR}"

# ---------------------------------------------------------------------------
# サマリー
# ---------------------------------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for r in "${RESULTS[@]}"; do
    if [[ "$r" == PASS* ]]; then
        printf "  ${GREEN}%s${RESET}\n" "$r"
    else
        printf "  ${RED}%s${RESET}\n" "$r"
    fi
done
echo ""
printf "  合計: %d 件  PASS: %d  FAIL: %d\n" \
    "$((PASS_COUNT + FAIL_COUNT))" "${PASS_COUNT}" "${FAIL_COUNT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if (( FAIL_COUNT > 0 )); then
    exit 1
fi
