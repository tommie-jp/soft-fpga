#!/bin/bash
# scripts/_doTestAll-web.sh — Web 統合テスト (Playwright headless Chromium)
# doTest.sh [06] から呼び出される内部スクリプト。
#
# 前提:
#   - .venv が作成済み (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)
#   - .venv/bin/playwright install chromium 実行済み
#   - examples/04-6502/web/sim.wasm が最新ビルド済み
#   - examples/06-8080/web/sim.wasm が最新ビルド済み
#   - ポート 8080 が空いていること
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT=8080
PID_FILE="/tmp/sft-web-test-httpd.pid"
VENV="${PROJECT_ROOT}/.venv"

cleanup() {
    if [[ -f "${PID_FILE}" ]]; then
        kill "$(cat "${PID_FILE}")" 2>/dev/null || true
        rm -f "${PID_FILE}"
    fi
}
trap cleanup EXIT

# .venv が存在するか確認
if [[ ! -x "${VENV}/bin/pytest" ]]; then
    echo "エラー: .venv が見つかりません。" >&2
    echo "  python3 -m venv .venv" >&2
    echo "  .venv/bin/pip install -r requirements.txt" >&2
    echo "  .venv/bin/playwright install chromium" >&2
    exit 1
fi

echo "01---HTTP サーバー起動 (ポート ${PORT})..."
python3 -m http.server "${PORT}" --directory "${PROJECT_ROOT}" \
    > /tmp/sft-httpd.log 2>&1 &
echo $! > "${PID_FILE}"

# サーバー起動を待つ
for i in $(seq 1 10); do
    if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then break; fi
    sleep 0.3
done

# テスト結果を集計するための変数
RESULT_6502=0
RESULT_8080=0
RESULT_PDP11=0

echo ""
echo "02---Playwright テスト実行 (04-6502 Apple-I)..."
"${VENV}/bin/pytest" "${PROJECT_ROOT}/verif/web/test_apple1.py" -v \
    --base-url "http://localhost:${PORT}/examples/04-6502/web/index.html" \
    --browser chromium \
    || RESULT_6502=$?

echo ""
echo "03---Playwright テスト実行 (06-8080 CP/M WASM)..."
"${VENV}/bin/pytest" "${PROJECT_ROOT}/verif/web/test_8080.py" -v \
    --base-url "http://localhost:${PORT}/examples/06-8080/web/index.html" \
    --browser chromium \
    || RESULT_8080=$?

echo ""
echo "04---Playwright テスト実行 (09-PDP-11 Unix V6)..."
"${VENV}/bin/pytest" "${PROJECT_ROOT}/verif/web/test_pdp11.py" -v \
    --base-url "http://localhost:${PORT}/examples/09-pdp11/web/index.html" \
    --browser chromium \
    || RESULT_PDP11=$?

# 終了コード: いずれかが失敗していたら 1
if [[ "${RESULT_6502}" -ne 0 ]] || [[ "${RESULT_8080}" -ne 0 ]] || [[ "${RESULT_PDP11}" -ne 0 ]]; then
    echo ""
    echo "Web テストに失敗があります: 04-6502=${RESULT_6502}  06-8080=${RESULT_8080}  09-PDP11=${RESULT_PDP11}"
    exit 1
fi
echo ""
echo "Web テスト全件 PASS"
