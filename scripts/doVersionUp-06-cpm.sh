#!/usr/bin/env bash
# examples/06-8080/cxx/version.h のバージョン番号を上げる。
#
# 使い方:
#   scripts/doVersionUp-06-cpm.sh              # パッチ番号をインクリメント
#   scripts/doVersionUp-06-cpm.sh 1.0          # バージョンを直接指定
#
# ビルドは手動で行う:
#   cd examples/06-8080 && cmake --build build -j$(nproc)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_H="${SCRIPT_DIR}/../examples/06-8080/cxx/version.h"

if [[ ! -f "${VERSION_H}" ]]; then
    echo "ERROR: ${VERSION_H} が見つかりません" >&2
    exit 1
fi

# 現在のバージョンを読み取る
CURRENT=$(grep -oP '(?<=#define CPM_SIM_VERSION ")[^"]+' "${VERSION_H}")

if [[ $# -ge 1 ]]; then
    # 引数で直接指定
    NEW_VER="$1"
else
    # MAJOR.MINOR のパッチ部分をインクリメント
    MAJOR="${CURRENT%.*}"
    MINOR="${CURRENT##*.}"
    NEW_MINOR=$(( MINOR + 1 ))
    # マイナーが 100 に達したらメジャーを上げてリセット
    if [[ ${NEW_MINOR} -ge 100 ]]; then
        NEW_MAJOR=$(( ${MAJOR%.*} + 1 ))
        NEW_VER="${NEW_MAJOR}.0"
    else
        NEW_VER="${MAJOR}.$(printf '%02d' ${NEW_MINOR})"
    fi
fi

sed -i "s|#define CPM_SIM_VERSION \"${CURRENT}\"|#define CPM_SIM_VERSION \"${NEW_VER}\"|" "${VERSION_H}"

echo "${CURRENT} → ${NEW_VER}"
echo "  ${VERSION_H}"
