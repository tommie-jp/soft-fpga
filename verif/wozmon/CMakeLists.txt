cmake_minimum_required(VERSION 3.27)
project(test_wozmon CXX)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(verilator HINTS $ENV{VERILATOR_ROOT} /usr/local REQUIRED)

set(VERILOG_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../examples/04-6502/verilog)
set(BASIC_BIN   ${CMAKE_CURRENT_SOURCE_DIR}/../../examples/04-6502/rom/basic.bin)

set(VERILATOR_APPLE1_ARGS
    -Wno-CASEX -Wno-CASEINCOMPLETE -Wno-WIDTHEXPAND -Wno-WIDTHTRUNC -Wno-CASEOVERLAP)
set(VERILOG_APPLE1_SOURCES
    ${VERILOG_DIR}/apple1_top.v
    ${VERILOG_DIR}/hoglet/cpu_65c02.v
    ${VERILOG_DIR}/hoglet/ALU.v)

# ── test_wozmon ────────────────────────────────────────────────────────────
add_executable(test_wozmon test_wozmon.cpp)
target_compile_features(test_wozmon PRIVATE cxx_std_17)
verilate(test_wozmon
    PREFIX Vapple1_top
    SOURCES ${VERILOG_APPLE1_SOURCES}
    TOP_MODULE apple1_top
    VERILATOR_ARGS ${VERILATOR_APPLE1_ARGS}
)

# ── test_programs ──────────────────────────────────────────────────────────
add_executable(test_programs test_programs.cpp)
target_compile_features(test_programs PRIVATE cxx_std_17)
if(EXISTS "${BASIC_BIN}")
    target_compile_definitions(test_programs PRIVATE
        BASIC_BIN_PATH="${BASIC_BIN}")
endif()
verilate(test_programs
    PREFIX Vapple1_top
    SOURCES ${VERILOG_APPLE1_SOURCES}
    TOP_MODULE apple1_top
    VERILATOR_ARGS ${VERILATOR_APPLE1_ARGS}
)

# ── test_basic ─────────────────────────────────────────────────────────────
add_executable(test_basic test_basic.cpp)
target_compile_features(test_basic PRIVATE cxx_std_17)
if(EXISTS "${BASIC_BIN}")
    target_compile_definitions(test_basic PRIVATE
        BASIC_BIN_PATH="${BASIC_BIN}")
endif()
verilate(test_basic
    PREFIX Vapple1_top
    SOURCES ${VERILOG_APPLE1_SOURCES}
    TOP_MODULE apple1_top
    VERILATOR_ARGS ${VERILATOR_APPLE1_ARGS}
)
