#!/bin/bash
# 手動確認用 HTTP サーバー（Ctrl+C で停止）
set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doServe.sh [-h] [ポート番号]

Apple-I (04-6502) の WASM 版をブラウザで開くための HTTP サーバーを起動する。

引数:
  ポート番号  省略時は 8080

例:
  ./doServe.sh          # ポート 8080 で起動
  ./doServe.sh 9090     # ポート 9090 で起動

終了: Ctrl+C

オプション:
  -h, --help  このヘルプを表示して終了
EOF
}

PORT=8080
for arg in "$@"; do
    case "$arg" in
        -h|--help) usage; exit 0 ;;
        [0-9]*) PORT="$arg" ;;
        *) echo "不明なオプション: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
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
