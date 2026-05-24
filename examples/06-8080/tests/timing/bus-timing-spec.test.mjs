/**
 * bus-timing-spec.test.mjs — Intel 8080A バスタイミング仕様照合 (方法 3)
 *
 * 【目的】
 * vm80a の実動作を Intel 8080A ユーザーズマニュアルのタイミング仕様と比較し、
 * 各マシンサイクルの信号遷移が仕様に準拠していることを確認する。
 *
 * 【Intel 8080A ステータスバイト (SYNC 中に D バスに出力される)】
 *
 *   bit 7: MEMR  — メモリリードサイクル (1=読み出し)
 *   bit 6: INP   — I/O 入力サイクル
 *   bit 5: M1    — 命令フェッチサイクル
 *   bit 4: OUT   — I/O 出力サイクル
 *   bit 3: HLTA  — HALT アクノリッジ
 *   bit 2: STACK — スタック操作
 *   bit 1: WO    — Write Output (0=書き込みサイクル, 1=それ以外)
 *   bit 0: INTA  — 割り込みアクノリッジ
 *
 *   0xA2 = 1010 0010 = MEMR(7) + M1(5) + WO(1)  → 命令フェッチ
 *   0x82 = 1000 0010 = MEMR(7) + WO(1)           → メモリ読み出し (オペランド)
 *   0x00 = 0000 0000 = (WO=0)                    → メモリ書き込み
 *
 * 【各マシンサイクルの信号仕様 (T-state ごと)】
 *
 *  M1 — Instruction Fetch (4T):
 *    T1: SYNC=1, status=0xA2, WR_N=1, MEMW=0
 *    T2: SYNC=0, MEMR=1, WR_N=1, MEMW=0       ← DBIN アサート
 *    T3: SYNC=0, WR_N=1, MEMW=0               ← データラッチ (IR ← opcode)
 *    T4: SYNC=0, MEMR=0, WR_N=1, MEMW=0       ← デコード/実行
 *
 *  Memory Read (3T):
 *    T1: SYNC=1, status=0x82, WR_N=1, MEMW=0
 *    T2: SYNC=0, MEMR=1, WR_N=1, MEMW=0
 *    T3: SYNC=0, WR_N=1, MEMW=0
 *
 *  Memory Write (3T):
 *    T1: SYNC=1, status=0x00, MEMR=0, DBIN=0
 *    T2: SYNC=0, MEMR=0, DBIN=0
 *    T3: SYNC=0, WR_N=0, MEMW=1               ← ライトストローブ
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { groupByMachineCycle } from '../helpers/ring.mjs';

// ---------------------------------------------------------------------------
// ゴールデンテーブル
// ---------------------------------------------------------------------------

/**
 * Intel 8080A 仕様に基づくマシンサイクル種別の期待値テーブル。
 *
 * 各エントリは { t: T-state番号, fi: フェーズインデックス (0=f2,1=f1), ...期待値 }。
 * '?' = テストしない (実装依存の過渡状態)。
 */
const M1_SPEC = [
  // index 0: T1 f2 フェーズ
  { label: 'T1 f2', t: 1, f1: true,  sync: true,  status: 0xA2, wr_n: true,  memw: false },
  // index 1: T1 f1 フェーズ
  { label: 'T1 f1', t: 1, f1: false, sync: true,  status: 0xA2, wr_n: true,  memw: false },
  // index 2: T2 f2 フェーズ
  { label: 'T2 f2', t: 2, f1: true,  sync: false, wr_n: true, memw: false },
  // index 3: T2 f1 フェーズ
  { label: 'T2 f1', t: 2, f1: false, sync: false, wr_n: true, memw: false },
  // index 4: T3 f2 フェーズ
  { label: 'T3 f2', t: 3, f1: true,  sync: false, wr_n: true, memw: false },
  // index 5: T3 f1 フェーズ (IR ラッチ)
  { label: 'T3 f1', t: 3, f1: false, sync: false, wr_n: true, memw: false },
  // index 6: T4 f2 フェーズ
  { label: 'T4 f2', t: 4, f1: true,  sync: false, memr: false, wr_n: true, memw: false },
  // index 7: T4 f1 フェーズ
  { label: 'T4 f1', t: 4, f1: false, sync: false, memr: false, wr_n: true, memw: false },
];

