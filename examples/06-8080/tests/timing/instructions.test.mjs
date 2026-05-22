/**
 * instructions.test.mjs — 8080 命令 Logic Analyzer タイミング検証テスト
 *
 * Intel 8080A ユーザーズマニュアル Table 2-4 (Instruction Set Summary) の
 * T-state 数・マシンサイクル数・バスシーケンスを検証する。
 *
 * リングバッファの 2フェーズクロック制約:
 *   1 T-state = 2 サンプル
 *   SYNC パルスは T1 f1・f2 の両フェーズで High → 立ち上がりエッジで命令境界を検出
 *
 * 各テストは独立した sim インスタンスを使うため並列実行可能。
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import {
  formatTiming,
  extractFirstInstr,
  extractNMachineCycles,
  readRingBuffer,
  parseSample,
  analyzeTiming,
} from '../helpers/ring.mjs';

// ---------------------------------------------------------------------------
// 共通定数・ヘルパー
// ---------------------------------------------------------------------------

const POST_DELAY = 120; // 最長命令(17T=34samples) + JMP(10T=20samples) + 余裕

/**
 * インラインテスト用: トリガー発火まで step して ring buffer を読む。
 * setPostDelay も内部で呼ぶ。
 * @param {import('../helpers/sim.mjs').SimWrapper} sim
 * @param {number} [postDelay=POST_DELAY]
 * @returns {Array} parsedSamples (postDelay+1 個)
 */
function waitTriggerAndRead(sim, postDelay = POST_DELAY) {
  sim.setPostDelay(postDelay);
  for (let i = 0; i < 300000; i++) {
    sim.step();
    if (sim.isTriggerHit()) break;
  }
  if (!sim.isTriggerHit()) throw new Error('トリガーが発火しなかった');
  sim.M._sim_freeze_ring();
  // +1 でトリガーサンプル (M1 T1 f1) を含める
  const snap = readRingBuffer(
    sim.M.HEAPU32, sim.ringBase, sim.ringSize, sim.getHead(), postDelay + 1
  );
  return snap.map(parseSample);
}

/**
 * タイミング検証ヘルパー
 * @param {{machineCycles: number, totalTStates: number, cycles: Array}} timing
 * @param {{m: number, t: number, perCycle?: number[]}} expected
 * @param {string} instrName
 */
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
// G01: MVI r, d8 — データ即値ロード
// ---------------------------------------------------------------------------
describe('G01: MVI r, d8 (7T / M=2)', () => {
  const cases = [
    { name: 'MVI A, $FF', bytes: [0x3E, 0xFF] },
    { name: 'MVI B, $00', bytes: [0x06, 0x00] },
    { name: 'MVI C, $55', bytes: [0x0E, 0x55] },
    { name: 'MVI D, $AA', bytes: [0x16, 0xAA] },
    { name: 'MVI E, $01', bytes: [0x1E, 0x01] },
    { name: 'MVI H, $02', bytes: [0x26, 0x02] },
    { name: 'MVI L, $03', bytes: [0x2E, 0x03] },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, c.name);
    });
  }

  it('MVI M, $FF (10T / M=3)', async () => {
    // LXI H,0x0200 で HL を設定してから MVI M を測定する
    // 0x0000: JMP 0x0100
    // 0x0100: LXI H,0x0200 (3B)
    // 0x0103: MVI M,$FF (2B)  ← trigger
    // 0x0105: JMP 0x0103
    // extractFirstInstr はafterAddrを知らないため、extractNMachineCycles で 3 サイクルを抽出
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x0100, [0x21, 0x00, 0x02]);  // LXI H,0x0200
    sim.pokeBytes(0x0103, [0x36, 0xFF]);         // MVI M,$FF
    sim.pokeBytes(0x0105, [0xC3, 0x03, 0x01]);  // JMP 0x0103

    sim.clearTrigger();
    sim.setInstrTrigger(0x0103, -1);

    const parsed = waitTriggerAndRead(sim);
    const instrSamples = extractNMachineCycles(parsed, 3);
    const timing = analyzeTiming(instrSamples);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'MVI M,$FF');
  });
});

