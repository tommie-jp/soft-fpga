/**
 * signal-frame.test.mjs — シグナルは 2 段階で届き、偽の割り込みフレームで配られる（docs/09-PDP11/32 章）
 *
 * sig.c の issig() のコメント「A signal does not do anything directly to a process; it sets a flag
 * that asks the process to do something to itself.」を、DEL キー（0177 = CINTR）で確かめる。
 *   1. 受信割り込みの中の psignal() は、p_sig に番号を 1 バイト書くだけ。
 *   2. 配るのは psig()。プロセス自身が、カーネルを出るときに呼ぶ。
 *   3. psig() はユーザースタックに PS と PC を積み、戻り先をハンドラに書き換える（割り込みと同じ形の枠）。
 *   4. ハンドラは、ユーザーモードの rtt でその 2 語を取り出して、元の番地へ戻る。
 *   5. 計算中のプロセスには、clock() の 1 秒ごとの処理が配る。
 *
 * トリガーの値は js/sft-pdp11-la-defs.js のプリセット
 * 「V6 psignal: signal number written to p_sig」「V6 psig: frame pushed on user stack」
 * 「V6 sig.c: SIGINT handler entry (tvect+20)」と同じ。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  KERNEL, USER, AOUT_HEADER_BYTES, VA_KSTACK_PC, VA_KSTACK_PS, OP_RTT,
  isFetch, word, bootV6, diskReader, symbolTable, armPcData, captureAt, writeV6File,
} from '../helpers/v6-trace.mjs';

const SIGINT       = 2;
const EINTR        = 4;
const KEY_DEL      = 0o177;          // tty.h の CINTR
const OP_JSR_R5_CSV = 0o004567;      // C の関数の最初の命令（psignal・psig とも）
const OP_PUSH_R0   = 0o010046;       // tvect の各入口の最初の命令 mov r0,-(sp)
const OP_BEC       = 0o103002;       // libc の read: sys read の次の bec
const PS_USER_MODE = 0o170000;
const PS_CARRY     = 1;              // システムコールの失敗の印

const VA_PSIGNAL   = 0o22644;
const VA_PSIG      = 0o23144;
const VA_HANDLER_ENTRY = 0o1410;     // プリセットに書いた、sig.c の a.out の tvect+020
const PSIGNAL_POST = 1000;           // プリセットの Post
const PSIG_POST    = 1900;
const HANDLER_POST = 400;

const VEC_TTY_RX   = 0o60;           // KL11 受信割り込みのベクタ
const VA_KL_RBUF   = 0o177562;
const TVECT_ENTRY_BYTES = 8;         // signal.s の tvect は 1 シグナルあたり 4 語
const FRAME_BYTES  = 4;              // psig が積む PS と PC
const CLOCK_TICKS  = 10000;          // クロック割り込みの間隔
const HZ           = 60;
const SPIN_LOOP_OFFSETS = [0o22, 0o26, 0o30];   // main の中の tst _n / bne / br
const WAIT_FOR_PROGRAM_TICKS = 4_000_000;

// 入力を待つ版（記事の本文）。read が中断され、-1 を返す
const SIG_C = [
  'int n;',
  'h(){ n++; }',
  'main(){ char c; signal(2, h); read(0, &c, 1); printf("n=%d\\n", n); }',
];
// 計算し続ける版。システムコールを呼ばないので、配るのは clock()
const SPIN_C = [
  'int n;',
  'h(){ n++; }',
  'main(){ signal(2, h); while(n == 0); printf("n=%d\\n", n); }',
];

describe('Unix V6: シグナルは p_sig に書くだけで、配るのはプロセス自身', () => {
  let sim;
  let kernel;
  let aout;
  let user;           // a.out のシンボル
  let userName;       // a.out の番地 → シンボル名
  let spin;           // spin のシンボル
  let sigEntry;       // tvect の中の SIGINT の入口

  function compile(name, lines) {
    writeV6File(sim, name, lines);
    const cc = sim.sendLine(`cc ${name}\r`, '# ', { maxCycles: 3_000_000_000 });
    expect(cc.out, `cc ${name} がエラーを出した`).toBe(`cc ${name}\r\n# `);
  }

  beforeAll(async () => {
    sim = await bootV6();
    compile('spin.c', SPIN_C);
    sim.sendLine('mv a.out spin\r');
    compile('sig.c', SIG_C);
    sim.sendLine('sync\r');
    sim.step(3_000_000);
    const readFile = diskReader(sim);
    kernel = symbolTable(readFile('/rkunix'));
    aout = readFile('/a.out');
    ({ byName: user, nameOf: userName } = symbolTable(aout));
    spin = symbolTable(readFile('/spin')).byName;
    sigEntry = user.tvect + SIGINT * TVECT_ENTRY_BYTES;
  }, 900000);

  const aoutWord = va => word(aout, AOUT_HEADER_BYTES + va);
  const kernelNames = rows => rows.filter(x => isFetch(x) && x.cpu_cm === KERNEL).map(x => kernel.nameOf(x.addr_v));
  /** トリガーの直前に実行していた関数（フェッチが 2 tick にまたがるので、トリガー自身の名前は除く）。 */
  const callerOf = (rows, callee) => kernelNames(rows).filter(n => n !== callee).at(-1);

  describe('作ったプログラム（sig.c）', () => {
    it('libc の signal.s の tvect が入り、SIGINT の入口は mov r0,-(sp) で始まる', () => {
      expect(aoutWord(sigEntry)).toBe(OP_PUSH_R0);
    });

    it('SIGINT の入口は、プリセットに書いた 001410', () => {
      expect(sigEntry).toBe(VA_HANDLER_ENTRY);
    });

    it('tvect の共通部は rtt で終わる', () => {
      const rttVa = [...Array(0o400 / 2).keys()].map(i => sigEntry + i * 2).find(va => aoutWord(va) === OP_RTT);
      expect(rttVa).toBeGreaterThan(sigEntry);
    });
  });

  describe('DEL キー: 割り込みの中では p_sig に書くだけ', () => {
    let cap;

    beforeAll(() => {
      sim.sendLine('a.out\r', null);
      sim.step(WAIT_FOR_PROGRAM_TICKS);          // read で入力を待って眠る
      armPcData(sim, VA_PSIGNAL, OP_JSR_R5_CSV, PSIGNAL_POST);
      sim.sendKey(KEY_DEL);
      cap = captureAt(sim, { pc: VA_PSIGNAL, data: OP_JSR_R5_CSV, mode: KERNEL, post: PSIGNAL_POST, what: 'psignal' });
    }, 300000);

    it('受信割り込み（ベクタ 060）が入ったとき、a.out は走っていない（カーネルが待機中）', () => {
      const iVec = cap.before.findLastIndex(x => x.rd && x.cpu_cm === KERNEL && x.addr_p === VEC_TTY_RX);
      expect(iVec).toBeGreaterThan(0);
      const lastFetch = cap.before.slice(0, iVec).findLast(isFetch);
      expect(lastFetch.cpu_cm).toBe(KERNEL);
    });

    it('klrint → ttyinput → signal の順に呼ばれ、受信バッファから 0177 を読む', () => {
      const names = kernelNames(cap.before);
      const order = ['klrint', 'ttyinpu', 'signal'].map(n => names.lastIndexOf(n));
      expect(order.every(i => i >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      const rbuf = cap.before.findLast(x => x.rd && x.addr_v === VA_KL_RBUF);
      expect(rbuf.data & 0o177).toBe(KEY_DEL);
    });

    it('psignal は proc の p_sig へシグナル番号 2 を 1 バイト書く（sh と a.out の 2 プロセスぶん）', () => {
      const writes = cap.after.filter(x => x.wr && x.byte_op && x.cpu_cm === KERNEL &&
                                           kernel.nameOf(x.pc) === 'psignal' && (x.data & 0o377) === SIGINT);
      expect(writes.length).toBe(2);
      expect(writes[0].addr_v).not.toBe(writes[1].addr_v);
    });

    it('この取り込みの中では psig を通らず、ユーザースタックにも書かない', () => {
      expect(cap.after.some(x => isFetch(x) && x.cpu_cm === KERNEL && x.addr_v === VA_PSIG)).toBe(false);
      expect(cap.after.some(x => x.wr && kernel.nameOf(x.pc) === 'suiword')).toBe(false);
    });
  });

  describe('配達: psig がユーザースタックに枠を作る', () => {
    let cap;
    let framePs;        // suword が PS を書いたサンプル
    let framePc;        // 同じく PC

    beforeAll(() => {
      armPcData(sim, VA_PSIG, OP_JSR_R5_CSV, PSIG_POST);
      cap = captureAt(sim, { pc: VA_PSIG, data: OP_JSR_R5_CSV, mode: KERNEL, post: PSIG_POST, what: 'psig' });
      [framePs, framePc] = cap.after.filter(x => x.wr && x.cpu_cm === USER && kernel.nameOf(x.pc) === 'suiword');
    }, 300000);

    it('起こされたプロセスは sleep の中で issig() を呼び、aretu で read を中断する', () => {
      const names = kernelNames(cap.before);
      const iSleep = names.lastIndexOf('sleep');
      expect(names.indexOf('issig')).toBeGreaterThan(0);
      expect(names.indexOf('aretu')).toBeGreaterThan(names.indexOf('issig'));
      expect(iSleep).toBeGreaterThan(names.indexOf('aretu'));
    });

    it('psig を呼ぶのは trap()。システムコールを出るところ', () => {
      expect(callerOf(cap.before, 'psig')).toBe('trap');
    });

    it('suword を 2 回呼び、PS を上、中断された PC を下に積む', () => {
      expect(framePs.addr_v - framePc.addr_v).toBe(2);
      expect(framePs.data & PS_USER_MODE).toBe(PS_USER_MODE);
      expect(userName(framePc.data)).toBe('read');
      expect(aoutWord(framePc.data)).toBe(OP_BEC);
    });

    it('積んだ PS は、中断された read の失敗の印（C ビット）を持つ', () => {
      expect(framePs.data & PS_CARRY).toBe(PS_CARRY);
    });

    it('退避した PC（141774）を、tvect の SIGINT の入口に書き換える', () => {
      const store = cap.after.findLast(x => x.wr && x.cpu_cm === KERNEL && x.addr_v === VA_KSTACK_PC &&
                                            kernel.nameOf(x.pc) === 'psig');
      expect(store.data).toBe(sigEntry);
    });
  });

  describe('ハンドラ: ユーザーモードの rtt で戻る', () => {
    let cap;
    let entry;          // ハンドラの最初の命令のサンプル
    let frameVa;        // 積まれた PC の番地
    let savedPc;

    beforeAll(() => {
      armPcData(sim, VA_HANDLER_ENTRY, OP_PUSH_R0, HANDLER_POST);
      cap = captureAt(sim, { pc: VA_HANDLER_ENTRY, data: OP_PUSH_R0, mode: USER, post: HANDLER_POST, what: 'ハンドラの入口' });
      entry = cap.raw[cap.i0];
      frameVa = entry.sp;
      savedPc = sim.peekVirt(USER, frameVa);
    }, 300000);

    it('カーネルの rtt は、中断した番地ではなく SIGINT の入口へ戻る', () => {
      const tail = cap.before.slice(-12);
      expect(tail.findLast(x => isFetch(x) && x.cpu_cm === KERNEL).data).toBe(OP_RTT);
      expect(tail.findLast(x => x.rd && !isFetch(x) && x.addr_v === VA_KSTACK_PC).data).toBe(sigEntry);
    });

    it('SP の先に、中断された PC（read の中）と PS が積まれている', () => {
      expect(userName(savedPc)).toBe('read');
      expect(sim.peekVirt(USER, frameVa + 2) & PS_USER_MODE).toBe(PS_USER_MODE);
    });

    it('R0 は中断されたシステムコールのエラー番号 EINTR', () => {
      expect(entry.r0).toBe(EINTR);
    });

    it('ハンドラ h() が呼ばれる', () => {
      expect(cap.after.some(x => isFetch(x) && x.cpu_cm === USER && x.addr_v === user.h)).toBe(true);
    });

    it('ユーザーモードの rtt が、積まれた PC と PS を取り出して元の番地へ戻る', () => {
      const iRtt = cap.after.findIndex(x => isFetch(x) && x.cpu_cm === USER && x.data === OP_RTT);
      expect(iRtt).toBeGreaterThan(0);
      const rest = cap.after.slice(iRtt + 1);
      const popPc = rest.find(x => x.rd && !isFetch(x) && x.addr_v === frameVa);
      const popPs = rest.find(x => x.rd && !isFetch(x) && x.addr_v === frameVa + 2);
      const next = rest.find(isFetch);
      expect(popPc.data).toBe(savedPc);
      expect(popPs.data & PS_CARRY).toBe(PS_CARRY);
      expect(next.addr_v).toBe(savedPc);
      expect(next.cpu_cm).toBe(USER);
      expect(next.sp).toBe(frameVa + FRAME_BYTES);
    });

    it('ハンドラの入口から元の番地まで、カーネルには入らない', () => {
      const iBack = cap.after.findIndex(x => isFetch(x) && x.addr_v === savedPc);
      expect(iBack).toBeGreaterThan(0);
      expect(cap.after.slice(0, iBack).some(x => isFetch(x) && x.cpu_cm === KERNEL)).toBe(false);
    });

    it('戻った先の bec は分岐せず、read は cerror を通って失敗を返す', () => {
      const iBack = cap.after.findIndex(x => isFetch(x) && x.addr_v === savedPc);
      const next = cap.after.slice(iBack + 1).filter(isFetch).map(x => userName(x.addr_v));
      expect(next).toContain('cerror');
    });

    it('プログラムは n=1 を表示して終わる', () => {
      expect(sim.runTo('# ').out).toContain('n=1');
    });
  });

  describe('計算し続けるプロセス（spin）: 配るのは 1 秒ごとの clock()', () => {
    let cap;
    let ticksToPsig;

    beforeAll(() => {
      sim.sendLine('spin\r', null);
      sim.step(WAIT_FOR_PROGRAM_TICKS);
      armPcData(sim, VA_PSIG, OP_JSR_R5_CSV, 0);
      sim.sendKey(KEY_DEL);
      const chunk = 1000;
      ticksToPsig = 0;
      while (!sim.M._sim_trigger_hit() && ticksToPsig < 5_000_000) { sim.step(chunk); ticksToPsig += chunk; }
      cap = captureAt(sim, { pc: VA_PSIG, data: OP_JSR_R5_CSV, mode: KERNEL, post: 0, what: 'spin の psig' });
    }, 300000);

    it('DEL から配達までは、長くて 1 秒（クロック割り込み 60 回）', () => {
      expect(ticksToPsig).toBeLessThanOrEqual(HZ * CLOCK_TICKS + 2 * CLOCK_TICKS);
    });

    it('psig を呼ぶのは clock()。その前に issig() が配るものがあると答えている', () => {
      expect(callerOf(cap.before, 'psig')).toBe('clock');
      expect(kernelNames(cap.before)).toContain('issig');
    });

    it('中断された番地は、ループの 3 命令のどれか', () => {
      const savedPc = sim.peekVirt(KERNEL, VA_KSTACK_PC);
      expect(SPIN_LOOP_OFFSETS.map(off => spin.main + off)).toContain(savedPc);
      expect(sim.peekVirt(KERNEL, VA_KSTACK_PS) & PS_USER_MODE).toBe(PS_USER_MODE);
    });

    it('ハンドラが n を増やし、ループを抜けて n=1 を表示する', () => {
      expect(sim.runTo('# ').out).toContain('n=1');
    });
  });
});
