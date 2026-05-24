/**
 * cond-ret.test.mjs — Phase 8: 条件付き RET 全条件 (Rcc × 2パス)
 *
 * 対象:
 *   RNZ(0xC0) RZ(0xC8) RNC(0xD0) RC(0xD8) RPO(0xE0) RPE(0xE8) RP(0xF0) RM(0xF8)
 *   各条件 × not-taken / taken = 16 テスト
 *
 * vm80a 実測値:
 *   not-taken : 5T / 1M , perCycle=[5]       (無条件リターンなし、フォールスルー)
 *   taken     : 11T / 3M , perCycle=[5,3,3]  (無条件 RET は [4,3,3] だが Rcc は [5,3,3])
 *   ※ vm80a は全ケースで M1=5T を使う。
 *
 * テスト手法:
 *   not-taken : captureWithSetup([flagSetup], [opc]) → フォールスルー (スタック不使用)
 *   taken     : 手動セットアップ (poke) + extractNMachineCycles(3)
 *               CALL で戻りアドレスをプッシュ → Rcc trigger
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
// Rcc not-taken helper
// captureWithSetup で実現: 条件不成立 → フォールスルー → JMP back
// スタックは不使用 (not-taken では SP を触らない)
// ---------------------------------------------------------------------------
async function captureNotTaken(opc, flagSetup) {
  const sim = await loadSim();
  const { timing } = sim.captureWithSetup(flagSetup, [opc]);
  return timing;
}

// ---------------------------------------------------------------------------
// Rcc taken helper
// 手動 poke: LXI SP,0x01F0 + flagSetup + CALL rccAddr → Rcc (trigger) → loop
// CALL が戻りアドレスをスタックに積む → Rcc は条件成立でそこへリターン
// ---------------------------------------------------------------------------
async function captureTaken(opc, flagSetup) {
  const sim = await loadSim();
  sim.init();
  sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
  // 0x0100: LXI SP,0x01F0
  sim.pokeBytes(0x0100, [0x31, 0xF0, 0x01]);
  // 0x0103: flagSetup (フラグ設定; CALL はフラグを変更しない)
  sim.pokeBytes(0x0103, flagSetup);
  const callAddr = 0x0103 + flagSetup.length;
  const rccAddr = 0x0120;
  // callAddr: CALL rccAddr (スタックに callAddr+3 をプッシュ)
  sim.pokeBytes(callAddr, [0xCD, rccAddr & 0xFF, rccAddr >> 8]);
  // callAddr+3: JMP 0x0100 (Rcc リターン後のループ)
  sim.pokeBytes(callAddr + 3, [0xC3, 0x00, 0x01]);
  // rccAddr: Rcc (trigger)
  sim.pokeBytes(rccAddr, [opc]);
  // rccAddr+1: JMP callAddr+3 (フォールスルー安全網; takenテストでは通らない)
  sim.pokeBytes(rccAddr + 1, [0xC3, (callAddr + 3) & 0xFF, (callAddr + 3) >> 8]);

  sim.clearTrigger();
  sim.setInstrTrigger(rccAddr, -1);
  const parsed = runToTrigger(sim);
  // Rcc taken = 3 マシンサイクル: M1(5T)+M2(3T)+M3(3T)=11T
  const instrSamples = extractNMachineCycles(parsed, 3);
  return analyzeTiming(instrSamples);
}

// ---------------------------------------------------------------------------
// テストケース定義
//
// フラグセットアップ (Ccc / Jcc と同じ凡例):
//   [0xAF]            = XRA A    → Z=1, CY=0, S=0, PE=1
//   [0xAF, 0x3C]      = XRA A; INR A → Z=0, CY=0, S=0, PO=1
//   [0x37]            = STC      → CY=1
//   [0x3E,0x80,0xA7]  = MVI A,0x80; ANA A → S=1, PE=1
// ---------------------------------------------------------------------------

const RCC_CASES = [
  {
    name: 'RNZ', opc: 0xC0, cond: 'NZ (Z=0)',
    takenSetup:    [0xAF, 0x3C],       // Z=0
    notTakenSetup: [0xAF],             // Z=1
  },
  {
    name: 'RZ',  opc: 0xC8, cond: 'Z (Z=1)',
    takenSetup:    [0xAF],             // Z=1
    notTakenSetup: [0xAF, 0x3C],      // Z=0
  },
  {
    name: 'RNC', opc: 0xD0, cond: 'NC (CY=0)',
    takenSetup:    [0xAF],             // CY=0
    notTakenSetup: [0x37],             // CY=1
  },
  {
    name: 'RC',  opc: 0xD8, cond: 'C (CY=1)',
    takenSetup:    [0x37],             // CY=1
    notTakenSetup: [0xAF],             // CY=0
  },
  {
    name: 'RPO', opc: 0xE0, cond: 'PO (P=odd)',
    takenSetup:    [0xAF, 0x3C],      // A=1, PO=1
    notTakenSetup: [0xAF],             // A=0, PE=1 → PO=0
  },
  {
    name: 'RPE', opc: 0xE8, cond: 'PE (P=even)',
    takenSetup:    [0xAF],             // A=0, PE=1
    notTakenSetup: [0xAF, 0x3C],      // A=1, PO=1 → PE=0
  },
  {
    name: 'RP',  opc: 0xF0, cond: 'P (S=0)',
    takenSetup:    [0xAF],             // S=0
    notTakenSetup: [0x3E, 0x80, 0xA7],// S=1
  },
  {
    name: 'RM',  opc: 0xF8, cond: 'M (S=1)',
    takenSetup:    [0x3E, 0x80, 0xA7],// S=1
    notTakenSetup: [0xAF],             // S=0
  },
];

// ---------------------------------------------------------------------------
// テスト実行
// ---------------------------------------------------------------------------

describe('Rcc not-taken — 5T / 1M (vm80a: perCycle=[5])', () => {
  for (const c of RCC_CASES) {
    it(`${c.name} (not-taken, ${c.cond} 不成立)`, async () => {
      const timing = await captureNotTaken(c.opc, c.notTakenSetup);
      expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, `${c.name} not-taken`);
    });
  }
});

describe('Rcc taken — 11T / 3M (vm80a: perCycle=[5,3,3])', () => {
  for (const c of RCC_CASES) {
    it(`${c.name} (taken, ${c.cond} 成立)`, async () => {
      const timing = await captureTaken(c.opc, c.takenSetup);
      expectTiming(timing, { m: 3, t: 11, perCycle: [5, 3, 3] }, `${c.name} taken`);
    });
  }
});
