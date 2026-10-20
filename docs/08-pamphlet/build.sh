#!/usr/bin/env bash
# パンフレット PDF を作る。作成日を今日にし、QR 画像を生成し、
# Chrome で A4 縦 2 ページ（表・裏）の PDF にして、作者などのメタデータを入れる。
# 使い方: docs/08-pamphlet/build.sh   （CHROME=… で Chrome のパスを差し替え可）
set -euo pipefail

cd "$(dirname "$0")"

# 作成日（pamphlet.html の「作成日 YYYY-MM-DD」を今日に書き換える）
sed -i -E "s/作成日 [0-9]{4}-[0-9]{2}-[0-9]{2}/作成日 $(date +%F)/" pamphlet.html

python3 make_qr.py

CHROME="${CHROME:-google-chrome}"
"$CHROME" --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PWD/pamphlet.pdf" "file://$PWD/pamphlet.html" 2>/dev/null

python3 set_pdf_meta.py pamphlet.pdf

echo "→ $PWD/pamphlet.pdf"
