#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
EXAMPLE="$ROOT/examples/06-8080"
OBJ_DIR="$ROOT/obj_dir_06_wasm"
source "$SCRIPT_DIR/_build-wasm-common.sh"
wasm_sync_verilated_cpp always
wasm_require_emsdk

echo "=== Verilator ==="
# バージョン混在を防ぐため毎回クリーンビルド
rm -rf "$OBJ_DIR"
verilator --cc \
    "$EXAMPLE/verilog/cpm_top.v" \
    "$EXAMPLE/verilog/vm80a/org/rtl/vm80a.v" \
    --top-module cpm_top \
    -Wno-WIDTHEXPAND \
    -Wno-WIDTHTRUNC \
    -Wno-UNOPTFLAT \
    --Mdir "$OBJ_DIR"

COMMON_FLAGS="-O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH -I$VERILATOR_ROOT/include -I$VERILATOR_ROOT/include/vltstd -I$OBJ_DIR"

echo "=== Emscripten: verilated.cpp ==="
wasm_compile_verilated_cpp

BIOS="$EXAMPLE/sw/cpm/bios/bios.bin"
CPM="$EXAMPLE/rom/cpm22.bin"
DSK="$EXAMPLE/sw/cpm/disks/cpm22.dsk"
BDSC="$EXAMPLE/sw/cpm/disks/bdsc.dsk"

# *.C / *.H を WASM 仮想 FS に埋め込む — CP/M 内から R.COM で転送可能になる
C_H_EMBEDS=""
for f in "$EXAMPLE"/*.C "$EXAMPLE"/*.H; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    C_H_EMBEDS="$C_H_EMBEDS --embed-file $f@/$base"
done

echo "=== Emscripten: link ==="
# __Dpi.cpp は vm80a が DPI を使わないため不要。除外しないと svdpi.h の uint8_t エラーになる。
V_SRCS=$(ls "$OBJ_DIR"/V*.cpp | grep -v '__Dpi\.cpp')
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    $V_SRCS \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    --embed-file "$BIOS@/bios.bin" \
    --embed-file "$CPM@/cpm22.bin" \
    --embed-file "$DSK@/cpm22.dsk" \
    --embed-file "$BDSC@/bdsc.dsk" \
    $C_H_EMBEDS \
    -s EXPORTED_FUNCTIONS='["_sim_init","_sim_init_wasm","_sim_init_disk","_step","_send_key","_get_display_char","_get_pc","_sim_read_byte","_sim_poke","_sim_poke_block","_load_disk","_load_disk_drive","_sim_load_disk_file","_sim_test","_sim_run_bare","_get_ring_ptr","_get_head","_get_ring_size","_get_ring_words","_sim_get_disk_ptr","_sim_get_disk_size","_sim_get_disk_dirty","_sim_clear_disk_dirty","_malloc","_free","_sim_snap_regs","_sim_freeze_ring","_sim_thaw_ring","_sim_ring_frozen","_sim_set_trigger","_sim_trigger_hit","_sim_trigger_fired","_sim_get_trig_fire_head","_sim_set_post_delay","_sim_clear_trigger","_sim_get_call_log_ptr","_sim_get_call_log_head","_sim_clear_call_log","_sim_set_edge_trigger","_sim_set_value_trigger","_sim_set_instr_trigger","_sim_set_reg_trigger","_sim_step_instr","_sim_run_n","_sim_set_la_enabled","_sim_set_pc","_sim_set_reg","_sim_set_flags","_sim_set_mem_watch"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32","HEAPU8","FS"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"

echo "=== Emscripten: test build (Node.js ES Module) ==="
TEST_DIR="$EXAMPLE/tests"
mkdir -p "$TEST_DIR"
# shellcheck disable=SC2086
em++ $COMMON_FLAGS \
    $V_SRCS \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    --embed-file "$BIOS@/bios.bin" \
    --embed-file "$CPM@/cpm22.bin" \
    --embed-file "$DSK@/cpm22.dsk" \
    --embed-file "$BDSC@/bdsc.dsk" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_sim_init_wasm","_sim_init_disk","_step","_send_key","_get_display_char","_get_pc","_sim_read_byte","_sim_poke","_sim_poke_block","_load_disk","_load_disk_drive","_sim_load_disk_file","_sim_test","_sim_run_bare","_get_ring_ptr","_get_head","_get_ring_size","_get_ring_words","_sim_get_disk_ptr","_sim_get_disk_size","_sim_get_disk_dirty","_sim_clear_disk_dirty","_malloc","_free","_sim_snap_regs","_sim_freeze_ring","_sim_thaw_ring","_sim_ring_frozen","_sim_set_trigger","_sim_trigger_hit","_sim_trigger_fired","_sim_get_trig_fire_head","_sim_set_post_delay","_sim_clear_trigger","_sim_get_call_log_ptr","_sim_get_call_log_head","_sim_clear_call_log","_sim_set_edge_trigger","_sim_set_value_trigger","_sim_set_instr_trigger","_sim_set_reg_trigger","_sim_step_instr","_sim_run_n","_sim_set_la_enabled","_sim_set_pc","_sim_set_reg","_sim_set_flags","_sim_set_mem_watch"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32","HEAPU8","FS"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=0 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=node \
    -o "$TEST_DIR/sim-test.mjs"

echo "=== Done ==="
echo "  $EXAMPLE/web/sim.js"
echo "  $EXAMPLE/web/sim.wasm"
echo "  $TEST_DIR/sim-test.mjs"
echo "  $TEST_DIR/sim-test.wasm"
echo ""
echo "Serve: cd $EXAMPLE/web && python3 -m http.server"
