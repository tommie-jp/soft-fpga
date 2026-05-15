#!/bin/bash
# web 版統合テスト — Playwright headless Chromium で Wasm ビルドを検証する
# doTestAll.sh のホスト側テストに対応する web 版。
#
# 前提:
#   - .venv が作成済み (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)
#   - .venv/bin/playwright install chromium 実行済み
#   - examples/04-6502/web/sim.wasm が最新ビルド済み
#   - ポート 8080 が空いていること
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
PID_FILE="/tmp/sft-web-test-httpd.pid"
VENV="${SCRIPT_DIR}/.venv"

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
python3 -m http.server "${PORT}" --directory "${SCRIPT_DIR}" \
    > /tmp/sft-httpd.log 2>&1 &
echo $! > "${PID_FILE}"

# サーバー起動を待つ
for i in $(seq 1 10); do
    if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then break; fi
    sleep 0.3
done

echo ""
echo "02---Playwright テスト実行 (04-6502 Apple-I)..."
"${VENV}/bin/pytest" "${SCRIPT_DIR}/verif/web/" -v \
    --base-url "http://localhost:${PORT}/examples/04-6502/web/index.html" \
    --browser chromium
