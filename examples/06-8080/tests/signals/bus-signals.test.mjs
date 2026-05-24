/**
 * bus-signals.test.mjs — Logic Analyzer バス信号・制御信号の検証
 *
 * リングバッファの各フィールドが正しいタイミング・値で記録されているかを確認する。
 *
 * 検証対象フィールド:
 *   sync        — SYNC パルス (マシンサイクル T1 で High)
 *   status_byte — マシンサイクル種別バイト (SYNC 中に cpu_dout に出力)
 *   ir          — 命令レジスタ (vm80a 内部 __PVT__i)
 *   addr        — アドレスバス (= cpu_addr = dbg_pc)
 *   pc          — 内部 PC レジスタ (r16_pc)
 *   t_state     — T ステートカウンタ (T1 でリセット、以降インクリメント)
 *   memr        — メモリリード (= !cycle_io && cpu_dbin)
 *   memw        — メモリライト (= !cycle_io && !cpu_wr_n)
 *   dbin        — データバス入力イネーブル (= cpu_dbin)
 *   wr_n        — ライトストローブ (アクティブ Low、wr_n=false で書き込み中)
 *   dbus        — データバス値 (MEMR 時 = cpu_din = ram[cpu_addr])
 *
 * vm80a 2フェーズクロック規約:
 *   1 T-state = 2 サンプル (f1 フェーズ + f2 フェーズ)
 *   T1 の両フェーズで SYNC=1 → 立ち上がりエッジでサイクル境界検出
 *
 * ステータスバイト (Intel 8080A 仕様):
 *   0xA2 = FETCH      (bit7=MEMR, bit5=M1, bit1=WO)
 *   0x82 = MEMR       (bit7=MEMR, bit1=WO) — オペランド読み出しサイクル
 *   0x10 = OUT cycle  (bit4=OUT)
 */

import { describe, it, expect } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { groupByMachineCycle } from '../helpers/ring.mjs';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** 命令完了後の最終サンプルを返す */
function lastSample(result) {
  return result.instrSamples[result.instrSamples.length - 1];
}

/** マシンサイクル M1/M2 を取り出す (groupByMachineCycle のラッパー) */
function getCycles(result) {
  return groupByMachineCycle(result.instrSamples);
}

// テスト共通アドレス
const TEST_ADDR = 0x0100;

// ---------------------------------------------------------------------------
// SYNC 信号タイミング
// ---------------------------------------------------------------------------

describe('SYNC 信号タイミング', () => {
  it('M1 T1 f1 (instrSamples[0]): sync = true', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]); // MVI A,$FF
    expect(result.instrSamples[0].sync).toBe(true);
  });

  it('M1 T1 f2 (instrSamples[1]): sync = true (f1・f2 両フェーズで High)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(result.instrSamples[1].sync).toBe(true);
  });

  it('M1 T2 f1 (instrSamples[2]): sync = false (T2 以降は Low)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(result.instrSamples[2].sync).toBe(false);
  });

  it('M2 T1 f1: sync = true (新マシンサイクル開始)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    // cycles[1] = M2 (即値バイト読み出し)
    expect(cycles[1].samples[0].sync).toBe(true);
  });

  it('M2 T1 f2: sync = true', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    expect(cycles[1].samples[1].sync).toBe(true);
  });

  it('M2 T2 f1: sync = false', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    expect(cycles[1].samples[2].sync).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ステータスバイト
// ---------------------------------------------------------------------------

describe('status_byte — マシンサイクル種別', () => {
  it('MVI A の M1 T1 サンプルで status_byte = 0xA2 (FETCH)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    // M1 T1 f1: FETCH サイクル
    expect(result.instrSamples[0].status_byte).toBe(0xA2);
  });

  it('MVI A の M1 全サンプルで status_byte = 0xA2 (FETCH マシンサイクル中は固定)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    for (const s of cycles[0].samples) {
      expect(s.status_byte).toBe(0xA2);
    }
  });

  it('MVI A の M2 T1 サンプルで status_byte = 0x82 (MEMR — 即値バイト読み出し)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    // M2 T1 f1: MEMR サイクル
    expect(cycles[1].samples[0].status_byte).toBe(0x82);
  });

  it('MVI A の M2 全サンプルで status_byte = 0x82', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    for (const s of cycles[1].samples) {
      expect(s.status_byte).toBe(0x82);
    }
  });

  it('LXI B の M1=0xA2, M2=0x82, M3=0x82', async () => {
    const sim = await loadSim();
    // LXI B,$1234 = 3 マシンサイクル (M1=FETCH, M2=lo, M3=hi)
    const result = sim.captureInstruction([0x01, 0x34, 0x12]);
    const cycles = getCycles(result);
    expect(cycles[0].samples[0].status_byte).toBe(0xA2); // M1 FETCH
    expect(cycles[1].samples[0].status_byte).toBe(0x82); // M2 MEMR
    expect(cycles[2].samples[0].status_byte).toBe(0x82); // M3 MEMR
  });
});

