/**
 * branches.test.mjs — Phase 6: 無条件分岐補完 + 条件ジャンプ全条件
 *
 * 対象:
 *   RST 1-7  (7種,  11T / 3M, perCycle=[5,3,3])  RST 0 は instructions.test.mjs で済み
 *   Jcc      (8条件 × taken/not-taken = 16テスト, 常に 10T / 3M)
 *     JNZ(0xC2)/JZ(0xCA)/JNC(0xD2)/JC(0xDA)/JPO(0xE2)/JPE(0xEA)/JP(0xF2)/JM(0xFA)
 *
 * Intel 8080A 仕様: Jcc は条件成立・不成立に関わらず常に 10T / 3M。
 *
 * テスト手法:
 *   RST     : poke でRSTベクタにJMPを配置し extractNMachineCycles(3) で抽出
 *   Jcc taken   : Jcc を自己ループ (jump-to-self) にして extractFirstInstr で抽出
 *   Jcc not-taken: captureWithSetup でフラグ設定後、条件不成立→フォールスルー
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import {
  readRingBuffer, parseSample, analyzeTiming,
  extractNMachineCycles, extractFirstInstr, formatTiming,
} from '../helpers/ring.mjs';

const POST_DELAY = 120;

// ---------------------------------------------------------------------------
// 共通ヘルパー
// ---------------------------------------------------------------------------

/** トリガー発火まで step し、ring buffer のスナップショットを返す。 */
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

/** タイミングアサーション */
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
// RST n — 全 7 バリアント (RST 0 は既テスト, RST 1-7 を追加)
//
// RST opc が 0x0103 に配置。rstVec (n×8) に JMP 0x0100 を置いて無限ループ。
// LXI SP,0x01F0 で SP を初期化 (RST はスタックに PC+1 をプッシュするため)。
// ---------------------------------------------------------------------------

