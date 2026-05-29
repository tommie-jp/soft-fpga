#!/usr/bin/env bash
# scripts/check-pages-deploy.sh — GitHub Pages デプロイ確認スクリプト
#
# 使い方:
#   scripts/check-pages-deploy.sh [--sha <commit_sha>] [--timeout <seconds>]
#
# 処理:
#   フェーズ 1: GitHub Deployments API をポーリングしてデプロイ完了を待つ
#   フェーズ 2: curl で主要 URL の HTTP 200 を確認（スモークテスト）
#   フェーズ 3: Playwright で CP/M ターミナルの A> プロンプトを確認
#
# 前提:
#   - gh CLI がインストール済み（未インストールの場合はフェーズ1をスキップ）
#   - .venv に playwright がインストール済み（未インストールの場合はフェーズ3をスキップ）
#
# 終了コード: 0 = 全フェーズ合格, 1 = いずれかのフェーズが失敗

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── ANSI カラー ──────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

# ── 定数 ─────────────────────────────────────────────────────────────────────
REPO="tommie-jp/soft-fpga"
PAGES_BASE="https://tommie-jp.github.io/soft-fpga"
# 実体は examples/06-8080/web/ に配置（js/ の相対パスがローカル開発と一致するため）
# 旧 URL 06-8080/ はリダイレクトで転送
PAGES_URL="${PAGES_BASE}/examples/06-8080/web/"
VENV="${PROJECT_ROOT}/.venv"
CPM_BOOT_TIMEOUT=60   # GitHub Pages 経由での A> 待ち（秒）

SMOKE_URLS=(
    "${PAGES_BASE}/"
    "${PAGES_BASE}/examples/06-8080/web/"
    "${PAGES_BASE}/js/rtlscope-la.js"
    "${PAGES_BASE}/js/xterm-jp106.js"
    "${PAGES_BASE}/js/monaco-wasm-editor.js"
    "${PAGES_BASE}/js/sft-8080-sim-api.js"
    "${PAGES_BASE}/js/sft-8080-worker-bridge.js"
)

# ── 引数解析 ─────────────────────────────────────────────────────────────────
TARGET_SHA=""
TIMEOUT=180
while [[ $# -gt 0 ]]; do
    case "$1" in
        --sha)     TARGET_SHA="$2"; shift 2 ;;
        --timeout) TIMEOUT="$2";    shift 2 ;;
        *)         shift ;;
    esac
done

# ── ヘルパー ─────────────────────────────────────────────────────────────────
ok()   { printf "    ${GREEN}✓${RESET}  %s\n" "$*"; }
fail() { printf "    ${RED}✗${RESET}  %s\n" "$*"; }
info() { printf "    %s\n" "$*"; }
warn() { printf "    ${YELLOW}⚠${RESET}  %s\n" "$*"; }
step() { printf "\n  ${CYAN}%s${RESET}\n" "$*"; }

overall_ok=true

# ════════════════════════════════════════════════════════════════════════════
# フェーズ 1: GitHub Deployments API ポーリング
# ════════════════════════════════════════════════════════════════════════════
step "フェーズ1: デプロイ状態確認"

if ! command -v gh &>/dev/null; then
    warn "gh CLI が見つかりません — フェーズ1をスキップします"
    phase1_ok=true
