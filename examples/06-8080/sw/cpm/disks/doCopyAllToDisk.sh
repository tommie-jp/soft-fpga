#!/bin/bash
# doCopyAllToDisk.sh — work-turbo-pascal/H3-TPASCAL3/3/ の全ファイルを
#                       TurboPascal3.dsk へ cpmcp でコピーする
#
# コピー順: 必須システムファイル → 設定ファイル → サンプル（容量次第）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/work-turbo-pascal/H3-TPASCAL3/3"
DSK="$SCRIPT_DIR/TurboPascal3.dsk"
FMT="ibm-3740"

if [ ! -f "$DSK" ]; then
  echo "ERROR: $DSK が見つかりません。先に makeBlankDisk.sh を実行してください。" >&2
  exit 1
fi

# ---- 優先度別ファイルリスト ----
# 1) 必須: Turbo Pascal 本体（これがないと起動不可）
ESSENTIAL=(
  TURBO.COM   # メイン実行ファイル
  TURBO.OVR   # エディタ/コンパイラ overlay（必須）
  TURBO.MSG   # エラーメッセージ（必須）
)

# 2) インストーラ一式（端末設定変更に使う）
INSTALLER=(
  TINST.COM
  TINST.DTA
  TINST.MSG
)

# 3) 設定ファイル（プリンタ設定 .LTP）
CONFIG=(
  DEFAULT.LTP
  EPSON80.LTP
  EPSON100.LTP
  OKI82.LTP
  OKI92.LTP
  OKI93.LTP
)

# 4) サンプル・ドキュメント（容量に余裕があれば）
SAMPLES=(
  HELLO.PAS HELLO.COM
  MYNAME.PAS VERSION.PAS PASSFUNC.PAS
  INLINE.PAS FUNCKEYS.PAS TYPEAHED.PAS FILLCHAR.PAS
  IOERROR.PAS RANDOM.PAS SCALARS.PAS
  CMDLIN.PAS CMDLINE.PAS
  CPMDIR.PAS CPMSTAT.PAS DISKSTUS.PAS DIRECTRY.PAS CHNGDIR.PAS
  MEMSCREN.PAS IBMINT10.PAS TBOMOUSE.PAS FILTER.PAS
  PASS.ASM
  GAME1.PAS
  COMLIB.PAS
  QDL.PAS
  LISTER.PAS LISTT.PAS LISTT2.INC LISTT.DOC
  MC.PAS MC.HLP MC-MOD00.INC MC-MOD01.INC MC-MOD02.INC \
  MC-MOD03.INC MC-MOD04.INC MC-MOD05.INC MCDEMO.MCS
  READ.ME READ1.DOC INFO.TXT
)

copy_file() {
  local name="$1"
  local path="$SRC/$name"
  if [ ! -f "$path" ]; then
    echo "  MISSING $name"
    return 0
  fi
  if cpmcp -f "$FMT" "$DSK" "$path" "0:$name" 2>/dev/null; then
    echo "  OK    $name"
  else
    echo "  FULL  $name (ディスク満杯のためスキップ)"
  fi
}

echo "=== Copy to $(basename "$DSK") ==="

echo "--- 必須ファイル ---"
for f in "${ESSENTIAL[@]}"; do copy_file "$f"; done

echo "--- インストーラ ---"
for f in "${INSTALLER[@]}"; do copy_file "$f"; done

echo "--- 設定ファイル ---"
for f in "${CONFIG[@]}"; do copy_file "$f"; done

echo "--- サンプル（容量次第） ---"
for f in "${SAMPLES[@]}"; do copy_file "$f"; done

echo ""
echo "=== Done — disk contents ==="
cpmls -f "$FMT" "$DSK"
