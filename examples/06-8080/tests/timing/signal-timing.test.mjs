/**
 * signal-timing.test.mjs — リングバッファ信号フェーズ検証 (方法 2)
 *
 * 【目的】
 * リングバッファの各サンプルに記録された信号が、vm80a の 2フェーズクロック規約
 * に沿って正しいタイミングで変化しているかを確認する。
 *
 * 「タイミングの正しさ」とは:
 *   - f1/f2 の交互パターンが instrSamples の奇偶インデックスで一致していること
 *   - t_state カウンタが 2サンプルごとに増えること (1T = 2サンプル)
 *   - IR は M1 T3 の f1 フェーズ (instrSamples[5]) でラッチされること
 *   - SYNC は T1 の 2サンプル (instrSamples[0, 1]) のみ true であること
 *   - MEMR は T1 (SYNC 中) では false、T2-T3 で true になること
 *
 * 【vm80a 2フェーズクロック規約 (ハーネス視点)】
 *   harness NEW f1 = true  → vm80a が OLD f1=0 / OLD f2=1 で評価 (= vm80a f2 アクション)
 *   harness NEW f1 = false → vm80a が OLD f1=1 / OLD f2=0 で評価 (= vm80a f1 アクション)
 *
 * instrSamples インデックスと f1 の対応 (M1 = 4T = 8 サンプル):
 *   index | f1    | t_state | vm80a 内部フェーズ | 主要イベント
 *     0   | true  |    1    |  f2 (T1 SET)       | SYNC=1, トリガーポイント
 *     1   | false |    1    |  f1 (T1 latch)     | SYNC=1
 *     2   | true  |    2    |  f2 (T2 SET)       | SYNC=0, T2 開始
 *     3   | false |    2    |  f1 (T2 latch)     |
 *     4   | true  |    3    |  f2 (T3 SET)       | T3=1 がセット (vm80a 内部)
 *     5   | false |    3    |  f1 (T3 latch)     | IR ここでラッチ!
 *     6   | true  |    4    |  f2 (T4 SET)       | T4 開始
 *     7   | false |    4    |  f1 (T4 latch)     |
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { groupByMachineCycle } from '../helpers/ring.mjs';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function getM1Samples(result) {
  return groupByMachineCycle(result.instrSamples)[0].samples;
}

// ---------------------------------------------------------------------------
// f1/f2 交互パターン
// ---------------------------------------------------------------------------

describe('f1/f2 交互パターン', () => {
  it('M1 の全サンプルで f1 は偶数インデックス=true, 奇数=false', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]); // NOP (1バイト, 4T)
    const m1 = getM1Samples(result);

    expect(m1).toHaveLength(8); // 4T × 2 フェーズ = 8 サンプル
    m1.forEach((s, i) => {
      const expected = (i % 2 === 0);
      expect(s.f1).toBe(expected,
        `instrSamples[${i}]: f1=${s.f1} (期待 ${expected})`);
    });
  });

  it('M1 の全サンプルで f1/f2 は相補関係', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = getM1Samples(result);

    for (let i = 0; i < m1.length; i++) {
      expect(m1[i].f1).not.toBe(m1[i].f2,
        `instrSamples[${i}]: f1=${m1[i].f1} と f2=${m1[i].f2} が相補でない`);
    }
  });
});

// ---------------------------------------------------------------------------
// t_state カウンタパターン
// ---------------------------------------------------------------------------

describe('t_state カウンタ', () => {
  it('M1(4T) 全 8 サンプルの t_state は [1,1,2,2,3,3,4,4]', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]); // NOP
    const m1 = getM1Samples(result);
    // 1T につき 2サンプル (f2 フェーズと f1 フェーズ) で同じ t_state を共有する
    expect(m1.map(s => s.t_state)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('MVI A (4T M1 + 3T MR = 7T) の各マシンサイクルで t_state がリセットされる', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]); // MVI A, $42
    const cycles = groupByMachineCycle(result.instrSamples);
    // M1 (4T): t_state=[1,1,2,2,3,3,4,4]
    expect(cycles[0].samples.map(s => s.t_state)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    // M2 (MR, 3T): t_state=[1,1,2,2,3,3]
    expect(cycles[1].samples.map(s => s.t_state)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('各マシンサイクルの先頭サンプルで t_state は 1 にリセットされる', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const cycles = groupByMachineCycle(result.instrSamples);
    for (const c of cycles) {
      expect(c.samples[0].t_state).toBe(1,
        `M${c.mCycleIdx + 1} の先頭サンプル: t_state=${c.samples[0].t_state} (期待 1)`);
    }
  });
});

// ---------------------------------------------------------------------------
// SYNC タイミング
// ---------------------------------------------------------------------------

describe('SYNC タイミング', () => {
  it('M1: instrSamples[0,1] のみ sync=true, 残りは false', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]); // NOP
    const m1 = getM1Samples(result);

    expect(m1[0].sync).toBe(true);  // T1 f2 phase
    expect(m1[1].sync).toBe(true);  // T1 f1 phase
    for (let i = 2; i < m1.length; i++) {
      expect(m1[i].sync).toBe(false,
        `instrSamples[${i}]: sync=true (T2 以降は false を期待)`);
    }
  });

  it('SYNC パルス幅は 2 サンプル (= 1 T-state)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]); // MVI A
    const syncs = result.instrSamples.filter(s => s.sync);
    // 2 マシンサイクル × 2 サンプル = 4 サンプルが sync=true
    expect(syncs).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// IR ラッチタイミング (方法 2 の核心)
// ---------------------------------------------------------------------------

describe('IR ラッチタイミング', () => {
  it('XRA A (0xAF): instrSamples[5] (T3 f1 フェーズ) で IR = 0xAF にラッチされる', async () => {
    const sim = await loadSim();
    // XRA A は 1バイト命令 → M1 のみ (4T = 8 サンプル)
    // ハーネス起動時の前命令は JMP (opc=0xC3) のため、
    // instrSamples[4] 時点では IR はまだ 0xC3 を保持している
    const result = sim.captureInstruction([0xAF]);
    const m1 = getM1Samples(result);

    // index 5: f1=false, t_state=3, vm80a f1 アクション
    //   vm80a: if (~f2 & m1 & t3) i <= pin_din; → OLD f2=0, OLD t3=1 → ラッチ!
    expect(m1[5].f1).toBe(false);      // f1=false: vm80a f1 アクション
    expect(m1[5].t_state).toBe(3);     // T3 期間
    expect(m1[5].ir).toBe(0xAF);       // IR にオペコードがラッチされた
  });

  it('XRA A (0xAF): instrSamples[4] (T3 f2 フェーズ) では IR = 0xAF (ハーネス読み取り時点でラッチ済み)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    const m1 = getM1Samples(result);

    // index 4: f1=true, t_state=3, vm80a f2 アクション
    //   ハーネスはポスエッジ後に信号を読み取るため、vm80a が f2 アクションを完了した時点の値が記録される。
    //   実測では instrSamples[4].ir = 0xAF — T3 f2 フェーズ内で IR がラッチされていることを示す。
    expect(m1[4].f1).toBe(true);       // f2 フェーズ
    expect(m1[4].t_state).toBe(3);     // T3 期間
    expect(m1[4].ir).toBe(0xAF);       // 実測値: T3 f2 フェーズで IR = 0xAF
  });

  it('MVI A (0x3E): M1 の instrSamples[5] で IR = 0x3E', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]); // MVI A, $42
    const m1 = getM1Samples(result);

    expect(m1[5].ir).toBe(0x3E);
  });

  it('ADD A (0x87): instrSamples[5] で IR = 0x87', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x87]);
    const m1 = getM1Samples(result);

    expect(m1[5].ir).toBe(0x87);
  });

  it('T3 f1 以降 (instrSamples[5..7]) では IR 値が維持される', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]); // NOP = 0x00
    const m1 = getM1Samples(result);

    // instrSamples[5]: IR ラッチ
    expect(m1[5].ir).toBe(0x00);
    // instrSamples[6, 7]: IR 維持
    expect(m1[6].ir).toBe(0x00);
    expect(m1[7].ir).toBe(0x00);
  });
});

// ---------------------------------------------------------------------------
// MEMR タイミング
// ---------------------------------------------------------------------------

describe('MEMR タイミング', () => {
  it('M1 T1 (instrSamples[0, 1]): MEMR=false (SYNC 中は DBIN 非アクティブ)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = getM1Samples(result);

    expect(m1[0].memr).toBe(false); // T1 f2: SYNC=1, DBIN まだ立っていない
    expect(m1[1].memr).toBe(false); // T1 f1: SYNC=1, DBIN まだ立っていない
  });

  it('M1 T2-T3 (instrSamples[2..5]): MEMR=true のサンプルが存在する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = getM1Samples(result);
    const t2t3 = m1.slice(2, 6); // instrSamples[2..5]

    expect(t2t3.some(s => s.memr)).toBe(true);
  });

  it('M1 T4 (instrSamples[6, 7]): MEMR=false (データはT3でラッチ済み)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    const m1 = getM1Samples(result);

    // T4 の両フェーズで MEMR=false (DBIN 降りている)
    expect(m1[6].memr).toBe(false);
    expect(m1[7].memr).toBe(false);
  });

  it('MVI A M2 (MR サイクル): T1 は MEMR=false, T2-T3 は MEMR=true が存在', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const cycles = groupByMachineCycle(result.instrSamples);
    const mr = cycles[1].samples; // M2 = Memory Read (3T = 6 サンプル)

    // T1: SYNC=1, MEMR=false
    expect(mr[0].memr).toBe(false);
    expect(mr[1].memr).toBe(false);
    // T2-T3: MEMR=true のサンプルが存在
    expect(mr.slice(2).some(s => s.memr)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// status_byte
// ---------------------------------------------------------------------------

describe('status_byte — マシンサイクル種別', () => {
  it('M1 の instrSamples[0] (SYNC 立ち上がり): status_byte = 0xA2 (FETCH)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x00]);
    // トリガーポイント = SYNC 立ち上がり = instrSamples[0]
    expect(result.instrSamples[0].status_byte).toBe(0xA2);
  });

  it('MVI A M2 の instrSamples[0]: status_byte = 0x82 (Memory Read)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const cycles = groupByMachineCycle(result.instrSamples);
    expect(cycles[1].samples[0].status_byte).toBe(0x82);
  });
});