describe('RST n — 11T / 3M (RST 1-7)', () => {
  const RST_CASES = [
    { name: 'RST 1', opc: 0xCF, vec: 0x0008 },
    { name: 'RST 2', opc: 0xD7, vec: 0x0010 },
    { name: 'RST 3', opc: 0xDF, vec: 0x0018 },
    { name: 'RST 4', opc: 0xE7, vec: 0x0020 },
    { name: 'RST 5', opc: 0xEF, vec: 0x0028 },
    { name: 'RST 6', opc: 0xF7, vec: 0x0030 },
    { name: 'RST 7', opc: 0xFF, vec: 0x0038 },
  ];

  for (const c of RST_CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      sim.init();
      // リセットベクター → 0x0100
      sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
      // 0x0100: LXI SP,0x01F0 (RST はスタックを使う)
      sim.pokeBytes(0x0100, [0x31, 0xF0, 0x01]);
      // 0x0103: RST n (trigger)
      sim.pokeBytes(0x0103, [c.opc]);
      // RST ベクタ (n×8) に JMP 0x0100 を配置してループ継続
      sim.pokeBytes(c.vec, [0xC3, 0x00, 0x01]);

      sim.clearTrigger();
      sim.setInstrTrigger(0x0103, -1);

      const parsed = runToTrigger(sim);
      // RST = 3 マシンサイクル: M1(5T)+M2(3T)+M3(3T)=11T
      const instrSamples = extractNMachineCycles(parsed, 3);
      const timing = analyzeTiming(instrSamples);
      expectTiming(timing, { m: 3, t: 11, perCycle: [5, 3, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// Jcc — 全 8 条件 × taken/not-taken (常に 10T / 3M)
//
// フラグセットアップ凡例:
//   [0xAF]              = XRA A → Z=1, CY=0, S=0, PE=1 (0 bit count)
//   [0xAF, 0x3C]        = XRA A; INR A → Z=0, CY=0, S=0, PO=1 (1 bit count)
//   [0x37]              = STC → CY=1
//   [0x3E, 0x80, 0xA7]  = MVI A,0x80; ANA A → S=1, PE=1
//   [0x3E, 0x80, 0x3C]  = MVI A,0x80; INR A → S=0 (A=0x81 but wait ...)
//
// NOTE: MVI r,d は 8080 でフラグを変更しない。
//       ANA A: result = A, Z/S/P/AC セット, CY=0。
//       INR r: Z/S/P/AC セット、CY 変更なし。
// ---------------------------------------------------------------------------

// Jcc taken: Jcc を自己ループ (jump-to-self) にして extractFirstInstr で抽出
async function captureJccTaken(opc, flagSetup) {
  const sim = await loadSim();
  sim.init();
  sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
  sim.pokeBytes(0x0100, flagSetup);
  const jccAddr = 0x0100 + flagSetup.length;
  // Jcc self-loop: jump to itself
  sim.pokeBytes(jccAddr, [opc, jccAddr & 0xFF, jccAddr >> 8]);
  sim.clearTrigger();
  sim.setInstrTrigger(jccAddr, -1);
  const parsed = runToTrigger(sim);
  const instrSamples = extractFirstInstr(parsed, jccAddr);
  return analyzeTiming(instrSamples);
}

// Jcc not-taken: captureWithSetup → 条件不成立 → フォールスルー → JMP back
async function captureJccNotTaken(opc, flagSetup) {
  const sim = await loadSim();
  // 任意の安全な jump target (not-taken なので実際には飛ばない)
  const { timing } = sim.captureWithSetup(flagSetup, [opc, 0x00, 0xFF]);
  return timing;
}

describe('Jcc — 全 8 条件 (常に 10T / 3M)', () => {
  // [opc, name, takenSetup, notTakenSetup]
  const JCC_CASES = [
    {
      name: 'JNZ', opc: 0xC2, cond: 'Z=0',
      takenSetup:    [0xAF, 0x3C],       // XRA A; INR A → Z=0
      notTakenSetup: [0xAF],             // XRA A        → Z=1
    },
    {
      name: 'JZ',  opc: 0xCA, cond: 'Z=1',
      takenSetup:    [0xAF],             // XRA A        → Z=1
      notTakenSetup: [0xAF, 0x3C],      // XRA A; INR A → Z=0
    },
    {
      name: 'JNC', opc: 0xD2, cond: 'CY=0',
      takenSetup:    [0xAF],             // XRA A → CY=0
      notTakenSetup: [0x37],             // STC   → CY=1
    },
    {
      name: 'JC',  opc: 0xDA, cond: 'CY=1',
      takenSetup:    [0x37],             // STC   → CY=1
      notTakenSetup: [0xAF],             // XRA A → CY=0
    },
    {
      name: 'JPO', opc: 0xE2, cond: 'PO=1 (odd parity)',
      takenSetup:    [0xAF, 0x3C],      // XRA A; INR A → A=1, P=odd → PO=1
      notTakenSetup: [0xAF],             // XRA A        → A=0, P=even → PE=1 → PO=0
    },
    {
      name: 'JPE', opc: 0xEA, cond: 'PE=1 (even parity)',
      takenSetup:    [0xAF],             // XRA A → A=0, PE=1
      notTakenSetup: [0xAF, 0x3C],      // XRA A; INR A → A=1, PO=1 → PE=0
    },
    {
      name: 'JP',  opc: 0xF2, cond: 'S=0',
      takenSetup:    [0xAF],             // XRA A → A=0, S=0
      notTakenSetup: [0x3E, 0x80, 0xA7],// MVI A,0x80; ANA A → S=1
    },
    {
      name: 'JM',  opc: 0xFA, cond: 'S=1',
      takenSetup:    [0x3E, 0x80, 0xA7],// MVI A,0x80; ANA A → S=1
      notTakenSetup: [0xAF],             // XRA A → S=0
    },
  ];

  for (const c of JCC_CASES) {
    it(`${c.name} (taken, ${c.cond})`, async () => {
      const timing = await captureJccTaken(c.opc, c.takenSetup);
      expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, `${c.name} taken`);
    });

    it(`${c.name} (not-taken)`, async () => {
      const timing = await captureJccNotTaken(c.opc, c.notTakenSetup);
      expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, `${c.name} not-taken`);
    });
  }
});