else
    phase1_ok=false
    deploy_id=""

    # --- デプロイ ID の探索（最大 60 秒）---
    if [[ -n "$TARGET_SHA" ]]; then
        info "デプロイ ID を検索中 (SHA: ${TARGET_SHA})..."
    else
        info "デプロイ ID を検索中 (最新)..."
    fi

    id_deadline=$(( $(date +%s) + 60 ))
    while [[ $(date +%s) -lt $id_deadline ]]; do
        json=$(gh api "repos/${REPO}/deployments?environment=github-pages&per_page=5" 2>/dev/null || echo "[]")
        if [[ -n "$TARGET_SHA" ]]; then
            deploy_id=$(python3 - <<EOF
import sys, json
data = json.loads("""${json}""")
sha = "${TARGET_SHA}"
for d in data:
    if d['sha'].startswith(sha):
        print(d['id']); break
EOF
)
        else
            deploy_id=$(python3 - <<EOF
import sys, json
data = json.loads("""${json}""")
if data: print(data[0]['id'])
EOF
)
        fi
        [[ -n "$deploy_id" ]] && break
        sleep 3
    done

    # SHA 一致するデプロイが見つからない場合は最新デプロイにフォールバック
    if [[ -z "$deploy_id" && -n "$TARGET_SHA" ]]; then
        warn "SHA ${TARGET_SHA} に一致するデプロイが見つかりません — 最新デプロイで代替します"
        fallback_json=$(gh api "repos/${REPO}/deployments?environment=github-pages&per_page=1" 2>/dev/null || echo "[]")
        deploy_id=$(python3 - <<EOF
import sys, json
data = json.loads("""${fallback_json}""")
if data: print(data[0]['id'])
EOF
)
    fi

    if [[ -z "$deploy_id" ]]; then
        fail "デプロイ ID が見つかりません (SHA: ${TARGET_SHA:-指定なし})"
        overall_ok=false
        phase1_ok=false
    else
        info "デプロイ #${deploy_id} を検出"

        # --- ステータスポーリング ---
        start=$(date +%s)
        deadline=$(( start + TIMEOUT ))
        prev_state=""
        while [[ $(date +%s) -lt $deadline ]]; do
            elapsed=$(( $(date +%s) - start ))
            state=$(gh api "repos/${REPO}/deployments/${deploy_id}/statuses?per_page=1" 2>/dev/null \
                | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['state'] if d else 'pending')" \
                2>/dev/null || echo "pending")

            if [[ "$state" != "$prev_state" ]]; then
                prev_state="$state"
                case "$state" in
                    success)
                        ok "success  (${elapsed}s)"
                        phase1_ok=true
                        break
                        ;;
                    failure|error)
                        fail "state=${state}  (${elapsed}s)"
                        info "詳細: https://github.com/${REPO}/deployments"
                        overall_ok=false
                        break
                        ;;
                    *)
                        printf "    ⏳ %-14s (%ds)\n" "$state" "$elapsed"
                        ;;
                esac
            fi
            sleep 5
        done

        if [[ "$phase1_ok" == false && "$overall_ok" == true ]]; then
            fail "タイムアウト (${TIMEOUT}s) — デプロイがまだ完了していません"
            overall_ok=false
        fi
    fi
fi

# ════════════════════════════════════════════════════════════════════════════
# フェーズ 2: URL スモークテスト (curl)
# ════════════════════════════════════════════════════════════════════════════
step "フェーズ2: URL スモークテスト"

smoke_ok=true
for url in "${SMOKE_URLS[@]}"; do
    # GitHub Pages のキャッシュを避けるため Cache-Control: no-cache で叩く
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
        -H "Cache-Control: no-cache" \
        --max-time 15 "$url" 2>/dev/null || echo "000")
    label="${url#${PAGES_BASE}}"
    if [[ "$http_code" == "200" ]]; then
        ok "${http_code}  ${label}"
    else
        fail "${http_code}  ${label}"
        smoke_ok=false
        overall_ok=false
    fi
done

# ════════════════════════════════════════════════════════════════════════════
# フェーズ 3: CP/M ターミナル "A>" 確認 (Playwright)
# ════════════════════════════════════════════════════════════════════════════
step "フェーズ3: CP/M ターミナル確認 (Playwright / A> プロンプト)"

SMOKE_PY="${SCRIPT_DIR}/smoke_cpm_boot.py"

if [[ ! -x "${VENV}/bin/python3" ]]; then
    warn ".venv が見つかりません — フェーズ3をスキップします"
    warn "セットアップ: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    warn "           && .venv/bin/playwright install chromium"
elif [[ "$smoke_ok" == false ]]; then
    warn "フェーズ2 でエラーがあるためフェーズ3をスキップします"
else
    set +e
    "${VENV}/bin/python3" "${SMOKE_PY}" "${PAGES_URL}" "${CPM_BOOT_TIMEOUT}" 2>&1 | sed 's/^/  /'
    py_exit=$?
    set -e

    case $py_exit in
        0) : ;;   # ok() は smoke_cpm_boot.py が出力済み
        2) warn "playwright 未インストール — フェーズ3をスキップします" ;;
        *) fail "A> プロンプトが表示されませんでした"; overall_ok=false ;;
    esac
fi

# ════════════════════════════════════════════════════════════════════════════
# 結果サマリー
# ════════════════════════════════════════════════════════════════════════════
echo ""
if [[ "$overall_ok" == true ]]; then
    printf "${GREEN}  ✓ デプロイ確認 完了${RESET}\n"
    exit 0
else
    printf "${RED}  ✗ デプロイ確認 失敗${RESET}\n"
    exit 1
fi
