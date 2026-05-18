cmake_minimum_required(VERSION 3.27)
project(cpm_06_8080 CXX)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(verilator HINTS $ENV{VERILATOR_ROOT} /usr/local REQUIRED)

add_executable(cpm cxx/harness.cpp cxx/main_linux.cpp)
target_compile_features(cpm PRIVATE cxx_std_17)

verilate(cpm
    PREFIX Vcpm_top
    SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/verilog/cpm_top.v
        ${CMAKE_CURRENT_SOURCE_DIR}/verilog/vm80a/org/rtl/vm80a.v
    TOP_MODULE cpm_top
    VERILATOR_ARGS
        -Wno-WIDTHEXPAND
        -Wno-WIDTHTRUNC
        -Wno-UNOPTFLAT
)
