/**
 * flags.test.mjs — F (PSW) レジスタ フラグビット検証
 *
 * CPU 内部 PSW フラグが Logic Analyzer リングバッファ (parseSample().f) に
 * 正しく反映されているかを確認する。
 *
 * F レジスタのビットレイアウト (harness.cpp の再構成ロジックに準拠):
 *   bit7 : S  (Sign)           — 結果の bit7 が 1 のとき 1
 *   bit6 : Z  (Zero)           — 結果が 0x00 のとき 1
 *   bit5 : 0  (常時 0)
 *   bit4 : AC (Auxiliary Carry)— 下位ニブル (bit3→bit4) へのキャリーで 1
 *   bit3 : 0  (常時 0)
 *   bit2 : P  (Parity)         — 結果の 1-bit 数が偶数のとき 1
 *   bit1 : 1  (常時 1)         — Intel 8080A 仕様固定ビット
 *   bit0 : C  (Carry)          — 8bit オーバーフロー / ボローで 1
 *
 * テスト方針:
 *   - フラグ操作が確実に決まる命令列を使用する
 *   - XRA A でフラグを既知状態 (Z=1, P=1, S=0, C=0, AC=0) にリセットしてから検証
 *   - フラグマスクでビット単位に確認する (exact F 値への依存を避ける)
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';

// ---------------------------------------------------------------------------
// フラグマスク定数
// ---------------------------------------------------------------------------
const F_S  = 0x80; // Sign flag (bit7)
const F_Z  = 0x40; // Zero flag (bit6)
const F_AC = 0x10; // Auxiliary Carry flag (bit4)
const F_P  = 0x04; // Parity flag (bit2)
const F_1  = 0x02; // 常時 1 のビット (bit1)
const F_C  = 0x01; // Carry flag (bit0)

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** 命令完了後の最終サンプルを返す */
function lastSample(result) {
  return result.instrSamples[result.instrSamples.length - 1];
}

/**
 * パイプライン確定後のサンプルを返す。
 *
 * vm80a では acc/フラグは1M1サイクル分遅延してパイプライン確定する。
 * instrSamples 終了の2サンプル後 (次命令 M1 の T2f1) で更新される。
 *
 * フラグは INR A/DCR A でも instrSamples 内では更新されないため、
 * フラグ検証には常に settledSample を使用する。
 *
 * @param {object} result - captureInstruction / captureWithSetup の戻り値
 */
function settledSample(result) {
  const idx = result.instrSamples.length + 2;
  return result.parsedSamples[idx] ?? lastSample(result);
}

// ---------------------------------------------------------------------------
// Z フラグ (Zero flag)
// ---------------------------------------------------------------------------

describe('Z フラグ', () => {
  it('XRA A (A←A XOR A=0) → Z フラグ = 1', async () => {
    const sim = await loadSim();
    // XRA A (0xAF): A XOR A = 0 → Z=1 (常に)
    const result = sim.captureInstruction([0xAF]);
    expect(settledSample(result).f & F_Z).toBeTruthy();
  });

  it('MVI A,$01 → ADD A → Z フラグ = 0 (結果 0x02 ≠ 0)', async () => {
    const sim = await loadSim();
    // setup: XRA A (C=0), MVI A,$01  target: ADD A → result=0x02, Z=0
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x01], [0x87]);
    expect(settledSample(result).f & F_Z).toBe(0);
  });

  it('MVI A,$80 → ADD A (0x80+0x80=0x100, result=0x00) → Z フラグ = 1', async () => {
    const sim = await loadSim();
    // result=0x00 → Z=1
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x80], [0x87]);
    expect(settledSample(result).f & F_Z).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// S フラグ (Sign flag)
// ---------------------------------------------------------------------------

