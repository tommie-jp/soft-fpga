cmake_minimum_required(VERSION 3.27)
project(sim_04_6502 CXX)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(verilator HINTS $ENV{VERILATOR_ROOT} /usr/local REQUIRED)

add_executable(sim cxx/harness.cpp cxx/main_linux.cpp)
target_compile_features(sim PRIVATE cxx_std_17)

verilate(sim
    PREFIX Vapple1_top
    SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/verilog/apple1_top.v
        ${CMAKE_CURRENT_SOURCE_DIR}/verilog/hoglet/cpu_65c02.v
        ${CMAKE_CURRENT_SOURCE_DIR}/verilog/hoglet/ALU.v
    TOP_MODULE apple1_top
    VERILATOR_ARGS
        -Wno-CASEX
        -Wno-CASEINCOMPLETE
        -Wno-WIDTHEXPAND
        -Wno-WIDTHTRUNC
        -Wno-CASEOVERLAP
)
