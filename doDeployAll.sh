#!/usr/bin/env bash
# doDeployAll.sh — examples/06-8080 と 09-pdp11 をビルドして GitHub Pages にデプロイする
#
# 処理内容:
#   1. doBuildAll.sh + build-wasm-09.sh — 全成果物をビルド
#   2. scripts/_doTimingSSPDP11.sh — PDP-11 全命令タイミング図 PNG 再生成
#   3. gen-timing-ss-index.py — タイミング図ギャラリー index 再生成
#   4. scripts/doDeployPages.sh --no-build 06 09 — gh-pages ブランチへデプロイ
#   5. scripts/check-pages-deploy.sh — デプロイ完了・動作確認
#      フェーズ1: GitHub Deployments API でデプロイ成否を確認
#      フェーズ2: curl で主要 URL の HTTP 200 を確認
#      フェーズ3: Playwright で CP/M ターミナルの A> プロンプトを確認
#      フェーズ4: 内部リンク切れチェック
#   6. scripts/check-gallery-links.py — ギャラリー参照 URL リンクチェック
#      test/ss/8080・pdp11/index.html が参照する PNG を GitHub Pages で確認
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
使い方: doDeployAll.sh [-y] [--no-build] [--no-timing-ss] [--no-gallery] [--no-deploy] [--no-check] [--no-gallery-check] [--no-qr-check]

examples/06-8080 と 09-pdp11 をビルドして GitHub Pages にデプロイする。

処理内容:
  1. doBuildAll.sh + build-wasm-09.sh        全成果物をビルド
  2. scripts/_doTimingSSPDP11.sh             PDP-11 全命令タイミング図 PNG 再生成
  3. gen-timing-ss-index.py                  タイミング図ギャラリー index 再生成
  4. scripts/doDeployPages.sh --no-build 06 09  gh-pages ブランチへデプロイ
  5. scripts/check-pages-deploy.sh           デプロイ完了・動作確認
     フェーズ1: GitHub Deployments API でデプロイ成否を確認
     フェーズ2: curl で主要 URL の HTTP 200 を確認
     フェーズ3: Playwright で CP/M ターミナルの A> プロンプトを確認
     フェーズ4: 内部リンク切れチェック
  6. scripts/check-gallery-links.py          ギャラリーリンクチェック
     test/ss/8080・pdp11/index.html が参照する PNG を GitHub Pages で確認
  7. scripts/check-pdp11-links.py            PDP-11 ローカルリンクチェック（デプロイ前）
     index.html・sim-worker.js・sft-pdp11-docs.js の参照ファイル存在確認と一貫性検証
  8. QR PNG 存在確認                          docs/09-PDP11/XX-QR.png が GitHub Pages で HTTP 200 か確認

前提条件:
  - git remote "origin" が設定済みで push 権限があること
  - Verilator・Emscripten (emsdk)・z80asm・cmake が利用可能なこと
  - gh CLI がインストール済み（なければフェーズ1をスキップ）
  - .venv に playwright がインストール済み（なければフェーズ3をスキップ）

終了コード: 0 = 成功、1 = 失敗

オプション:
  -y, --yes              no-op（確認プロンプトは廃止。後方互換のため受理のみ）
  --no-build             ステップ1 ビルドをスキップ
  --no-timing-ss         ステップ2 PDP-11 タイミングSS PNG 生成をスキップ
  --no-gallery           ステップ3 ギャラリー index 再生成をスキップ
  --no-deploy            ステップ4 GitHub Pages デプロイをスキップ
  --no-check             ステップ5 デプロイ確認をスキップ
  --no-gallery-check     ステップ6 ギャラリーリンクチェックをスキップ
  --no-pdp11-links       ステップ7 PDP-11 ローカルリンクチェックをスキップ
  --no-qr-check          ステップ8 QR PNG 存在確認をスキップ
  -h, --help             このヘルプを表示して終了

使用例:
  # チェックのみ再実行（ビルド・SS生成・ギャラリー・デプロイをスキップ）
  doDeployAll.sh --no-build --no-timing-ss --no-gallery --no-deploy

  # ビルドとSS生成を済ませてからデプロイと確認だけ
  doDeployAll.sh --no-build --no-timing-ss --no-gallery

  # 全ステップ実行（確認プロンプトなしでそのまま走る）
  doDeployAll.sh
EOF
}

