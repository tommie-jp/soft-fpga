#!/bin/bash
# scripts/_test-8080-sim-api.sh — sim API ブラウザ統合テスト
# doTest.sh [07] から呼び出される内部スクリプト。
#
# 対象テスト: verif/web/test_8080.py::TestSimAPI
#   - test_mvi_a_ff : MVI A,$FF を sim API で実行し A=0xFF を検証
#
# 前提:
#   - .venv が作成済み (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)
#   - .venv/bin/playwright install chromium 実行済み
#   - examples/06-8080/web/sim.wasm が最新ビルド済み
#   - ポート 8080 が空いていること
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT=8080
PID_FILE="/tmp/sft-sim-api-httpd.pid"
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

echo "HTTP サーバー起動 (ポート ${PORT})..."
python3 -m http.server "${PORT}" --directory "${PROJECT_ROOT}" \
    > /tmp/sft-sim-api-httpd.log 2>&1 &
echo $! > "${PID_FILE}"

# サーバー起動を待つ（最大 3 秒）
for i in $(seq 1 10); do
    if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then break; fi
    sleep 0.3
done

echo "Playwright テスト実行 (TestSimAPI)..."
"${VENV}/bin/pytest" \
    "${PROJECT_ROOT}/verif/web/test_8080.py::TestSimAPI" \
    -v \
    --base-url "http://localhost:${PORT}/examples/06-8080/web/index.html" \
    --browser chromium
