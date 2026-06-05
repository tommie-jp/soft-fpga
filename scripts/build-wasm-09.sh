#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/09-pdp11"
VENDOR="$ROOT/vendor/cpus-pdp11"
OBJ_DIR="$ROOT/obj_dir_09_wasm"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

VERILATED_CPP="$ROOT/cxx/verilated.cpp"
cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
WASM_COMPAT="$ROOT/cxx/wasm_compat.h"

# emsdk が PATH にない場合は自動検索
if ! command -v em++ &>/dev/null; then
    EMSDK_ENV=""
    for candidate in \
        "$HOME/emsdk/emsdk_env.sh" \
        "$HOME/emsdk/emsdk/emsdk_env.sh"; do
        [ -f "$candidate" ] && EMSDK_ENV="$candidate" && break
    done
    if [ -n "${EMSDK_ENV:-}" ]; then
        # shellcheck disable=SC1090
        source "$EMSDK_ENV" 2>/dev/null
    else
        echo "ERROR: em++ not found. Install emsdk and source emsdk_env.sh" >&2
        exit 1
    fi
fi

echo "=== Verilator ==="
rm -rf "$OBJ_DIR"
verilator --cc \
    --no-timing \
    --top-module test_top_wasm \
    -Wno-DECLFILENAME \
    -Wno-MULTITOP \
    -Wno-UNUSEDSIGNAL \
    -Wno-UNOPTFLAT \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-STMTDLY \
    -Wno-TIMESCALEMOD \
    -Wno-CASEX \
    -Wno-CASEINCOMPLETE \
    "$EXAMPLE/verilog/test_top_wasm.v" \
    +incdir+"$EXAMPLE/verilog" \
    +incdir+"$VENDOR/rtl" \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O3 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH \
  -I$VERILATOR_ROOT/include \
  -I$VERILATOR_ROOT/include/vltstd \
  -I$OBJ_DIR"

echo "=== Emscripten: verilated.cpp ==="
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    -I"$ROOT/cxx" \
    -include "$WASM_COMPAT" \
    -c "$VERILATED_CPP" \
    -o "$OBJ_DIR/verilated.wasm.o"

mkdir -p "$EXAMPLE/web"

echo "=== Emscripten: link ==="
# __Dpi.cpp は DPI export 専用（当プロジェクトは import のみ）。
# svdpi.h が uint8_t を要求するが WASM ターゲットでは解決できないため除外する。
# DPI import の実装は harness.cpp / ide_v5.cpp / ram_v5.cpp に含まれる。
V_SRCS=$(ls "$OBJ_DIR"/Vtest_top_wasm*.cpp | grep -v '__Dpi\.cpp')

# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    $V_SRCS \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    "$EXAMPLE/cxx/ide_v5.cpp" \
    "$EXAMPLE/cxx/ram_v5.cpp" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_step_n","_send_key","_get_display_char",
                            "_get_ring_ptr","_get_ring_head","_get_ring_size","_get_ring_words",
                            "_get_pc","_sim_con_in_space",
                            "_sim_set_pc_trigger","_sim_trigger_hit","_sim_clear_trigger",
                            "_get_gpr_ptr",
                            "_sim_update_mmu","_get_mmu_ptr","_get_mmu_size",
                            "_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32","HEAPU16","HEAPU8","FS"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=67108864 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"

# ── web/js/ の生成 ──────────────────────────────────────────────────────────
# index.html は js/rtlscope-la.js など web/js/ 相対パスで参照する。
# gitignore 除外のためローカルにしか存在しないので、ビルド時に共有 js/ から生成する。
mkdir -p "$EXAMPLE/web/js"
cp "$ROOT/js/rtlscope-la.js"         "$EXAMPLE/web/js/"
cp "$ROOT/js/sft-pdp11-la-defs.js"   "$EXAMPLE/web/js/"
cp "$ROOT/js/sft-pdp11-docs.js"      "$EXAMPLE/web/js/"
echo "  web/js/: rtlscope-la.js sft-pdp11-la-defs.js sft-pdp11-docs.js"

# ── web/docs/ へ Markdown ドキュメントをコピー ──────────────────────────────
# docs/09-PDP11/*.md がソース（git 管理）。web/docs/ は gitignore 除外のため
# ビルド時に同期する。
mkdir -p "$EXAMPLE/web/docs"
cp "$ROOT/docs/09-PDP11/"*.md "$EXAMPLE/web/docs/"
echo "  web/docs/: $(ls "$ROOT/docs/09-PDP11/"*.md | wc -l) .md files"