const MR_SPEC = [
  // index 0: T1 f2
  { label: 'T1 f2', t: 1, f1: true,  sync: true,  status: 0x82, wr_n: true, memw: false },
  // index 1: T1 f1
  { label: 'T1 f1', t: 1, f1: false, sync: true,  status: 0x82, wr_n: true, memw: false },
  // index 2: T2 f2
  { label: 'T2 f2', t: 2, f1: true,  sync: false, wr_n: true, memw: false },
  // index 3: T2 f1
  { label: 'T2 f1', t: 2, f1: false, sync: false, wr_n: true, memw: false },
  // index 4: T3 f2
  { label: 'T3 f2', t: 3, f1: true,  sync: false, wr_n: true, memw: false },
  // index 5: T3 f1
  { label: 'T3 f1', t: 3, f1: false, sync: false, wr_n: true, memw: false },
];

const MW_SPEC = [
  // index 0: T1 f2
  { label: 'T1 f2', t: 1, f1: true,  sync: true,  status: 0x00, memr: false, dbin: false },
  // index 1: T1 f1
  { label: 'T1 f1', t: 1, f1: false, sync: true,  status: 0x00, memr: false, dbin: false },
  // index 2: T2 f2
  { label: 'T2 f2', t: 2, f1: true,  sync: false, memr: false, dbin: false },
  // index 3: T2 f1
  { label: 'T2 f1', t: 2, f1: false, sync: false, memr: false, dbin: false },
  // index 4: T3 f2 (wr_n はこのフェーズまたは T3 f1 でアサート)
  { label: 'T3 f2', t: 3, f1: true,  sync: false, memr: false, dbin: false },
  // index 5: T3 f1
  { label: 'T3 f1', t: 3, f1: false, sync: false, memr: false, dbin: false },
];

// ---------------------------------------------------------------------------
// ゴールデンテーブルとサンプルを照合するユーティリティ
// ---------------------------------------------------------------------------

/**
 * samples[i] が spec[i] の期待値に一致するか検証する。
 * spec エントリに undefined の項目はスキップ。
 * @param {object[]} samples  - parseSample 済みサンプル配列
 * @param {object[]} spec     - ゴールデンテーブル
 * @param {string}   prefix   - エラーメッセージ用プレフィックス
 */
function verifySpec(samples, spec, prefix) {
  expect(samples.length).toBeGreaterThanOrEqual(spec.length,
    `${prefix}: サンプル数 ${samples.length} < spec 行数 ${spec.length}`);

  for (let i = 0; i < spec.length; i++) {
    const s = samples[i];
    const e = spec[i];
    const loc = `${prefix} ${e.label} (index=${i})`;

    if (e.f1     !== undefined) expect(s.f1,          `${loc}: f1`).toBe(e.f1);
    if (e.t      !== undefined) expect(s.t_state,     `${loc}: t_state`).toBe(e.t);
    if (e.sync   !== undefined) expect(s.sync,        `${loc}: sync`).toBe(e.sync);
    if (e.status !== undefined) expect(s.status_byte, `${loc}: status_byte`).toBe(e.status);
    if (e.memr   !== undefined) expect(s.memr,        `${loc}: memr`).toBe(e.memr);
    if (e.dbin   !== undefined) expect(s.dbin,        `${loc}: dbin`).toBe(e.dbin);
    if (e.wr_n   !== undefined) expect(s.wr_n,        `${loc}: wr_n`).toBe(e.wr_n);
    if (e.memw   !== undefined) expect(s.memw,        `${loc}: memw`).toBe(e.memw);
  }
}

// ---------------------------------------------------------------------------
// M1 サイクル (Instruction Fetch)
// ---------------------------------------------------------------------------

