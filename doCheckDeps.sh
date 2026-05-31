#!/usr/bin/env bash
# doCheckDeps.sh — ビルド・テストに必要なツールが揃っているか確認する
#
# 確認対象:
#   verilator  RTL → C++ 変換
#   em++       Emscripten C++ → WASM コンパイル
#   z80asm     Z80 アセンブラ (BIOS・テストバイナリ生成)
#   cmake      ネイティブ Linux バイナリビルド
#   make       Makefile 実行
#   node       Node.js (Vitest 実行)
#   npm        パッケージ管理 (Vitest インストール)
#
# 終了コード: 0 = 全ツール OK、1 = 不足あり
#
# 実行手順:
#   cd ~/36-soft-FPGA
#   bash doCheckDeps.sh

set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doCheckDeps.sh [-h]

ビルド・テストに必要なツールが揃っているか確認する。

確認対象:
  verilator  RTL → C++ 変換
  em++       Emscripten C++ → WASM コンパイル
  z80asm     Z80 アセンブラ (BIOS・テストバイナリ生成)
  cmake      ネイティブ Linux バイナリビルド
  make       Makefile 実行
  node       Node.js (Vitest 実行)
  npm        パッケージ管理 (Vitest インストール)

終了コード: 0 = 全ツール OK、1 = 不足あり

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

# ANSI カラー
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

ok=0
ng=0

check() {
    local name="$1"
    local cmd="$2"
    local hint="$3"
    local ver

    # head -1 で broken pipe が出ないよう { read -r ver; cat>/dev/null; } で吸収する
    if ver=$(eval "${cmd}" 2>/dev/null | { read -r line; echo "${line}"; cat > /dev/null; }); then
        printf "  ${GREEN}OK${RESET}  %-12s %s\n" "${name}" "${ver}"
        (( ok++ )) || true
    else
        printf "  ${RED}NG${RESET}  %-12s — 未インストール  ${YELLOW}${hint}${RESET}\n" "${name}"
        (( ng++ )) || true
    fi
}

echo "======================================================================"
echo " 依存ツール確認"
echo "======================================================================"
echo ""

check "verilator" \
    "verilator --version" \
    "apt install verilator  または  https://verilator.org"

check "em++" \
    "em++ --version" \
    "source ~/emsdk/emsdk_env.sh  または  https://emscripten.org/docs/getting_started"

check "z80asm" \
    "z80asm --version" \
    "apt install z80asm"

check "cmake" \
    "cmake --version" \
    "apt install cmake"

check "make" \
    "make --version" \
    "apt install make"

check "node" \
    "node --version" \
    "https://nodejs.org  または  apt install nodejs"

check "npm" \
    "npm --version" \
    "apt install npm"

echo ""
echo "  合計: $((ok + ng)) 件  OK: ${ok}  NG: ${ng}"
echo "======================================================================"

if (( ng > 0 )); then
    echo ""
    printf "${RED}[結果] ${ng} 件のツールが不足しています${RESET}\n"
    exit 1
else
    echo ""
    printf "${GREEN}[結果] 全 ${ok} 件 OK — ビルド可能です${RESET}\n"
    exit 0
fi
