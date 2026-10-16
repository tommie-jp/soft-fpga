// firmware/apple1/led_panel.cpp

#include "led_panel.h"

#include "hardware/gpio.h"
#include "panel_logic.h"
#include "pico/stdlib.h"

#ifndef APPLE1_DEBUG_UART
#error "APPLE1_DEBUG_UART must be defined by CMake (0 or 1)"
#endif

namespace {

namespace panel = apple1::panel;

// デバッグ UART (UART0 = GP0 / GP1) を使う間は A0 / A1 を LED に出さない。
#if APPLE1_DEBUG_UART
constexpr uint32_t kDriveMask = panel::kOutputMask & ~panel::kDebugUartMask;
#else
constexpr uint32_t kDriveMask = panel::kOutputMask;
#endif

constexpr uint32_t kSelfTestStepMs = 80;
constexpr uint32_t kSelfTestAllOnMs = 300;

apple1::PanelLogic g_panel;

// 1 本ずつ流してから全点灯。配線ミスと LED の向きの確認用。
void selfTest() {
    for (uint32_t bit = 0; bit < 32; ++bit) {
        const uint32_t pin = 1u << bit;
        if (kDriveMask & pin) {
            gpio_put_masked(kDriveMask, pin);
            sleep_ms(kSelfTestStepMs);
        }
    }
    gpio_put_masked(kDriveMask, kDriveMask);
    sleep_ms(kSelfTestAllOnMs);
    gpio_put_masked(kDriveMask, 0);
}

}  // namespace

// harness.cpp (SFA_PICO) から毎サイクル呼ばれる。
extern "C" void sim_bus_observe(uint16_t ab, uint8_t db, bool we, bool sync, uint16_t pc) {
    const uint32_t word = g_panel.update(apple1::BusSample{ab, db, we, sync, pc});
    gpio_put_masked(kDriveMask, word);
}

namespace apple1 {

void ledPanelInit() {
    gpio_init_mask(kDriveMask);
    gpio_set_dir_out_masked(kDriveMask);
    gpio_put_masked(kDriveMask, 0);
}

void ledPanelReset() {
    g_panel.reset();
}

bool ledPanelCommand(uint8_t cmd) {
    if (cmd == 't') {
        selfTest();
        return true;
    }
    return g_panel.applyCommand(cmd);
}

}  // namespace apple1