# ── 引数解析 ──────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_TIMING_SS=false
SKIP_GALLERY=false
SKIP_DEPLOY=false
SKIP_CHECK=false
SKIP_GALLERY_CHECK=false
SKIP_PDP11_LINKS=false
SKIP_QR_CHECK=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)           usage; exit 0 ;;
        -y|--yes)            shift ;;  # 後方互換: 確認プロンプト廃止により no-op
        --no-build)          SKIP_BUILD=true;         shift ;;
        --no-timing-ss)      SKIP_TIMING_SS=true;     shift ;;
        --no-gallery)        SKIP_GALLERY=true;       shift ;;
        --no-deploy)         SKIP_DEPLOY=true;        shift ;;
        --no-check)          SKIP_CHECK=true;         shift ;;
        --no-gallery-check)  SKIP_GALLERY_CHECK=true;  shift ;;
        --no-pdp11-links)    SKIP_PDP11_LINKS=true;    shift ;;
        --no-qr-check)       SKIP_QR_CHECK=true;       shift ;;
        *) echo "不明なオプション: $1" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 定数 ─────────────────────────────────────────────────────────────────────
PAGES_BASE="https://tommie-jp.github.io/soft-fpga"
GALLERY_8080_HTML="${SCRIPT_DIR}/test/ss/8080/index.html"
GALLERY_8080_URL="${PAGES_BASE}/test/ss/8080/index.html"
GALLERY_PDP11_HTML="${SCRIPT_DIR}/test/ss/pdp11/index.html"
GALLERY_PDP11_URL="${PAGES_BASE}/test/ss/pdp11/index.html"

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

# ── デプロイ対象の表示（確認プロンプトは廃止: 常に続行）──────────────────────
if [[ "$SKIP_DEPLOY" == false ]]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "不明")
    REMOTE=$(git remote get-url origin 2>/dev/null || echo "不明")
    printf "${RED}警告: GitHub Pages への公開デプロイを実行します。${RESET}\n"
    echo "  ブランチ : ${BRANCH}"
    echo "  リモート : ${REMOTE}"
    echo ""
fi

# ── ステップ表示ヘルパー ──────────────────────────────────────────────────────
step_header() {
    local num="$1" label="$2" skipped="$3"
    if [[ "$skipped" == true ]]; then
        printf "${CYAN}[%s/8]${RESET} %s → ${YELLOW}スキップ${RESET}\n\n" "$num" "$label"
    else
        printf "${CYAN}[%s/8]${RESET} %s\n\n" "$num" "$label"
    fi
}

# ---------------------------------------------------------------------------
# ステップ 1: 全ビルド
# ---------------------------------------------------------------------------
step_header 1 "ビルド (make deploy-build = cpm-06 + wasm-09)" "$SKIP_BUILD"
if [[ "$SKIP_BUILD" == false ]]; then
    # ビルド層は Makefile に委譲。09 WASM はソース未変更ならスキップされ（差分ビルド）、
    # 06 はステートフルなため doBuildAll.sh をそのまま実行する。
    make -C "${SCRIPT_DIR}" deploy-build
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 2: PDP-11 タイミング図 PNG 再生成
# ---------------------------------------------------------------------------
step_header 2 "PDP-11 タイミング図 PNG 生成 (scripts/_doTimingSSPDP11.sh)" "$SKIP_TIMING_SS"
if [[ "$SKIP_TIMING_SS" == false ]]; then
    if [[ ! -x "${SCRIPT_DIR}/.venv/bin/pytest" ]]; then
        printf "  ${YELLOW}⚠${RESET}  .venv が見つからないためスキップ\n"
    else
        bash "${SCRIPT_DIR}/scripts/_doTimingSSPDP11.sh"

        # 最新 timing-*/ を docs/09-PDP11/img/timing/ にコピー
        _latest=$(ls -dt "${SCRIPT_DIR}/test/ss/pdp11/timing-"*/ 2>/dev/null | head -1 || true)
        if [[ -n "$_latest" ]]; then
            _img_dir="${SCRIPT_DIR}/docs/09-PDP11/img/timing"
            mkdir -p "$_img_dir"
            cp "${_latest}"*.png "$_img_dir/"
            printf "  ${GREEN}✓${RESET}  docs/09-PDP11/img/timing/ 更新 ← %s (%d 枚)\n" \
                "$(basename "$_latest")" "$(ls "$_img_dir"/*.png 2>/dev/null | wc -l)"
        fi
    fi
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 3: タイミング図ギャラリー index 再生成
# ---------------------------------------------------------------------------
step_header 3 "ギャラリー index 再生成 (gen-timing-ss-index.py)" "$SKIP_GALLERY"
if [[ "$SKIP_GALLERY" == false ]]; then
    if [[ -d "${SCRIPT_DIR}/test/ss/8080" ]]; then
        python3 "${SCRIPT_DIR}/scripts/gen-timing-ss-index.py"
    else
        echo "  test/ss/8080/ が存在しないためスキップ"
    fi
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 4: GitHub Pages へデプロイ
# ---------------------------------------------------------------------------
step_header 4 "GitHub Pages デプロイ (scripts/doDeployPages.sh --no-build 06 09)" "$SKIP_DEPLOY"
if [[ "$SKIP_DEPLOY" == false ]]; then
    bash "${SCRIPT_DIR}/scripts/doDeployPages.sh" --no-build 06 09
    echo ""
