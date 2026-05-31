#!/usr/bin/env bash
# doBuildAll.sh — examples/06-8080 の全ビルドを順次実行する
#
# ビルドステップ:
#   1. 命令テストバイナリ生成 (z80asm: test/Makefile)
#   2. BIOS アセンブル Linux 版 (z80asm: sw/cpm/Makefile linux)
#   3. ネイティブ Linux バイナリ (cmake + make)
#   4. BIOS アセンブル WASM 版  (z80asm: sw/cpm/Makefile wasm)
#   5. WebAssembly ビルド       (Verilator + Emscripten: scripts/build-wasm-06.sh)
#   6. BIOS アセンブル Linux 版 に戻す (doCPM.sh / doAllTest.sh 用)
#   7. npm install              (Vitest 依存パッケージ)
#
# 終了コード: 0 = 全ステップ成功、1 = 1 件以上失敗
#
# 実行手順:
#   cd ~/36-soft-FPGA
#   bash doBuildAll.sh

set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doBuildAll.sh [-h]

examples/06-8080 の全ビルドを順次実行する。

ビルドステップ:
  1. 命令テストバイナリ生成    (test/Makefile)
  2. BIOS アセンブル Linux 版  (sw/cpm/Makefile linux)
  3. ネイティブ Linux バイナリ (cmake -B build)
  4. BIOS アセンブル WASM 版   (sw/cpm/Makefile wasm)
  5. WebAssembly ビルド         (scripts/build-wasm-06.sh)
  6. BIOS Linux 版に戻す        (sw/cpm/Makefile linux)
  7. npm install                 (tests/ の Vitest 依存)

終了コード: 0 = 全ステップ成功、1 = 1 件以上失敗

オプション:
  -h, --help  このヘルプを表示して終了
EOF
}

for arg in "$@"; do
    case "$arg" in
        -h|--help) usage; exit 0 ;;
        *) echo "不明なオプション: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CPM_DIR="${SCRIPT_DIR}/examples/06-8080"

# ANSI カラー
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

# ---------------------------------------------------------------------------
# ヘルパー: 1 ステップを実行して結果を記録する
# ---------------------------------------------------------------------------
run_step() {
    local label="$1"
    shift
    printf "${CYAN}[BUILD]${RESET} %s\n" "$label"
    if "$@"; then
        printf "${GREEN}[OK]${RESET}    %s\n\n" "$label"
        RESULTS+=("OK    $label")
        (( PASS_COUNT++ )) || true
    else
        printf "${RED}[FAIL]${RESET}  %s\n\n" "$label"
        RESULTS+=("FAIL  $label")
        (( FAIL_COUNT++ )) || true
    fi
}

echo "======================================================================"
echo " 全ビルド: examples/06-8080"
echo "======================================================================"
echo ""

cd "${CPM_DIR}"

# ---------------------------------------------------------------------------
# 1. 命令テストバイナリ生成 (test/test_all.bin)
# ---------------------------------------------------------------------------
run_step "命令テストバイナリ生成 (test/Makefile)" \
    make -C test

# ---------------------------------------------------------------------------
# 2. BIOS アセンブル Linux 版 (ネイティブバイナリ向け)
# ---------------------------------------------------------------------------
run_step "BIOS アセンブル Linux 版 (sw/cpm/Makefile linux)" \
    make -C sw/cpm linux

# ---------------------------------------------------------------------------
# 3. ネイティブ Linux バイナリ (cmake)
# ---------------------------------------------------------------------------
run_step "cmake 設定 (cmake -B build)" \
    cmake -B build -DCMAKE_BUILD_TYPE=Release

run_step "ネイティブ Linux バイナリ (cmake --build build)" \
    cmake --build build

# ---------------------------------------------------------------------------
# 4. BIOS アセンブル WASM 版 (Emscripten 埋め込み向け)
# ---------------------------------------------------------------------------
run_step "BIOS アセンブル WASM 版 (sw/cpm/Makefile wasm)" \
    make -C sw/cpm wasm

# ---------------------------------------------------------------------------
# 5. WebAssembly ビルド (Verilator + Emscripten)
# ---------------------------------------------------------------------------
run_step "WebAssembly ビルド (scripts/build-wasm-06.sh)" \
    bash "${SCRIPT_DIR}/scripts/build-wasm-06.sh"

# ---------------------------------------------------------------------------
# 6. BIOS を Linux 版に戻す (doCPM.sh / doAllTest.sh 用)
# ---------------------------------------------------------------------------
run_step "BIOS を Linux 版に戻す (sw/cpm/Makefile linux)" \
    make -C sw/cpm linux

# ---------------------------------------------------------------------------
# 7. npm install (Vitest 依存)
# ---------------------------------------------------------------------------
run_step "npm install (tests/)" \
    npm --prefix tests install --prefer-offline

# ---------------------------------------------------------------------------
# サマリー
# ---------------------------------------------------------------------------
echo "======================================================================"
echo " サマリー"
echo "======================================================================"
for r in "${RESULTS[@]}"; do
    if [[ "$r" == OK* ]]; then
        printf "  ${GREEN}%s${RESET}\n" "$r"
    else
        printf "  ${RED}%s${RESET}\n" "$r"
    fi
done
echo ""
echo "  合計: $((PASS_COUNT + FAIL_COUNT)) ステップ  OK: ${PASS_COUNT}  FAIL: ${FAIL_COUNT}"
echo "======================================================================"

if (( FAIL_COUNT > 0 )); then
    echo ""
    printf "${RED}[結果] ${FAIL_COUNT} ステップ FAIL${RESET}\n"
    exit 1
else
    echo ""
    printf "${GREEN}[結果] 全 ${PASS_COUNT} ステップ OK${RESET}\n"
    exit 0
fi