// ---------------------------------------------------------------------------
// G02: MOV r1, r2 — レジスタ間転送 (5T / M=1)
// ---------------------------------------------------------------------------
describe('G02: MOV r1, r2 (5T / M=1)', () => {
  const cases = [
    { name: 'MOV A, B', bytes: [0x78] },
    { name: 'MOV B, C', bytes: [0x41] },
    { name: 'MOV D, E', bytes: [0x53] },
    { name: 'MOV H, L', bytes: [0x65] },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G03: LXI rp, d16 — 16bit 即値ロード (10T / M=3)
// ---------------------------------------------------------------------------
describe('G03: LXI rp, d16 (10T / M=3)', () => {
  const cases = [
    { name: 'LXI B,0x1234', bytes: [0x01, 0x34, 0x12] },
    { name: 'LXI D,0x5678', bytes: [0x11, 0x78, 0x56] },
    { name: 'LXI H,0x9ABC', bytes: [0x21, 0xBC, 0x9A] },
    { name: 'LXI SP,0x0200', bytes: [0x31, 0x00, 0x02] },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G04: XCHG / SPHL / PCHL — 特殊転送
// ---------------------------------------------------------------------------
// XCHG は Intel 8080A 仕様では 4T / M=1、SPHL・PCHL は 5T / M=1
describe('G04: XCHG (4T/M=1), SPHL/PCHL (5T/M=1)', () => {
  it('XCHG (DE ↔ HL) 4T / M=1', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xEB]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'XCHG');
  });

  it('SPHL (HL → SP)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xF9]);
    expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, 'SPHL');
  });

  it('PCHL (HL → PC, 5T / M=1)', async () => {
    // LXI H,0x0103; PCHL → 0x0103 でループ (PCHL が自己参照)
    // 0x0000: JMP 0x0100
    // 0x0100: LXI H,0x0103 (3B)
    // 0x0103: PCHL (1B)  ← trigger & ループ
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x0100, [0x21, 0x03, 0x01]);  // LXI H,0x0103
    sim.pokeBytes(0x0103, [0xE9]);               // PCHL → 0x0103

    sim.clearTrigger();
    sim.setInstrTrigger(0x0103, -1);

    const parsed = waitTriggerAndRead(sim);
    // PCHL は飛び先が 0x0103 自身なので extractFirstInstr でOK
    const instrSamples = extractFirstInstr(parsed, 0x0103);
    const timing = analyzeTiming(instrSamples);
    expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, 'PCHL');
  });
});

// ---------------------------------------------------------------------------
// G05: ADD r — レジスタ加算 (4T / M=1)
// ---------------------------------------------------------------------------
describe('G05: ADD r (4T / M=1)', () => {
  const cases = [
    { name: 'ADD A', bytes: [0x87] },
    { name: 'ADD B', bytes: [0x80] },
    { name: 'ADD C', bytes: [0x81] },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G06: ADC r — キャリー加算 (4T / M=1)
// ---------------------------------------------------------------------------
describe('G06: ADC r (4T / M=1)', () => {
  it('ADC A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x8F]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'ADC A');
  });
});

// ---------------------------------------------------------------------------
// G07: SUB r — 減算 (4T / M=1)
// ---------------------------------------------------------------------------
describe('G07: SUB r (4T / M=1)', () => {
  it('SUB A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x97]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'SUB A');
  });
});

// ---------------------------------------------------------------------------
// G08: SBB r — ボロウ減算 (4T / M=1)
// ---------------------------------------------------------------------------
describe('G08: SBB r (4T / M=1)', () => {
  it('SBB A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x9F]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'SBB A');
  });
});