// ---------------------------------------------------------------------------
// IR — 命令レジスタ
// ---------------------------------------------------------------------------

describe('IR (命令レジスタ)', () => {
  it('MVI A,$FF (opcode=0x3E) の M2 サンプルで ir = 0x3E', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    // M2 以降では IR に 0x3E (MVI A オペコード) がラッチされている
    for (const s of cycles[1].samples) {
      expect(s.ir).toBe(0x3E);
    }
  });

  it('MVI B,$00 (opcode=0x06) の M2 サンプルで ir = 0x06', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x06, 0x00]);
    const cycles = getCycles(result);
    for (const s of cycles[1].samples) {
      expect(s.ir).toBe(0x06);
    }
  });

  it('XRA A (opcode=0xAF, 1バイト命令) の M1 後半サンプルで ir = 0xAF', async () => {
    const sim = await loadSim();
    // XRA A = 1 バイト (M1 のみ, 4T)
    // M1 T3 以降で IR にラッチされる
    const result = sim.captureInstruction([0xAF]);
    const cycles = getCycles(result);
    const m1 = cycles[0].samples;
    // T3 f1 = index 4 以降で ir=0xAF を確認
    expect(m1[4].ir).toBe(0xAF); // T3 f1
    expect(m1[5].ir).toBe(0xAF); // T3 f2
  });

  it('ADD A (opcode=0x87) の最終サンプルで ir = 0x87', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x87]);
    expect(lastSample(result).ir).toBe(0x87);
  });
});

// ---------------------------------------------------------------------------
// アドレスバス (addr = cpu_addr = dbg_pc)
// ---------------------------------------------------------------------------

describe('アドレスバス (addr)', () => {
  it('MVI A の M1 T1 f1: addr = testAddr (0x0100)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    // M1 T1 f1 (instrSamples[0]) はオペコードフェッチ → addr = testAddr
    expect(result.instrSamples[0].addr).toBe(TEST_ADDR);
  });

  it('MVI A の M2 T1 f1: addr = testAddr+1 (0x0101) — 即値バイトのアドレス', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    // M2 でアドレスバスが次のバイト位置 (testAddr+1) を指す
    expect(cycles[1].samples[0].addr).toBe(TEST_ADDR + 1);
  });

  it('LXI B の M1/M2/M3 でアドレスが testAddr, +1, +2 と進む', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x01, 0x34, 0x12]); // LXI B
    const cycles = getCycles(result);
    expect(cycles[0].samples[0].addr).toBe(TEST_ADDR);     // M1: オペコード
    expect(cycles[1].samples[0].addr).toBe(TEST_ADDR + 1); // M2: lo バイト
    expect(cycles[2].samples[0].addr).toBe(TEST_ADDR + 2); // M3: hi バイト
  });
});

// ---------------------------------------------------------------------------
// T ステートカウンタ (t_state)
// ---------------------------------------------------------------------------

describe('t_state — T ステートカウンタ', () => {
  it('M1 T1 f1: t_state = 1 (SYNC でリセット)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(result.instrSamples[0].t_state).toBe(1);
  });

  it('M1 T1 f2: t_state = 1 (SYNC 中は f1 も f2 も 1)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(result.instrSamples[1].t_state).toBe(1);
  });

  it('M1 T2 f1: t_state = 2 (SYNC 終了後にインクリメント)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(result.instrSamples[2].t_state).toBe(2);
  });

  it('M1 T2 f1: t_state = 2', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    expect(result.instrSamples[3].t_state).toBe(2);
  });

  it('M2 T1 f1: t_state = 1 (新マシンサイクルでリセット)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const cycles = getCycles(result);
    expect(cycles[1].samples[0].t_state).toBe(1);
  });

  it('M1(4T) 全 8 サンプルの t_state は [1,1,2,2,3,3,4,4]', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const m1 = getCycles(result)[0].samples; // M1 は 4T = 8 サンプル
    const expected = [1, 1, 2, 2, 3, 3, 4, 4];
    expect(m1.map(s => s.t_state)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// MEMR 信号 (メモリリード)
// ---------------------------------------------------------------------------

describe('memr — メモリリード信号', () => {
  it('MVI A の M1 に MEMR=true のサンプルが存在する (オペコードフェッチ)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const m1Samples = getCycles(result)[0].samples;
    // T1(SYNC中)は DBIN=0 のため MEMR=false、T2以降で MEMR=true
    const memrSamples = m1Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
  });

  it('MVI A の M2 に MEMR=true のサンプルが存在する (即値バイト読み出し)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const m2Samples = getCycles(result)[1].samples;
    const memrSamples = m2Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
  });

  it('1 バイト命令 (XRA A, M=1) で M1 後半に MEMR=true が存在する', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    const m1Samples = getCycles(result)[0].samples;
    const memrSamples = m1Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// dbus — データバス値
// ---------------------------------------------------------------------------

describe('dbus — データバス値', () => {
  it('MVI A,$FF の M2 MEMR サンプルで dbus = 0xFF (即値)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const m2Samples = getCycles(result)[1].samples;
    // MEMR=true のサンプルで dbus = 即値バイト
    const memrSamples = m2Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
    expect(memrSamples[0].dbus).toBe(0xFF);
  });

  it('MVI A,$42 の M2 MEMR サンプルで dbus = 0x42', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0x42]);
    const m2Samples = getCycles(result)[1].samples;
    const memrSamples = m2Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
    expect(memrSamples[0].dbus).toBe(0x42);
  });

  it('MVI B,$AB の M2 MEMR サンプルで dbus = 0xAB', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x06, 0xAB]);
    const m2Samples = getCycles(result)[1].samples;
    const memrSamples = m2Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
    expect(memrSamples[0].dbus).toBe(0xAB);
  });

  it('M1 の MEMR サンプルで dbus = オペコード (0x3E for MVI A)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const m1Samples = getCycles(result)[0].samples;
    const memrSamples = m1Samples.filter(s => s.memr);
    expect(memrSamples.length).toBeGreaterThan(0);
    // M1 でのデータバスはオペコードバイト
    expect(memrSamples[0].dbus).toBe(0x3E);
  });
});

