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
# 利用するバイナリ: z80pack (MIT) の cpmsim/srccpm2/cpm.bin。
#   CCP が $E400 に組まれた CP/M 2.2 の像なので、0x880 から 5632 バイトを切り出し、
#   scripts/cpm22-reloc.txt の位置 (1072 か所) の上位バイトから 8 を引いて $DC00 用に組み直す。
#   できた像は MD5 で確かめる。

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
#    z80pack の cpm.bin (コミットを固定) を取り、$DC00 用に組み直す。
#    以前は RunCPM の CPM22.SYS を取っていたが、RunCPM はそのファイルを置いていない (404)。
CPM22_BIN="$ROM_DIR/cpm22.bin"
CPM22_MD5="62239bb06db6e149fd07440c3bae71d0"
Z80PACK_URL="https://raw.githubusercontent.com/udo-munk/z80pack/1cf2c6799c6ab31701fb49488da8dfa8400ac32e/cpmsim/srccpm2/cpm.bin"
if [ ! -f "$CPM22_BIN" ]; then
    mkdir -p "$ROM_DIR"
    echo "[INFO] CP/M 2.2 の像を z80pack から取り、\$DC00 用に組み直します..."
    TMP_SRC="$(mktemp)"
    trap 'rm -f "$TMP_SRC"' EXIT
    wget -q -O "$TMP_SRC" "$Z80PACK_URL" || {
        echo "[ERROR] ダウンロードに失敗しました: $Z80PACK_URL"
        echo "        $CPM22_BIN に CP/M 2.2 の CCP+BDOS binary (5632 bytes, \$DC00) を"
        echo "        手動で配置してから再実行してください。"
        exit 1
    }
    python3 - "$TMP_SRC" "$REPO_ROOT/scripts/cpm22-reloc.txt" "$CPM22_BIN" <<'PY'
import sys
src = open(sys.argv[1], 'rb').read()[0x880:0x880 + 5632]
bitmap = bytes.fromhex(open(sys.argv[2]).read().replace('\n', ''))
out = bytearray(src)
for i in range(len(out)):
    if bitmap[i >> 3] & (1 << (i & 7)):
        out[i] = (out[i] - 8) & 0xFF   # $E4xx -> $DCxx
open(sys.argv[3], 'wb').write(out)
PY
    got="$(md5sum "$CPM22_BIN" | cut -d' ' -f1)"
    if [ "$got" != "$CPM22_MD5" ]; then
        echo "[ERROR] 組み直した像の MD5 が合いません ($got)。消して止めます。"
        rm -f "$CPM22_BIN"
        exit 1
    fi
    echo "[OK] $CPM22_BIN ($(wc -c < "$CPM22_BIN") bytes, MD5 一致)"
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
