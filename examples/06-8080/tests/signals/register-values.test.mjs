/**
 * register-values.test.mjs — CPU レジスタ値の Logic Analyzer 信号検証
 *
 * 各 CPU レジスタ (A/B/C/D/E/H/L/SP) の値が、命令実行後に
 * リングバッファの対応フィールドへ正しく反映されていることを確認する。
 *
 * 検証フィールド (parseSample の出力):
 *   acc                 — アキュムレータ A  (Word1[31:24])
 *   b, c                — BC ペア           (Word2[15:8], Word2[23:16])
 *   d, e                — DE ペア           (Word2[31:24], Word3[7:0])
 *   h, l                — HL ペア           (Word3[15:8], Word3[23:16])
 *   sp                  — スタックポインタ  (Word5[31:16])
 *
 * テスト方法:
 *   - 単一命令 (MVI r,n / LXI rp,d16) → captureInstruction
 *   - セットアップ + 対象命令 (MOV / ALU 演算) → captureWithSetup
 *   - 命令完了後の最終サンプルでレジスタ値を確認する
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/**
 * 命令完了後の最終サンプルを返す。
 * (instrSamples の最後のサンプル)
 */
function lastSample(result) {
  return result.instrSamples[result.instrSamples.length - 1];
}

/**
 * パイプライン確定後のサンプルを返す。
 *
 * vm80a では acc/フラグは1M1サイクル分遅延してパイプライン確定する。
 * 具体的には instrSamples 終了の2サンプル後 (次命令 M1 の T2f1) で更新される。
 *
 * - INR A / DCR A: acc は instrSamples 内 T5 で既に更新されるため lastSample でも可
 * - ADD A / XRA A など id_op 系: acc は次命令 T2f1 で更新 → settledSample が必要
 *
 * @param {object} result - captureInstruction / captureWithSetup の戻り値
 */
function settledSample(result) {
  const idx = result.instrSamples.length + 2;
  return result.parsedSamples[idx] ?? lastSample(result);
}

// ---------------------------------------------------------------------------
// A レジスタ (acc)
// ---------------------------------------------------------------------------

describe('A レジスタ (acc)', () => {
  it('MVI A,$FF → acc = 0xFF', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(lastSample(result).acc).toBe(0xFF);
  });

  it('MVI A,$00 → acc = 0x00', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x00]);
    expect(lastSample(result).acc).toBe(0x00);
  });

  it('MVI A,$42 → acc = 0x42', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    expect(lastSample(result).acc).toBe(0x42);
  });

  it('MVI A,$5A → MOV A,A → acc = 0x5A (転送後も変化なし)', async () => {
    const sim = await loadSim();
    // MOV A,A (0x7F) = NOP 相当、A 自身を A に転送
    const result = sim.captureWithSetup([0x3E, 0x5A], [0x7F]);
    expect(lastSample(result).acc).toBe(0x5A);
  });
});

// ---------------------------------------------------------------------------
// B レジスタ (b)
// ---------------------------------------------------------------------------

describe('B レジスタ (b)', () => {
  it('MVI B,$AB → b = 0xAB', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x06, 0xAB]);
    expect(lastSample(result).b).toBe(0xAB);
  });

  it('MVI A,$42 → MOV B,A → b = 0x42', async () => {
    const sim = await loadSim();
    // setup: MVI A,$42  target: MOV B,A (0x47)
    const result = sim.captureWithSetup([0x3E, 0x42], [0x47]);
    expect(lastSample(result).b).toBe(0x42);
  });
});

// ---------------------------------------------------------------------------
// C レジスタ (c)
// ---------------------------------------------------------------------------

describe('C レジスタ (c)', () => {
  it('MVI C,$CD → c = 0xCD', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x0E, 0xCD]);
    expect(lastSample(result).c).toBe(0xCD);
  });

  it('MVI A,$99 → MOV C,A → c = 0x99', async () => {
    const sim = await loadSim();
    // MOV C,A = 0x4F
    const result = sim.captureWithSetup([0x3E, 0x99], [0x4F]);
    expect(lastSample(result).c).toBe(0x99);
  });
});

// ---------------------------------------------------------------------------
// D レジスタ (d)
// ---------------------------------------------------------------------------

describe('D レジスタ (d)', () => {
  it('MVI D,$DE → d = 0xDE', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x16, 0xDE]);
    expect(lastSample(result).d).toBe(0xDE);
  });

  it('MVI A,$55 → MOV D,A → d = 0x55', async () => {
    const sim = await loadSim();
    // MOV D,A = 0x57
    const result = sim.captureWithSetup([0x3E, 0x55], [0x57]);
    expect(lastSample(result).d).toBe(0x55);
  });
});

// ---------------------------------------------------------------------------
// E レジスタ (e)
// ---------------------------------------------------------------------------

describe('E レジスタ (e)', () => {
  it('MVI E,$EF → e = 0xEF', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x1E, 0xEF]);
    expect(lastSample(result).e).toBe(0xEF);
  });

  it('MVI A,$66 → MOV E,A → e = 0x66', async () => {
    const sim = await loadSim();
    // MOV E,A = 0x5F
    const result = sim.captureWithSetup([0x3E, 0x66], [0x5F]);
    expect(lastSample(result).e).toBe(0x66);
  });
});

// ---------------------------------------------------------------------------
// H レジスタ (h)
// ---------------------------------------------------------------------------

