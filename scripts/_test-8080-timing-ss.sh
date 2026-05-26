#!/bin/bash
# scripts/_test-8080-timing-ss.sh — 8080 全命令タイミング図スクリーンショット生成
#
# verif/web/test_timing_ss.py を実行して test/ss/timing/ に PNG を保存する。
# doTest.sh から直接呼び出すか、単独で実行する。
#
# 使い方:
#   bash scripts/_test-8080-timing-ss.sh            # 全 73 ケース
#   bash scripts/_test-8080-timing-ss.sh -k "nop"   # フィルタ実行
#   bash scripts/_test-8080-timing-ss.sh -k "00_nop or 20_mvi_a_ff or 56_xthl"
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
PID_FILE="/tmp/sft-timing-ss-httpd.pid"
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
    > /tmp/sft-timing-ss-httpd.log 2>&1 &
echo $! > "${PID_FILE}"

# サーバー起動を待つ（最大 3 秒）
for i in $(seq 1 10); do
    if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then break; fi
    sleep 0.3
done

echo "Playwright テスト実行 (test_timing_ss.py)..."
echo "出力先: ${PROJECT_ROOT}/test/ss/8080/timing-*/"
echo ""

# 追加の pytest 引数（-k フィルタなど）をそのまま渡す
"${VENV}/bin/pytest" \
    "${PROJECT_ROOT}/verif/web/test_timing_ss.py" \
    -v \
    --base-url "http://localhost:${PORT}/examples/06-8080/web/index.html" \
    --browser chromium \
    "$@"

echo ""
echo "スクリーンショット保存先: ${PROJECT_ROOT}/test/ss/8080/"
ls "${PROJECT_ROOT}/test/ss/8080/" 2>/dev/null | tail -5 || true
