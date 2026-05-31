#!/usr/bin/env bash
# doCPM.sh — ホスト版 CP/M シミュレーターを起動する
#
# 起動前に BIOS を Linux 用署名でアセンブルし直してから cpm を実行する。
# (doBuildAll.sh は WASM 版 bios.bin で終わるため、ここで Linux 版に戻す)
#
# 使い方:
#   bash doCPM.sh                  インタラクティブ CP/M を起動
#   bash doCPM.sh --orig           原本ディスクで起動
#   bash doCPM.sh --exec DIR       DIR コマンドを実行して終了
#   bash doCPM.sh --no-save        ディスクを保存しない
#   bash doCPM.sh --help           cpm のヘルプを表示
#
# 追加オプションはすべて cpm バイナリに転送される。

set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doCPM.sh [-h] [cpm オプション...]

ホスト版 CP/M シミュレーターを起動する。
起動前に BIOS を Linux 用でアセンブルし直してから cpm バイナリを実行する。

主な使い方:
  ./doCPM.sh                   インタラクティブ CP/M を起動
  ./doCPM.sh --orig            原本ディスクで起動
  ./doCPM.sh --exec DIR        DIR コマンドを実行して終了
  ./doCPM.sh --no-save         ディスクを保存しない
  ./doCPM.sh --help            cpm バイナリのヘルプを表示

オプション:
  -h          このヘルプを表示して終了（--help は cpm バイナリに転送）

その他のオプションはすべて cpm バイナリに転送される。
EOF
}

for arg in "$@"; do
    case "$arg" in
        -h) usage; exit 0 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CPM_DIR="${SCRIPT_DIR}/examples/06-8080"
CPM_BIN="${CPM_DIR}/build/cpm"

# ---------------------------------------------------------------------------
# 事前確認
# ---------------------------------------------------------------------------
if [[ ! -x "${CPM_BIN}" ]]; then
    echo "エラー: ${CPM_BIN} が見つかりません。先にビルドしてください。" >&2
    echo "  bash doBuildAll.sh" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# BIOS を Linux 用署名でアセンブル
# (make は差分ビルドのため、signon.inc が同じなら再アセンブルしない)
# ---------------------------------------------------------------------------
make -C "${CPM_DIR}/sw/cpm" linux --silent

# ---------------------------------------------------------------------------
# CP/M 起動 (引数をそのまま転送)
# ---------------------------------------------------------------------------
exec "${CPM_BIN}" "$@"
