#!/bin/bash
# 手動確認用 HTTP サーバー（Ctrl+C で停止）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=${1:-8080}
TARGET="http://localhost:${PORT}/examples/04-6502/web/index.html"

echo "HTTP サーバー起動中 (ポート ${PORT}) — Ctrl+C で停止"
echo "URL: ${TARGET}"

# ブラウザを自動で開く（xdg-open / wslview / open に対応）
if command -v wslview &>/dev/null; then
    wslview "${TARGET}" 2>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open "${TARGET}" 2>/dev/null &
elif command -v open &>/dev/null; then
    open "${TARGET}" 2>/dev/null &
fi

python3 -m http.server "${PORT}" --directory "${SCRIPT_DIR}"
