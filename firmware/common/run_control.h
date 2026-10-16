// firmware/common/run_control.h
//
// シミュレーションの進め方を決める。Pico SDK に依存しない（ホストの単体テストで回すため）。
// 時刻は引数で受け取るので、実機なしで時間経過を再現できる。
//
//   g  実速（既定）。1000 サイクルずつまとめて回す
//   w  低速。4 Hz で 1 サイクルずつ（φ2 の LED が目で追える）
//   c  固定クロック。10 kHz で 1 サイクルずつ（オシロのトリガが安定する）
//   n  次の命令まで 1 命令だけ進めて止まる（押すたびに 1 命令。ステップ実行に入る）

#pragma once

#include <cstdint>

namespace apple1 {

enum class RunAction : uint8_t {
    Idle,         // 何もしない（次の時刻・次の n を待つ）
    Batch,        // 1000 サイクルまとめて
    Cycle,        // 1 サイクル
    Instruction,  // 次の SYNC まで（1 命令）
};

class RunControl {
public:
    static constexpr uint32_t kSlowPeriodUs = 250000;  // 4 Hz
    static constexpr uint32_t kFixedPeriodUs = 100;    // 10 kHz
    static constexpr uint32_t kMaxPendingSteps = 16;

    static bool isCommand(uint8_t c) { return c == 'g' || c == 'w' || c == 'c' || c == 'n'; }

    // 扱ったら true。
    bool apply(uint8_t c, uint32_t nowUs) {
        switch (c) {
            case 'g':
                mode_ = Mode::Free;
                return true;
            case 'w':
                startPaced(kSlowPeriodUs, nowUs);
                return true;
            case 'c':
                startPaced(kFixedPeriodUs, nowUs);
                return true;
            case 'n':
                if (mode_ != Mode::Step) {
                    mode_ = Mode::Step;
                    pendingSteps_ = 0;
                }
                if (pendingSteps_ < kMaxPendingSteps) {
                    ++pendingSteps_;
                }
                return true;
            default:
                return false;
        }
    }

    RunAction next(uint32_t nowUs) {
        switch (mode_) {
            case Mode::Free:
                return RunAction::Batch;
            case Mode::Paced:
                if (static_cast<int32_t>(nowUs - nextTickUs_) < 0) {
                    return RunAction::Idle;
                }
                nextTickUs_ += periodUs_;
                // 大きく遅れたら取り戻そうとせず、今から数え直す（バーストさせない）
                if (static_cast<int32_t>(nowUs - nextTickUs_) >= 0) {
                    nextTickUs_ = nowUs + periodUs_;
                }
                return RunAction::Cycle;
            case Mode::Step:
                if (pendingSteps_ == 0) {
                    return RunAction::Idle;
                }
                --pendingSteps_;
                return RunAction::Instruction;
        }
        return RunAction::Idle;
    }

private:
    enum class Mode : uint8_t { Free, Paced, Step };

    void startPaced(uint32_t periodUs, uint32_t nowUs) {
        mode_ = Mode::Paced;
        periodUs_ = periodUs;
        nextTickUs_ = nowUs;
    }

    Mode mode_ = Mode::Free;
    uint32_t periodUs_ = 0;
    uint32_t nextTickUs_ = 0;
    uint32_t pendingSteps_ = 0;
};

}  // namespace apple1
