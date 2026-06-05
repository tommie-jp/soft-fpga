/**
 * boot-signals.test.mjs — Unix V6 ブート時の GPR / PSW / MMU / リングバッファ信号検証
 *
 * WASM シミュレーターを起動し（ディスクは埋め込み）、login: まで進めたうえで、
 * Logic Analyzer リングバッファ・GPR・MMU スナップショットに信号が正しく
 * 反映されていることを確認する。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';

describe('Unix V6 ブート時の信号パイプライン', () => {
  /** @type {import('../helpers/sim.mjs').Sim} */
  let sim;
  let boot;

  beforeAll(async () => {
    sim  = await loadSim();
    boot = sim.bootToLogin();
  }, 180000);

  it('bootrom @ → rkunix → login: まで到達する', () => {
    expect(boot.timeout, `boot stage=${boot.stage}, out tail=${boot.out.slice(-80)}`).toBeFalsy();
    expect(boot.out).toContain('@rkunix');
    expect(boot.out).toContain('login:');
  });

  it('PC が 16bit 範囲の有効値である', () => {
    const pc = sim.pc();
    expect(pc).toBeGreaterThanOrEqual(0);
    expect(pc).toBeLessThanOrEqual(0xFFFF);
  });

  it('GPR: SP が初期化されている（非ゼロ）', () => {
    const g = sim.gpr();
    for (const k of ['r0','r1','r2','r3','r4','r5','sp']) {
      expect(g[k]).toBeGreaterThanOrEqual(0);
      expect(g[k]).toBeLessThanOrEqual(0xFFFF);
    }
    expect(g.sp, 'スタックポインタが設定されているはず').toBeGreaterThan(0);
  });

  it('MMU: カーネル seg7（I/O ページ）の PAR が設定されている', () => {
    const m = sim.mmu();
    expect(m.kernel).toHaveLength(8);
    expect(m.user).toHaveLength(8);
    // V6 カーネルは seg7 を I/O ページにマップする → PAR は非ゼロ（典型 0o7600/0o177600）
    expect(m.kernel[7].par, `kernel seg7 PAR=${m.kernel[7].par.toString(8)}`).toBeGreaterThan(0);
    // 低位セグメントの PAR/PDR も何らかの値で設定されている
    expect(m.kernel.some(s => s.pdr !== 0)).toBe(true);
  });

  it('リングバッファが信号サンプルを取得している', () => {
    expect(sim.ringHead()).toBeGreaterThan(100);
    const s = sim.readRing(128);
    expect(s.length).toBeGreaterThan(0);
    // PC が動いている（>0 のサンプルが存在）
    expect(s.some(x => x.pc > 0)).toBe(true);
    // cpu_cm はカーネル(0)/スーパバイザ(1)/ユーザ(3) のいずれか
    expect(s.every(x => [0, 1, 3].includes(x.cpu_cm))).toBe(true);
  });

  it('リングバッファに PSW が記録されている', () => {
    const s = sim.readRing(256);
    // PSW フィールドは 16bit。何らかの非ゼロ PSW が観測される（割り込み優先度/モード等）
    expect(s.some(x => x.psw !== 0)).toBe(true);
  });

  it('ブート中にバスサイクル（rd/wr）が観測される', () => {
    const s = sim.readRing(256);
    expect(s.some(x => x.rd === 1 || x.wr === 1)).toBe(true);
  });
});
