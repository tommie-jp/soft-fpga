cmake_minimum_required(VERSION 3.27)
project(test_dormann CXX)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(verilator HINTS $ENV{VERILATOR_ROOT} /usr/local REQUIRED)

add_executable(test_dormann test_dormann.cpp)
target_compile_features(test_dormann PRIVATE cxx_std_17)

set(VERILOG_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../examples/04-6502/verilog)

verilate(test_dormann
    PREFIX Vapple1_top
    SOURCES
        ${VERILOG_DIR}/apple1_top.v
        ${VERILOG_DIR}/hoglet/cpu_65c02.v
        ${VERILOG_DIR}/hoglet/ALU.v
    TOP_MODULE apple1_top
    VERILATOR_ARGS
        -Wno-CASEX
        -Wno-CASEINCOMPLETE
        -Wno-WIDTHEXPAND
        -Wno-WIDTHTRUNC
        -Wno-CASEOVERLAP
)
