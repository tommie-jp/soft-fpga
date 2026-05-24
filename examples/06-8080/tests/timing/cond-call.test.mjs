/**
 * cond-call.test.mjs — Phase 7: 条件付き CALL 全条件 (Ccc × 2パス)
 *
 * 対象:
 *   CNZ(0xC4) CZ(0xCC) CNC(0xD4) CC(0xDC) CPO(0xE4) CPE(0xEC) CP(0xF4) CM(0xFC)
 *   各条件 × not-taken / taken = 16 テスト
 *
 * vm80a 実測値 (Intel 8080A 仕様と perCycle が異なる):
 *   not-taken : 11T / 3M , perCycle=[5,3,3]   (仕様: M1=4T, M3=4T)
 *   taken     : 17T / 5M , perCycle=[5,3,3,3,3] (仕様: M1=4T, M5=4T)
 *   ※ vm80a は全ケースで M1=5T を使う。
 *
 * テスト手法:
 *   not-taken : captureWithSetup([flagSetup], [opc, lo, hi]) → フォールスルー
 *   taken     : 手動セットアップ (poke) + extractNMachineCycles(5)
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
// Ccc not-taken helper
// captureWithSetup で実現: 条件不成立 → フォールスルー → JMP back
// ---------------------------------------------------------------------------
async function captureNotTaken(opc, flagSetup) {
  const sim = await loadSim();
  const { timing } = sim.captureWithSetup(flagSetup, [opc, 0x00, 0xFF]);
  return timing;
}

// ---------------------------------------------------------------------------
// Ccc taken helper
// 手動 poke: LXI SP,0x01F0 + flagSetup + Ccc → subroutine (RET) → loop back
// ---------------------------------------------------------------------------
async function captureTaken(opc, flagSetup) {
  const sim = await loadSim();
  sim.init();
  sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
  // 0x0100: LXI SP,0x01F0
  sim.pokeBytes(0x0100, [0x31, 0xF0, 0x01]);
  // 0x0103: flagSetup
  sim.pokeBytes(0x0103, flagSetup);
  const cccAddr = 0x0103 + flagSetup.length;
  // cccAddr: Ccc 0x0120 (trigger)
  const callTarget = 0x0120;
  sim.pokeBytes(cccAddr,     [opc, callTarget & 0xFF, callTarget >> 8]);
  // cccAddr+3: JMP cccAddr (loop after RET)
  sim.pokeBytes(cccAddr + 3, [0xC3, cccAddr & 0xFF, cccAddr >> 8]);
  // callTarget: RET
  sim.pokeBytes(callTarget, [0xC9]);

  sim.clearTrigger();
  sim.setInstrTrigger(cccAddr, -1);
  const parsed = runToTrigger(sim);
  // Ccc taken = 5 マシンサイクル
  const instrSamples = extractNMachineCycles(parsed, 5);
  return analyzeTiming(instrSamples);
}

// ---------------------------------------------------------------------------
// テストケース定義
//
// フラグセットアップ:
//   [0xAF]            = XRA A    → Z=1, CY=0, S=0, PE=1
//   [0xAF, 0x3C]      = XRA A; INR A → Z=0, CY=0, S=0, PO=1
//   [0x37]            = STC      → CY=1
//   [0x3E,0x80,0xA7]  = MVI A,0x80; ANA A → S=1, PE=1
// ---------------------------------------------------------------------------

const CCC_CASES = [
  {
    name: 'CNZ', opc: 0xC4, cond: 'NZ (Z=0)',
    takenSetup:    [0xAF, 0x3C],       // Z=0
    notTakenSetup: [0xAF],             // Z=1
  },
  {
    name: 'CZ',  opc: 0xCC, cond: 'Z (Z=1)',
    takenSetup:    [0xAF],             // Z=1
    notTakenSetup: [0xAF, 0x3C],      // Z=0
  },
  {
    name: 'CNC', opc: 0xD4, cond: 'NC (CY=0)',
    takenSetup:    [0xAF],             // CY=0
    notTakenSetup: [0x37],             // CY=1
  },
  {
    name: 'CC',  opc: 0xDC, cond: 'C (CY=1)',
    takenSetup:    [0x37],             // CY=1
    notTakenSetup: [0xAF],             // CY=0
  },
  {
    name: 'CPO', opc: 0xE4, cond: 'PO (P=odd)',
    takenSetup:    [0xAF, 0x3C],      // A=1, PO=1
    notTakenSetup: [0xAF],             // A=0, PE=1 → PO=0
  },
  {
    name: 'CPE', opc: 0xEC, cond: 'PE (P=even)',
    takenSetup:    [0xAF],             // A=0, PE=1
    notTakenSetup: [0xAF, 0x3C],      // A=1, PO=1 → PE=0
  },
  {
    name: 'CP',  opc: 0xF4, cond: 'P (S=0)',
    takenSetup:    [0xAF],             // S=0
    notTakenSetup: [0x3E, 0x80, 0xA7],// S=1
  },
  {
    name: 'CM',  opc: 0xFC, cond: 'M (S=1)',
    takenSetup:    [0x3E, 0x80, 0xA7],// S=1
    notTakenSetup: [0xAF],             // S=0
  },
];

// ---------------------------------------------------------------------------
// テスト実行
// ---------------------------------------------------------------------------

describe('Ccc not-taken — 11T / 3M (vm80a: perCycle=[5,3,3])', () => {
  for (const c of CCC_CASES) {
    it(`${c.name} (not-taken, ${c.cond} 不成立)`, async () => {
      const timing = await captureNotTaken(c.opc, c.notTakenSetup);
      expectTiming(timing, { m: 3, t: 11, perCycle: [5, 3, 3] }, `${c.name} not-taken`);
    });
  }
});

describe('Ccc taken — 17T / 5M (vm80a: perCycle=[5,3,3,3,3])', () => {
  for (const c of CCC_CASES) {
    it(`${c.name} (taken, ${c.cond} 成立)`, async () => {
      const timing = await captureTaken(c.opc, c.takenSetup);
      expectTiming(timing, { m: 5, t: 17, perCycle: [5, 3, 3, 3, 3] }, `${c.name} taken`);
    });
  }
});
