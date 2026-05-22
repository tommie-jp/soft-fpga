#!/usr/bin/env bash
# doServe06.sh — 06-8080 CP/M シミュレーターをブラウザで開く
#
# 使い方:
#   bash doServe06.sh          ポート 8080 で起動
#   bash doServe06.sh 9090     ポートを指定
#
# 前提: doBuildAll.sh で WASM ビルド済みであること

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=${1:-8080}
TARGET="http://localhost:${PORT}/examples/06-8080/web/index.html"

# WASM ビルド済み確認
if [[ ! -f "${SCRIPT_DIR}/examples/06-8080/web/sim.wasm" ]]; then
    echo "エラー: sim.wasm が見つかりません。先にビルドしてください。" >&2
    echo "  bash doBuildAll.sh" >&2
    exit 1
fi

echo "HTTP サーバー起動中 (ポート ${PORT}) — Ctrl+C で停止"
echo "URL: ${TARGET}"
echo ""

# ブラウザを自動で開く（WSL / Linux / macOS 対応）
if command -v wslview &>/dev/null; then
    wslview "${TARGET}" 2>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open "${TARGET}" 2>/dev/null &
elif command -v open &>/dev/null; then
    open "${TARGET}" 2>/dev/null &
fi

python3 -m http.server "${PORT}" --directory "${SCRIPT_DIR}"
