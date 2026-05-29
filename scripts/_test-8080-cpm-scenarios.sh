#!/bin/bash
# _test-8080-cpm-scenarios.sh — CP/M コマンドシナリオを作業ディスクコピー上で実行する。
#
# 各シナリオ (.cpm) ごとに cpm22.dsk / bdsc.dsk の作業コピーを mktemp に作り、
# fixtures を cpmcp で投入してから `cpm --cpm-script ... --cpm-save` を実行する。
# 書込み系シナリオは実行後に cpmls で生成物を検証する。
# 元の .dsk は一切変更しない（作業コピーのみ使用）。
#
# 使い方:
#   _test-8080-cpm-scenarios.sh <cpm-bin> <example-dir>
#     cpm-bin     : ネイティブシミュレータ実行ファイル（例 build/cpm）
#     example-dir : examples/06-8080 へのパス
#
# 終了コード: 全シナリオ PASS で 0、1 件でも FAIL で 1。

set -uo pipefail

CPM_BIN="${1:?usage: $0 <cpm-bin> <example-dir>}"
EX_DIR="${2:?usage: $0 <cpm-bin> <example-dir>}"

SCN_DIR="$EX_DIR/test/cpm-scenarios"
FIX_DIR="$SCN_DIR/fixtures"
SRC_DSK_A="$EX_DIR/sw/cpm/disks/cpm22.dsk"
SRC_DSK_B="$EX_DIR/sw/cpm/disks/bdsc.dsk"
BIOS_BIN="$EX_DIR/sw/cpm/bios/bios.bin"
CPM_ROM="$EX_DIR/rom/cpm22.bin"
FMT="ibm-3740"

# cpmtools 必須（fixtures 投入・生成物検証に使用）
if ! command -v cpmcp >/dev/null 2>&1 || ! command -v cpmls >/dev/null 2>&1; then
    echo "ERROR: cpmtools (cpmcp/cpmls) が見つかりません" >&2
    exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# cpmls でディスク上にファイル（小文字 8.3 名）が存在するか確認する。
check_disk_file() {
    local dsk="$1" fname="$2"
    cpmls -f "$FMT" "$dsk" 2>/dev/null | grep -iqx "$fname"
}

pass=0
fail=0

for scn in "$SCN_DIR"/*.cpm; do
    [ -f "$scn" ] || continue
    name="$(basename "$scn" .cpm)"
    work_a="$TMP/$name-a.dsk"
    work_b="$TMP/$name-b.dsk"
    cp "$SRC_DSK_A" "$work_a"

    # fixtures をテキストモード (-t = LF→CRLF) で作業ディスク A: へ投入
    if [ -d "$FIX_DIR" ]; then
        for fx in "$FIX_DIR"/*; do
            [ -f "$fx" ] || continue
            base="$(basename "$fx")"
            cpmcp -f "$FMT" -t "$work_a" "$fx" "0:$base" 2>/dev/null || true
        done
    fi

    # BDS C シナリオは B: に bdsc.dsk 作業コピーをマウント
    disk_b_args=()
    if [[ "$name" == bdsc_* ]] && [ -f "$SRC_DSK_B" ]; then
        cp "$SRC_DSK_B" "$work_b"
        disk_b_args=(--disk-b "$work_b")
    fi

    log="$TMP/$name.log"
    "$CPM_BIN" --cpm-script "$scn" --bios "$BIOS_BIN" --cpm "$CPM_ROM" \
        --disk "$work_a" "${disk_b_args[@]}" --cpm-save \
        >"$log" 2>&1
    rc=$?

    # 書込み系シナリオは cpmls で生成物を検証
    gen_ok=1
    gen_note=""
    case "$name" in
        pip)        check_disk_file "$work_a" "copy.txt"  || { gen_ok=0; gen_note="copy.txt 未生成"; } ;;
        ren)        check_disk_file "$work_a" "new.txt"   || { gen_ok=0; gen_note="new.txt 未生成"; } ;;
        save)       check_disk_file "$work_a" "blk.com"   || { gen_ok=0; gen_note="blk.com 未生成"; } ;;
        asm_load)   check_disk_file "$work_a" "prog.com"  || { gen_ok=0; gen_note="prog.com 未生成"; } ;;
        ed)         check_disk_file "$work_a" "edtest.txt" || { gen_ok=0; gen_note="edtest.txt 未生成"; } ;;
        bdsc_hello) check_disk_file "$work_b" "hello.com" || { gen_ok=0; gen_note="hello.com 未生成"; } ;;
    esac

    if [ "$rc" -eq 0 ] && [ "$gen_ok" -eq 1 ]; then
        echo "  [PASS] $name"
        pass=$((pass + 1))
    else
        echo "  [FAIL] $name${gen_note:+ ($gen_note)}"
        sed 's/^/      /' "$log" | tail -8
        fail=$((fail + 1))
    fi
done

echo "=== CP/M シナリオ: $pass PASS / $fail FAIL ==="
[ "$fail" -eq 0 ]
