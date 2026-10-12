#!/usr/bin/env bash
# パンフレット PDF を作る。QR 画像を生成し、Chrome で A4 縦 2 ページ（表・裏）の PDF にする。
# 使い方: docs/08-pamphlet/build.sh   （CHROME=… で Chrome のパスを差し替え可）
set -euo pipefail

cd "$(dirname "$0")"

python3 make_qr.py

CHROME="${CHROME:-google-chrome}"
"$CHROME" --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PWD/pamphlet.pdf" "file://$PWD/pamphlet.html" 2>/dev/null

echo "→ $PWD/pamphlet.pdf"
