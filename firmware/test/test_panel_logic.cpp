// firmware/test/test_panel_logic.cpp
//
// PanelLogic（LED パネルに出す GPIO ワードの決定）のホスト単体テスト。
// scripts/test-fw-unit.sh で回す。

#include <cstdint>
#include <cstdio>
#include <cstdlib>

#include "panel_logic.h"

namespace {

using apple1::BusSample;
using apple1::PanelLogic;
namespace panel = apple1::panel;

int g_failures = 0;

void expectEq(const char* name, uint32_t actual, uint32_t expected) {
    if (actual != expected) {
        std::fprintf(stderr, "FAIL %s: actual=0x%08X expected=0x%08X\n", name, actual, expected);
        ++g_failures;
    }
}

void expectTrue(const char* name, bool value) {
    if (!value) {
        std::fprintf(stderr, "FAIL %s\n", name);
        ++g_failures;
    }
}

// 命令フェッチ (SYNC=1) のサンプル。ab は命令の次の番地、pc も同じ（pc - 1 が命令の番地）。
BusSample fetch(uint16_t opcodeAddr, uint8_t opcode) {
    return BusSample{static_cast<uint16_t>(opcodeAddr + 1), opcode, false, true,
                     static_cast<uint16_t>(opcodeAddr + 1)};
}

BusSample readCycle(uint16_t ab, uint8_t db) {
    return BusSample{ab, db, false, false, ab};
}

BusSample writeCycle(uint16_t ab, uint8_t db) {
    return BusSample{ab, db, true, false, ab};
}

uint16_t addrOf(uint32_t word) { return static_cast<uint16_t>(word & 0xFFFFu); }

uint8_t dataOf(uint32_t word) {
    return static_cast<uint8_t>(((word >> 16) & 0x7Fu) | (((word >> 26) & 1u) << 7));
}

void packPlacesEachSignalOnItsPin() {
    // A=0xABCD, D=0x81 (D0 と D7), 読み出し, SYNC, φ2
    const uint32_t word = panel::pack(0xABCD, 0x81, true, true, true);
    const uint32_t expected = 0xABCDu | (0x01u << 16) | (1u << 26) | (1u << 27) | (1u << 28) |
                              (1u << 25);
    expectEq("packPlacesEachSignalOnItsPin", word, expected);
}

void packWriteCycleClearsReadWriteLed() {
    const uint32_t word = panel::pack(0, 0, false, false, false);
    expectEq("packWriteCycleClearsReadWriteLed", word, 0u);
}

void packStaysInsideOutputMask() {
    const uint32_t word = panel::pack(0xFFFF, 0xFF, true, true, true);
    expectEq("packStaysInsideOutputMask", word, panel::kOutputMask);
}

void defaultShowsOpcodeAddressOnSync() {
    PanelLogic p;
    const uint32_t w = p.update(fetch(0xFF00, 0xD8));
    expectEq("defaultShowsOpcodeAddressOnSync.addr", addrOf(w), 0xFF00);
    expectEq("defaultShowsOpcodeAddressOnSync.data", dataOf(w), 0xD8);
}

void syncSampleHoldsAddressAndDataBetweenFetches() {
    PanelLogic p;
    p.update(fetch(0x0300, 0xA9));
    const uint32_t w = p.update(readCycle(0x0302, 0x55));
    expectEq("holds.addr", addrOf(w), 0x0300);
    expectEq("holds.data", dataOf(w), 0xA9);
}

void readWriteAndSyncLedsStayLiveInSyncSample() {
    PanelLogic p;
    p.update(fetch(0x0300, 0xA9));
    const uint32_t w = p.update(writeCycle(0x0400, 0x55));
    expectTrue("rw.low", (w & (1u << 27)) == 0);   // 書き込み
    expectTrue("sync.low", (w & (1u << 28)) == 0);
    const uint32_t f = p.update(fetch(0x0303, 0x4C));
    expectTrue("rw.high", (f & (1u << 27)) != 0);  // 読み出し
    expectTrue("sync.high", (f & (1u << 28)) != 0);
}

void phi2TogglesEveryCycle() {
    PanelLogic p;
    const uint32_t a = p.update(readCycle(0, 0));
    const uint32_t b = p.update(readCycle(0, 0));
    const uint32_t c = p.update(readCycle(0, 0));
    expectTrue("phi2.a!=b", ((a ^ b) & panel::kPhi2Bit) != 0);
    expectTrue("phi2.a==c", ((a ^ c) & panel::kPhi2Bit) == 0);
}

void liveModeShowsRawBusEveryCycle() {
    PanelLogic p;
    expectTrue("apply a", p.applyCommand('a'));
    const uint32_t w = p.update(readCycle(0x1234, 0x56));
    expectEq("live.addr", addrOf(w), 0x1234);
    expectEq("live.data", dataOf(w), 0x56);
}

void firstPortWriteSwitchesDataLedsToPort() {
    PanelLogic p;
    p.update(fetch(0x0300, 0x8D));
    p.update(writeCycle(0xC000, 0x55));
    const uint32_t w = p.update(fetch(0x0303, 0x4C));
    expectEq("port.addr", addrOf(w), 0x0303);
    expectEq("port.data", dataOf(w), 0x55);
}

void portValueSurvivesOtherWrites() {
    PanelLogic p;
    p.update(writeCycle(0xC000, 0xAA));
    p.update(writeCycle(0x0400, 0x11));
    const uint32_t w = p.update(fetch(0x0300, 0xEA));
    expectEq("portValueSurvivesOtherWrites", dataOf(w), 0xAA);
}

void syncSampleCommandReturnsToBus() {
    PanelLogic p;
    p.update(writeCycle(0xC000, 0x55));
    expectTrue("apply y", p.applyCommand('y'));
    const uint32_t w = p.update(fetch(0x0300, 0xA9));
    expectEq("y.data", dataOf(w), 0xA9);
}

void portCommandShowsPortWithoutAWrite() {
    PanelLogic p;
    expectTrue("apply o", p.applyCommand('o'));
    const uint32_t w = p.update(fetch(0x0300, 0xA9));
    expectEq("o.data", dataOf(w), 0x00);
}

void resetClearsPortAndReturnsToBus() {
    PanelLogic p;
    p.update(writeCycle(0xC000, 0x55));
    p.reset();
    const uint32_t w = p.update(fetch(0xFF00, 0xD8));
    expectEq("reset.addr", addrOf(w), 0xFF00);
    expectEq("reset.data", dataOf(w), 0xD8);
}

void commandClassification() {
    expectTrue("isCommand y", panel::isCommand('y'));
    expectTrue("isCommand a", panel::isCommand('a'));
    expectTrue("isCommand o", panel::isCommand('o'));
    expectTrue("isCommand t", panel::isCommand('t'));
    expectTrue("isCommand x is false", !panel::isCommand('x'));
    PanelLogic p;
    expectTrue("applyCommand t is handled elsewhere", !p.applyCommand('t'));
}

}  // namespace

int main() {
    packPlacesEachSignalOnItsPin();
    packWriteCycleClearsReadWriteLed();
    packStaysInsideOutputMask();
    defaultShowsOpcodeAddressOnSync();
    syncSampleHoldsAddressAndDataBetweenFetches();
    readWriteAndSyncLedsStayLiveInSyncSample();
    phi2TogglesEveryCycle();
    liveModeShowsRawBusEveryCycle();
    firstPortWriteSwitchesDataLedsToPort();
    portValueSurvivesOtherWrites();
    syncSampleCommandReturnsToBus();
    portCommandShowsPortWithoutAWrite();
    resetClearsPortAndReturnsToBus();
    commandClassification();

    if (g_failures != 0) {
        std::fprintf(stderr, "%d test(s) failed\n", g_failures);
        return EXIT_FAILURE;
    }
    std::puts("panel_logic: all tests passed");
    return EXIT_SUCCESS;
}
