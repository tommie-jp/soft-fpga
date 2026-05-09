cmake_minimum_required(VERSION 3.19)
project(sim_04_6502 CXX)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

find_package(verilator HINTS $ENV{VERILATOR_ROOT} /usr/local REQUIRED)

add_executable(sim cxx/harness.cpp cxx/main_linux.cpp)
target_compile_features(sim PUBLIC cxx_std_17)

verilate(sim
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
