// firmware/apple1/main_pico.cpp
//
// Pico 2 上の Apple-1 (6502 + wozmon + Integer BASIC)。
// core0: USB-CDC / UART0 のコンソールと LED。core1: シミュレーション (sim_core.cpp)。
//
// コンソールの操作:
//   - 通常の入力は Apple-1 のキーボードへ送る（InputFilter が変換する）
//   - Ctrl-] に続く 1 文字は本体へのコマンド
//       i  ビルド情報 (+XI ...)
//       b  実効クロックの実測値 (+XB ...)
//       r  リセット（実速・SYNC サンプル表示に戻る）
//     実行制御:  g 実速 / w 低速 4 Hz / c 固定クロック 10 kHz / n 次の命令（ステップ）
//     LED 表示:  y SYNC サンプル / a 全サイクル / o ポート($C000) / t LED 自己診断

#include <cstdint>
#include <cstdio>

#include "diag.h"
#include "display_filter.h"
#include "input_filter.h"
#include "pico/stdlib.h"
#include "sim_core.h"

namespace {

constexpr uint32_t kBenchTimeoutUs = 200000;

// "+XB clk=0.312MHz cycles=NNN us=NNN\r\n"  浮動小数は使わない
void reportBench() {
    apple1::BenchStats stats{};
    if (!apple1::simQueryBench(&stats, kBenchTimeoutUs)) {
        printf("+XB timeout\r\n");
        return;
    }
    if (stats.us == 0) {
        printf("+XB no-data\r\n");
        return;
    }
    const uint64_t clkKhz = stats.cycles * 1000u / stats.us;
    printf("+XB clk=%lu.%03luMHz cycles=%lu us=%lu\r\n",
           static_cast<unsigned long>(clkKhz / 1000u),
           static_cast<unsigned long>(clkKhz % 1000u),
           static_cast<unsigned long>(stats.cycles),
           static_cast<unsigned long>(stats.us));
}

void handleCommand(uint8_t cmd) {
    switch (cmd) {
        case 'i': diag::reportId(); break;
        case 'b': reportBench(); break;
        case 'r': apple1::simPostReset(); break;
        default:
            if (!apple1::isControlCommand(cmd)) {
                printf("+ERR unknown command 0x%02X\r\n", static_cast<unsigned>(cmd));
            } else if (!apple1::simPostControl(cmd)) {
                printf("+ERR busy\r\n");
            }
            break;
    }
}

void flushDisplay() {
    uint8_t ch;
    while (apple1::simPollDisplay(&ch)) {
        uint8_t out[2];
        const int n = apple1::formatDisplayChar(ch, out);
        for (int i = 0; i < n; ++i) {
            putchar_raw(out[i]);
        }
    }
}

// キューに空きがあるときだけ読む。満杯のときは stdio 側に残し、USB のフロー制御に任せる
// （長い BASIC プログラムの貼り付けで文字を落とさない）。
void pumpInput(apple1::InputFilter* filter) {
    while (apple1::simKeyRoom()) {
        const int c = getchar_timeout_us(0);
        if (c < 0) {
            return;
        }
        const apple1::InputEvent ev = filter->feed(static_cast<uint8_t>(c));
        if (ev.kind == apple1::InputKind::Key) {
            apple1::simPostKey(ev.value);
        } else if (ev.kind == apple1::InputKind::Command) {
            handleCommand(ev.value);
        }
    }
}

}  // namespace

int main() {
    stdio_init_all();

    sleep_ms(500);                          // USB-CDC ホスト接続待ち
    while (getchar_timeout_us(0) >= 0) {}   // 接続時の余分バイトを捨てる

    apple1::simCoreStart();

    apple1::InputFilter filter;
    while (true) {
        flushDisplay();
        pumpInput(&filter);
    }
}
