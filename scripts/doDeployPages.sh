#!/bin/bash
# deploy-gh-pages.sh — Build WASM and deploy to gh-pages branch
#
# Usage:
#   scripts/deploy-gh-pages.sh          # deploy all examples
#   scripts/deploy-gh-pages.sh 06       # deploy only example 06-8080
#   scripts/deploy-gh-pages.sh --no-build 06  # skip build, deploy only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
WORKTREE="/tmp/soft-fpga-gh-pages"
BRANCH="gh-pages"

# ---------- option parsing ----------
NO_BUILD=false
TARGETS=()
for arg in "$@"; do
    case "$arg" in
        --no-build) NO_BUILD=true ;;
        *)          TARGETS+=("$arg") ;;
    esac
done

# ---------- example registry ----------
# format: "id:build_script:web_dir:deploy_subdir"
# deploy_subdir="" means deploy to root of gh-pages
declare -a EXAMPLES=(
    "01:build-wasm.sh:examples/01-counter/web:01-counter"
    "02:build-wasm-02.sh:examples/02-traffic-fsm/web:02-traffic-fsm"
    "03:build-wasm-03.sh:examples/03-uart/web:03-uart"
    "04:build-wasm.sh:examples/04-6502/web:04-6502"
    "05:build-wasm.sh:examples/05-dormann/web:05-dormann"
    "06:build-wasm-06.sh:examples/06-8080/web:examples/06-8080/web"
)

