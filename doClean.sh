#!/usr/bin/env bash
# doClean.sh — ビルド成果物をすべて削除してクリーンな状態に戻す
#
# 削除対象:
#   examples/06-8080/build/         cmake ビルドディレクトリ
#   obj_dir_06_wasm/                Verilator 生成 C++ (WASM ビルド用)
#   examples/06-8080/web/sim.js     WASM リンク成果物
#   examples/06-8080/web/sim.wasm
#   examples/06-8080/tests/sim-test.mjs   テスト用 WASM
#   examples/06-8080/tests/sim-test.wasm
#   examples/06-8080/sw/cpm/bios/signon.inc  make clean 対象
#
# 削除しないもの:
#   node_modules/  (npm install は時間がかかるため保持)
#   *.dsk          (ディスクイメージはユーザーデータを含む可能性あり)
#   bios.bin       (make clean で生成し直せるが、誤削除防止のため保持)
#
# 実行手順:
#   cd ~/36-soft-FPGA
#   bash doClean.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CPM_DIR="${SCRIPT_DIR}/examples/06-8080"

# ANSI カラー
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
RESET='\033[0m'

removed=0

rm_if_exists() {
    local target="$1"
    if [[ -e "${target}" ]]; then
        rm -rf "${target}"
        printf "  ${YELLOW}削除${RESET} %s\n" "${target#${SCRIPT_DIR}/}"
        (( removed++ )) || true
    fi
}

echo "======================================================================"
echo " クリーン: examples/06-8080"
echo "======================================================================"
echo ""

# cmake ビルドディレクトリ
rm_if_exists "${CPM_DIR}/build"

# Verilator 生成 C++ (WASM ビルド用)
rm_if_exists "${SCRIPT_DIR}/obj_dir_06_wasm"

# WASM 成果物
rm_if_exists "${CPM_DIR}/web/sim.js"
rm_if_exists "${CPM_DIR}/web/sim.wasm"

# テスト用 WASM
rm_if_exists "${CPM_DIR}/tests/sim-test.mjs"
rm_if_exists "${CPM_DIR}/tests/sim-test.wasm"

# BIOS make clean (signon.inc のみ削除)
if [[ -f "${CPM_DIR}/sw/cpm/bios/signon.inc" ]]; then
    make -C "${CPM_DIR}/sw/cpm" clean --silent
    printf "  ${YELLOW}削除${RESET} examples/06-8080/sw/cpm/bios/signon.inc + bios.bin\n"
    (( removed++ )) || true
fi

echo ""
if (( removed == 0 )); then
    echo "  削除対象なし（すでにクリーン）"
else
    printf "${GREEN}[完了]${RESET} ${removed} 件削除しました\n"
fi
echo ""
echo "再ビルドするには:"
echo "  bash doBuildAll.sh"
