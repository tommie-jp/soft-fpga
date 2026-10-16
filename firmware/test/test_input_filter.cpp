// firmware/test/test_input_filter.cpp
//
// InputFilter (端末入力 → Apple-1 キー / 本体コマンド) のホスト単体テスト。
// Pico SDK に依存しないので g++ だけで回る: scripts/test-fw-unit.sh

#include <cstdint>
#include <cstdio>
#include <cstdlib>

#include "input_filter.h"

namespace {

int g_failures = 0;

void expectEvent(const char* name, apple1::InputEvent actual,
                 apple1::InputKind kind, uint8_t value) {
    if (actual.kind != kind || (kind != apple1::InputKind::None && actual.value != value)) {
        std::fprintf(stderr, "FAIL %s: kind=%d value=0x%02X (expected kind=%d value=0x%02X)\n",
                     name, static_cast<int>(actual.kind), actual.value,
                     static_cast<int>(kind), value);
        ++g_failures;
    }
}

using apple1::InputFilter;
using apple1::InputKind;

void plainCharacterIsKey() {
    InputFilter f;
    expectEvent("plainCharacterIsKey", f.feed('A'), InputKind::Key, 'A');
}

void carriageReturnIsKey() {
    InputFilter f;
    expectEvent("carriageReturnIsKey", f.feed('\r'), InputKind::Key, '\r');
}

void lineFeedAloneBecomesCarriageReturn() {
    InputFilter f;
    expectEvent("lineFeedAloneBecomesCarriageReturn", f.feed('\n'), InputKind::Key, '\r');
}

void lineFeedAfterCarriageReturnIsDropped() {
    InputFilter f;
    f.feed('\r');
    expectEvent("lineFeedAfterCarriageReturnIsDropped", f.feed('\n'), InputKind::None, 0);
}

void twoLineFeedsGiveTwoCarriageReturns() {
    InputFilter f;
    expectEvent("twoLineFeeds[0]", f.feed('\n'), InputKind::Key, '\r');
    expectEvent("twoLineFeeds[1]", f.feed('\n'), InputKind::Key, '\r');
}

void deleteAndBackspaceBecomeUnderscore() {
    InputFilter f;
    expectEvent("delete", f.feed(0x7F), InputKind::Key, '_');
    expectEvent("backspace", f.feed(0x08), InputKind::Key, '_');
}

void controlCPassesThrough() {
    InputFilter f;
    expectEvent("controlCPassesThrough", f.feed(0x03), InputKind::Key, 0x03);
}

void highBitBytesAreDropped() {
    InputFilter f;
    expectEvent("highBitBytesAreDropped", f.feed(0xE3), InputKind::None, 0);
}

void escapeThenByteIsCommand() {
    InputFilter f;
    expectEvent("escape", f.feed(0x1D), InputKind::None, 0);
    expectEvent("command", f.feed('b'), InputKind::Command, 'b');
}

void byteAfterCommandIsKeyAgain() {
    InputFilter f;
    f.feed(0x1D);
    f.feed('b');
    expectEvent("byteAfterCommandIsKeyAgain", f.feed('x'), InputKind::Key, 'x');
}

void lineFeedAfterCommandIsCarriageReturn() {
    InputFilter f;
    f.feed('\r');
    f.feed(0x1D);
    f.feed('i');
    expectEvent("lineFeedAfterCommandIsCarriageReturn", f.feed('\n'), InputKind::Key, '\r');
}

}  // namespace

int main() {
    plainCharacterIsKey();
    carriageReturnIsKey();
    lineFeedAloneBecomesCarriageReturn();
    lineFeedAfterCarriageReturnIsDropped();
    twoLineFeedsGiveTwoCarriageReturns();
    deleteAndBackspaceBecomeUnderscore();
    controlCPassesThrough();
    highBitBytesAreDropped();
    escapeThenByteIsCommand();
    byteAfterCommandIsKeyAgain();
    lineFeedAfterCommandIsCarriageReturn();

    if (g_failures != 0) {
        std::fprintf(stderr, "%d test(s) failed\n", g_failures);
        return EXIT_FAILURE;
    }
    std::puts("input_filter: all tests passed");
    return EXIT_SUCCESS;
}
