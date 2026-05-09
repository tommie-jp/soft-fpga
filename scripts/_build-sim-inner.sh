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

echo "=== Compile ===" >&2
CFLAGS="-O2 -std=c++17 -I${VERILATOR_ROOT}/include -I${OBJ_DIR}"

g++ ${CFLAGS} \
    -c "${VERILATOR_ROOT}/include/verilated.cpp" \
    -o "${OBJ_DIR}/verilated.o"

g++ ${CFLAGS} \
    -c "${VERILATOR_ROOT}/include/verilated_threads.cpp" \
    -o "${OBJ_DIR}/verilated_threads.o"

g++ ${CFLAGS} \
    "${OBJ_DIR}"/V*.cpp \
    "${OBJ_DIR}/verilated.o" \
    "${OBJ_DIR}/verilated_threads.o" \
    "${EXAMPLE_DIR}/cxx/harness.cpp" \
    "${EXAMPLE_DIR}/cxx/main_linux.cpp" \
    -lpthread \
    -o "${BUILD_DIR}/sim"

echo "=== Done: ${BUILD_DIR}/sim ===" >&2
