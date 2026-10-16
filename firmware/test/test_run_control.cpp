// firmware/test/test_run_control.cpp
//
// RunControl（実速 / 低速 / 固定クロック / ステップ実行の切り替え）のホスト単体テスト。
// 時刻は引数で渡すので、実機なしで時間経過を再現できる。

#include <cstdint>
#include <cstdio>
#include <cstdlib>

#include "run_control.h"

namespace {

using apple1::RunAction;
using apple1::RunControl;

int g_failures = 0;

void expectAction(const char* name, RunAction actual, RunAction expected) {
    if (actual != expected) {
        std::fprintf(stderr, "FAIL %s: actual=%d expected=%d\n", name, static_cast<int>(actual),
                     static_cast<int>(expected));
        ++g_failures;
    }
}

void expectTrue(const char* name, bool value) {
    if (!value) {
        std::fprintf(stderr, "FAIL %s\n", name);
        ++g_failures;
    }
}

void defaultIsFullSpeedBatch() {
    RunControl rc;
    expectAction("defaultIsFullSpeedBatch", rc.next(0), RunAction::Batch);
}

void slowClockRunsOneCyclePerPeriod() {
    RunControl rc;
    rc.apply('w', 1000);
    expectAction("slow.first", rc.next(1000), RunAction::Cycle);
    expectAction("slow.idle", rc.next(1000 + RunControl::kSlowPeriodUs - 1), RunAction::Idle);
    expectAction("slow.second", rc.next(1000 + RunControl::kSlowPeriodUs), RunAction::Cycle);
}

void fixedClockRunsOneCyclePerPeriod() {
    RunControl rc;
    rc.apply('c', 0);
    expectAction("fixed.t0", rc.next(0), RunAction::Cycle);
    expectAction("fixed.t99", rc.next(99), RunAction::Idle);
    expectAction("fixed.t100", rc.next(100), RunAction::Cycle);
    expectAction("fixed.t200", rc.next(200), RunAction::Cycle);
}

void fallingBehindDoesNotBurst() {
    RunControl rc;
    rc.apply('c', 0);
    rc.next(0);
    expectAction("burst.late", rc.next(10000000), RunAction::Cycle);
    expectAction("burst.after", rc.next(10000000), RunAction::Idle);
}

void clockSurvivesTimerWraparound() {
    RunControl rc;
    const uint32_t start = 0xFFFFFF00u;
    rc.apply('c', start);
    expectAction("wrap.t0", rc.next(start), RunAction::Cycle);
    expectAction("wrap.t50", rc.next(start + 50), RunAction::Idle);
    expectAction("wrap.t100", rc.next(start + 100), RunAction::Cycle);
    expectAction("wrap.t300", rc.next(start + 300), RunAction::Cycle);
}

void nextRunsOneInstructionThenWaits() {
    RunControl rc;
    rc.apply('n', 0);
    expectAction("next.instruction", rc.next(0), RunAction::Instruction);
    expectAction("next.waits", rc.next(1), RunAction::Idle);
    expectAction("next.waits.later", rc.next(1000000), RunAction::Idle);
}

void eachNextRunsOneInstruction() {
    RunControl rc;
    rc.apply('n', 0);
    rc.apply('n', 0);
    expectAction("twice.1", rc.next(0), RunAction::Instruction);
    expectAction("twice.2", rc.next(0), RunAction::Instruction);
    expectAction("twice.3", rc.next(0), RunAction::Idle);
}

void goReturnsToFullSpeed() {
    RunControl rc;
    rc.apply('n', 0);
    rc.next(0);
    rc.apply('g', 10);
    expectAction("go", rc.next(10), RunAction::Batch);
}

void slowAfterStepLeavesStepMode() {
    RunControl rc;
    rc.apply('n', 0);
    rc.apply('w', 5);
    expectAction("slowAfterStep", rc.next(5), RunAction::Cycle);
}

void stepAfterSlowStopsTheClock() {
    RunControl rc;
    rc.apply('w', 0);
    rc.next(0);
    rc.apply('n', 10);
    expectAction("stepAfterSlow.instruction", rc.next(10), RunAction::Instruction);
    expectAction("stepAfterSlow.wait", rc.next(RunControl::kSlowPeriodUs * 4), RunAction::Idle);
}

void commandClassification() {
    expectTrue("g", RunControl::isCommand('g'));
    expectTrue("w", RunControl::isCommand('w'));
    expectTrue("c", RunControl::isCommand('c'));
    expectTrue("n", RunControl::isCommand('n'));
    expectTrue("x", !RunControl::isCommand('x'));
    RunControl rc;
    expectTrue("apply unknown returns false", !rc.apply('x', 0));
}

}  // namespace

int main() {
    defaultIsFullSpeedBatch();
    slowClockRunsOneCyclePerPeriod();
    fixedClockRunsOneCyclePerPeriod();
    fallingBehindDoesNotBurst();
    clockSurvivesTimerWraparound();
    nextRunsOneInstructionThenWaits();
    eachNextRunsOneInstruction();
    goReturnsToFullSpeed();
    slowAfterStepLeavesStepMode();
    stepAfterSlowStopsTheClock();
    commandClassification();

    if (g_failures != 0) {
        std::fprintf(stderr, "%d test(s) failed\n", g_failures);
        return EXIT_FAILURE;
    }
    std::puts("run_control: all tests passed");
    return EXIT_SUCCESS;
}