describe('S フラグ', () => {
  it('XRA A → S フラグ = 0 (結果 0x00 は正数)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    expect(settledSample(result).f & F_S).toBe(0);
  });

  it('MVI A,$FF → ADD A (0xFF+0xFF=0x1FE, result=0xFE) → S フラグ = 1', async () => {
    const sim = await loadSim();
    // 0xFE = 11111110b → bit7=1 → S=1
    const result = sim.captureWithSetup([0xAF, 0x3E, 0xFF], [0x87]);
    expect(settledSample(result).f & F_S).toBeTruthy();
  });

  it('MVI A,$7F → INR A (0x7F+1=0x80) → S フラグ = 1', async () => {
    const sim = await loadSim();
    // 0x80 = 10000000b → bit7=1 → S=1
    // setup: XRA A (C=0), MVI A,$7F  target: INR A
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x7F], [0x3C]);
    expect(settledSample(result).f & F_S).toBeTruthy();
  });

  it('MVI A,$80 → DCR A (0x80-1=0x7F) → S フラグ = 0', async () => {
    const sim = await loadSim();
    // 0x7F = 01111111b → bit7=0 → S=0
    const result = sim.captureWithSetup([0x3E, 0x80], [0x3D]);
    expect(settledSample(result).f & F_S).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C フラグ (Carry flag)
// ---------------------------------------------------------------------------

describe('C フラグ', () => {
  it('XRA A → C フラグ = 0 (XRA はキャリーをクリア)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    expect(settledSample(result).f & F_C).toBe(0);
  });

  it('STC → C フラグ = 1 (Set Carry は無条件でキャリーをセット)', async () => {
    const sim = await loadSim();
    // STC (0x37): C ← 1 (他フラグ不変)
    const result = sim.captureInstruction([0x37]);
    expect(settledSample(result).f & F_C).toBeTruthy();
  });

  it('MVI A,$80 → ADD A (0x80+0x80=0x100) → C フラグ = 1 (8bit オーバーフロー)', async () => {
    const sim = await loadSim();
    // 0x80+0x80=0x100 → 8bit に収まらない → C=1
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x80], [0x87]);
    expect(settledSample(result).f & F_C).toBeTruthy();
  });

  it('MVI A,$01 → ADD A (1+1=2) → C フラグ = 0 (オーバーフローなし)', async () => {
    const sim = await loadSim();
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x01], [0x87]);
    expect(settledSample(result).f & F_C).toBe(0);
  });

  it('XRA A → STC → CMC → C フラグ = 0 (キャリー反転)', async () => {
    const sim = await loadSim();
    // XRA A で C=0 → STC で C=1 → CMC (0x3F) で C=0
    const result = sim.captureWithSetup([0xAF, 0x37], [0x3F]);
    expect(settledSample(result).f & F_C).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// P フラグ (Parity flag)
// ---------------------------------------------------------------------------

describe('P フラグ', () => {
  it('XRA A (結果 0x00: 0 個の 1-bit = 偶数) → P フラグ = 1', async () => {
    const sim = await loadSim();
    // 0x00 = 00000000b → 1-bit 数 = 0 (偶数) → P=1
    const result = sim.captureInstruction([0xAF]);
    expect(settledSample(result).f & F_P).toBeTruthy();
  });

  it('MVI A,$01 → ADD A (結果 0x02: 1 個の 1-bit = 奇数) → P フラグ = 0', async () => {
    const sim = await loadSim();
    // 0x02 = 00000010b → 1-bit 数 = 1 (奇数) → P=0
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x01], [0x87]);
    expect(settledSample(result).f & F_P).toBe(0);
  });

  it('MVI A,$03 → ADD A (結果 0x06: 2 個の 1-bit = 偶数) → P フラグ = 1', async () => {
    const sim = await loadSim();
    // 0x06 = 00000110b → 1-bit 数 = 2 (偶数) → P=1
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x03], [0x87]);
    expect(settledSample(result).f & F_P).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC フラグ (Auxiliary Carry flag)
// ---------------------------------------------------------------------------

describe('AC フラグ (下位ニブルキャリー)', () => {
  it('MVI A,$0F → INR A (0x0F+1=0x10, 下位ニブルオーバーフロー) → AC フラグ = 1', async () => {
    const sim = await loadSim();
    // 下位ニブル: 0xF + 1 = 0x10 → bit3 から bit4 へキャリー → AC=1
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x0F], [0x3C]);
    expect(settledSample(result).f & F_AC).toBeTruthy();
  });

  it('MVI A,$01 → INR A (0x01+1=0x02, 下位ニブルオーバーフローなし) → AC フラグ = 0', async () => {
    const sim = await loadSim();
    // 下位ニブル: 0x1 + 1 = 0x2 → キャリーなし → AC=0
    const result = sim.captureWithSetup([0xAF, 0x3E, 0x01], [0x3C]);
    expect(settledSample(result).f & F_AC).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// bit1 常時 1 (Intel 8080A 仕様)
// ---------------------------------------------------------------------------

describe('F bit1 — 常時 1', () => {
  it('XRA A 後の F[1] = 1', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    expect(settledSample(result).f & F_1).toBeTruthy();
  });

  it('STC 後の F[1] = 1', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x37]);
    expect(settledSample(result).f & F_1).toBeTruthy();
  });

  it('MVI A,$FF → ADD A 後の F[1] = 1 (ALU 演算後も不変)', async () => {
    const sim = await loadSim();
    const result = sim.captureWithSetup([0xAF, 0x3E, 0xFF], [0x87]);
    expect(settledSample(result).f & F_1).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 複合検証: XRA A の F 値全体
// ---------------------------------------------------------------------------

describe('XRA A — F レジスタ全体の一致確認', () => {
  it('XRA A → F = 0x46 (Z=1, P=1, bit1=1, 他=0)', async () => {
    const sim = await loadSim();
    // 期待: S=0, Z=1, AC=0, P=1, bit1=1, C=0
    // F = 0b0100_0110 = 0x46
    const result = sim.captureInstruction([0xAF]);
    expect(settledSample(result).f).toBe(0x46);
  });
});