describe('H レジスタ (h)', () => {
  it('MVI H,$12 → h = 0x12', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x26, 0x12]);
    expect(lastSample(result).h).toBe(0x12);
  });

  it('MVI A,$77 → MOV H,A → h = 0x77', async () => {
    const sim = await loadSim();
    // MOV H,A = 0x67
    const result = sim.captureWithSetup([0x3E, 0x77], [0x67]);
    expect(lastSample(result).h).toBe(0x77);
  });
});

// ---------------------------------------------------------------------------
// L レジスタ (l)
// ---------------------------------------------------------------------------

describe('L レジスタ (l)', () => {
  it('MVI L,$34 → l = 0x34', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x2E, 0x34]);
    expect(lastSample(result).l).toBe(0x34);
  });

  it('MVI A,$88 → MOV L,A → l = 0x88', async () => {
    const sim = await loadSim();
    // MOV L,A = 0x6F
    const result = sim.captureWithSetup([0x3E, 0x88], [0x6F]);
    expect(lastSample(result).l).toBe(0x88);
  });
});

// ---------------------------------------------------------------------------
// レジスタペア (LXI)
// ---------------------------------------------------------------------------

describe('レジスタペア — LXI (b/c, d/e, h/l, sp)', () => {
  it('LXI B,$1234 → b=0x12, c=0x34', async () => {
    const sim = await loadSim();
    // LXI B,d16 = 0x01 lo hi → B=hi, C=lo (8080 リトルエンディアン)
    const result = sim.captureInstruction([0x01, 0x34, 0x12]);
    const last = lastSample(result);
    expect(last.b).toBe(0x12);
    expect(last.c).toBe(0x34);
  });

  it('LXI D,$ABCD → d=0xAB, e=0xCD', async () => {
    const sim = await loadSim();
    // LXI D,d16 = 0x11 lo hi → D=hi, E=lo
    const result = sim.captureInstruction([0x11, 0xCD, 0xAB]);
    const last = lastSample(result);
    expect(last.d).toBe(0xAB);
    expect(last.e).toBe(0xCD);
  });

  it('LXI H,$5678 → h=0x56, l=0x78', async () => {
    const sim = await loadSim();
    // LXI H,d16 = 0x21 lo hi → H=hi, L=lo
    const result = sim.captureInstruction([0x21, 0x78, 0x56]);
    const last = lastSample(result);
    expect(last.h).toBe(0x56);
    expect(last.l).toBe(0x78);
  });

  it('LXI SP,$FF00 → sp = 0xFF00', async () => {
    const sim = await loadSim();
    // LXI SP,d16 = 0x31 lo hi → SP=hi*256+lo
    const result = sim.captureInstruction([0x31, 0x00, 0xFF]);
    expect(lastSample(result).sp).toBe(0xFF00);
  });

  it('LXI SP,$0200 → sp = 0x0200', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x31, 0x00, 0x02]);
    expect(lastSample(result).sp).toBe(0x0200);
  });
});

// ---------------------------------------------------------------------------
// ALU 演算後のレジスタ値
// ---------------------------------------------------------------------------

describe('ALU 演算後のレジスタ値', () => {
  it('MVI A,$10 → ADD A → acc = 0x20 (1+1=2)', async () => {
    const sim = await loadSim();
    // ADD A = 0x87
    // vm80a は id_op 系命令の acc を次 M1 サイクル T2 でパイプライン確定
    const result = sim.captureWithSetup([0x3E, 0x10], [0x87]);
    expect(settledSample(result).acc).toBe(0x20);
  });

  it('MVI A,$7F → ADD A → acc = 0xFE (0x7F+0x7F)', async () => {
    const sim = await loadSim();
    const result = sim.captureWithSetup([0x3E, 0x7F], [0x87]);
    expect(settledSample(result).acc).toBe(0xFE);
  });

  it('MVI A,$FE → INR A → acc = 0xFF', async () => {
    const sim = await loadSim();
    // INR A = 0x3C
    const result = sim.captureWithSetup([0x3E, 0xFE], [0x3C]);
    expect(lastSample(result).acc).toBe(0xFF);
  });

  it('MVI A,$01 → DCR A → acc = 0x00', async () => {
    const sim = await loadSim();
    // DCR A = 0x3D
    const result = sim.captureWithSetup([0x3E, 0x01], [0x3D]);
    expect(lastSample(result).acc).toBe(0x00);
  });

  it('MVI A,$FF → INR A → acc = 0x00 (オーバーフロー折り返し)', async () => {
    const sim = await loadSim();
    const result = sim.captureWithSetup([0x3E, 0xFF], [0x3C]);
    expect(lastSample(result).acc).toBe(0x00);
  });
});

// ---------------------------------------------------------------------------
// レジスタ間 MOV — B/C/D/E を A から転送確認
// ---------------------------------------------------------------------------

describe('MOV r,B — B レジスタ経由の転送確認', () => {
  it('MVI B,$33 → MOV A,B → acc = 0x33', async () => {
    const sim = await loadSim();
    // MOV A,B = 0x78
    const result = sim.captureWithSetup([0x06, 0x33], [0x78]);
    expect(lastSample(result).acc).toBe(0x33);
  });

  it('MVI C,$44 → MOV A,C → acc = 0x44', async () => {
    const sim = await loadSim();
    // MOV A,C = 0x79
    const result = sim.captureWithSetup([0x0E, 0x44], [0x79]);
    expect(lastSample(result).acc).toBe(0x44);
  });
});
