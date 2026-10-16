// firmware/apple1/led_panel.h
//
// LED パネル（バス信号を GPIO に出す）。表示の決め方は common/panel_logic.h。
// GPIO を触るのは core1 だけ（sim_bus_observe() は harness の step() から呼ばれる）。

#pragma once

#include <cstdint>

namespace apple1 {

// GPIO を出力にする。sim_init() より前に core1 から 1 回呼ぶ。
void ledPanelInit();

// 表示状態を初期状態（SYNC サンプル + バス）に戻す。リセット時に呼ぶ。
void ledPanelReset();

// y / a / o（表示モード）と t（全 LED の自己診断）。扱ったら true。
// 't' は約 2 秒かかり、その間シミュレーションは止まる。
bool ledPanelCommand(uint8_t cmd);

}  // namespace apple1
