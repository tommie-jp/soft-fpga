// firmware/apple1/sim_core.h
//
// シミュレーションを core1 で回し、core0 とは pico_util の queue でやり取りする。
//
//   core0 (コンソール)  --key-->      core1 (harness step())
//                       <--display--
//                       --reset / bench 要求-->
//                       <--bench 応答--
//
// harness.cpp の static 変数（RAM・キーボード / ディスプレイキュー・Verilator モデル）は
// core1 だけが触る。core0 は queue 経由でのみ連携するので、harness 側に排他は要らない。

#pragma once

#include <cstdint>

#include "panel_logic.h"
#include "run_control.h"

namespace apple1 {

struct BenchStats {
    uint64_t cycles;  // step() を呼んだ回数
    uint64_t us;      // step() だけに掛かった時間（コンソール処理を含まない）
};

// キュー初期化 → core1 起動。core1 側で sim_init() を実行してループに入る。
void simCoreStart();

// ---- core0 から呼ぶ ----
// キーボード入力に空きがあるか（core0 だけが送信側なので、true なら simPostKey は成功する）。
bool simKeyRoom();
bool simPostKey(uint8_t appleKey);
void simPostReset();
// ディスプレイ出力を 1 文字受け取る（bit7 は落とし済み）。無ければ false。
bool simPollDisplay(uint8_t* ch);
// 実効クロックの実測値を問い合わせる。timeoutUs 以内に返らなければ false。
// 実速（g）で回した分だけを数える。低速・固定クロック・ステップ中は数えない。
bool simQueryBench(BenchStats* out, uint32_t timeoutUs);

// 実行制御（g / w / c / n）と LED 表示（y / a / o / t）のコマンドか。
inline bool isControlCommand(uint8_t c) {
    return RunControl::isCommand(c) || panel::isCommand(c);
}
// isControlCommand() が true のコマンドを core1 へ送る。キューが満杯なら false。
bool simPostControl(uint8_t cmd);

}  // namespace apple1
