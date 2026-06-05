#!/bin/bash
# scripts/_doTimingSSPDP11.sh — PDP-11 / Unix V6 全命令タイミング図スクリーンショット生成
#
# verif/web/test_timing_ss_pdp11.py を実行して test/ss/pdp11/timing-*/ に PNG を保存する。
# doTest.sh から直接呼び出すか、単独で実行する。
#
# 使い方:
#   bash scripts/_doTimingSSPDP11.sh              # 全 55 ケース
#   bash scripts/_doTimingSSPDP11.sh -k "nop"     # フィルタ実行
#   bash scripts/_doTimingSSPDP11.sh -k "mov-r-r or clr-r or add-r-r"
#
# 前提:
#   - .venv が作成済み (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)
#   - .venv/bin/playwright install chromium 実行済み
#   - examples/09-pdp11/web/sim.wasm が最新ビルド済み（scripts/build-wasm-09.sh）
#   - examples/09-pdp11/web/disk/unix_v6_rk05.dsk が配置済み（クリーンディスク）
#   - ポート 8080 が空いていること
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT=8080
PID_FILE="/tmp/sft-pdp11-timing-ss-httpd.pid"
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
    > /tmp/sft-pdp11-timing-ss-httpd.log 2>&1 &
echo $! > "${PID_FILE}"

# サーバー起動を待つ（最大 3 秒）
for i in $(seq 1 10); do
    if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then break; fi
    sleep 0.3
done

echo "Playwright テスト実行 (test_timing_ss_pdp11.py)..."
echo "出力先: ${PROJECT_ROOT}/test/ss/pdp11/timing-*/"
echo ""

# 追加の pytest 引数（-k フィルタなど）をそのまま渡す
"${VENV}/bin/pytest" \
    "${PROJECT_ROOT}/verif/web/test_timing_ss_pdp11.py" \
    -v \
    --base-url "http://localhost:${PORT}/examples/09-pdp11/web/index.html" \
    --browser chromium \
    "$@"

echo ""
echo "スクリーンショット保存先: ${PROJECT_ROOT}/test/ss/pdp11/"
ls "${PROJECT_ROOT}/test/ss/pdp11/" 2>/dev/null | tail -5 || true

echo ""
echo "ギャラリー生成中..."
"${VENV}/bin/python" "${SCRIPT_DIR}/gen-timing-ss-index.py"
