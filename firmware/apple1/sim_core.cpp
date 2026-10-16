// firmware/apple1/sim_core.cpp

#include "sim_core.h"

#include "led_panel.h"
#include "pico/multicore.h"
#include "pico/stdlib.h"
#include "pico/util/queue.h"

extern "C" {
void sim_init();
void step();
void step_instruction();
void reset_sim();
void send_key(uint8_t ch);
int get_display_char();
}

namespace apple1 {

namespace {

constexpr uint kKeyQueueDepth = 64;
constexpr uint kDisplayQueueDepth = 256;
constexpr uint kCommandQueueDepth = 16;
constexpr uint32_t kStepsPerBatch = 1000;
// Verilator の eval() は深い呼び出しになり得るので、SDK 既定 (2 KB) より大きく取る。
constexpr size_t kCore1StackWords = 4096;  // 16 KB

enum Command : uint8_t { kCommandReset = 1, kCommandBench = 2 };

queue_t g_keyQueue;
queue_t g_displayQueue;
queue_t g_commandQueue;
queue_t g_benchQueue;
uint32_t g_core1Stack[kCore1StackWords];

void handleCommands(BenchStats* stats, RunControl* run) {
    uint8_t cmd;
    while (queue_try_remove(&g_commandQueue, &cmd)) {
        if (cmd == kCommandReset) {
            reset_sim();
            ledPanelReset();
            *run = RunControl{};  // リセット後は実速に戻す（ステップ待ちで止まらないように）
            *stats = BenchStats{};
        } else if (cmd == kCommandBench) {
            // 深さ 1 のキュー。core0 は要求前に古い応答を捨てるので、満杯で失敗しても問題ない。
            queue_try_add(&g_benchQueue, stats);
        } else if (RunControl::isCommand(cmd)) {
            run->apply(cmd, time_us_32());
        } else if (panel::isCommand(cmd)) {
            ledPanelCommand(cmd);
        }
    }
}

void flushDisplayToCore0() {
    int ch;
    while ((ch = get_display_char()) >= 0) {
        const uint8_t c = static_cast<uint8_t>(ch & 0x7F);
        // 文字を落とさない。core0 は常に吸い出しているので、満杯でも短時間で空く。
        while (!queue_try_add(&g_displayQueue, &c)) {
            tight_loop_contents();
        }
    }
}

void core1Main() {
    ledPanelInit();
    sim_init();

    BenchStats stats{};
    RunControl run;
    while (true) {
        handleCommands(&stats, &run);

        uint8_t key;
        while (queue_try_remove(&g_keyQueue, &key)) {
            send_key(key);
        }

        switch (run.next(time_us_32())) {
            case RunAction::Batch: {
                const uint32_t t0 = time_us_32();
                for (uint32_t i = 0; i < kStepsPerBatch; ++i) {
                    step();
                }
                stats.us += time_us_32() - t0;
                stats.cycles += kStepsPerBatch;
                break;
            }
            case RunAction::Cycle:
                step();
                break;
            case RunAction::Instruction:
                step_instruction();
                break;
            case RunAction::Idle:
                tight_loop_contents();
                break;
        }

        flushDisplayToCore0();
    }
}

}  // namespace

void simCoreStart() {
    queue_init(&g_keyQueue, sizeof(uint8_t), kKeyQueueDepth);
    queue_init(&g_displayQueue, sizeof(uint8_t), kDisplayQueueDepth);
    queue_init(&g_commandQueue, sizeof(uint8_t), kCommandQueueDepth);
    queue_init(&g_benchQueue, sizeof(BenchStats), 1);
    multicore_launch_core1_with_stack(core1Main, g_core1Stack, sizeof(g_core1Stack));
}

bool simKeyRoom() {
    return queue_get_level(&g_keyQueue) < kKeyQueueDepth;
}

bool simPostControl(uint8_t cmd) {
    return queue_try_add(&g_commandQueue, &cmd);
}

bool simPostKey(uint8_t appleKey) {
    return queue_try_add(&g_keyQueue, &appleKey);
}

void simPostReset() {
    const uint8_t cmd = kCommandReset;
    queue_try_add(&g_commandQueue, &cmd);
}

bool simPollDisplay(uint8_t* ch) {
    return queue_try_remove(&g_displayQueue, ch);
}

bool simQueryBench(BenchStats* out, uint32_t timeoutUs) {
    BenchStats stale;
    while (queue_try_remove(&g_benchQueue, &stale)) {}  // 前回の取りこぼしを捨てる

    const uint8_t cmd = kCommandBench;
    if (!queue_try_add(&g_commandQueue, &cmd)) {
        return false;
    }

    const uint32_t start = time_us_32();
    while (time_us_32() - start < timeoutUs) {
        if (queue_try_remove(&g_benchQueue, out)) {
            return true;
        }
    }
    return false;
}

}  // namespace apple1
