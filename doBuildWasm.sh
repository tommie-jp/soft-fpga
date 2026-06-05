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
  09-pdp11 (Unix V6)

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

# ビルド層は Makefile に委譲する（差分ビルド: 変更があった example だけ再ビルド）。
# make wasm = 01-counter / 02-traffic-fsm / 03-uart / 04-6502 / 09-pdp11
exec make -C "$SCRIPT_DIR" wasm
