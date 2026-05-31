#!/usr/bin/env bash
# doServe06.sh — 06-8080 CP/M シミュレーターをブラウザで開く
#
# 使い方:
#   bash doServe06.sh          ポート 8080 で起動（既存プロセスがあればエラー）
#   bash doServe06.sh --kill   既存サーバーを終了してから再起動
#   bash doServe06.sh 9090     ポートを指定して起動
#
# 前提: doBuildAll.sh で WASM ビルド済みであること

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 引数解析
KILL_FIRST=false
PORT=8080
for arg in "$@"; do
    case "$arg" in
        -h|--help)
            cat <<'EOF'
使い方:
  ./doServe06.sh [オプション] [ポート番号]

8080 CP/M シミュレーター (examples/06-8080) の WASM 版を
ブラウザで開くための HTTP サーバーを起動する。
前提: doBuildAll.sh で WASM ビルド済みであること。

オプション:
  -h, --help   このヘルプを表示して終了
  --kill       指定ポートを占有している既存サーバーを終了してから起動

引数:
  ポート番号   省略時は 8080

例:
  ./doServe06.sh               # ポート 8080 で起動
  ./doServe06.sh 9090          # ポート 9090 で起動
  ./doServe06.sh --kill        # 既存サーバーを止めてポート 8080 で再起動
  ./doServe06.sh --kill 9090   # 既存サーバーを止めてポート 9090 で再起動
EOF
            exit 0
            ;;
        --kill) KILL_FIRST=true ;;
        [0-9]*) PORT="$arg" ;;
        *) echo "不明なオプション: $arg" >&2; echo "  ./doServe06.sh -h でヘルプを表示" >&2; exit 1 ;;
    esac
done

TARGET="http://localhost:${PORT}/examples/06-8080/web/index.html"

# --kill: ポートを占有しているプロセスを終了
if [[ "$KILL_FIRST" == true ]]; then
    PIDS=$(lsof -i :"${PORT}" -t 2>/dev/null || true)
    if [[ -n "$PIDS" ]]; then
        echo "既存サーバー (PID: $PIDS) を終了します..."
        kill $PIDS 2>/dev/null || true
        # プロセスが消えるまで最大 3 秒待つ
        for i in $(seq 1 6); do
            sleep 0.5
            lsof -i :"${PORT}" -t &>/dev/null || break
        done
    else
        echo "ポート ${PORT} に既存プロセスはありません。"
    fi
fi

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

python3 "${SCRIPT_DIR}/scripts/serve_no_cache.py" "${PORT}" "${SCRIPT_DIR}"
