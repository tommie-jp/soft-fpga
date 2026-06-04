#!/usr/bin/env bash
# doPDP11-unix-v6.sh — PDP-11 / Unix V6 シミュレーターを起動する
#
# Verilator で生成した PDP-11 RTL コアを使用し、Unix V6 をブートする。
# 起動から約 8M クロック後に "rkunix" を自動送信してブートを開始する。
# ブート完了後（約 3〜10 秒）に "login:" プロンプトが表示される。
#
# 使い方:
#   ./doPDP11-unix-v6.sh              Unix V6 を起動（デフォルトディスクイメージ）
#   ./doPDP11-unix-v6.sh -h           このヘルプを表示
#
# ログイン:
#   ユーザー名: root  パスワードなし（Enter のみ）
#
# 終了:
#   Ctrl-C

set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doPDP11-unix-v6.sh [-h]

PDP-11 / Unix V6 シミュレーターを起動する。
Verilator で生成した PDP-11 RTL コア（Brad Parker cpus-pdp11）を使用する。

ブートシーケンス:
  1. ブートロムが "@" プロンプトを表示
  2. 自動的に "rkunix" を送信してカーネルをロード
  3. ブート完了後に "login:" が表示される（3〜10 秒）

ログイン:
  login: root
  Password: （空、Enter のみ）
  # シェルプロンプトが表示される

主な Unix V6 コマンド:
  ls /         ルートディレクトリ一覧
  cat /etc/motd  メッセージ表示
  who          ログインユーザー一覧
  date         現在日時
  ed file      テキストエディタ（行単位）

終了:
  Ctrl-C または sync; halt

オプション:
  -h, --help  このヘルプを表示して終了

ディスクイメージ:
  examples/09-pdp11/disk/unix_v6_rk05.dsk
  （IDEIMAGE 環境変数で別のイメージを指定可能）
EOF
}

for arg in "$@"; do
    case "$arg" in
        -h|--help) usage; exit 0 ;;
        *) echo "不明なオプション: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SIM="${SCRIPT_DIR}/examples/09-pdp11/build/pdp11_sim"
DISK="${SCRIPT_DIR}/examples/09-pdp11/disk/unix_v6_rk05.dsk"

# ── 事前確認 ─────────────────────────────────────────────────────────────
if [[ ! -x "${SIM}" ]]; then
    echo "エラー: ${SIM} が見つかりません。先にビルドしてください。" >&2
    echo "  bash scripts/build-host-09.sh" >&2
    exit 1
fi

if [[ ! -f "${DISK}" ]]; then
    echo "エラー: ディスクイメージが見つかりません: ${DISK}" >&2
    echo "  examples/09-pdp11/disk/README.md を参照して配置してください。" >&2
    exit 1
fi

# ── 起動 ─────────────────────────────────────────────────────────────────
exec env IDEIMAGE="${DISK}" "${SIM}" 2>/dev/null
