#!/usr/bin/env bash
# doDeployAll.sh — examples/06-8080 をビルドして GitHub Pages にデプロイする
#
# 処理内容:
#   1. doBuildAll.sh — 全成果物をビルド
#   2. scripts/doDeployPages.sh --no-build 06 — gh-pages ブランチへデプロイ
#   3. scripts/check-pages-deploy.sh — デプロイ完了・動作確認
#      フェーズ1: GitHub Deployments API でデプロイ成否を確認
#      フェーズ2: curl で主要 URL の HTTP 200 を確認
#      フェーズ3: Playwright で CP/M ターミナルの A> プロンプトを確認
#
# 前提条件:
#   - git remote "origin" が設定済みで push 権限があること
#   - Verilator・Emscripten (emsdk)・z80asm・cmake が利用可能なこと
#   - gh CLI がインストール済み（なければフェーズ1をスキップ）
#   - .venv に playwright がインストール済み（なければフェーズ3をスキップ）
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
RED='\033[0;31m'
RESET='\033[0m'

echo "======================================================================"
echo " デプロイ: examples/06-8080 → GitHub Pages"
echo "======================================================================"
echo ""

# ---------------------------------------------------------------------------
# Step 1: 全ビルド
# ---------------------------------------------------------------------------
printf "${CYAN}[1/3]${RESET} ビルド (doBuildAll.sh)\n\n"
bash "${SCRIPT_DIR}/doBuildAll.sh"
echo ""

# ---------------------------------------------------------------------------
# Step 2: GitHub Pages へデプロイ
# ---------------------------------------------------------------------------
printf "${CYAN}[2/3]${RESET} GitHub Pages デプロイ (scripts/doDeployPages.sh --no-build 06)\n\n"
bash "${SCRIPT_DIR}/scripts/doDeployPages.sh" --no-build 06
echo ""

# push 直後の gh-pages ブランチ HEAD を取得（フェーズ1 でデプロイを特定するため）
GH_SHA=$(git ls-remote origin gh-pages 2>/dev/null | cut -c1-7 || true)

# ---------------------------------------------------------------------------
# Step 3: デプロイ確認
# ---------------------------------------------------------------------------
printf "${CYAN}[3/3]${RESET} デプロイ確認 (scripts/check-pages-deploy.sh)\n"

CHECK_ARGS=("--timeout" "180")
[[ -n "$GH_SHA" ]] && CHECK_ARGS+=("--sha" "$GH_SHA")

if bash "${SCRIPT_DIR}/scripts/check-pages-deploy.sh" "${CHECK_ARGS[@]}"; then
    echo ""
    printf "${GREEN}[完了] デプロイ完了・動作確認済み ✓${RESET}\n"
else
    echo ""
    printf "${RED}[失敗] デプロイに問題があります。上記のエラーを確認してください。${RESET}\n"
    exit 1
fi