# ---------- filter by targets ----------
if [ ${#TARGETS[@]} -gt 0 ]; then
    FILTERED=()
    for ex in "${EXAMPLES[@]}"; do
        id="${ex%%:*}"
        for t in "${TARGETS[@]}"; do
            if [[ "$id" == "$t" ]]; then
                FILTERED+=("$ex")
            fi
        done
    done
    EXAMPLES=("${FILTERED[@]}")
fi

if [ ${#EXAMPLES[@]} -eq 0 ]; then
    echo "No matching examples found." >&2
    exit 1
fi

# ---------- build ----------
if [ "$NO_BUILD" = false ]; then
    echo "=== Build ==="
    for ex in "${EXAMPLES[@]}"; do
        IFS=: read -r id build_script web_dir deploy_subdir <<< "$ex"
        script="$SCRIPT_DIR/$build_script"
        if [ -f "$script" ]; then
            echo "--- Building example $id ---"
            bash "$script"
        else
            echo "WARN: build script not found: $script (skipping build for $id)"
        fi
    done
fi

# ---------- deploy ----------
echo ""
echo "=== Deploy to $BRANCH ==="

# prepare worktree
if [ -d "$WORKTREE" ]; then
    git worktree remove --force "$WORKTREE" 2>/dev/null || true
fi

# gh-pages がローカルになければリモートから取得、それもなければ孤立ブランチ作成
if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    if git ls-remote --exit-code origin "$BRANCH" &>/dev/null; then
        echo "Fetching $BRANCH from origin..."
        git fetch origin "$BRANCH:$BRANCH"
    else
        echo "Creating orphan branch $BRANCH..."
        git worktree add --orphan -b "$BRANCH" "$WORKTREE"
        git -C "$WORKTREE" commit --allow-empty -m "init gh-pages"
        git push -u origin "$BRANCH"
        git worktree remove "$WORKTREE"
    fi
fi

git worktree add "$WORKTREE" "$BRANCH"

# 旧レイアウト（ルートに直置きされた 6502 成果物）を除去
for f in sim.js sim.wasm; do
    [ -f "$WORKTREE/$f" ] && git -C "$WORKTREE" rm -f "$f" && echo "Removed legacy root/$f"
done

# 目次ページ・共通アセットをルートにコピー
cp "$ROOT/web/index.html" "$WORKTREE/index.html"
[ -f "$ROOT/web/favicon.ico" ] && cp "$ROOT/web/favicon.ico" "$WORKTREE/favicon.ico"
echo "Copied root index.html + favicon.ico"

# js/ ライブラリをルートの js/ にコピー（rtlscope-la.js など）
if [ -d "$ROOT/js" ]; then
    mkdir -p "$WORKTREE/js"
    cp "$ROOT/js"/*.js "$WORKTREE/js/" 2>/dev/null || true
    echo "Copied js/ library files"
fi

for ex in "${EXAMPLES[@]}"; do
    IFS=: read -r id build_script web_dir deploy_subdir <<< "$ex"
    src="$ROOT/$web_dir"
    if [ -n "$deploy_subdir" ]; then
        dst="$WORKTREE/$deploy_subdir"
    else
        dst="$WORKTREE"
    fi

    if [ ! -f "$src/index.html" ]; then
        echo "WARN: $src/index.html not found, skipping example $id"
        continue
    fi

    echo "--- Deploying example $id → /${deploy_subdir} ---"
    mkdir -p "$dst"
    cp "$src/index.html" "$dst/"
    [ -f "$src/sim.js"        ] && cp "$src/sim.js"        "$dst/"
    [ -f "$src/sim.wasm"      ] && cp "$src/sim.wasm"      "$dst/"
    [ -f "$src/sim-worker.js" ] && cp "$src/sim-worker.js" "$dst/"
    [ -f "$src/favicon.ico"   ] && cp "$src/favicon.ico"   "$dst/"
    # 追加アセット（QR コードなど）
    for asset in "$src"/*.png "$src"/*.svg; do
        [ -f "$asset" ] && cp "$asset" "$dst/"
    done

    # docs/ ディレクトリ（Markdown ドキュメント）
    # deploy_subdir が深い場合（例: examples/06-8080/web）は
    # スラッシュ区切りの各コンポーネントを候補として順に試す
    docs_src=""
    # 完全一致を最初に試し、次にパスの各コンポーネントを順に試す
    if [ -d "$ROOT/docs/$deploy_subdir" ]; then
        docs_src="$ROOT/docs/$deploy_subdir"
    else
        IFS='/' read -ra _parts <<< "$deploy_subdir"
        for _part in "${_parts[@]}"; do
            [[ -z "$_part" ]] && continue
            if [ -d "$ROOT/docs/$_part" ]; then
                docs_src="$ROOT/docs/$_part"; break
            fi
        done
    fi
    if [[ -n "$docs_src" ]]; then
        mkdir -p "$dst/docs"
        cp "$docs_src"/*.md "$dst/docs/" 2>/dev/null || true
        echo "  Copied docs → /${deploy_subdir}/docs/"
    fi
done

# ── example 06 専用: js/ パス深度合わせのための追加処理 ──────────────────────
# index.html が ../../../js/ を参照するため、ローカル開発と同じ深度
# (examples/06-8080/web/) にデプロイし、旧 URL (06-8080/) はリダイレクトで転送する。
if [[ -f "$WORKTREE/examples/06-8080/web/index.html" ]]; then
    # 旧 06-8080/ 内の本体ファイルを削除（index.html のリダイレクトのみ残す）
    for old_file in sim.js sim.wasm sim-worker.js; do
        [ -f "$WORKTREE/06-8080/$old_file" ] && \
            git -C "$WORKTREE" rm -f "06-8080/$old_file" 2>/dev/null && \
            echo "Removed legacy 06-8080/$old_file"
    done

    # 旧 URL 06-8080/ → 実体 examples/06-8080/web/ へリダイレクト
    mkdir -p "$WORKTREE/06-8080"
    cat > "$WORKTREE/06-8080/index.html" <<'REDIRECT'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=../examples/06-8080/web/">
  <title>Intel 8080 / CP/M 2.2</title>
</head>
<body>
  <p>移動しました → <a href="../examples/06-8080/web/">Intel 8080 / CP/M 2.2</a></p>
</body>
</html>
REDIRECT
    echo "Created redirect: 06-8080/ → examples/06-8080/web/"
fi

cd "$WORKTREE"
git add -A

if git diff --cached --quiet; then
    echo "Nothing to deploy (no changes)."
else
    git commit -m "deploy: update simulator pages"
    git push
    echo ""
    echo "=== Deployed ==="
    for ex in "${EXAMPLES[@]}"; do
        IFS=: read -r id build_script web_dir deploy_subdir <<< "$ex"
        if [ -n "$deploy_subdir" ]; then
            echo "  https://tommie-jp.github.io/soft-fpga/$deploy_subdir/"
        else
            echo "  https://tommie-jp.github.io/soft-fpga/"
        fi
    done
fi

cd "$ROOT"
git worktree remove "$WORKTREE"
