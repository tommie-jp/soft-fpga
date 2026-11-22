/**
 * setd-trap.test.mjs — C のプログラムの最初の命令 SETD のトラップを観測する結合テスト
 *
 * trap.c のコメント「C produces a SETD at the beginning of every program which will trap on
 * CPUs without 11/45 FPU」の 3 つの主張を、docs/09-PDP11/28 章と同じ手順で確かめる。
 *   1. C のプログラムは SETD（170011）で始まる（crt0.s）。アセンブラのコマンドは違う。
 *   2. FPU の無い CPU では不正命令のトラップ（ベクタ 010）になる。
 *   3. SIGINS を捕まえていなければ無視して次の命令へ戻る。捕まえていれば（fcrt0.s）ハンドラへ届ける。
 *
 * トリガーの値は js/sft-pdp11-la-defs.js のプリセット
 * 「V6 crt0: SETD at user 0 (trap ignored)」「V6 units: fptrap entry (SIGINS caught)」と同じ。
 * 番地は配布ディスクの /rkunix と /usr/bin/units のもの。作り直すと変わる。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import { v6ParseNamelist, v6TextSymbols, v6NearestSym } from '../ksym/helpers/load-ksym.mjs';
import { v6FindPath, v6ReadInode, v6ReadFile } from '../v6fs/helpers/load-v6fs.mjs';

const KERNEL = 0;
const USER   = 3;
const TRIG_PC_DATA = 6;
const OP_SETD      = 0o170011;
const OP_SYS_SIGNAL = 0o104460;      // sys signal（fcrt0.s の最初の命令）
const OP_RTI       = 0o000002;
const SIGINS       = 4;
const AOUT_HEADER_BYTES = 16;

const VEC_RESERVED   = 0o10;         // 不正命令のトラップのベクタ
const PS_TRAP_ILL    = 0o341;        // ベクタの PS: 優先度 7 + トラップの種類 1
const PS_USER        = 0o170004;     // exec 直後のユーザーの PS（現モード・前モードとも User、Z = 1）
const VA_KSTACK_PS   = 0o141776;     // カーネルスタックの底。トラップが元の PS を積む
const VA_KSTACK_PC   = 0o141774;     // 同じく元の PC
const VA_U_SIGNAL_INS = 0o140352;    // u.u_signal[SIGINS]

const CRT0_POST      = 1600;         // プリセットの Post
const CRT0_TRAP_TICKS = 1477;        // 割り込みが入らないときの、トリガーから 2 番地のフェッチが始まるまで

const VA_FPTRAP      = 0o7100;       // units の fptrap の入口
const OP_FPTRAP      = 0o005367;     // dec reenter
const VA_FCRT0_SETD  = 6;            // fcrt0.s の setd の番地（sys signal; 4; fptrap の次）
const FCRT0_POST     = 0;            // 入口で止め、積まれた 2 語を見る
const FPTRAP_STEP_TICKS = 600;       // ▶ Step 2 回ぶん。fptrap が rti で戻るまでが入る

/** 同じ番地が続くバスサイクルの最後のサンプルだけを残す（データが確定した tick）。 */
function settled(rows) {
  return rows.filter((x, i) => {
    const n = rows[i + 1];
    return !(n && n.addr_v === x.addr_v && n.rd === x.rd && n.wr === x.wr && n.cpu_cm === x.cpu_cm);
  });
}

const isFetch = x => x.rd === 1 && x.istate === 1;

