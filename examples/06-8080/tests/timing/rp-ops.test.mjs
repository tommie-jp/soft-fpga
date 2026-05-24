/**
 * rp-ops.test.mjs — Phase 2: レジスタペア命令 + STAX D / LDAX D
 *
 * 対象:
 *   - INX  rp  : B/D/H/SP 全4ペア (5T / 1M)
 *   - DCX  rp  : B/D/H/SP 全4ペア (5T / 1M)
 *   - DAD  rp  : B/D/H/SP 全4ペア (10T / 1M*  vm80a: SYNC=1回のみ)
 *   - STAX rp  : B/D 全2バリアント (7T / 2M)
 *   - LDAX rp  : B/D 全2バリアント (7T / 2M)
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
// INX rp — 全 4 ペア (5T / 1M)
// エンコード: 00RP0011  B=00, D=01, H=10, SP=11
// ---------------------------------------------------------------------------

describe('INX rp — 全 4 ペア (5T / 1M)', () => {
  const CASES = [
    { name: 'INX B',  bytes: [0x03] },
    { name: 'INX D',  bytes: [0x13] },
    { name: 'INX H',  bytes: [0x23] },
    { name: 'INX SP', bytes: [0x33] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// DCX rp — 全 4 ペア (5T / 1M)
// エンコード: 00RP1011  B=00, D=01, H=10, SP=11
// ---------------------------------------------------------------------------

describe('DCX rp — 全 4 ペア (5T / 1M)', () => {
  const CASES = [
    { name: 'DCX B',  bytes: [0x0B] },
    { name: 'DCX D',  bytes: [0x1B] },
    { name: 'DCX H',  bytes: [0x2B] },
    { name: 'DCX SP', bytes: [0x3B] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// DAD rp — 全 4 ペア (10T / 1M*)
//
// vm80a 固有: SDAD 内部サイクルで SYNC を出力しないため、
// リングバッファ上では SYNC=1 が M1 の 1 回だけ → M=1 相当として解析される。
// Intel 8080A 仕様では M=3 (4T+3T+3T) だが、vm80a は 1 マシンサイクル×10T として見える。
// ---------------------------------------------------------------------------

describe('DAD rp — 全 4 ペア (10T / 1M*)', () => {
  const CASES = [
    { name: 'DAD B',  bytes: [0x09] },
    { name: 'DAD D',  bytes: [0x19] },
    { name: 'DAD H',  bytes: [0x29] },
    { name: 'DAD SP', bytes: [0x39] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      // vm80a: SYNC=1回 → m=1、合計 T-state=10
      expectTiming(timing, { m: 1, t: 10 }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// STAX rp — B/D (7T / 2M)
//
// [BC] または [DE] が指すアドレスに A を書き込む。
// アドレス 0x0000 が書き換わっても測定対象のループ (0x0100) には影響なし。
// ---------------------------------------------------------------------------

describe('STAX rp — B/D (7T / 2M)', () => {
  const CASES = [
    { name: 'STAX B', bytes: [0x02] },
    { name: 'STAX D', bytes: [0x12] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// LDAX rp — B/D (7T / 2M)
//
// [BC] または [DE] が指すアドレスから A へ読み込む。
// ---------------------------------------------------------------------------

describe('LDAX rp — B/D (7T / 2M)', () => {
  const CASES = [
    { name: 'LDAX B', bytes: [0x0A] },
    { name: 'LDAX D', bytes: [0x1A] },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }
});
