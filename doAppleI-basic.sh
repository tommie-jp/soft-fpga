#!/bin/bash
set -euo pipefail

usage() {
    cat <<'EOF'
使い方: doAppleI-basic.sh [-h]

Apple-I Integer BASIC シミュレータを起動する。
Verilator で生成した 6502 RTL コアを使用し、実機と等価の動作をする。

起動シーケンス:
  1. Woz Monitor が起動し "\" プロンプトを表示
  2. E000R で Integer BASIC を起動し ">" プロンプトになる

入力について:
  小文字は自動的に大文字に変換される（Apple-I の実機仕様）。

主な BASIC コマンド:
  LIST              プログラムを一覧表示
  RUN               プログラムを実行
  10 PRINT "HELLO"  行番号付きで命令を入力
  PRINT A           変数の値を表示
  A = 1 + 2         変数に代入（= の前後にスペース不要）
  NEW               プログラムを消去

存在しないコマンド（*** SYNTAX ERR になる）:
  END / SYSTEM / BYE / HELP / SYS

Woz Monitor に戻る:
  CALL -151  （モニタプロンプト "\" に戻る）
  モニタから終了: Ctrl+C

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

exec "${SIM}" "E000R"