# ── テストビルド: Node.js ES Module（Vitest 用、ディスク埋め込み） ──────────
# MODULARIZE=1 + EXPORT_ES6=1 + ENVIRONMENT=node で sim-test.mjs を生成する。
# Unix V6 ディスクを /disk0.rk として埋め込むので Vitest 側は単体で起動できる。
TEST_DIR="$EXAMPLE/tests"
TEST_DISK="$ROOT/examples/09-pdp11/disk/unix_v6_rk05.dsk"
if [ -f "$TEST_DISK" ]; then
    mkdir -p "$TEST_DIR"
    echo "=== Emscripten: test build (Node.js ES Module) ==="
    # shellcheck disable=SC2086
    em++ $COMMON_FLAGS \
        $V_SRCS \
        "$OBJ_DIR/verilated.wasm.o" \
        "$EXAMPLE/cxx/harness.cpp" \
        "$EXAMPLE/cxx/ide_v5.cpp" \
        "$EXAMPLE/cxx/ram_v5.cpp" \
        --embed-file "$TEST_DISK@/disk0.rk" \
        -s EXPORTED_FUNCTIONS='["_sim_init","_step_n","_send_key","_get_display_char",
                                "_get_ring_ptr","_get_ring_head","_get_ring_size","_get_ring_words",
                                "_get_pc","_sim_con_in_space",
                                "_sim_set_pc_trigger","_sim_trigger_hit","_sim_clear_trigger",
                                "_get_gpr_ptr",
                                "_sim_update_mmu","_get_mmu_ptr","_get_mmu_size",
                                "_malloc","_free"]' \
        -s EXPORTED_RUNTIME_METHODS='["HEAPU32","HEAPU16","HEAPU8","FS"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s INITIAL_MEMORY=67108864 \
        -s EXIT_RUNTIME=0 \
        -s MODULARIZE=1 \
        -s EXPORT_ES6=1 \
        -s ENVIRONMENT=node \
        -o "$TEST_DIR/sim-test.mjs"
    echo "  $TEST_DIR/sim-test.mjs"
    echo "  $TEST_DIR/sim-test.wasm"
else
    echo "WARNING: テストビルドをスキップ（ディスクが無い: $TEST_DISK）" >&2
fi

# ── ディスクイメージのステージング ───────────────────────────────────────────
# ローカルに disk/ があればコピー、なければ simh trailing-edge からダウンロードする。
DISK_SRC="$ROOT/examples/09-pdp11/disk/unix_v6_rk05.dsk"
DISK_WEB="$EXAMPLE/web/disk/unix_v6_rk05.dsk"
mkdir -p "$(dirname "$DISK_WEB")"

if [ -f "$DISK_WEB" ]; then
    echo "  disk: already present ($(du -h "$DISK_WEB" | cut -f1))"
elif [ -f "$DISK_SRC" ]; then
    cp "$DISK_SRC" "$DISK_WEB"
    echo "  disk: copied from disk/ ($(du -h "$DISK_WEB" | cut -f1))"
else
    echo "=== ディスクイメージ取得 (simh trailing-edge) ==="
    TMP_ZIP=$(mktemp /tmp/uv6_XXXXXX.zip)
    TMP_DIR=$(mktemp -d)
    # ダウンロード失敗は警告のみ（CI を止めない）
    if curl -L --retry 3 --fail-with-body \
            "http://simh.trailing-edge.com/kits/uv6swre.zip" -o "$TMP_ZIP" 2>/dev/null; then
        unzip -o "$TMP_ZIP" -d "$TMP_DIR" >/dev/null 2>&1 || true
        DISK_FILE=$(find "$TMP_DIR" -iname "rk*.dsk" -o -iname "*v6*.dsk" -o -iname "*.dsk" \
                      2>/dev/null | sort | head -1)
        if [ -n "$DISK_FILE" ]; then
            cp "$DISK_FILE" "$DISK_WEB"
            echo "  disk: downloaded ($(du -h "$DISK_WEB" | cut -f1))"
        else
            echo "WARNING: zip 内にディスクイメージが見つかりません。" >&2
        fi
    else
        echo "WARNING: ディスクイメージのダウンロード失敗。" \
             "手動で web/disk/unix_v6_rk05.dsk に配置してください。" >&2
    fi
    rm -f "$TMP_ZIP"
    rm -rf "$TMP_DIR"
fi

echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server 8080"
echo "Open : http://localhost:8080"
