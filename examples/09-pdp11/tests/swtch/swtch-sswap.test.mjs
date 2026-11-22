/**
 * swtch-sswap.test.mjs — Unix V6 swtch() の SSWAP 経路（aretu(u.u_ssav)）を観測する結合テスト
 *
 * slp.c の有名なコメント "You are not expected to understand this" の箇所を、
 * トリガーで止めて SP・R5 とスタックを読めることを確かめる。あわせて、この観測に使う
 * ハーネスの機能（RK11 シーク遅延・ポストトリガー数・仮想アドレス読み出し・KISA6 の記録）を検証する。
 *
 * 番地は配布ディスクの /rkunix のもの（swtch = 015562）。カーネルを作り直すと変わる。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { v6ParseNamelist, v6TextSymbols, v6NearestSym } from '../ksym/helpers/load-ksym.mjs';
import { v6FindPath, v6ReadInode, v6ReadFile } from '../v6fs/helpers/load-v6fs.mjs';

const KERNEL = 0;
const VA_SWTCH       = 0o15562;   // swtch の入口（jsr r5,csv = 004567）
const VA_SSWAP_CLEAR = 0o16000;   // bicb $10,1(r2) — SSWAP が立っているときだけ通る
const OP_SSWAP_CLEAR = 0o142762;
const VA_AFTER_ARETU = 0o16016;   // aretu から戻った先（mov $1,r0 = return(1)）
const VA_U_RSAV      = 0o140000;
const VA_U_SSAV      = 0o140336;
const TRIG_PC_DATA   = 6;
const RK_STATE_SEEK  = 23;
const SEEK_DELAY     = 4096;
const POST_SAMPLES   = 500;

// メモリが足りなくなるまで fork する: 16000 バイト広げた 8 プロセス（RAM は 128 KB）
const SWAP_PROGRAM = 'main(){ int i; sbrk(16000); for(i=0;i<3;i++) fork(); sleep(4); }';

/** トリガーで止まった ring から、aretu の前後と復帰先を取り出す。 */
function observeAretu(sim) {
  const rows = sim.readRing(sim.ringSize);
  const i0 = rows.findIndex(x => x.rd && x.addr_v === VA_SSWAP_CLEAR);
  const iAfter = rows.findIndex((x, i) => i > i0 && x.rd && x.addr_v === VA_AFTER_ARETU);
  // cret の rts pc の次のフェッチ = aretu の後で最初に swtch・aretu・cret の外へ出た番地
  const landing = rows.slice(iAfter).find(x => x.rd && x.istate === 1 && x.addr_v >= 0o20000);
  return { rows, i0, iAfter, before: rows[i0], after: rows[iAfter], landing };
}

