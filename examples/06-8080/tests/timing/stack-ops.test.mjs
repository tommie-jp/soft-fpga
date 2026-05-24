/**
 * stack-ops.test.mjs — Phase 5: スタック命令 (PUSH / POP / XTHL)
 *
 * 対象:
 *   PUSH rp/PSW  (4種, 11T / 3M, perCycle=[5,3,3])  SP-=2 して [SP] に書く
 *   POP  rp/PSW  (4種, 10T / 3M, perCycle=[4,3,3])  [SP] から読んで SP+=2
 *   XTHL         (1種, 18T / 5M, perCycle=[4,3,3,3,5]) HL ↔ [SP:SP+1]
 *
 * セットアップ: LXI SP,0x01F0 で SP を安全な領域に配置。
 *   XTHL は追加で LXI H,0x1234 も実施。
 *
 * vm80a 実測メモ:
 *   XTHL: [4,3,3,3,5] — Intel 8080A 仕様と完全一致
 *   PUSH: [5,3,3]      — Intel 8080A 仕様通り (M1=5T は WRITE サイクルを示す T5)
 *   POP:  [4,3,3]      — Intel 8080A 仕様通り (M1=4T)
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { formatTiming } from '../helpers/ring.mjs';

// LXI SP,0x01F0
const SET_SP = [0x31, 0xF0, 0x01];
// LXI SP,0x01F0 + LXI H,0x1234
const SET_SP_HL = [0x31, 0xF0, 0x01, 0x21, 0x34, 0x12];

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
// PUSH rp/PSW — 全 4 バリアント (11T / 3M, perCycle=[5,3,3])
// エンコード: 11RP0101  B=00, D=01, H=10, PSW=11
// ---------------------------------------------------------------------------

describe('PUSH rp/PSW — 全 4 バリアント (11T / 3M)', () => {
  const CASES = [
    { name: 'PUSH B',   bytes: [0xC5] },
    { name: 'PUSH D',   bytes: [0xD5] },
    { name: 'PUSH H',   bytes: [0xE5] },
    { name: 'PUSH PSW', bytes: [0xF5] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureWithSetup(SET_SP, c.bytes);
      expectTiming(timing, { m: 3, t: 11, perCycle: [5, 3, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// POP rp/PSW — 全 4 バリアント (10T / 3M, perCycle=[4,3,3])
// エンコード: 11RP0001  B=00, D=01, H=10, PSW=11
// ---------------------------------------------------------------------------

describe('POP rp/PSW — 全 4 バリアント (10T / 3M)', () => {
  const CASES = [
    { name: 'POP B',   bytes: [0xC1] },
    { name: 'POP D',   bytes: [0xD1] },
    { name: 'POP H',   bytes: [0xE1] },
    { name: 'POP PSW', bytes: [0xF1] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureWithSetup(SET_SP, c.bytes);
      expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// XTHL (0xE3) — 18T / 5M, perCycle=[4,3,3,3,5]
//
// HL ↔ [SP:SP+1] を交換する。
//   M2: [SP]   → L (stack read low)
//   M3: [SP+1] → H (stack read high)
//   M4: old H → [SP+1] (stack write high, 3T)
//   M5: old L → [SP]   (stack write low,  5T)
//
// Intel 8080A 仕様と vm80a の perCycle が完全一致することを確認済み。
// ---------------------------------------------------------------------------

describe('XTHL (18T / 5M)', () => {
  it('XTHL', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureWithSetup(SET_SP_HL, [0xE3]);
    expectTiming(timing, { m: 5, t: 18, perCycle: [4, 3, 3, 3, 5] }, 'XTHL');
  });
});
