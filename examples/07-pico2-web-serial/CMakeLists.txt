cmake_minimum_required(VERSION 3.13)

# Pico SDK のパスを環境変数または cmake 変数で設定しておく
# 例: export PICO_SDK_PATH=~/pico-sdk
include($ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake)

project(pico2_web_serial C CXX ASM)
set(CMAKE_C_STANDARD   11)
set(CMAKE_CXX_STANDARD 17)

# RP2350 ターゲット (Pico 2)
set(PICO_BOARD pico2)

pico_sdk_init()

add_executable(pico2_web_serial
    main.c
)

# USB-CDC を stdio として使用（UART は無効化）
pico_enable_stdio_usb(pico2_web_serial  1)
pico_enable_stdio_uart(pico2_web_serial 0)

target_link_libraries(pico2_web_serial
    pico_stdlib
    hardware_adc
)

# UF2 / bin / hex を生成
pico_add_extra_outputs(pico2_web_serial)