// ---------------------------------------------------------------------------
// MEMW 信号 (メモリライト)
// ---------------------------------------------------------------------------

describe('memw — メモリライト信号', () => {
  it('STA 命令の書き込みサイクルで memw = true が存在する', async () => {
    const sim = await loadSim();
    // MVI A,$42 → STA 0x0200 (アドレス $0200 に $42 を書く)
    // STA = 0x32, lo=0x00, hi=0x02
    const result = sim.captureWithSetup([0x3E, 0x42], [0x32, 0x00, 0x02]);
    // STA は 4 マシンサイクル: M1(FETCH) M2(addrLo) M3(addrHi) M4(WRITE)
    const cycles = getCycles(result);
    expect(cycles.length).toBe(4);
    const m4Samples = cycles[3].samples; // M4 = メモリ書き込みサイクル
    const memwSamples = m4Samples.filter(s => s.memw);
    expect(memwSamples.length).toBeGreaterThan(0);
  });

  it('STA の書き込みサイクル中は wr_n = false (アクティブ Low)', async () => {
    const sim = await loadSim();
    const result = sim.captureWithSetup([0x3E, 0x42], [0x32, 0x00, 0x02]);
    const cycles = getCycles(result);
    const m4Samples = cycles[3].samples;
    // memw=true のサンプルは wr_n=false (WR# Low = 書き込みアクティブ)
    const memwSamples = m4Samples.filter(s => s.memw);
    expect(memwSamples.length).toBeGreaterThan(0);
    for (const s of memwSamples) {
      expect(s.wr_n).toBe(false);
    }
  });

  it('MVI A (読み出し命令) には memw=true のサンプルが存在しない', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    // 読み出し命令では書き込みサイクルなし
    const memwSamples = result.instrSamples.filter(s => s.memw);
    expect(memwSamples.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 内部 PC レジスタ (pc = r16_pc)
// ---------------------------------------------------------------------------

describe('内部 PC レジスタ (pc)', () => {
  it('MVI A の M1 T2 f2 (instrSamples[3]) で pc = testAddr+1 (オペコードフェッチ後インクリメント済み)', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x3E, 0xFF]);
    // vm80a の r16_pc 動作:
    //   T1 f1 時点: JMP で到着した場合、r16_pc はまだ前命令 (JMP) のインクリメント後の値を保持
    //              (goto=1 で WZ がアドレスバスに出るが r16_pc 自体はまだ更新されない)
    //   M1 T2 f2  : r16_pc ← a + 1 = testAddr + 1 (オペコードフェッチ完了後に初めて更新)
    // → instrSamples[3] = M1 T2 f2 で r16_pc = testAddr + 1
    expect(result.instrSamples[3].pc).toBe(TEST_ADDR + 1);
  });

  it('命令完了後の pc は次の命令アドレス (testAddr + instrLen) を指す', async () => {
    const sim = await loadSim();
    // MVI A,$FF = 2 バイト → 実行後 PC = testAddr+2 = 0x0102
    const result = sim.captureInstruction([0x3E, 0xFF]);
    const last = lastSample(result);
    expect(last.pc).toBe(TEST_ADDR + 2);
  });

  it('1 バイト命令 (XRA A) 完了後: pc = testAddr+1', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0xAF]);
    expect(lastSample(result).pc).toBe(TEST_ADDR + 1);
  });

  it('3 バイト命令 (LXI B) 完了後: pc = testAddr+3', async () => {
    const sim = await loadSim();
    const result = sim.captureInstruction([0x01, 0x34, 0x12]);
    expect(lastSample(result).pc).toBe(TEST_ADDR + 3);
  });
});
