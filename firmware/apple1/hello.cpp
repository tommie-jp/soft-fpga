// firmware/apple1/hello.cpp
//
// Phase 0 の疎通確認用ファームウェア。
//   - GP25 (基板の LED) を 2 Hz で点滅
//   - USB-CDC / UART0 で受けたバイトをそのままエコー
//   - 行頭が "XI" の行にビルド情報で応答 (リバーシ main.cpp の id_report と同形式)
//
// Verilator も 6502 も含まない。ビルド環境 (Docker / Pico SDK / Probe 書き込み /
// HIL) を先に通すためのもの。

#include <cstdint>

#include "diag.h"
#include "hardware/gpio.h"
#include "pico/stdlib.h"

namespace {

constexpr uint32_t kBlinkHalfPeriodUs = 250000;  // 2 Hz
constexpr int kLineMax = 32;

}  // namespace

int main() {
    stdio_init_all();

    const uint ledPin = PICO_DEFAULT_LED_PIN;
    gpio_init(ledPin);
    gpio_set_dir(ledPin, GPIO_OUT);

    sleep_ms(500);                          // USB-CDC ホスト接続待ち
    while (getchar_timeout_us(0) >= 0) {}   // 接続時の余分バイトを捨てる

    char line[kLineMax] = {};
    int lineLen = 0;
    bool led = false;
    uint32_t nextToggleUs = time_us_32() + kBlinkHalfPeriodUs;

    while (true) {
        const uint32_t now = time_us_32();
        if (static_cast<int32_t>(now - nextToggleUs) >= 0) {
            led = !led;
            gpio_put(ledPin, led);
            nextToggleUs += kBlinkHalfPeriodUs;
        }

        const int c = getchar_timeout_us(0);
        if (c < 0) {
            continue;
        }
        putchar_raw(c);

        if (c == '\n') {
            if (lineLen >= 2 && line[0] == 'X' && line[1] == 'I') {
                diag::reportId();
            }
            lineLen = 0;
        } else if (c != '\r' && lineLen < kLineMax) {
            line[lineLen++] = static_cast<char>(c);
        }
    }
}
