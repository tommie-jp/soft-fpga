#!/bin/bash
set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doAppleI-monitor.sh [-h]

Apple-I Woz Monitor シミュレータを起動する。
Verilator で生成した 6502 RTL コアを使用し、実機と等価の動作をする。

起動シーケンス:
  シミュレータが起動すると "\" プロンプトが表示される。
  Integer BASIC を起動するには E000R と入力する。

入力について:
  小文字は自動的に大文字に変換される（Apple-I の実機仕様）。

主な Woz Monitor コマンド:
  XXXXR             アドレス XXXX から実行（例: FF00R でモニタ再起動）
  XXXX              アドレス XXXX の内容を表示
  XXXX: BB BB ...   アドレス XXXX にバイト列を書き込む
  XXXX.YYYY         アドレス範囲 XXXX〜YYYY をダンプ
  E000R             Integer BASIC を起動

終了:
  Ctrl+C

オプション:
  -h, --help  このヘルプを表示して終了

ドキュメント:
  docs/04-6502/50-wozmon-使い方.md             Woz Monitor コマンドリファレンス
  docs/04-6502/51-integer-BASIC-文法リファレンス.md  Integer BASIC 文法リファレンス
  docs/04-6502/12-integer-BASIC-動作検証サンプル.md  動作確認用サンプルプログラム集
EOF
}

for arg in "$@"; do
    case "$arg" in
        -h|--help) usage; exit 0 ;;
        *) echo "不明なオプション: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SIM="${SCRIPT_DIR}/examples/04-6502/build/sim"

if [[ ! -x "${SIM}" ]]; then
    echo "sim が見つかりません。先にビルドしてください:" >&2
    echo "  scripts/build-sim.sh 04-6502" >&2
    exit 1
fi

exec "${SIM}"