// ---------------------------------------------------------------------------
// G09: ANA r — AND (4T / M=1)
// ---------------------------------------------------------------------------
describe('G09: ANA r (4T / M=1)', () => {
  it('ANA A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xA7]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'ANA A');
  });
});

// ---------------------------------------------------------------------------
// G10: ORA r — OR (4T / M=1)
// ---------------------------------------------------------------------------
describe('G10: ORA r (4T / M=1)', () => {
  it('ORA A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xB7]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'ORA A');
  });
});

// ---------------------------------------------------------------------------
// G11: XRA r — XOR (4T / M=1)
// ---------------------------------------------------------------------------
describe('G11: XRA r (4T / M=1)', () => {
  it('XRA A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xAF]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'XRA A');
  });
});

// ---------------------------------------------------------------------------
// G12: CMP r — 比較 (4T / M=1)
// ---------------------------------------------------------------------------
describe('G12: CMP r (4T / M=1)', () => {
  it('CMP A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xBF]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'CMP A');
  });
});

// ---------------------------------------------------------------------------
// G13: INR / DCR / INX / DCX
// ---------------------------------------------------------------------------
describe('G13: INR r (5T / M=1), DCR r (5T / M=1)', () => {
  it('INR A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x3C]);
    expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, 'INR A');
  });

  it('DCR A', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x3D]);
    expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, 'DCR A');
  });

  it('INX B (5T / M=1)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x03]);
    expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, 'INX B');
  });

  it('DCX B (5T / M=1)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x0B]);
    expectTiming(timing, { m: 1, t: 5, perCycle: [5] }, 'DCX B');
  });
});

// ---------------------------------------------------------------------------
// G14: DAD / NOP / DI / EI
// ---------------------------------------------------------------------------
describe('G14: DAD (10T / M=3), NOP (4T / M=1)', () => {
  it('DAD B (10T)', async () => {
    // vm80a は DAD の SDAD 内部サイクルで SYNC を出力しない。
    // 8080 仕様では M=3 (4T+3T+3T) だが、vm80a では SYNC は M1 T1 の 1 回のみ。
    // リングバッファ上では 1 つの 10T マシンサイクルとして見える。
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x0100, [0x09]);              // DAD B
    sim.pokeBytes(0x0101, [0xC3, 0x00, 0x01]); // JMP 0x0100

    sim.clearTrigger();
    sim.setInstrTrigger(0x0100, -1);

    const parsed = waitTriggerAndRead(sim);
    // SYNC は 1 回のみ → 1 マシンサイクルとして抽出
    const instrSamples = extractNMachineCycles(parsed, 1);
    const timing = analyzeTiming(instrSamples);
    // vm80a では totalTStates=10 だが SYNC は 1 回 (M=1 相当)
    expectTiming(timing, { m: 1, t: 10 }, 'DAD B');
  });

  it('NOP (4T / M=1)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x00]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'NOP');
  });

  it('DI (4T / M=1)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xF3]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'DI');
  });

  it('EI (4T / M=1)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xFB]);
    expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, 'EI');
  });
});

// ---------------------------------------------------------------------------
// G15: STA / LDA / SHLD / LHLD / STAX / LDAX
// ---------------------------------------------------------------------------
describe('G15: STA/LDA (13T / M=4), STAX/LDAX (7T / M=2)', () => {
  it('STA 0x0200 (13T / M=4)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x32, 0x00, 0x02]);
    expectTiming(timing, { m: 4, t: 13, perCycle: [4, 3, 3, 3] }, 'STA');
  });

  it('LDA 0x0200 (13T / M=4)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x3A, 0x00, 0x02]);
    expectTiming(timing, { m: 4, t: 13, perCycle: [4, 3, 3, 3] }, 'LDA');
  });

  it('SHLD 0x0200 (16T / M=5)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x22, 0x00, 0x02]);
    expectTiming(timing, { m: 5, t: 16, perCycle: [4, 3, 3, 3, 3] }, 'SHLD');
  });

  it('LHLD 0x0200 (16T / M=5)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x2A, 0x00, 0x02]);
    expectTiming(timing, { m: 5, t: 16, perCycle: [4, 3, 3, 3, 3] }, 'LHLD');
  });

  it('STAX B (7T / M=2)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x02]);
    expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, 'STAX B');
  });

  it('LDAX B (7T / M=2)', async () => {
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0x0A]);
    expectTiming(timing, { m: 2, t: 7, perCycle: [4, 3] }, 'LDAX B');
  });
});

