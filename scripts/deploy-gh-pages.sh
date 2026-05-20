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
    "06:build-wasm-06.sh:examples/06-8080/web:06-8080"
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

# 目次ページをルートにコピー
cp "$ROOT/web/index.html" "$WORKTREE/index.html"
echo "Copied root index.html"

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
    [ -f "$src/sim.js"   ] && cp "$src/sim.js"   "$dst/"
    [ -f "$src/sim.wasm" ] && cp "$src/sim.wasm" "$dst/"
    # 追加アセット（QR コードなど）
    for asset in "$src"/*.png "$src"/*.svg; do
        [ -f "$asset" ] && cp "$asset" "$dst/"
    done
done

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
