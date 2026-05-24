/**
 * alu-imm.test.mjs — Phase 3: ALU immediate 全 8 命令
 *
 * 対象: A レジスタと 8bit 即値の演算命令 (7T / 2M, M1=4T, M2=3T)
 *
 *   ADI d8 (0xC6)  A += d8
 *   ACI d8 (0xCE)  A += d8 + CY
 *   SUI d8 (0xD6)  A -= d8
 *   SBI d8 (0xDE)  A -= d8 - CY
 *   ANI d8 (0xE6)  A &= d8
 *   XRI d8 (0xEE)  A ^= d8
 *   ORI d8 (0xF6)  A |= d8
 *   CPI d8 (0xFE)  A - d8 (フラグのみ更新、A は変化しない)
 *
 * 全て 2 バイト命令。captureInstruction([opc, imm]) だけで完結する。
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { formatTiming } from '../helpers/ring.mjs';

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
// ALU immediate — 全 8 命令 (7T / 2M, perCycle=[4,3])
// ---------------------------------------------------------------------------

describe('ALU immediate — 全 8 命令 (7T / 2M)', () => {
  const CASES = [
    { name: 'ADI $55', bytes: [0xC6, 0x55] },
    { name: 'ACI $00', bytes: [0xCE, 0x00] },
    { name: 'SUI $01', bytes: [0xD6, 0x01] },
    { name: 'SBI $00', bytes: [0xDE, 0x00] },
    { name: 'ANI $FF', bytes: [0xE6, 0xFF] },
    { name: 'XRI $AA', bytes: [0xEE, 0xAA] },
    { name: 'ORI $00', bytes: [0xF6, 0x00] },
    { name: 'CPI $00', bytes: [0xFE, 0x00] },
  ];

  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }
});
