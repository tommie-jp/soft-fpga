#!/usr/bin/env bash
# doDeployAll.sh — examples/06-8080 をビルドして GitHub Pages にデプロイする
#
# 処理内容:
#   1. doBuildAll.sh — 全成果物をビルド
#   2. scripts/doDeployPages.sh --no-build 06 — gh-pages ブランチへデプロイ
#
# 前提条件:
#   - git remote "origin" が設定済みで push 権限があること
#   - Verilator・Emscripten (emsdk)・z80asm・cmake が利用可能なこと
#
# 終了コード: 0 = 成功、1 = 失敗
#
# 実行手順:
#   cd ~/36-soft-FPGA
#   bash doDeployAll.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ANSI カラー
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo "======================================================================"
echo " デプロイ: examples/06-8080 → GitHub Pages"
echo "======================================================================"
echo ""

# ---------------------------------------------------------------------------
# Step 1: 全ビルド
# ---------------------------------------------------------------------------
printf "${CYAN}[1/2]${RESET} ビルド (doBuildAll.sh)\n\n"
bash "${SCRIPT_DIR}/doBuildAll.sh"
echo ""

# ---------------------------------------------------------------------------
# Step 2: GitHub Pages へデプロイ
# ---------------------------------------------------------------------------
printf "${CYAN}[2/2]${RESET} GitHub Pages デプロイ (scripts/doDeployPages.sh --no-build 06)\n\n"
bash "${SCRIPT_DIR}/scripts/doDeployPages.sh" --no-build 06
echo ""

printf "${GREEN}[完了] デプロイ完了${RESET}\n"