describe('M1 サイクル — Instruction Fetch (Intel 8080A 仕様準拠)', () => {
  it('NOP (0x00): M1 の全 8 サンプルがゴールデンテーブルに一致する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;
    verifySpec(m1, M1_SPEC, 'NOP M1');
  });

  it('XRA A (0xAF): M1 の全 8 サンプルがゴールデンテーブルに一致する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;
    verifySpec(m1, M1_SPEC, 'XRA A M1');
  });

  it('M1 全体で WR_N=true, MEMW=false が維持される (読み取り専用フェッチ)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;

    for (const s of m1) {
      expect(s.wr_n).toBe(true,  `M1 t_state=${s.t_state}: WR_N が Low`);
      expect(s.memw).toBe(false, `M1 t_state=${s.t_state}: MEMW が High`);
    }
  });

  it('M1 T1 中: SYNC=true, MEMR=false', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;
    const t1 = m1.filter(s => s.t_state === 1);

    expect(t1).toHaveLength(2);
    for (const s of t1) {
      expect(s.sync).toBe(true);
      expect(s.memr).toBe(false);
    }
  });

  it('M1 T2-T3 中: SYNC=false, MEMR=true のサンプルが存在する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;
    const t2t3 = m1.filter(s => s.t_state === 2 || s.t_state === 3);

    for (const s of t2t3) {
      expect(s.sync).toBe(false);
    }
    expect(t2t3.some(s => s.memr)).toBe(true);
  });

  it('M1 T4 中: SYNC=false, MEMR=false (データラッチ完了)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;
    const t4 = m1.filter(s => s.t_state === 4);

    expect(t4).toHaveLength(2);
    for (const s of t4) {
      expect(s.sync).toBe(false);
      expect(s.memr).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Memory Read サイクル (オペランド読み出し)
// ---------------------------------------------------------------------------

describe('Memory Read サイクル — オペランド読み出し (Intel 8080A 仕様準拠)', () => {
  it('MVI A (0x3E, $42): M2 の全 6 サンプルがゴールデンテーブルに一致する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const cycles = groupByMachineCycle(result.instrSamples);
    // cycles[1] = M2: オペランド読み出し (3T = 6 サンプル)
    expect(cycles).toHaveLength(2);
    verifySpec(cycles[1].samples, MR_SPEC, 'MVI A M2');
  });

  it('MVI A M2 全体で WR_N=true, MEMW=false (読み取り専用)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const mr = groupByMachineCycle(result.instrSamples)[1].samples;

    for (const s of mr) {
      expect(s.wr_n).toBe(true,  `MR t_state=${s.t_state}: WR_N が Low`);
      expect(s.memw).toBe(false, `MR t_state=${s.t_state}: MEMW が High`);
    }
  });

  it('LXI B (0x01): M2/M3 どちらも status_byte=0x82 (Memory Read)', async () => {
    // LXI B, nn は 3バイト: M1(4T) + MR(3T) + MR(3T) = 10T
    const sim = await loadSim();
    const result = sim.captureInstruction([0x01, 0x34, 0x12]);
    const cycles = groupByMachineCycle(result.instrSamples);
    expect(cycles).toHaveLength(3);
    // M2 と M3 はともに Memory Read
    expect(cycles[1].samples[0].status_byte).toBe(0x82);
    expect(cycles[2].samples[0].status_byte).toBe(0x82);
  });
});

// ---------------------------------------------------------------------------
// Memory Write サイクル
// ---------------------------------------------------------------------------

describe('Memory Write サイクル (Intel 8080A 仕様準拠)', () => {
  // MOV M,A (0x77): HL が指すアドレスに A を書く
  // M1(4T) + MW(3T) = 7T, 2 マシンサイクル
  // デフォルト HL=0x0000 → アドレス 0x0000 に書き込み (JMP の上書き)

  it('MOV M,A (0x77): MW サイクルの status_byte=0x00 (Write サイクル)', async () => {
    const sim = await loadSim();
    // 0x0100: MOV M,A; JMP 0x0100 (H=0, L=0 でアドレス 0 に書く)
    const result = sim.captureInstruction([0x77]);
    const cycles = groupByMachineCycle(result.instrSamples);
    // cycles[1] = MW (3T = 6 サンプル)
    expect(cycles).toHaveLength(2);
    expect(cycles[1].samples[0].status_byte).toBe(0x00);
  });

  it('MOV M,A: MW のゴールデンテーブル照合 (status, SYNC, MEMR, DBIN)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x77]);
    const mw = groupByMachineCycle(result.instrSamples)[1].samples;
    verifySpec(mw, MW_SPEC, 'MOV M,A MW');
  });

  it('MOV M,A: MW T3 でライトストローブ (WR_N=false, MEMW=true) が出る', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x77]);
    const mw = groupByMachineCycle(result.instrSamples)[1].samples;
    const t3 = mw.filter(s => s.t_state === 3);

    expect(t3).toHaveLength(2);
    // T3 の少なくとも 1 サンプルで WR_N=false, MEMW=true
    expect(t3.some(s => !s.wr_n && s.memw)).toBe(true);
  });

  it('MOV M,A: MW 全体で MEMR=false, DBIN=false (書き込み時は読み取りなし)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x77]);
    const mw = groupByMachineCycle(result.instrSamples)[1].samples;

    for (const s of mw) {
      expect(s.memr).toBe(false, `MW t_state=${s.t_state}: MEMR が High`);
      expect(s.dbin).toBe(false, `MW t_state=${s.t_state}: DBIN が High`);
    }
  });

  it('MOV M,A: M1 は WR_N=1 (書き込みなし)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x77]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;

    for (const s of m1) {
      expect(s.wr_n).toBe(true, `M1 t_state=${s.t_state}: WR_N が Low`);
    }
  });
});

