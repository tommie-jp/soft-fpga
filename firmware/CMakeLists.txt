cmake_minimum_required(VERSION 3.13)

include($ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake)

# Verilator 出力 (Vapple1_top) は dynamic_cast を使うので RTTI を有効化する。
# pico_sdk_init より前に設定。
set(PICO_CXX_ENABLE_RTTI 1)
set(PICO_CXX_ENABLE_EXCEPTIONS 0)

project(apple1_firmware C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# デバッグ UART (GP0 / GP1 = UART0) をコンソールに併用する。
# Debug Probe の UART ブリッジ (/dev/ttyACM0) から HIL テストやログが取れる。
# LED パネルを配線したら OFF にする (GP0 / GP1 は A0 / A1 に使う: docs/07 §9.2)。
option(APPLE1_DEBUG_UART "コンソールを UART0 (GP0/GP1) にも出す" ON)

pico_sdk_init()

# --- ビルドメタデータ ---
execute_process(
    COMMAND git rev-parse --short HEAD
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE GIT_HASH
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET)
execute_process(
    COMMAND git diff-index --quiet HEAD
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    RESULT_VARIABLE GIT_IS_DIRTY
    ERROR_QUIET)
if(GIT_IS_DIRTY)
    string(APPEND GIT_HASH "+")
endif()
if(NOT GIT_HASH)
    set(GIT_HASH "unknown")
endif()

# --- 全ターゲット共通の設定 ---
# 注: LTO は Pico SDK の --wrap=printf/puts/putchar と衝突して link エラーになる
# (LTO で printf がインライン化され --wrap が効かない) ため採用しない。
function(apple1_configure_target TARGET_NAME)
    target_compile_options(${TARGET_NAME} PRIVATE
        -Os
        -fno-unwind-tables
        -Wall
        -Wextra
    )
    target_compile_definitions(${TARGET_NAME} PRIVATE
        NDEBUG
        PICO_PRINTF_SUPPORT_FLOAT=0
        PICO_PRINTF_SUPPORT_EXPONENTIAL=0
        GIT_HASH="${GIT_HASH}"
        PICO_PLATFORM_STR="${PICO_PLATFORM}"
    )
    target_sources(${TARGET_NAME} PRIVATE common/diag.cpp)
    target_include_directories(${TARGET_NAME} PRIVATE ${CMAKE_SOURCE_DIR}/common)
    target_link_libraries(${TARGET_NAME}
        pico_stdlib
        hardware_clocks
    )

    pico_enable_stdio_usb(${TARGET_NAME} 1)
    if(APPLE1_DEBUG_UART)
        pico_enable_stdio_uart(${TARGET_NAME} 1)
        target_compile_definitions(${TARGET_NAME} PRIVATE APPLE1_DEBUG_UART=1)
    else()
        pico_enable_stdio_uart(${TARGET_NAME} 0)
        target_compile_definitions(${TARGET_NAME} PRIVATE APPLE1_DEBUG_UART=0)
    endif()
    pico_add_extra_outputs(${TARGET_NAME})
endfunction()

# --- Phase 0: 疎通確認 (Verilator なし) ---
add_executable(apple1_hello apple1/hello.cpp)
apple1_configure_target(apple1_hello)

# --- Phase 1: Apple-1 (6502 + wozmon + Integer BASIC) ---
# examples/04-6502 の RTL と harness.cpp をそのまま使う。
# Verilator ランタイムは上流 5.048 から <iostream> / <sstream> を外したコピー
# (common/verilator-runtime/verilated.cpp)。ホスト前提機能 (mutex / threads / trace) は
# stub_mutex.h が include guard 先取りと最小型 stub で迂回する。
set(APPLE1_EXAMPLE_DIR ${CMAKE_SOURCE_DIR}/../examples/04-6502)
set(APPLE1_RUNTIME_DIR ${CMAKE_SOURCE_DIR}/common/verilator-runtime)
set(VERILATOR_BIN /usr/local/bin/verilator)
set(VERILATOR_INC /usr/local/share/verilator/include)
set(APPLE1_VERILATED_DIR ${CMAKE_BINARY_DIR}/verilated_apple1)

set(APPLE1_RTL
    ${APPLE1_EXAMPLE_DIR}/verilog/apple1_top.v
    ${APPLE1_EXAMPLE_DIR}/verilog/hoglet/cpu_65c02.v
    ${APPLE1_EXAMPLE_DIR}/verilog/hoglet/ALU.v
)
# RTL が変わったら configure をやり直し、Verilator も再実行する。
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${APPLE1_RTL})

file(MAKE_DIRECTORY ${APPLE1_VERILATED_DIR})
execute_process(
    COMMAND ${VERILATOR_BIN} --cc --no-trace --no-timing
            -Wno-CASEX -Wno-CASEINCOMPLETE -Wno-WIDTHEXPAND -Wno-WIDTHTRUNC -Wno-CASEOVERLAP
            --top-module apple1_top
            --Mdir ${APPLE1_VERILATED_DIR}
            ${APPLE1_RTL}
    RESULT_VARIABLE _vl_result
)
if(NOT _vl_result EQUAL 0)
    message(FATAL_ERROR "Verilator failed for apple1_top (exit ${_vl_result})")
endif()

file(GLOB APPLE1_VERILATED_SOURCES CONFIGURE_DEPENDS "${APPLE1_VERILATED_DIR}/Vapple1_top*.cpp")

add_executable(apple1
    apple1/main_pico.cpp
    apple1/sim_core.cpp
    apple1/led_panel.cpp
    ${APPLE1_EXAMPLE_DIR}/cxx/harness.cpp
    common/cxx_minimal.cpp
    ${APPLE1_VERILATED_SOURCES}
    ${APPLE1_RUNTIME_DIR}/verilated.cpp
)

target_include_directories(apple1 SYSTEM PRIVATE
    ${APPLE1_VERILATED_DIR}
    ${VERILATOR_INC}
    ${VERILATOR_INC}/vltstd
)
target_include_directories(apple1 PRIVATE ${APPLE1_RUNTIME_DIR})
target_include_directories(apple1 PRIVATE ${CMAKE_SOURCE_DIR}/apple1)

# Verilator 由来のソースとランタイム: stub_mutex.h を差し込み、警告を抑止する。
set_source_files_properties(
    ${APPLE1_VERILATED_SOURCES} ${APPLE1_RUNTIME_DIR}/verilated.cpp
    PROPERTIES COMPILE_FLAGS "-include ${APPLE1_RUNTIME_DIR}/stub_mutex.h -w"
)
# harness.cpp は Verilator ヘッダを include するので stub_mutex.h だけ差し込む。
set_source_files_properties(
    ${APPLE1_EXAMPLE_DIR}/cxx/harness.cpp
    PROPERTIES COMPILE_FLAGS "-include ${APPLE1_RUNTIME_DIR}/stub_mutex.h"
)

target_compile_definitions(apple1 PRIVATE SFA_PICO=1)
target_link_libraries(apple1 pico_multicore)
apple1_configure_target(apple1)