fi

# push 直後の gh-pages ブランチ HEAD を取得（確認フェーズ1 でデプロイを特定するため）
GH_SHA=$(git ls-remote origin gh-pages 2>/dev/null | cut -c1-7 || true)

# ---------------------------------------------------------------------------
# ステップ 5: デプロイ確認
# ---------------------------------------------------------------------------
step_header 5 "デプロイ確認 (scripts/check-pages-deploy.sh)" "$SKIP_CHECK"
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
# ステップ 6: ギャラリーリンクチェック
# ---------------------------------------------------------------------------
step_header 6 "ギャラリーリンクチェック (scripts/check-gallery-links.py)" "$SKIP_GALLERY_CHECK"
if [[ "$SKIP_GALLERY_CHECK" == false ]]; then
    gc_total_exit=0
    for gallery_pair in \
        "${GALLERY_8080_HTML}|${GALLERY_8080_URL}" \
        "${GALLERY_PDP11_HTML}|${GALLERY_PDP11_URL}"; do
        gallery_html="${gallery_pair%%|*}"
        gallery_url="${gallery_pair##*|}"
        if [[ ! -f "${gallery_html}" ]]; then
            printf "  ${YELLOW}⚠${RESET}  ${gallery_html} が存在しないためスキップ\n"
        else
            set +e
            python3 "${SCRIPT_DIR}/scripts/check-gallery-links.py" \
                "${gallery_html}" "${gallery_url}" 2>&1 | sed 's/^/  /'
            gc_exit=${PIPESTATUS[0]}
            set -e
            [[ $gc_exit -ne 0 ]] && gc_total_exit=1
        fi
    done

    echo ""
    if [[ $gc_total_exit -ne 0 ]]; then
        printf "${RED}✗ ギャラリーリンクに問題があります。${RESET}\n"
        exit 1
    else
        printf "${GREEN}✓ ギャラリーリンクチェック 完了${RESET}\n"
    fi
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 7: PDP-11 ローカルリンクチェック
# ---------------------------------------------------------------------------
step_header 7 "PDP-11 ローカルリンクチェック (scripts/check-pdp11-links.py)" "$SKIP_PDP11_LINKS"
if [[ "$SKIP_PDP11_LINKS" == false ]]; then
    set +e
    python3 "${SCRIPT_DIR}/scripts/check-pdp11-links.py" \
        "${SCRIPT_DIR}/examples/09-pdp11/web" 2>&1 | sed 's/^/  /'
    p11_exit=${PIPESTATUS[0]}
    set -e

    echo ""
    if [[ $p11_exit -ne 0 ]]; then
        printf "${RED}✗ PDP-11 リンクチェックに問題があります。${RESET}\n"
        exit 1
    else
        printf "${GREEN}✓ PDP-11 リンクチェック 完了${RESET}\n"
    fi
    echo ""
fi

# ---------------------------------------------------------------------------
# ステップ 8: QR PNG 存在確認
# ---------------------------------------------------------------------------
step_header 8 "QR PNG 存在確認 (docs/09-PDP11/XX-QR.png @ GitHub Pages)" "$SKIP_QR_CHECK"
if [[ "$SKIP_QR_CHECK" == false ]]; then
    QR_BASE="${PAGES_BASE}/docs/09-PDP11"
    qr_fail=0
    qr_ok=0
    qr_missing=()

    for png in "${SCRIPT_DIR}/docs/09-PDP11/"*-QR.png; do
        fname="$(basename "$png")"
        url="${QR_BASE}/${fname}"
        status=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 "$url")
        if [[ "$status" == "200" ]]; then
            (( qr_ok++ )) || true
        else
            qr_missing+=("$fname (HTTP $status)")
            (( qr_fail++ )) || true
        fi
    done

    if [[ $qr_fail -eq 0 ]]; then
        printf "  ${GREEN}✓${RESET}  全 %d 件 HTTP 200\n" "$qr_ok"
        echo ""
        printf "${GREEN}✓ QR PNG 存在確認 完了${RESET}\n"
    else
        printf "  ${RED}✗${RESET}  %d / %d 件が 404 または エラー:\n" "$qr_fail" "$(( qr_ok + qr_fail ))"
        for m in "${qr_missing[@]}"; do
            printf "       %s\n" "$m"
        done
        echo ""
        printf "${RED}✗ QR PNG が GitHub Pages に存在しません。${RESET}\n"
        exit 1
    fi
    echo ""
fi

printf "${GREEN}[完了] 全ステップ正常終了 ✓${RESET}\n"
