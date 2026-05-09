#!/usr/bin/env bash
set -euo pipefail

# コンテナ内で実行される。直接呼ばず scripts/build-sim.sh から呼び出す。
# Env: EXAMPLE — 対象サンプル名 (例: 04-6502)

EXAMPLE="${EXAMPLE:?EXAMPLE env var required (e.g. 04-6502)}"
EXAMPLE_DIR="/work/examples/${EXAMPLE}"
BUILD_DIR="${EXAMPLE_DIR}/build"
OBJ_DIR="${BUILD_DIR}/obj_dir"
VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"

case "${EXAMPLE}" in
    01-counter)
        TOP="counter"
        VFILES="${EXAMPLE_DIR}/verilog/counter.v"
        VFLAGS=""
        ;;
    02-traffic-fsm)
        TOP="traffic_fsm"
        VFILES="${EXAMPLE_DIR}/verilog/traffic_fsm.v"
        VFLAGS=""
        ;;
    03-uart)
        TOP="uart_top"
        VFILES="${EXAMPLE_DIR}/verilog/uart_top.v \
                ${EXAMPLE_DIR}/verilog/uart_tx.v \
                ${EXAMPLE_DIR}/verilog/uart_rx.v"
        VFLAGS=""
        ;;
    04-6502)
        TOP="apple1_top"
        VFILES="${EXAMPLE_DIR}/verilog/apple1_top.v \
                ${EXAMPLE_DIR}/verilog/hoglet/cpu_65c02.v \
                ${EXAMPLE_DIR}/verilog/hoglet/ALU.v"
        VFLAGS="-Wno-CASEX -Wno-CASEINCOMPLETE -Wno-WIDTHEXPAND -Wno-WIDTHTRUNC -Wno-CASEOVERLAP"
        ;;
    *)
        echo "ERROR: Unknown EXAMPLE='${EXAMPLE}'" >&2
        echo "Known examples: 01-counter 02-traffic-fsm 03-uart 04-6502" >&2
        exit 1
        ;;
esac

mkdir -p "${OBJ_DIR}"

echo "=== Verilator: ${EXAMPLE} ===" >&2
# shellcheck disable=SC2086
verilator --cc \
    ${VFILES} \
    --top-module "${TOP}" \
    ${VFLAGS} \
    --Mdir "${OBJ_DIR}"

echo "=== Build (Verilator Makefile) ===" >&2
make -C "${OBJ_DIR}" -f "V${TOP}.mk" -j"$(nproc)" \
    OPT_FAST="-O3" OPT_SLOW="-O3" OPT_GLOBAL="-O3"

echo "=== Link ===" >&2
CFLAGS="-O3 -std=c++17 -I${VERILATOR_ROOT}/include -I${OBJ_DIR}"

g++ ${CFLAGS} \
    "${EXAMPLE_DIR}/cxx/harness.cpp" \
    "${EXAMPLE_DIR}/cxx/main_linux.cpp" \
    "${OBJ_DIR}/V${TOP}__ALL.a" \
    "${OBJ_DIR}/libverilated.a" \
    -lpthread \
    -o "${BUILD_DIR}/sim"

echo "=== Done: ${BUILD_DIR}/sim ===" >&2
