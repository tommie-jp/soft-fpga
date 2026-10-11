#!/bin/bash
# 01-counter のローカル確認サーバ（http://localhost:8081/）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/../../.."

# js/ ライブラリ（rtlscope-la.js など）を HTTP で提供するシンボリックリンク
ln -sfn "$ROOT/js" "$SCRIPT_DIR/js"

cd "$SCRIPT_DIR"
python3 -m http.server 8081
