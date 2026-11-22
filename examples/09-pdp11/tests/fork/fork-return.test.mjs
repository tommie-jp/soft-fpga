/**
 * fork-return.test.mjs — fork は戻り番地で親と子を分ける（docs/09-PDP11/29 章）
 *
 * 「fork は子に 0 を返す」は libc（s4/fork.s）の仕事で、カーネル（sys1.c fork()）は
 *   - 子の R0 に親の pid を入れ、戻り番地はそのまま（sys fork のすぐあとの br 1f）
 *   - 親の R0 に子の pid を入れ、戻り番地を 2 進める（br を飛ばして bec 2f）
 * だけをする。シェルがコマンドを 1 つ実行するときの fork で確かめる。
 *
 * トリガーの値は js/sft-pdp11-la-defs.js のプリセット
 * 「V6 sh: fork returns in parent (bec 2f)」「V6 sh: fork returns in child (br 1f)」
 * 「V6 fork: child gets parent pid (fork+52)」と同じ。番地は配布ディスクの /bin/sh と /rkunix のもの。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  KERNEL, USER, AOUT_HEADER_BYTES, VA_KSTACK_PC, VA_KSTACK_PS, VA_KSTACK_R0, OP_RTT,
  isFetch, word, bootV6, diskReader, symbolTable, armPcData, captureAt,
} from '../helpers/v6-trace.mjs';

const OP_SYS_FORK = 0o104402;
const OP_BR_1F    = 0o000403;        // br 1f（子が通る）
const OP_BEC_2F   = 0o103005;        // bec 2f（親が通る）
const OP_CLR_R0   = 0o005000;
const OP_MOV_PPID = 0o016477;        // fork+52: mov 12(r4),*u_ar0

const VA_SYS_FORK = 0o7776;          // /bin/sh の fork() の中の sys fork
const VA_BR_1F    = 0o10000;
const VA_BEC_2F   = 0o10002;
const VA_MOV_PARUID = 0o10010;       // 1: mov r0,_par_uid
const VA_CLR_R0   = 0o10014;
const VA_LABEL_2  = 0o10016;         // 2: mov (sp)+,r5
const VA_FORK_CHILD_STORE = 0o35010; // カーネル fork+52

const RETURN_POST = 200;             // プリセットの Post
const PS_USER_MODE_MASK = 0o170000;

describe('Unix V6: fork は戻り番地で親と子を分ける', () => {
  let sim;
  let kernel;
  let sh;

  beforeAll(async () => {
    sim = await bootV6();
    const readFile = diskReader(sim);
    kernel = symbolTable(readFile('/rkunix'));
    sh = readFile('/bin/sh');
  }, 300000);

  const shWord = va => word(sh, AOUT_HEADER_BYTES + va);

  describe('libc の fork（/bin/sh の中）', () => {
    it('sys fork のすぐあとに br 1f、その次に bec 2f が並ぶ', () => {
      expect(shWord(VA_SYS_FORK)).toBe(OP_SYS_FORK);
      expect(shWord(VA_BR_1F)).toBe(OP_BR_1F);
      expect(shWord(VA_BEC_2F)).toBe(OP_BEC_2F);
    });

    it('br 1f の先で R0 を _par_uid へ写してから clr r0 する', () => {
      expect(shWord(VA_MOV_PARUID) & 0o177700).toBe(0o010000);   // mov r0,...
      expect(shWord(VA_CLR_R0)).toBe(OP_CLR_R0);
    });

    it('カーネルの fork+52 は、子の側だけが通る mov 12(r4),*u_ar0', () => {
      expect(VA_FORK_CHILD_STORE - kernel.byName.fork).toBe(0o52);
    });
  });

  describe('親: date を実行するときの fork', () => {
    let cap;
    let childPid;

    beforeAll(() => {
      armPcData(sim, VA_BEC_2F, OP_BEC_2F, RETURN_POST);
      sim.sendLine('date\r', null);
      cap = captureAt(sim, { pc: VA_BEC_2F, data: OP_BEC_2F, mode: USER, post: RETURN_POST, what: '親の bec 2f' });
      childPid = cap.raw[cap.i0].r0;
      sim.runTo('# ');
    }, 300000);

    it('カーネルは退避した PC に 2 を足して 010002 にする（u.u_ar0[R7] =+ 2）', () => {
      const store = cap.before.filter(x => x.wr && x.cpu_cm === KERNEL && x.addr_v === VA_KSTACK_PC).at(-1);
      expect(store.data).toBe(VA_BEC_2F);
      expect(kernel.nameOf(store.pc)).toBe('fork');
    });

    it('カーネルは退避した R0 に子の pid を書く（u.u_ar0[R0] = p2->p_pid）', () => {
      const store = cap.before.filter(x => x.wr && x.cpu_cm === KERNEL && x.addr_v === VA_KSTACK_R0).at(-1);
      expect(store.data).toBe(childPid);
      expect(kernel.nameOf(store.pc)).toBe('fork');
      expect(childPid).toBeGreaterThan(1);
    });

    it('rtt は PC = 010002 と User モードの PS を取り出す', () => {
      const tail = cap.before.slice(-12);
      const rtt = tail.findLast(x => isFetch(x) && x.cpu_cm === KERNEL);
      const popPc = tail.findLast(x => x.rd && !isFetch(x) && x.addr_v === VA_KSTACK_PC);
      const popPs = tail.findLast(x => x.rd && !isFetch(x) && x.addr_v === VA_KSTACK_PS);
      expect(rtt.data).toBe(OP_RTT);
      expect(popPc.data).toBe(VA_BEC_2F);
      expect(popPs.data & PS_USER_MODE_MASK).toBe(PS_USER_MODE_MASK);
    });

    it('親は br 1f を通らず、bec から 2:（010016）へ進む。R0 は子の pid のまま', () => {
      const fetches = cap.after.filter(x => isFetch(x) && x.cpu_cm === USER);
      expect(fetches[0].addr_v).toBe(VA_BEC_2F);
      expect(fetches[1].addr_v).toBe(VA_LABEL_2);
      expect(fetches.some(x => x.addr_v === VA_BR_1F || x.addr_v === VA_CLR_R0)).toBe(false);
      expect(fetches[2].r0).toBe(childPid);
    });
  });

  describe('子: 同じ fork のもう一方', () => {
    let cap;
    let parentPid;

    beforeAll(() => {
      armPcData(sim, VA_BR_1F, OP_BR_1F, RETURN_POST);
      sim.sendLine('date\r', null);
      cap = captureAt(sim, { pc: VA_BR_1F, data: OP_BR_1F, mode: USER, post: RETURN_POST, what: '子の br 1f' });
      parentPid = cap.raw[cap.i0].r0;
      sim.runTo('# ');
    }, 300000);

    it('rtt は PC = 010000（sys fork のすぐあと）を取り出す。カーネルは PC を進めていない', () => {
      const tail = cap.before.slice(-12);
      const popPc = tail.findLast(x => x.rd && !isFetch(x) && x.addr_v === VA_KSTACK_PC);
      expect(popPc.data).toBe(VA_BR_1F);
    });

    it('戻った時点の R0 は 0 ではなく、親の pid', () => {
      expect(parentPid).toBeGreaterThan(1);
    });

    it('子は br 1f → mov r0,_par_uid → clr r0 と進み、ここで初めて R0 が 0 になる', () => {
      const fetches = cap.after.filter(x => isFetch(x) && x.cpu_cm === USER);
      expect(fetches.slice(0, 4).map(x => x.addr_v)).toEqual([VA_BR_1F, VA_MOV_PARUID, VA_CLR_R0, VA_LABEL_2]);
      expect(fetches[2].r0).toBe(parentPid);     // clr r0 をフェッチした時点ではまだ親の pid
      expect(fetches[3].r0).toBe(0);             // 次の命令では 0
    });

    it('_par_uid に親の pid が書かれる', () => {
      const store = cap.after.find(x => x.wr && x.cpu_cm === USER);
      expect(store.data).toBe(parentPid);
    });
  });

  describe('子のカーネル側: fork() が親の pid を R0 に入れる', () => {
    let cap;

    beforeAll(() => {
      armPcData(sim, VA_FORK_CHILD_STORE, OP_MOV_PPID, RETURN_POST);
      sim.sendLine('date\r', null);
      cap = captureAt(sim, { pc: VA_FORK_CHILD_STORE, data: OP_MOV_PPID, mode: KERNEL, post: RETURN_POST, what: 'fork+52' });
      sim.runTo('# ');
    }, 300000);

    it('newproc() から 1 が返っている（子の側）', () => {
      expect(cap.raw[cap.i0].r0).toBe(1);
    });

    it('退避した R0（141772）へ 1 より大きい pid を書き、PC（141774）には書かない', () => {
      const inFork = cap.after.filter(x => x.wr && x.cpu_cm === KERNEL && kernel.nameOf(x.pc) === 'fork');
      const storeR0 = inFork.find(x => x.addr_v === VA_KSTACK_R0);
      expect(storeR0.data).toBeGreaterThan(1);
      expect(inFork.some(x => x.addr_v === VA_KSTACK_PC)).toBe(false);
    });
  });
});