// ---------------------------------------------------------------------------
// マルチサイクル命令のシグネチャ照合
// ---------------------------------------------------------------------------

describe('マルチサイクル命令のバスシグネチャ', () => {
  it('MVI A ($42): マシンサイクル列は [M1(FETCH=0xA2), MR(0x82)]', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const cycles = groupByMachineCycle(result.instrSamples);

    expect(cycles).toHaveLength(2);
    expect(cycles[0].samples[0].status_byte).toBe(0xA2); // M1: FETCH
    expect(cycles[1].samples[0].status_byte).toBe(0x82); // M2: MR
    expect(cycles[0].tStates).toBe(4);
    expect(cycles[1].tStates).toBe(3);
  });

  it('MVI M ($nn): マシンサイクル列は [M1(0xA2), MR(0x82), MW(0x00)]', async () => {
    // MVI M = 0x36 nn (M1:4T + MR:3T + MW:3T = 10T)
    const sim = await loadSim();
    const result = sim.captureInstruction([0x36, 0xAA]);
    const cycles = groupByMachineCycle(result.instrSamples);

    expect(cycles).toHaveLength(3);
    expect(cycles[0].samples[0].status_byte).toBe(0xA2); // M1: FETCH
    expect(cycles[1].samples[0].status_byte).toBe(0x82); // M2: MR
    expect(cycles[2].samples[0].status_byte).toBe(0x00); // M3: MW
    expect(cycles[0].tStates).toBe(4);
    expect(cycles[1].tStates).toBe(3);
    expect(cycles[2].tStates).toBe(3);
  });

  it('MVI M ($nn): M3 (MW) で MEMW=true, WR_N=false のサンプルが存在する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x36, 0xAA]);
    const mw = groupByMachineCycle(result.instrSamples)[2].samples;

    expect(mw.some(s => s.memw && !s.wr_n)).toBe(true);
  });

  it('各マシンサイクルで SYNC は T1 の 2 サンプルのみ true (SYNC パルス幅 = 1T)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]); // MVI A: 2 サイクル
    const cycles = groupByMachineCycle(result.instrSamples);

    for (const c of cycles) {
      const syncCount = c.samples.filter(s => s.sync).length;
      expect(syncCount).toBe(2,
        `M${c.mCycleIdx + 1}: SYNC=true のサンプルが ${syncCount} 個 (期待 2)`);
    }
  });

  it('読み取りサイクル (M1, MR) では全体を通じて MEMW=false', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    for (const s of result.instrSamples) {
      expect(s.memw).toBe(false, `addr=${s.addr} t_state=${s.t_state}: MEMW が High`);
    }
  });
});

// ---------------------------------------------------------------------------
// 境界条件テスト
// ---------------------------------------------------------------------------

describe('境界条件', () => {
  it('T-state 数: NOP=4, MVI A=7 (4+3), MVI M=10 (4+3+3)', async () => {
    const sim1 = await loadSim();
    const sim2 = await loadSim();
    const sim3 = await loadSim();

    const r1 = sim1.captureInstruction([0x00]);        // NOP
    const r2 = sim2.captureInstruction([0x3E, 0x42]);  // MVI A
    const r3 = sim3.captureInstruction([0x36, 0xAA]);  // MVI M

    expect(r1.timing.totalTStates).toBe(4);
    expect(r2.timing.totalTStates).toBe(7);
    expect(r3.timing.totalTStates).toBe(10);
  });

  it('status_byte は全マシンサイクルで T1 後も値を保持する (status レジスタ)', async () => {
    // cpm_top: always @(posedge clk) if (cpu_sync) status <= cpu_dout;
    // SYNC 後も status は次の SYNC まで維持される
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const m1 = groupByMachineCycle(result.instrSamples)[0].samples;

    // M1 の全サンプルで status_byte=0xA2 (最初の SYNC でラッチされ維持)
    for (const s of m1) {
      expect(s.status_byte).toBe(0xA2,
        `M1 t_state=${s.t_state}: status_byte=${s.status_byte} (期待 0xA2)`);
    }
  });
});
