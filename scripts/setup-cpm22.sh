#!/usr/bin/env bash
# setup-cpm22.sh — CP/M 2.2 環境セットアップ
#
# 実行するとプロジェクトルートから:
#   examples/06-8080/rom/cpm22.bin     CCP+BDOS バイナリ (5632 bytes, $DC00–$F1FF)
#   examples/06-8080/sw/cpm/disks/cpm22.dsk  空フォーマット済みディスクイメージ
# が生成される。
#
# CP/M 2.2 は Caldera が 2001 年にオープンソースとして公開した。
# ソース: http://www.cpm.z80.de/source.html
#
# 利用するバイナリ: SIMH AltairZ80 シミュレータ付属の
#   altairz80/disks/cpm22.dsk (IBM 3740 フォーマット)
# から CCP+BDOS を抽出する。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROM_DIR="$REPO_ROOT/examples/06-8080/rom"
DSK_DIR="$REPO_ROOT/examples/06-8080/sw/cpm/disks"
BIOS_BIN="$REPO_ROOT/examples/06-8080/sw/cpm/bios/bios.bin"

# 1. 依存ツール確認
for tool in wget cpmtools mkfs.cpm z80asm; do
    if ! command -v "$tool" &>/dev/null; then
        case "$tool" in
            cpmtools|mkfs.cpm) sudo apt-get install -y cpmtools ;;
            z80asm)            sudo apt-get install -y z80asm ;;
            wget)              sudo apt-get install -y wget ;;
        esac
    fi
done

# 2. BIOS をビルド（未ビルドの場合）
if [ ! -f "$BIOS_BIN" ]; then
    echo "[INFO] BIOS をビルドします..."
    make -C "$REPO_ROOT/examples/06-8080/sw/cpm"
fi

# 3. CCP+BDOS バイナリを入手
#    CP/M 2.2 システムトラック (2 tracks × 26 sectors × 128 B = 6656 bytes)
#    のうち CCP は先頭 2048 B、BDOS は続く 3584 B。
#    RunCPM プロジェクトの CPM22.SYS を使う（CCP+BDOS の raw バイナリ）。
CPM22_BIN="$ROM_DIR/cpm22.bin"
if [ ! -f "$CPM22_BIN" ]; then
    mkdir -p "$ROM_DIR"
    echo "[INFO] CP/M 2.2 CCP+BDOS バイナリをダウンロードします..."
    # RunCPM の CPM22.SYS は CCP+BDOS の raw binary (5632 bytes)
    # ライセンス: CP/M 2.2 Caldera open-source release 2001
    wget -q -O "$CPM22_BIN" \
        "https://github.com/MockbaTheBorg/RunCPM/raw/master/RunCPM/CPM22.SYS" \
        || {
            echo "[ERROR] ダウンロードに失敗しました。"
            echo "        $CPM22_BIN に CP/M 2.2 の CCP+BDOS binary (5632 bytes) を"
            echo "        手動で配置してから再実行してください。"
            echo "        入手先: http://www.cpm.z80.de/binary.html"
            exit 1
        }
    echo "[OK] $CPM22_BIN ($(wc -c < "$CPM22_BIN") bytes)"
else
    echo "[SKIP] $CPM22_BIN は既に存在します"
fi

# 4. 空ディスクイメージを作成（IBM 3740: 77T × 26S × 128B = 256256 bytes）
DSK="$DSK_DIR/cpm22.dsk"
mkdir -p "$DSK_DIR"
if [ ! -f "$DSK" ]; then
    echo "[INFO] DSK イメージを作成します..."
    dd if=/dev/zero bs=256256 count=1 > "$DSK" 2>/dev/null
    mkfs.cpm -f ibm-3740 "$DSK"
    echo "[OK] $DSK"
else
    echo "[SKIP] $DSK は既に存在します"
fi

echo ""
echo "セットアップ完了。起動方法:"
echo "  cd $REPO_ROOT/examples/06-8080"
echo "  cmake -B build && cmake --build build"
echo "  ./build/sim"