// ---------------------------------------------------------------------------
// G16: RLC / RRC / RAL / RAR / CMA / STC / CMC / DAA
// ---------------------------------------------------------------------------
describe('G16: 1バイト演算 (4T / M=1)', () => {
  const cases = [
    { name: 'RLC',  bytes: [0x07] },
    { name: 'RRC',  bytes: [0x0F] },
    { name: 'RAL',  bytes: [0x17] },
    { name: 'RAR',  bytes: [0x1F] },
    { name: 'CMA',  bytes: [0x2F] },
    { name: 'STC',  bytes: [0x37] },
    { name: 'CMC',  bytes: [0x3F] },
    { name: 'DAA',  bytes: [0x27] },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const sim = await loadSim();
      const { timing } = sim.captureInstruction(c.bytes);
      expectTiming(timing, { m: 1, t: 4, perCycle: [4] }, c.name);
    });
  }
});

// ---------------------------------------------------------------------------
// G17: JMP / Jcc — ジャンプ (10T / M=3 常時)
// ---------------------------------------------------------------------------
describe('G17: JMP/Jcc (10T / M=3)', () => {
  it('JMP addr (10T / M=3)', async () => {
    // JMP 0x0100: 自分自身に戻るループ
    // captureInstruction 内で afterInstr(0x0103) に JMP 0x0100 が書かれるが、
    // instrBytes=[0xC3,0x00,0x01] が 0x0100 に先に書かれているので実質 JMP 0x0100 ループ
    const sim = await loadSim();
    const { timing } = sim.captureInstruction([0xC3, 0x00, 0x01]);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'JMP');
  });

  it('JNZ addr 条件成立 (10T / M=3)', async () => {
    // MVI A,1 → Z=0 → JNZ 0x0102 (自己ループ) で条件ジャンプを測定
    // 0x0000: JMP 0x0100
    // 0x0100: MVI A,1
    // 0x0102: JNZ 0x0102  ← trigger & ループ
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x0100, [0x3E, 0x01]);          // MVI A,1 → Z=0
    sim.pokeBytes(0x0102, [0xC2, 0x02, 0x01]);    // JNZ 0x0102 (自己ループ)

    sim.clearTrigger();
    sim.setInstrTrigger(0x0102, -1);

    const parsed = waitTriggerAndRead(sim);
    // JNZ 0x0102 は自己ループなので startAddr=0x0102 での extractFirstInstr でOK
    const instrSamples = extractFirstInstr(parsed, 0x0102);
    const timing = analyzeTiming(instrSamples);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'JNZ (taken)');
  });
});

