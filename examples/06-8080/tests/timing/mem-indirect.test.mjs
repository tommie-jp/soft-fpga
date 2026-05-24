/**
 * mem-indirect.test.mjs — Phase 4: メモリ間接命令 (HL 経由)
 *
 * 対象: HL レジスタが示すアドレスを介してメモリにアクセスする命令
 *
 *   MOV r,M  (7種, 7T / 2M)  : [HL] → r
 *   MOV M,r  (7種, 7T / 2M)  : r → [HL]
 *   ADD M    (0x86, 7T / 2M) : A += [HL]
 *   ADC M    (0x8E, 7T / 2M) : A += [HL] + CY
 *   SUB M    (0x96, 7T / 2M) : A -= [HL]
 *   SBB M    (0x9E, 7T / 2M) : A -= [HL] - CY
 *   ANA M    (0xA6, 7T / 2M) : A &= [HL]
 *   XRA M    (0xAE, 7T / 2M) : A ^= [HL]
 *   ORA M    (0xB6, 7T / 2M) : A |= [HL]
 *   CMP M    (0xBE, 7T / 2M) : A - [HL] (フラグのみ)
 *   INR M    (0x34, 10T / 3M): [HL]++
 *   DCR M    (0x35, 10T / 3M): [HL]--
 *
 * セットアップ: LXI H,0x0200 で HL を RAM 安全領域に向ける。
 *   captureWithSetup([0x21, 0x00, 0x02], instrBytes) を使用。
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { formatTiming } from '../helpers/ring.mjs';

// LXI H,0x0200
const SET_HL = [0x21, 0x00, 0x02];

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
        `${header}M${i + 1} T-state: 期待=${expected.perCycle[i]} 実際=${actual}\n` +
        formatTiming(timing)
      ).toBe(expected.perCycle[i]);
    }
  }
}

// ---------------------------------------------------------------------------
// MOV r,M — 全 7 バリアント (7T / 2M, perCycle=[4,3])
// エンコード: 01DDD110  (DDD=dst register, 110=M)
// ---------------------------------------------------------------------------

describe('MOV r,M — 全 7 バリアント (7T / 2M)', () => {
  const CASES = [
    { name: 'MOV B,M', bytes: [0x46] },
    { name: 'MOV C,M', bytes: [0x4E] },
    { name: 'MOV D,M', bytes: [0x56] },
    { name: 'MOV E,M', bytes: [0x5E] },
    { name: 'MOV H,M', bytes: [0x66] },
    { name: 'MOV L,M', bytes: [0x6E] },
    { name: 'MOV A,M', bytes: [0x7E] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureWithSetup(SET_HL, c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// MOV M,r — 全 7 バリアント (7T / 2M, perCycle=[4,3])
// エンコード: 01110SSS  (110=M dst, SSS=src register)
// ---------------------------------------------------------------------------

describe('MOV M,r — 全 7 バリアント (7T / 2M)', () => {
  const CASES = [
    { name: 'MOV M,B', bytes: [0x70] },
    { name: 'MOV M,C', bytes: [0x71] },
    { name: 'MOV M,D', bytes: [0x72] },
    { name: 'MOV M,E', bytes: [0x73] },
    { name: 'MOV M,H', bytes: [0x74] },
    { name: 'MOV M,L', bytes: [0x75] },
    { name: 'MOV M,A', bytes: [0x77] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureWithSetup(SET_HL, c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// ALU M — 全 8 バリアント (7T / 2M, perCycle=[4,3])
// エンコード: 10OOO110  (OOO=演算コード, 110=M)
// ---------------------------------------------------------------------------

describe('ALU M — 全 8 バリアント (7T / 2M)', () => {
  const CASES = [
    { name: 'ADD M', bytes: [0x86] },
    { name: 'ADC M', bytes: [0x8E] },
    { name: 'SUB M', bytes: [0x96] },
    { name: 'SBB M', bytes: [0x9E] },
    { name: 'ANA M', bytes: [0xA6] },
    { name: 'XRA M', bytes: [0xAE] },
    { name: 'ORA M', bytes: [0xB6] },
    { name: 'CMP M', bytes: [0xBE] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureWithSetup(SET_HL, c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// INR M (0x34) — 10T / 3M (M1=4T, M2=3T[MR], M3=3T[MW])
// ---------------------------------------------------------------------------

describe('INR M (10T / 3M)', () => {
  it('INR M', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureWithSetup(SET_HL, [0x34]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'INR M');
  });
});

// ---------------------------------------------------------------------------
// DCR M (0x35) — 10T / 3M (M1=4T, M2=3T[MR], M3=3T[MW])
// ---------------------------------------------------------------------------

describe('DCR M (10T / 3M)', () => {
  it('DCR M', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureWithSetup(SET_HL, [0x35]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'DCR M');
  });
});
