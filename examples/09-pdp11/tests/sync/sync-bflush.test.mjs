/**
 * sync-bflush.test.mjs — sync は書き込みの完了を待たずに戻る。それでもプロンプトは書き込みの後（docs/09-PDP11/34 章）
 *
 * V7 の sync(2) の BUGS「The writing, although scheduled, is not necessarily complete upon return
 * from sync.」を V6 で確かめる。
 *   1. update() の前半（スーパーブロックと inode）は bwrite で、1 ブロックずつ完了を待つ。
 *   2. 後半の bflush() は B_ASYNC を立てて書き込みを出し、待たずにユーザーへ戻る。
 *   3. ただし V6 の exit() は、ゾンビの記録をスワップへ bwrite する。この書き込みが列の後ろに並ぶので、
 *      sync コマンドのプロンプトは、ディスクが静かになってから出る。
 *
 * トリガーの値は js/sft-pdp11-la-defs.js のプリセット
 * 「V6 bflush: B_ASYNC set (write not awaited)」と、シナリオ sync-bflush（RK seek = 4K clk）と同じ。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  KERNEL, USER, AOUT_HEADER_BYTES,
  isFetch, word, bootV6, diskReader, symbolTable, armPcData,
} from '../helpers/v6-trace.mjs';

const OP_SYS_SYNC   = 0o104444;
const OP_BIS_ASYNC  = 0o052714;      // bis $400,(r4)
const B_ASYNC       = 0o400;
const VA_BFLUSH_ASYNC = 0o46012;     // bflush の中の bp->b_flags =| B_ASYNC
const VA_SYS_SYNC   = 0o50;          // /bin/sync の sys sync
const VA_AFTER_SYNC = 0o52;          // その次の命令

const VA_RKCS       = 0o177404;      // RK11 の制御レジスタ
const VA_RKDA       = 0o177412;      // RK11 のディスク番地
const RKCS_WRITE_GO = 0o103;
const VEC_RK        = 0o220;
const VA_KL_XBUF    = 0o177566;      // コンソールの送信バッファ
const CHAR_PROMPT   = 0x23;          // '#'
const RK_IDLE       = 0;
const SWAP_FIRST_BLOCK = 4000;       // ファイルシステムは 0〜3999、その先がスワップ
const RK_SECTORS    = 12;

const TICK_MASK_4   = 3;             // プリセットの 4tick/smpl
const TICKS_PER_SAMPLE = 4;
const BFLUSH_POST   = 4000;          // プリセットの Post
const RK_DELAY_PRESET = 4096;        // シナリオの RK seek = 4K clk
const RK_DELAY_REAL   = 262144;      // 256K clk（実機の RK05 に近い）
const MAX_TRACE_TICKS = 40_000_000;
const QUIET_TICKS     = 600_000;     // プロンプトのあと、これだけ RK が動かなければ終わりとみなす

// 新しいファイルを作ると、ディレクトリのブロックが遅延書き込みになって bflush まで残る。
// 同じ名前で繰り返すとディレクトリは変わらないので、実行のたびに名前を変える
const command = name => `date >${name}; sync`;

const rkBlock = da => ((da >> 5) * 2 + ((da >> 4) & 1)) * RK_SECTORS + (da & 0o17);

describe('Unix V6: sync は書き込みを待たずに戻る', () => {
  let sim;
  let kernel;

  beforeAll(async () => {
    sim = await bootV6();
    kernel = symbolTable(diskReader(sim)('/rkunix'));
  }, 300000);

  /** コマンドを送り、プロンプトのあと RK が静かになるまで 1 tick ずつ見て、出来事の列を返す。 */
  function trace(command) {
    const M = sim.M;
    M._sim_set_ring_tick_mask(0);
    M._sim_clear_trigger();
    sim.sendLine(command, null);
    sim.readRing(1);
    const events = [];
    let tick = 0;
    let lastRk = 0;
    let prompt = -1;
    let wasKernel = false;
    let inSync = false;
    let lastKind = '';
    let lastTick = -9;
    const push = (kind, extra) => {
      if (kind !== lastKind || tick - lastTick > 1) events.push({ tick, kind, ...extra });
      lastKind = kind;
      lastTick = tick;
    };
    sim.sendKey(13);
    while (tick < MAX_TRACE_TICKS && !(prompt > 0 && tick - Math.max(lastRk, prompt) > QUIET_TICKS)) {
      sim.step(1000);
      for (const x of sim.readRing(1000)) {
        tick++;
        const fetch = isFetch(x);
        if (fetch && x.cpu_cm === KERNEL) {
          if (x.addr_v === kernel.byName.sync) { push('sync'); inSync = true; }
          if (x.addr_v === kernel.byName.bflush) push('bflush');
          if (x.addr_v === VA_BFLUSH_ASYNC) push('async');
          if (x.addr_v === kernel.byName.exit) push('exit');
        }
        if (inSync && fetch && x.cpu_cm === USER && wasKernel && x.addr_v === VA_AFTER_SYNC) {
          push('return', { rkState: x.rk_state });
          inSync = false;
        }
        if (fetch) wasKernel = x.cpu_cm === KERNEL;
        if (x.wr && x.cpu_cm === KERNEL && x.addr_v === VA_RKDA) push('rkda', { block: rkBlock(x.data) });
        if (x.wr && x.cpu_cm === KERNEL && x.addr_v === VA_RKCS) {
          push(x.data === RKCS_WRITE_GO ? 'write' : 'read');
          lastRk = tick;
        }
        if (x.rd && !fetch && x.cpu_cm === KERNEL && x.addr_p === VEC_RK) { push('intr'); lastRk = tick; }
        if (x.wr && x.addr_v === VA_KL_XBUF && (x.data & 0x7f) === CHAR_PROMPT) { push('prompt'); prompt = tick; }
      }
    }
    sim.drain();
    return events;
  }

  const tickOf = (events, kind, from = -1) => events.find(e => e.kind === kind && e.tick > from)?.tick ?? -1;
  const count = (events, kind, from, to = Infinity) =>
    events.filter(e => e.kind === kind && e.tick > from && e.tick < to).length;

  describe('コードの場所', () => {
    it('bflush の 046012 は bis $400,(r4)（bp->b_flags =| B_ASYNC）', () => {
      const rkunix = diskReader(sim)('/rkunix');
      expect(word(rkunix, AOUT_HEADER_BYTES + VA_BFLUSH_ASYNC)).toBe(OP_BIS_ASYNC);
      expect(word(rkunix, AOUT_HEADER_BYTES + VA_BFLUSH_ASYNC + 2)).toBe(B_ASYNC);
      expect(kernel.nameOf(VA_BFLUSH_ASYNC)).toBe('bflush');
    });

    it('/bin/sync の 050 番地が sys sync', () => {
      expect(word(diskReader(sim)('/bin/sync'), AOUT_HEADER_BYTES + VA_SYS_SYNC)).toBe(OP_SYS_SYNC);
    });
  });

  describe('プリセットの取り込み（RK seek = 4K clk、4tick/smpl、Post = 4000）', () => {
    let after;        // トリガーから後のサンプル（4 tick ごと）

    beforeAll(() => {
      sim.M._sim_set_rk_delay(RK_DELAY_PRESET);
      armPcData(sim, VA_BFLUSH_ASYNC, OP_BIS_ASYNC, BFLUSH_POST, TICK_MASK_4);
      sim.sendLine(command('y') + '\r', null);
      expect(sim.runUntilTrigger({ maxCycles: 600_000_000 }), 'bflush の B_ASYNC で止まらない').toBe(true);
      // 4tick/smpl ではトリガーのフェッチ自身（2 tick）が採られないことがある。位置は Post から求める
      const raw = sim.readRing(sim.ringSize);
      after = raw.slice(raw.length - 1 - BFLUSH_POST);
      sim.M._sim_clear_trigger();
      sim.runTo('# ');
    }, 300000);

    it('止まったのは bflush の中', () => {
      expect(kernel.nameOf(after[0].pc)).toBe('bflush');
      expect(after[0].cpu_cm).toBe(KERNEL);
    });

    it('B_ASYNC を立てた時点では RK11 は止まっていて、そのあと動き出す', () => {
      expect(after[0].rk_state).toBe(RK_IDLE);
      expect(after.some(x => x.rk_state !== RK_IDLE)).toBe(true);
    });

    it('RK11 が動いている最中に、ユーザーモードへ戻る', () => {
      const firstUser = after.findIndex(x => x.cpu_cm === USER && x.pc < 0o100);
      expect(firstUser).toBeGreaterThan(0);
      expect(after[firstUser].rk_state).not.toBe(RK_IDLE);
    });

    it('RK11 が止まるのは、ユーザーへ戻ったあと。同じ取り込み（16000 tick）に入る', () => {
      const firstUser = after.findIndex(x => x.cpu_cm === USER && x.pc < 0o100);
      const firstBusy = after.findIndex(x => x.rk_state !== RK_IDLE);
      const idleAgain = after.findIndex((x, i) => i > firstBusy && x.rk_state === RK_IDLE);
      expect(idleAgain).toBeGreaterThan(firstUser);
      expect(idleAgain * TICKS_PER_SAMPLE).toBeLessThan(BFLUSH_POST * TICKS_PER_SAMPLE);
    });
  });

  for (const delay of [RK_DELAY_PRESET, RK_DELAY_REAL]) {
    describe(`出来事の順序（RK seek = ${delay} clk）`, () => {
      let events;
      let tSync, tBflush, tAsync, tReturn, tPrompt;

      beforeAll(() => {
        sim.M._sim_set_rk_delay(delay);
        events = trace(command(`y${delay}`));
        tSync = tickOf(events, 'sync');
        tBflush = tickOf(events, 'bflush', tSync);
        tAsync = tickOf(events, 'async', tBflush);
        tReturn = tickOf(events, 'return', tAsync);
        tPrompt = tickOf(events, 'prompt', tReturn);
      }, 600000);

      it('sync() → bflush() → B_ASYNC → ユーザーへ戻る → プロンプト の順に進む', () => {
        expect(tSync).toBeGreaterThan(0);
        expect(tBflush).toBeGreaterThan(tSync);
        expect(tAsync).toBeGreaterThan(tBflush);
        expect(tReturn).toBeGreaterThan(tAsync);
        expect(tPrompt).toBeGreaterThan(tReturn);
      });

      it('update() の前半は、書き込みを 1 つ出すたびに割り込みを待つ', () => {
        const front = events.filter(e => e.tick > tSync && e.tick < tBflush && ['write', 'read', 'intr'].includes(e.kind));
        expect(front.filter(e => e.kind === 'write').length).toBeGreaterThanOrEqual(2);
        front.forEach((e, i) => {
          if (e.kind !== 'intr') expect(front[i + 1]?.kind, `tick ${e.tick} の転送の次`).toBe('intr');
        });
      });

      it('bflush() が出した書き込みの割り込みは、ユーザーへ戻ったあとに来る', () => {
        const tWrite = tickOf(events, 'write', tAsync);
        const tIntr = tickOf(events, 'intr', tWrite);
        expect(tWrite).toBeLessThan(tReturn);
        expect(tIntr).toBeGreaterThan(tReturn);
        expect(events.find(e => e.kind === 'return' && e.tick === tReturn).rkState).not.toBe(RK_IDLE);
      });

      it('戻ったあとの exit() が、スワップ領域（ブロック 4000 以降）へ 1 ブロック書く', () => {
        const tExit = tickOf(events, 'exit', tReturn);
        const swapWrite = events.find(e => e.kind === 'rkda' && e.tick > tExit);
        expect(tExit).toBeGreaterThan(tReturn);
        expect(swapWrite.block).toBeGreaterThanOrEqual(SWAP_FIRST_BLOCK);
        expect(count(events, 'write', tReturn, tPrompt)).toBe(1);
      });

      it('プロンプトが出たあと、RK11 の割り込みは 1 つも来ない', () => {
        expect(count(events, 'intr', tPrompt)).toBe(0);
        expect(count(events, 'write', tPrompt)).toBe(0);
      });
    });
  }

  describe('sync を続けて打つ', () => {
    it('書くものが無くても、sync を打つたびに書き込みが出る（0 にはならない）', () => {
      sim.M._sim_set_rk_delay(0);
      trace('sync');
      const second = trace('sync');
      const third = trace('sync');
      expect(count(second, 'write', 0)).toBeGreaterThan(0);
      expect(count(third, 'write', 0)).toBe(count(second, 'write', 0));
    });
  });
});
