#!/bin/bash
# 全 example の WebAssembly ビルド（GitHub Pages / ローカル確認用）
# 前提: Verilator・emsdk がインストール済み
set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doBuildWasm.sh [-h]

全 example の WebAssembly ビルドを実行する（GitHub Pages / ローカル確認用）。

ビルド対象:
  01-counter
  02-traffic-fsm
  03-uart
  04-6502 (Apple-I)

前提: Verilator・emsdk がインストール済みであること。

オプション:
  -h, --help  このヘルプを表示して終了
EOF
}

for arg in "$@"; do
    case "$arg" in
        -h|--help) usage; exit 0 ;;
        *) echo "不明なオプション: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== build-wasm: 01-counter ==="
"$SCRIPT_DIR/scripts/build-wasm.sh"

echo "=== build-wasm: 02-traffic-fsm ==="
"$SCRIPT_DIR/scripts/build-wasm-02.sh"

echo "=== build-wasm: 03-uart ==="
"$SCRIPT_DIR/scripts/build-wasm-03.sh"

echo "=== build-wasm: 04-6502 Apple-I ==="
"$SCRIPT_DIR/scripts/build-wasm-04.sh"

echo ""
echo "All WASM builds done."
