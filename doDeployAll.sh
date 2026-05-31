#!/usr/bin/env bash
# doDeployAll.sh — examples/06-8080 をビルドして GitHub Pages にデプロイする
#
# 処理内容:
#   1. doBuildAll.sh — 全成果物をビルド
#   2. gen-timing-ss-index.py — タイミング図ギャラリー再生成
#   3. scripts/doDeployPages.sh --no-build 06 — gh-pages ブランチへデプロイ
#   4. scripts/check-pages-deploy.sh — デプロイ完了・動作確認
#      フェーズ1: GitHub Deployments API でデプロイ成否を確認
#      フェーズ2: curl で主要 URL の HTTP 200 を確認
#      フェーズ3: Playwright で CP/M ターミナルの A> プロンプトを確認
#      フェーズ4: 内部リンク切れチェック
#   5. scripts/check-gallery-links.py — ギャラリー参照 URL リンクチェック
#      test/ss/8080/index.html が参照する PNG・viewer.html を GitHub Pages で確認
#
# 前提条件:
#   - git remote "origin" が設定済みで push 権限があること
#   - Verilator・Emscripten (emsdk)・z80asm・cmake が利用可能なこと
#   - gh CLI がインストール済み（なければフェーズ1をスキップ）
#   - .venv に playwright がインストール済み（なければフェーズ3をスキップ）
#
# 終了コード: 0 = 成功、1 = 失敗
#
# 実行手順:
#   cd ~/36-soft-FPGA
#   bash doDeployAll.sh

set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doDeployAll.sh [-y] [--no-build] [--no-gallery] [--no-deploy] [--no-check] [--no-gallery-check]

examples/06-8080 をビルドして GitHub Pages にデプロイする。

処理内容:
  1. doBuildAll.sh                           全成果物をビルド
  2. gen-timing-ss-index.py                  タイミング図ギャラリー再生成
  3. scripts/doDeployPages.sh --no-build 06  gh-pages ブランチへデプロイ
  4. scripts/check-pages-deploy.sh           デプロイ完了・動作確認
     フェーズ1: GitHub Deployments API でデプロイ成否を確認
     フェーズ2: curl で主要 URL の HTTP 200 を確認
     フェーズ3: Playwright で CP/M ターミナルの A> プロンプトを確認
     フェーズ4: 内部リンク切れチェック
  5. scripts/check-gallery-links.py          ギャラリーリンクチェック
     test/ss/8080/index.html が参照する PNG・viewer.html を GitHub Pages で確認

前提条件:
  - git remote "origin" が設定済みで push 権限があること
  - Verilator・Emscripten (emsdk)・z80asm・cmake が利用可能なこと
  - gh CLI がインストール済み（なければフェーズ1をスキップ）
  - .venv に playwright がインストール済み（なければフェーズ3をスキップ）

終了コード: 0 = 成功、1 = 失敗

オプション:
  -y, --yes              確認プロンプトをスキップ（CI 等での自動実行用）
  --no-build             ステップ1 ビルドをスキップ
  --no-gallery           ステップ2 ギャラリー再生成をスキップ
  --no-deploy            ステップ3 GitHub Pages デプロイをスキップ
  --no-check             ステップ4 デプロイ確認をスキップ
  --no-gallery-check     ステップ5 ギャラリーリンクチェックをスキップ
  -h, --help             このヘルプを表示して終了

使用例:
  # チェックのみ再実行（ビルド・ギャラリー・デプロイをスキップ）
  doDeployAll.sh --no-build --no-gallery --no-deploy

  # ビルドとギャラリーを済ませてからデプロイと確認だけ
  doDeployAll.sh --no-build --no-gallery

  # CI 向けに確認プロンプトなしで全ステップ実行
  doDeployAll.sh -y
EOF
}

# ── 引数解析 ──────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_GALLERY=false
SKIP_DEPLOY=false
SKIP_CHECK=false
SKIP_GALLERY_CHECK=false
YES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)           usage; exit 0 ;;
        -y|--yes)            YES=true;                shift ;;
        --no-build)          SKIP_BUILD=true;         shift ;;
        --no-gallery)        SKIP_GALLERY=true;       shift ;;
        --no-deploy)         SKIP_DEPLOY=true;        shift ;;
        --no-check)          SKIP_CHECK=true;         shift ;;
        --no-gallery-check)  SKIP_GALLERY_CHECK=true; shift ;;
        *) echo "不明なオプション: $1" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 定数 ─────────────────────────────────────────────────────────────────────
PAGES_BASE="https://tommie-jp.github.io/soft-fpga"
GALLERY_HTML="${SCRIPT_DIR}/test/ss/8080/index.html"
GALLERY_PAGE_URL="${PAGES_BASE}/test/ss/8080/index.html"

# ── ANSI カラー ───────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

