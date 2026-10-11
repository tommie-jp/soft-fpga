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
make -C "$SCRIPT_DIR" wasm

# タイミング図 PNG を docs/09-PDP11/img/timing/ に集約
# test/ss/pdp11/timing-*/ 配下の PNG を古い順にコピー（同名は新しい方で上書き）
_ss_dir="${SCRIPT_DIR}/test/ss/pdp11"
_img_dir="${SCRIPT_DIR}/docs/09-PDP11/img/timing"
if ls "${_ss_dir}/timing-"*/*.png 2>/dev/null | grep -q .; then
    mkdir -p "$_img_dir"
    while IFS= read -r -d '' _d; do
        cp "${_d}"/*.png "$_img_dir/" 2>/dev/null || true
    done < <(find "${_ss_dir}" -maxdepth 1 -name 'timing-*' -type d -print0 | sort -z)
    echo "docs/09-PDP11/img/timing/ 更新: $(ls "${_img_dir}"/*.png 2>/dev/null | wc -l) 枚"
fi
