/**
 * all-reg-ops.test.mjs — Phase 1: レジスタ間演算 全バリアント
 *
 * 対象: メモリ・スタック・フラグ条件に依存しない命令を全 opcode 網羅。
 *   - MOV r,r   : 全 49 バリアント (5T / 1M)
 *   - ALU r     : ADD/ADC/SUB/SBB/ANA/XRA/ORA/CMP × B/C/D/E/H/L/A (4T / 1M)
 *   - INR r     : B/C/D/E/H/L/A 全 7 レジスタ (5T / 1M)
 *   - DCR r     : B/C/D/E/H/L/A 全 7 レジスタ (5T / 1M)
 *
 * すべて captureInstruction([opcode]) だけで完結する。
 * ALU の M バリアント (0x86/8E/96/9E/A6/AE/B6/BE) は mem-indirect.test.mjs で処理。
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { formatTiming } from '../helpers/ring.mjs';

// ---------------------------------------------------------------------------
// 共通アサーション
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// G_MOV: MOV r,r — 全 49 バリアント (5T / 1M)
//
// エンコード: 01DDDSSS
//   dst/src: B=000, C=001, D=010, E=011, H=100, L=101, A=111
//   M=110 は除外 (Phase 4 で扱う)
// ---------------------------------------------------------------------------

describe('MOV r,r — 全 49 バリアント (5T / 1M)', () => {
  const CASES = [
    // dst=B (0x40 台)
    { name: 'MOV B,B', bytes: [0x40] },
    { name: 'MOV B,C', bytes: [0x41] },
    { name: 'MOV B,D', bytes: [0x42] },
    { name: 'MOV B,E', bytes: [0x43] },
    { name: 'MOV B,H', bytes: [0x44] },
    { name: 'MOV B,L', bytes: [0x45] },
    { name: 'MOV B,A', bytes: [0x47] },
    // dst=C (0x48 台)
    { name: 'MOV C,B', bytes: [0x48] },
    { name: 'MOV C,C', bytes: [0x49] },
    { name: 'MOV C,D', bytes: [0x4A] },
    { name: 'MOV C,E', bytes: [0x4B] },
    { name: 'MOV C,H', bytes: [0x4C] },
    { name: 'MOV C,L', bytes: [0x4D] },
    { name: 'MOV C,A', bytes: [0x4F] },
    // dst=D (0x50 台)
    { name: 'MOV D,B', bytes: [0x50] },
    { name: 'MOV D,C', bytes: [0x51] },
    { name: 'MOV D,D', bytes: [0x52] },
    { name: 'MOV D,E', bytes: [0x53] },
    { name: 'MOV D,H', bytes: [0x54] },
    { name: 'MOV D,L', bytes: [0x55] },
    { name: 'MOV D,A', bytes: [0x57] },
    // dst=E (0x58 台)
    { name: 'MOV E,B', bytes: [0x58] },
    { name: 'MOV E,C', bytes: [0x59] },
    { name: 'MOV E,D', bytes: [0x5A] },
    { name: 'MOV E,E', bytes: [0x5B] },
    { name: 'MOV E,H', bytes: [0x5C] },
    { name: 'MOV E,L', bytes: [0x5D] },
    { name: 'MOV E,A', bytes: [0x5F] },
    // dst=H (0x60 台)
    { name: 'MOV H,B', bytes: [0x60] },
    { name: 'MOV H,C', bytes: [0x61] },
    { name: 'MOV H,D', bytes: [0x62] },
    { name: 'MOV H,E', bytes: [0x63] },
    { name: 'MOV H,H', bytes: [0x64] },
    { name: 'MOV H,L', bytes: [0x65] },
    { name: 'MOV H,A', bytes: [0x67] },
    // dst=L (0x68 台)
    { name: 'MOV L,B', bytes: [0x68] },
    { name: 'MOV L,C', bytes: [0x69] },
    { name: 'MOV L,D', bytes: [0x6A] },
    { name: 'MOV L,E', bytes: [0x6B] },
    { name: 'MOV L,H', bytes: [0x6C] },
    { name: 'MOV L,L', bytes: [0x6D] },
    { name: 'MOV L,A', bytes: [0x6F] },
    // dst=A (0x78 台)
    { name: 'MOV A,B', bytes: [0x78] },
    { name: 'MOV A,C', bytes: [0x79] },
    { name: 'MOV A,D', bytes: [0x7A] },
    { name: 'MOV A,E', bytes: [0x7B] },
    { name: 'MOV A,H', bytes: [0x7C] },
    { name: 'MOV A,L', bytes: [0x7D] },
    { name: 'MOV A,A', bytes: [0x7F] },
  ];

  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 5 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_ADD: ADD r — 全 7 バリアント (4T / 1M)
// エンコード: 1000 0SSS
// ---------------------------------------------------------------------------

describe('ADD r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'ADD B', bytes: [0x80] },
    { name: 'ADD C', bytes: [0x81] },
    { name: 'ADD D', bytes: [0x82] },
    { name: 'ADD E', bytes: [0x83] },
    { name: 'ADD H', bytes: [0x84] },
    { name: 'ADD L', bytes: [0x85] },
    { name: 'ADD A', bytes: [0x87] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_ADC: ADC r — 全 7 バリアント (4T / 1M)
// エンコード: 1000 1SSS
// ---------------------------------------------------------------------------

describe('ADC r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'ADC B', bytes: [0x88] },
    { name: 'ADC C', bytes: [0x89] },
    { name: 'ADC D', bytes: [0x8A] },
    { name: 'ADC E', bytes: [0x8B] },
    { name: 'ADC H', bytes: [0x8C] },
    { name: 'ADC L', bytes: [0x8D] },
    { name: 'ADC A', bytes: [0x8F] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_SUB: SUB r — 全 7 バリアント (4T / 1M)
// エンコード: 1001 0SSS
// ---------------------------------------------------------------------------

describe('SUB r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'SUB B', bytes: [0x90] },
    { name: 'SUB C', bytes: [0x91] },
    { name: 'SUB D', bytes: [0x92] },
    { name: 'SUB E', bytes: [0x93] },
    { name: 'SUB H', bytes: [0x94] },
    { name: 'SUB L', bytes: [0x95] },
    { name: 'SUB A', bytes: [0x97] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_SBB: SBB r — 全 7 バリアント (4T / 1M)
// エンコード: 1001 1SSS
// ---------------------------------------------------------------------------

describe('SBB r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'SBB B', bytes: [0x98] },
    { name: 'SBB C', bytes: [0x99] },
    { name: 'SBB D', bytes: [0x9A] },
    { name: 'SBB E', bytes: [0x9B] },
    { name: 'SBB H', bytes: [0x9C] },
    { name: 'SBB L', bytes: [0x9D] },
    { name: 'SBB A', bytes: [0x9F] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_ANA: ANA r — 全 7 バリアント (4T / 1M)
// エンコード: 1010 0SSS
// ---------------------------------------------------------------------------

describe('ANA r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'ANA B', bytes: [0xA0] },
    { name: 'ANA C', bytes: [0xA1] },
    { name: 'ANA D', bytes: [0xA2] },
    { name: 'ANA E', bytes: [0xA3] },
    { name: 'ANA H', bytes: [0xA4] },
    { name: 'ANA L', bytes: [0xA5] },
    { name: 'ANA A', bytes: [0xA7] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_XRA: XRA r — 全 7 バリアント (4T / 1M)
// エンコード: 1010 1SSS
// ---------------------------------------------------------------------------

describe('XRA r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'XRA B', bytes: [0xA8] },
    { name: 'XRA C', bytes: [0xA9] },
    { name: 'XRA D', bytes: [0xAA] },
    { name: 'XRA E', bytes: [0xAB] },
    { name: 'XRA H', bytes: [0xAC] },
    { name: 'XRA L', bytes: [0xAD] },
    { name: 'XRA A', bytes: [0xAF] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_ORA: ORA r — 全 7 バリアント (4T / 1M)
// エンコード: 1011 0SSS
// ---------------------------------------------------------------------------

describe('ORA r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'ORA B', bytes: [0xB0] },
    { name: 'ORA C', bytes: [0xB1] },
    { name: 'ORA D', bytes: [0xB2] },
    { name: 'ORA E', bytes: [0xB3] },
    { name: 'ORA H', bytes: [0xB4] },
    { name: 'ORA L', bytes: [0xB5] },
    { name: 'ORA A', bytes: [0xB7] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_CMP: CMP r — 全 7 バリアント (4T / 1M)
// エンコード: 1011 1SSS
// ---------------------------------------------------------------------------

describe('CMP r — 全 7 バリアント (4T / 1M)', () => {
  const CASES = [
    { name: 'CMP B', bytes: [0xB8] },
    { name: 'CMP C', bytes: [0xB9] },
    { name: 'CMP D', bytes: [0xBA] },
    { name: 'CMP E', bytes: [0xBB] },
    { name: 'CMP H', bytes: [0xBC] },
    { name: 'CMP L', bytes: [0xBD] },
    { name: 'CMP A', bytes: [0xBF] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_INR: INR r — 全 7 レジスタ (5T / 1M)
// エンコード: 00DDD100
// ---------------------------------------------------------------------------

describe('INR r — 全 7 レジスタ (5T / 1M)', () => {
  const CASES = [
    { name: 'INR B', bytes: [0x04] },
    { name: 'INR C', bytes: [0x0C] },
    { name: 'INR D', bytes: [0x14] },
    { name: 'INR E', bytes: [0x1C] },
    { name: 'INR H', bytes: [0x24] },
    { name: 'INR L', bytes: [0x2C] },
    { name: 'INR A', bytes: [0x3C] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 5 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G_DCR: DCR r — 全 7 レジスタ (5T / 1M)
// エンコード: 00DDD101
// ---------------------------------------------------------------------------

describe('DCR r — 全 7 レジスタ (5T / 1M)', () => {
  const CASES = [
    { name: 'DCR B', bytes: [0x05] },
    { name: 'DCR C', bytes: [0x0D] },
    { name: 'DCR D', bytes: [0x15] },
    { name: 'DCR E', bytes: [0x1D] },
    { name: 'DCR H', bytes: [0x25] },
    { name: 'DCR L', bytes: [0x2D] },
    { name: 'DCR A', bytes: [0x3D] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 5 }, c.name);
    });
  }
});