// ---------------------------------------------------------------------------
// G18: CALL addr (17T / M=5)
// ---------------------------------------------------------------------------
describe('G18: CALL addr (17T / M=5)', () => {
  it('CALL addr (17T / M=5)', async () => {
    // 0x0000: JMP 0x010A
    // 0x010A: LXI SP,0x01F0 (SP を安全な位置に)
    // 0x010D: JMP 0x0100
    // 0x0100: CALL 0x0106  ← trigger
    // 0x0103: JMP 0x0100   (RET 後の戻り先)
    // 0x0106: RET
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x0A); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x010A, [0x31, 0xF0, 0x01]);    // LXI SP,0x01F0
    sim.pokeBytes(0x010D, [0xC3, 0x00, 0x01]);    // JMP 0x0100
    sim.pokeBytes(0x0100, [0xCD, 0x06, 0x01]);    // CALL 0x0106
    sim.pokeBytes(0x0103, [0xC3, 0x00, 0x01]);    // JMP 0x0100
    sim.pokeBytes(0x0106, [0xC9]);                 // RET

    sim.clearTrigger();
    sim.setInstrTrigger(0x0100, -1);

    const parsed = waitTriggerAndRead(sim);
    // CALL は 5 マシンサイクル: M1(4T)+M2(3T)+M3(3T)+M4(3T)+M5(4T)=17T
    // RET を含まず正確に 5 サイクルだけ抽出する
    const instrSamples = extractNMachineCycles(parsed, 5);
    const timing = analyzeTiming(instrSamples);
    // vm80a では M1=5T (Intel 8080 仕様の M1=4T と異なる)、M5=3T
    // Intel 8080A User's Manual では M1=4T, M5=4T だが vm80a は M1=5T, M5=3T で合計 17T は同じ
    expectTiming(timing, { m: 5, t: 17, perCycle: [5, 3, 3, 3, 3] }, 'CALL addr');
  });
});

// ---------------------------------------------------------------------------
// G19: RET (10T / M=3)
// ---------------------------------------------------------------------------
describe('G19: RET (10T / M=3)', () => {
  it('RET (10T / M=3)', async () => {
    // 0x0000: JMP 0x010A
    // 0x010A: LXI SP,0x01F0
    // 0x010D: CALL 0x0113  → ループ
    // 0x0110: JMP 0x010D
    // 0x0113: RET  ← trigger
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x0A); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x010A, [0x31, 0xF0, 0x01]);    // LXI SP,0x01F0
    sim.pokeBytes(0x010D, [0xCD, 0x13, 0x01]);    // CALL 0x0113
    sim.pokeBytes(0x0110, [0xC3, 0x0D, 0x01]);    // JMP 0x010D
    sim.pokeBytes(0x0113, [0xC9]);                 // RET (trigger)

    sim.clearTrigger();
    sim.setInstrTrigger(0x0113, -1);

    const parsed = waitTriggerAndRead(sim);
    // RET は 3 マシンサイクル: M1(4T)+M2(3T)+M3(3T)=10T
    const instrSamples = extractNMachineCycles(parsed, 3);
    const timing = analyzeTiming(instrSamples);
    expectTiming(timing, { m: 3, t: 10, perCycle: [4, 3, 3] }, 'RET');
  });
});

// ---------------------------------------------------------------------------
// G20: RST n (11T / M=3)
// ---------------------------------------------------------------------------
describe('G20: RST n (11T / M=3)', () => {
  it('RST 0 (11T / M=3)', async () => {
    // 0x0000: JMP 0x0100  (RST 0 の飛び先をループに向ける)
    // 0x0100: LXI SP,0x01F0
    // 0x0103: RST 0  ← trigger
    // RST 0 → 0x0000 (JMP 0x0100) → 次のループでまた 0x0103 に到達
    const sim = await loadSim();
    sim.init();
    sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
    sim.pokeBytes(0x0100, [0x31, 0xF0, 0x01]);    // LXI SP,0x01F0
    sim.pokeBytes(0x0103, [0xC7]);                 // RST 0 (trigger)

    sim.clearTrigger();
    sim.setInstrTrigger(0x0103, -1);

    const parsed = waitTriggerAndRead(sim);
    // RST は 3 マシンサイクル: M1(5T)+M2(3T)+M3(3T)=11T
    const instrSamples = extractNMachineCycles(parsed, 3);
    const timing = analyzeTiming(instrSamples);
    expectTiming(timing, { m: 3, t: 11, perCycle: [5, 3, 3] }, 'RST 0');
  });
});
