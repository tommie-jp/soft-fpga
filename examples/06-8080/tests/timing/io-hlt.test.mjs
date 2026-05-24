/**
 * io-hlt.test.mjs — Phase 9: I/O 命令 + HLT
 *
 * 対象:
 *   IN  port  (0xDB): 10T / 3M, perCycle=[4,3,3]
 *     M1=オペコードフェッチ(4T), M2=ポート番号フェッチ(3T), M3=入力読出し(3T)
 *   OUT port  (0xD3): 10T / 3M, perCycle=[4,3,3]
 *     M1=オペコードフェッチ(4T), M2=ポート番号フェッチ(3T), M3=出力書込み(3T)
 *   HLT (0x76):  4T / 1M, perCycle=[4]
 *     M1=オペコードフェッチ(4T)のみ計測。以降は HALT サイクルが継続する。
 *
 * vm80a 実測値:
 *   IN / OUT: Intel 8080A 仕様通り (M1=4T, M2=3T, M3=3T)
 *   HLT     : M1=4T のみ。HALT サイクルは extractNMachineCycles(1) で切り出す。
 *             HALT サイクルは addr=0x0100, sync=true で長い T-state 列を形成する。
 *
 * テスト手法:
 *   IN / OUT : captureInstruction([opc, port]) を使用
 *   HLT      : 手動 poke + runToTrigger + extractNMachineCycles(1)
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import {
  readRingBuffer, parseSample, analyzeTiming,
  extractNMachineCycles, formatTiming,
} from '../helpers/ring.mjs';

const POST_DELAY = 120;

function runToTrigger(sim) {
  sim.setPostDelay(POST_DELAY);
  for (let i = 0; i < 300000; i++) {
    sim.step();
    if (sim.isTriggerHit()) break;
  }
  if (!sim.isTriggerHit()) throw new Error('トリガーが発火しなかった');
  sim.M._sim_freeze_ring();
  const snap = readRingBuffer(
    sim.M.HEAPU32, sim.ringBase, sim.ringSize, sim.getHead(), POST_DELAY + 1
  );
  return snap.map(parseSample);
}

function expectTiming(timing, expected, instrName = '') {
  const header = instrName ? `[${instrName}] ` : '';
  expect(
    timing.machineCycles,
    `${header}マシンサイクル数: 期待=${expected.m} 実際=${timing.machineCycles}\n` +
    formatTiming(timing)
  ).toBe(expected.m);
  expect(
    timing.totalTStates,
    `${header}T-state 合計: 期待=${expected.t} 実際=${timing.totalTStates}\n` +
    formatTiming(timing)
  ).toBe(expected.t);
  if (expected.perCycle) {
    for (let i = 0; i < expected.perCycle.length; i++) {
      const actual = timing.cycles[i]?.tStates;
      expect(
        actual,
        `${header}M${i + 1}: 期待=${expected.perCycle[i]} 実際=${actual}\n` +
        formatTiming(timing)
      ).toBe(expected.perCycle[i]);
    }
  }
}

// ---------------------------------------------------------------------------
// IN port (0xDB) — 10T / 3M, perCycle=[4,3,3]
// ---------------------------------------------------------------------------

describe('IN port — 10T / 3M', () => {
  it('IN 0x00', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xDB, 0x00]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'IN 0x00');
  });

  it('IN 0xFF', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xDB, 0xFF]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'IN 0xFF');
  });
});

// ---------------------------------------------------------------------------
// OUT port (0xD3) — 10T / 3M, perCycle=[4,3,3]
// ---------------------------------------------------------------------------

describe('OUT port — 10T / 3M', () => {
  it('OUT 0x00', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xD3, 0x00]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'OUT 0x00');
  });

  it('OUT 0xFF', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xD3, 0xFF]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'OUT 0xFF');
  });
});

// ---------------------------------------------------------------------------
// HLT (0x76) — 4T / 1M, perCycle=[4]
//
// HLT 実行後 CPU は HALT 状態に入り、RESET または INT まで待機する。
// vm80a は HALT サイクルを addr=0x0100, sync=true で継続するが、
// extractNMachineCycles(1) でオペコードフェッチ M1 のみを取り出す。
// ---------------------------------------------------------------------------

describe('HLT — 4T / 1M (オペコードフェッチのみ)', () => {
  it('HLT (0x76)', async () => {
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
    // 0x0100: HLT — CPU はここで停止する
    sim.pokeBytes(0x0100, [0x76]);

    sim.clearTrigger();
    sim.setInstrTrigger(0x0100, -1);

    const parsed = runToTrigger(sim);
    // M1 (オペコードフェッチ, 4T) だけを抽出
    const instrSamples = extractNMachineCycles(parsed, 1);
    const timing = analyzeTiming(instrSamples);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'HLT');
  });
});
