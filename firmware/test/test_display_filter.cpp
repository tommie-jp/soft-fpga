// firmware/test/test_display_filter.cpp
//
// formatDisplayChar (Apple-1 のディスプレイ出力 → 端末へ書くバイト列) のホスト単体テスト。
// scripts/test-fw-unit.sh で回す。

#include <cstdint>
#include <cstdio>
#include <cstdlib>

#include "display_filter.h"

namespace {

int g_failures = 0;

void expectBytes(const char* name, uint8_t ch, int count, uint8_t b0 = 0, uint8_t b1 = 0) {
    uint8_t out[2] = {0, 0};
    const int n = apple1::formatDisplayChar(ch, out);
    const bool ok = n == count && (count < 1 || out[0] == b0) && (count < 2 || out[1] == b1);
    if (!ok) {
        std::fprintf(stderr, "FAIL %s: n=%d out=[%02X %02X] (expected n=%d [%02X %02X])\n",
                     name, n, out[0], out[1], count, b0, b1);
        ++g_failures;
    }
}

}  // namespace

int main() {
    expectBytes("printableLetter", 'A', 1, 'A');
    expectBytes("space", ' ', 1, ' ');
    expectBytes("backslashPrompt", '\\', 1, '\\');
    expectBytes("lineFeedBecomesCrLf", '\n', 2, '\r', '\n');
    expectBytes("carriageReturnIsDropped", '\r', 0);
    expectBytes("deleteIsDropped", 0x7F, 0);
    expectBytes("nulIsDropped", 0x00, 0);
    expectBytes("escapeIsDropped", 0x1B, 0);
    expectBytes("bit7IsMasked", 0xC1, 1, 'A');
    expectBytes("bit7DeleteIsDropped", 0xFF, 0);

    if (g_failures != 0) {
        std::fprintf(stderr, "%d test(s) failed\n", g_failures);
        return EXIT_FAILURE;
    }
    std::puts("display_filter: all tests passed");
    return EXIT_SUCCESS;
}