describe('Unix V6 swtch() の SSWAP 経路の観測', () => {
  /** @type {import('../helpers/sim.mjs').Sim} */
  let sim;
  let symbols;

  beforeAll(async () => {
    sim = await loadSim();
    const boot = sim.bootToLogin();
    expect(boot.timeout, `boot stage=${boot.stage}`).toBeFalsy();
    sim.sendLine('root\r');
    sim.sendLine('cat >swp.c\r', null);
    sim.step(2_000_000);
    sim.sendLine(SWAP_PROGRAM + '\r', null);
    sim.step(2_000_000);
    sim.sendLine('\x04');
    const cc = sim.sendLine('cc swp.c\r');
    expect(cc.timeout, 'cc swp.c が終わらない').toBeFalsy();

    const disk = sim.M.FS.readFile('/disk0.rk');
    const ino  = v6FindPath(disk, '/rkunix');
    symbols = v6TextSymbols(v6ParseNamelist(v6ReadFile(disk, v6ReadInode(disk, ino))));
  }, 300000);

  /** a.out を走らせ、SSWAP 経路のトリガーで止める。 */
  function runToSswap(seekDelay) {
    const M = sim.M;
    M._sim_set_rk_delay(seekDelay);
    M._sim_set_ring_tick_mask(0);            // 1tick/smpl: バスサイクルを取りこぼさない
    M._sim_set_post_trig(POST_SAMPLES);
    M._sim_clear_trigger();
    M._sim_set_trigger(TRIG_PC_DATA, ((OP_SSWAP_CLEAR << 16) | VA_SSWAP_CLEAR) >>> 0);
    sim.sendLine('a.out\r', null);
    return sim.runUntilTrigger();
  }

  it('カーネルのシンボル表に swtch と fork がある', () => {
    expect(symbols.find(s => s.name === 'swtch')?.addr).toBe(VA_SWTCH);
    expect(symbols.some(s => s.name === 'fork')).toBe(true);
  });

  it('仮想アドレス読み出し: Kernel の swtch の入口が jsr r5,csv になっている', () => {
    expect(sim.peekVirt(KERNEL, VA_SWTCH)).toBe(0o004567);
  });

  it('仮想アドレス読み出し: I/O ページは読めない（-1）', () => {
    expect(sim.peekVirt(KERNEL, 0o177560)).toBe(-1);
    expect(sim.M._sim_virt_to_phys(KERNEL, 0o177560) >>> 0).toBe(0xFFFFFFFF);
  });

  it('ポストトリガー数は 0〜ring-1 に丸められる', () => {
    const M = sim.M;
    M._sim_set_post_trig(0);
    expect(M._sim_get_post_trig()).toBe(0);
    M._sim_set_post_trig(999999);
    expect(M._sim_get_post_trig()).toBe(sim.ringSize - 1);
    M._sim_set_post_trig(100);
    expect(M._sim_get_post_trig()).toBe(100);
  });

  describe('RK シーク遅延 ON（実機と同じ順序）', () => {
    let obs;
    beforeAll(() => {
      expect(runToSswap(SEEK_DELAY), 'SSWAP 経路で止まらない').toBe(true);
      obs = observeAretu(sim);
    }, 300000);

    it('発火の後を、指定したサンプル数だけ採って止まる', () => {
      expect(obs.i0).toBeGreaterThanOrEqual(0);
      // PC + Data は命令語がバスに出た tick で発火する（番地が出た tick の 1〜数 tick 後）
      const post = obs.rows.length - obs.i0;
      expect(post).toBeGreaterThanOrEqual(POST_SAMPLES);
      expect(post).toBeLessThanOrEqual(POST_SAMPLES + 8);
    });

    it('aretu の直前は u_rsav の値、直後は u_ssav の値になり、SP と R5 が動く', () => {
      const rsav = [sim.peekVirt(KERNEL, VA_U_RSAV), sim.peekVirt(KERNEL, VA_U_RSAV + 2)];
      const ssav = [sim.peekVirt(KERNEL, VA_U_SSAV), sim.peekVirt(KERNEL, VA_U_SSAV + 2)];
      expect(rsav).not.toEqual(ssav);          // 親の sleep → swtch が u_rsav を上書きしてから書き出された
      expect(obs.before.r5).toBe(rsav[1]);
      expect([obs.after.sp, obs.after.r5]).toEqual(ssav);
      expect(obs.before.sp).toBeLessThan(obs.after.sp);   // 古い枠（swtch ← sleep ← swap ← xswap）を飛び越える
    });

    it('swtch の return(1) は fork へ戻る（swtch を呼んだのは fork ではない）', () => {
      expect(obs.landing, '復帰先のフェッチが ring に無い').toBeTruthy();
      expect(v6NearestSym(symbols, obs.landing.addr_v).name).toBe('fork');
      expect(obs.landing.r0).toBe(1);
    });

    it('aretu の前の R5 の鎖には、親が残した sleep・swap・xswap・newproc の枠が並ぶ', () => {
      const chain = [];
      let fp = obs.before.r5;
      for (let i = 0; i < 5; i++) {
        chain.push(v6NearestSym(symbols, sim.peekVirt(KERNEL, fp + 2)).name);
        fp = sim.peekVirt(KERNEL, fp);
      }
      expect(chain).toEqual(['sleep', 'swap', 'xswap', 'newproc', 'fork']);
    });

    it('ring の KISA6 は MMU の Kernel PAR6 と一致する', () => {
      expect(obs.before.kisa6).toBe(sim.mmu().kernel[6].par & 0xFFF);
      expect(obs.before.kisa6).toBeGreaterThan(0);
    });

    it('シーク待ち（rk_state = 23）が、設定したクロック数だけ続く', () => {
      // ディスクを読む操作を起こし、ring を少しずつ取り込んで、連続する seek0 の長さを数える
      sim.M._sim_clear_trigger();
      sim.sendLine('', null);
      const r = sim.runTo('# ', { maxCycles: 900_000_000 });
      expect(r.timeout, 'a.out が終わらない').toBeFalsy();
      sim.sendLine('ls /usr/sys/dmr\r', null);
      let run = 0, longest = 0;
      for (let k = 0; k < 4000 && longest < SEEK_DELAY; k++) {
        sim.step(2000);
        for (const x of sim.readRing(2000)) {
          run = (x.rk_state === RK_STATE_SEEK) ? run + 1 : 0;
          if (run > longest) longest = run;
        }
      }
      expect(longest).toBeGreaterThanOrEqual(SEEK_DELAY);
      expect(longest).toBeLessThanOrEqual(SEEK_DELAY + 2);
    });
  });

  describe('RK シーク遅延 OFF（既定: 転送がすぐ始まる）', () => {
    let obs;
    beforeAll(() => {
      const r = sim.runTo('# ', { maxCycles: 900_000_000 });
      expect(r.timeout, '前の操作が終わらない').toBeFalsy();
      expect(runToSswap(0), 'SSWAP 経路で止まらない').toBe(true);
      obs = observeAretu(sim);
    }, 300000);

    it('u_rsav が上書きされる前に書き出されるので、aretu の前後で SP と R5 が変わらない', () => {
      expect(obs.i0).toBeGreaterThanOrEqual(0);
      expect([obs.before.sp, obs.before.r5]).toEqual([obs.after.sp, obs.after.r5]);
    });

    it('それでも swtch の return(1) は fork へ戻る', () => {
      expect(v6NearestSym(symbols, obs.landing.addr_v).name).toBe('fork');
    });
  });
});