describe('Unix V6: C のプログラムの最初の命令 SETD のトラップ', () => {
  /** @type {import('../helpers/sim.mjs').Sim} */
  let sim;
  let symbols;
  let disk;

  const readFile = path => v6ReadFile(disk, v6ReadInode(disk, v6FindPath(disk, path)));
  const word = (bytes, off) => bytes[off] | (bytes[off + 1] << 8);
  const firstInsn = path => word(readFile(path), AOUT_HEADER_BYTES);
  const symName = addr => v6NearestSym(symbols, addr).name;

  function arm(pc, data, post) {
    const M = sim.M;
    M._sim_set_ring_tick_mask(0);            // 1tick/smpl
    M._sim_set_post_trig(post);
    M._sim_clear_trigger();
    M._sim_set_trigger(TRIG_PC_DATA, ((data << 16) | pc) >>> 0);
  }

  beforeAll(async () => {
    sim = await loadSim();
    const boot = sim.bootToLogin();
    expect(boot.timeout, `boot stage=${boot.stage}`).toBeFalsy();
    sim.sendLine('root\r');
    disk = sim.M.FS.readFile('/disk0.rk');
    symbols = v6TextSymbols(v6ParseNamelist(readFile('/rkunix')));
  }, 300000);

  describe('主張 1: C のプログラムは SETD で始まる', () => {
    it('C で書かれたコマンド（ls・sh・date・cc）の最初の語は 170011', () => {
      for (const path of ['/bin/ls', '/bin/sh', '/bin/date', '/bin/cc']) {
        expect(firstInsn(path), path).toBe(OP_SETD);
      }
    });

    it('アセンブラで書かれたコマンド（cat・as）は SETD で始まらない', () => {
      expect(firstInsn('/bin/cat')).not.toBe(OP_SETD);
      expect(firstInsn('/bin/as')).not.toBe(OP_SETD);
    });

    it('fcrt0 のコマンド（units）は sys signal; 4; fptrap の次に SETD が来る', () => {
      const units = readFile('/usr/bin/units');
      const at = va => word(units, AOUT_HEADER_BYTES + va);
      expect([at(0), at(2), at(4), at(VA_FCRT0_SETD)]).toEqual([OP_SYS_SIGNAL, SIGINS, VA_FPTRAP, OP_SETD]);
      expect(at(VA_FPTRAP)).toBe(OP_FPTRAP);
    });
  });

  describe('主張 2・3: ls ではトラップになり、無視されて 2 番地へ戻る', () => {
    let rows;       // 確定したバスサイクルだけ
    let raw;        // ring のサンプルそのまま
    let i0;         // raw の中の、SETD をフェッチした tick

    beforeAll(() => {
      arm(0, OP_SETD, CRT0_POST);
      sim.sendLine('ls /usr/sys\r', null);
      expect(sim.runUntilTrigger({ maxCycles: 300_000_000 }), 'SETD のフェッチで止まらない').toBe(true);
      raw = sim.readRing(sim.ringSize);
      i0 = raw.findIndex(x => isFetch(x) && x.cpu_cm === USER && x.addr_v === 0 && x.data === OP_SETD);
      rows = settled(raw.slice(i0));
    }, 300000);

    it('ユーザーモードの 0 番地で 170011 をフェッチした tick から、Post の数だけ採って止まる', () => {
      expect(i0).toBeGreaterThanOrEqual(0);
      expect(raw[i0].psw).toBe(PS_USER);
      const post = raw.length - i0;
      expect(post).toBeGreaterThanOrEqual(CRT0_POST);
      expect(post).toBeLessThanOrEqual(CRT0_POST + 8);
    });

    it('CPU はベクタ 010 から、新しい PC（trap の入口）と PS 341 を読む', () => {
      const vecPc = rows.find(x => x.rd && x.cpu_cm === KERNEL && x.addr_p === VEC_RESERVED);
      const vecPs = rows.find(x => x.rd && x.cpu_cm === KERNEL && x.addr_p === VEC_RESERVED + 2);
      expect(symName(vecPc.data)).toBe('trap');
      expect(vecPs.data).toBe(PS_TRAP_ILL);
    });

    it('カーネルスタックに、元の PS と、SETD の次の番地 2 を積む', () => {
      const pushPs = rows.find(x => x.wr && x.addr_v === VA_KSTACK_PS);
      const pushPc = rows.find(x => x.wr && x.addr_v === VA_KSTACK_PC);
      expect(pushPs.data).toBe(PS_USER);
      expect(pushPc.data).toBe(2);
    });

    it('trap() は fuiword(pc-2) で、ユーザーの 0 番地から 170011 を読み直す', () => {
      // mfpi は前モード（User）の空間を読むので、Mode の欄は User になる
      const reread = rows.find(x => x.rd && !isFetch(x) && x.cpu_cm === USER && x.addr_v === 0);
      expect(reread.data).toBe(OP_SETD);
      expect(symName(reread.pc)).toBe('fuiword');
    });

    it('u.u_signal[SIGINS] は 0（捕まえていない）', () => {
      const sig = rows.find(x => x.rd && x.cpu_cm === KERNEL && x.addr_v === VA_U_SIGNAL_INS);
      expect(sig.data).toBe(0);
    });

    it('シグナルを送らず（psignal・psig を通らず）、ユーザーの 2 番地へ戻る', () => {
      const iBack = raw.findIndex((x, i) => i > i0 + 100 && isFetch(x) && x.cpu_cm === USER);
      const kernelFetches = raw.slice(i0, iBack).filter(x => isFetch(x) && x.cpu_cm === KERNEL);
      const names = new Set(kernelFetches.map(x => symName(x.addr_v)));
      expect(names.has('psignal')).toBe(false);
      expect(names.has('psig')).toBe(false);
      expect(raw[iBack].addr_v).toBe(2);
      expect(raw[iBack].sp).toBe(raw[i0].sp);          // ユーザースタックには何も積まれていない
    });

    it('割り込みが入らなければ、1 命令の代わりに 1477 tick をカーネルで過ごす', () => {
      const iBack = raw.findIndex((x, i) => i > i0 + 100 && isFetch(x) && x.cpu_cm === USER);
      const interrupted = raw.slice(i0, iBack).some(x => x.bus_int);
      const ticks = iBack - i0;       // 170011 がバスに出た tick から、2 番地のフェッチが始まる tick まで
      if (interrupted) expect(ticks).toBeGreaterThan(CRT0_TRAP_TICKS);
      else             expect(ticks).toBe(CRT0_TRAP_TICKS);
    });

    it('ls はそのまま最後まで動く', () => {
      sim.M._sim_clear_trigger();
      const r = sim.runTo('# ', { maxCycles: 300_000_000 });
      expect(r.timeout).toBeFalsy();
      expect(r.out).toContain('ken');
      expect(r.out).not.toContain('Illegal instruction');
    });
  });

  describe('主張 1 の裏: アセンブラの cat では止まらない', () => {
    it('cat を実行しても SETD のトリガーは発火しない', () => {
      arm(0, OP_SETD, CRT0_POST);
      const r = sim.sendLine('cat /etc/ttys\r');
      expect(r.timeout).toBeFalsy();
      expect(sim.M._sim_trigger_hit()).toBe(0);
    });
  });

  describe('主張 3 の裏: SIGINS を捕まえている units では、トラップが fptrap へ届く', () => {
    let raw;
    let i0;         // fptrap の入口をフェッチした tick
    let stopped;    // 止まった時点のレジスタとユーザースタックの 2 語

    beforeAll(() => {
      arm(VA_FPTRAP, OP_FPTRAP, FCRT0_POST);
      sim.sendLine('units\r', null);
      expect(sim.runUntilTrigger({ maxCycles: 300_000_000 }), 'fptrap の入口で止まらない').toBe(true);
      const sp = sim.gpr().sp;
      stopped = { sp, pc: sim.peekVirt(USER, sp), ps: sim.peekVirt(USER, sp + 2) };
      // ▶ Step 2 回と同じだけ進めてから ring を読む（発火の前も ring に残っている）
      sim.M._sim_clear_trigger();
      sim.step(FPTRAP_STEP_TICKS);
      raw = sim.readRing(sim.ringSize);
      i0 = raw.findIndex(x => isFetch(x) && x.cpu_cm === USER && x.addr_v === VA_FPTRAP && x.data === OP_FPTRAP);
    }, 300000);

    it('止まった時点で、ユーザースタックの先頭 2 語は SETD の次の番地 10 と元の PS', () => {
      expect(stopped.pc).toBe(VA_FCRT0_SETD + 2);
      expect(stopped.ps).toBe(PS_USER);
    });

    it('u.u_signal[SIGINS] に fptrap の番地が入っている', () => {
      const before = settled(raw.slice(0, i0));
      const sig = before.find(x => x.rd && x.cpu_cm === KERNEL && x.addr_v === VA_U_SIGNAL_INS);
      expect(sig.data).toBe(VA_FPTRAP);
    });

    it('psig() がユーザースタックに、元の PS と、SETD の次の番地 10 を積む', () => {
      const userSp = raw[i0].sp;
      const before = settled(raw.slice(0, i0));
      const pushPs = before.find(x => x.wr && x.cpu_cm === USER && x.addr_v === userSp + 2);
      const pushPc = before.find(x => x.wr && x.cpu_cm === USER && x.addr_v === userSp);
      expect(pushPs.data).toBe(PS_USER);
      expect(pushPc.data).toBe(VA_FCRT0_SETD + 2);
      expect(symName(pushPs.pc)).toBe('suiword');
    });

    it('fptrap は止まった命令 170011 を自分で読み、rti で 10 番地へ戻る', () => {
      const after = settled(raw.slice(i0));
      const reread = after.find(x => x.rd && !isFetch(x) && x.cpu_cm === USER && x.addr_v === VA_FCRT0_SETD);
      const iRti = after.findIndex(x => isFetch(x) && x.cpu_cm === USER && x.data === OP_RTI);
      const next = after.slice(iRti + 1).find(x => isFetch(x));
      expect(reread.data).toBe(OP_SETD);
      expect(iRti).toBeGreaterThan(0);
      expect(next.cpu_cm).toBe(USER);
      expect(next.addr_v).toBe(VA_FCRT0_SETD + 2);
      expect(next.sp).toBe(raw[i0].sp + 4);            // 積んだ 2 語を rti が取り出した
    });

    it('units はそのまま動き、you have: と聞いてくる', () => {
      sim.M._sim_clear_trigger();
      const r = sim.runTo('you have:', { maxCycles: 900_000_000 });
      expect(r.timeout).toBeFalsy();
      sim.sendLine('\x04');
    });
  });
});