echo "======================================================================"
echo " デプロイ: examples/06-8080 → GitHub Pages"
echo "======================================================================"
echo ""

# ── 確認プロンプト（デプロイを含む場合のみ）────────────────────────────────
if [[ "$SKIP_DEPLOY" == false ]]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "不明")
    REMOTE=$(git remote get-url origin 2>/dev/null || echo "不明")
    printf "${RED}警告: GitHub Pages への公開デプロイを実行します。${RESET}\n"
    echo "  ブランチ : ${BRANCH}"
    echo "  リモート : ${REMOTE}"
    echo ""
    if [[ "$YES" == false ]]; then
        read -r -p "続行しますか？ [y/N] " REPLY
        if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
            echo "キャンセルしました。"
            exit 0
        fi
    else
        echo "  (-y 指定のため自動承認)"
    fi
    echo ""
fi

# ── ステップ表示ヘルパー ──────────────────────────────────────────────────────
step_header() {
    local num="$1" label="$2" skipped="$3"
    if [[ "$skipped" == true ]]; then
        printf "${CYAN}[%s/5]${RESET} %s → ${YELLOW}スキップ${RESET}\n\n" "$num" "$label"
    else
        printf "${CYAN}[%s/5]${RESET} %s\n\n" "$num" "$label"
    fi
}

# ---------------------------------------------------------------------------
# ステップ 1: 全ビルド
# ---------------------------------------------------------------------------
step_header 1 "ビルド (doBuildAll.sh)" "$SKIP_BUILD"
if [[ "$SKIP_BUILD" == false ]]; then
    bash "${SCRIPT_DIR}/doBuildAll.sh"
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 2: タイミング図ギャラリー再生成
# ---------------------------------------------------------------------------
step_header 2 "タイミング図ギャラリー再生成 (gen-timing-ss-index.py)" "$SKIP_GALLERY"
if [[ "$SKIP_GALLERY" == false ]]; then
    if [[ -d "${SCRIPT_DIR}/test/ss/8080" ]]; then
        python3 "${SCRIPT_DIR}/scripts/gen-timing-ss-index.py"
    else
        echo "  test/ss/8080/ が存在しないためスキップ"
    fi
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 3: GitHub Pages へデプロイ
# ---------------------------------------------------------------------------
step_header 3 "GitHub Pages デプロイ (scripts/doDeployPages.sh --no-build 06)" "$SKIP_DEPLOY"
if [[ "$SKIP_DEPLOY" == false ]]; then
    bash "${SCRIPT_DIR}/scripts/doDeployPages.sh" --no-build 06
    echo ""
fi

# push 直後の gh-pages ブランチ HEAD を取得（確認フェーズ1 でデプロイを特定するため）
GH_SHA=$(git ls-remote origin gh-pages 2>/dev/null | cut -c1-7 || true)

# ---------------------------------------------------------------------------
# ステップ 4: デプロイ確認
# ---------------------------------------------------------------------------
step_header 4 "デプロイ確認 (scripts/check-pages-deploy.sh)" "$SKIP_CHECK"
if [[ "$SKIP_CHECK" == false ]]; then
    CHECK_ARGS=("--timeout" "180")
    [[ -n "$GH_SHA" ]] && CHECK_ARGS+=("--sha" "$GH_SHA")

    if bash "${SCRIPT_DIR}/scripts/check-pages-deploy.sh" "${CHECK_ARGS[@]}"; then
        echo ""
        printf "${GREEN}✓ デプロイ確認 完了${RESET}\n"
    else
        echo ""
        printf "${RED}✗ デプロイに問題があります。上記のエラーを確認してください。${RESET}\n"
        exit 1
    fi
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 5: ギャラリーリンクチェック
# ---------------------------------------------------------------------------
step_header 5 "ギャラリーリンクチェック (scripts/check-gallery-links.py)" "$SKIP_GALLERY_CHECK"
if [[ "$SKIP_GALLERY_CHECK" == false ]]; then
    if [[ ! -f "${GALLERY_HTML}" ]]; then
        printf "  ${YELLOW}⚠${RESET}  ${GALLERY_HTML} が存在しないためスキップ\n"
    else
        set +e
        python3 "${SCRIPT_DIR}/scripts/check-gallery-links.py" \
            "${GALLERY_HTML}" "${GALLERY_PAGE_URL}" 2>&1 | sed 's/^/  /'
        gc_exit=${PIPESTATUS[0]}
        set -e

        echo ""
        if [[ $gc_exit -ne 0 ]]; then
            printf "${RED}✗ ギャラリーリンクに問題があります。${RESET}\n"
            exit 1
        else
            printf "${GREEN}✓ ギャラリーリンクチェック 完了${RESET}\n"
        fi
    fi
    echo ""
fi

printf "${GREEN}[完了] 全ステップ正常終了 ✓${RESET}\n"
