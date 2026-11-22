/**
 * icode-first-user.test.mjs — 最初のユーザープロセスは、カーネルが手で写した 11 語（docs/09-PDP11/33 章）
 *
 * main.c の末尾「Return goes to loc. 0 of user init code just copied out.」を確かめる。
 *   1. main() は icode[] の 11 語を、copyout で User の 0 番地へ写す。
 *   2. main() から戻ると、start が PS 170000 と PC 0 を積んで rtt する。これが最初のユーザーモード。
 *   3. 0 番地の命令は sys exec（104413）で、"/etc/init" を実行する。
 *   4. exec のあとの最初の命令は、init の crt0 の SETD（28 章）。
 *
 * トリガーの値は js/sft-pdp11-la-defs.js のプリセット
 * 「V6 icode: first user instruction (sys exec)」と同じ。'@' が出たあと、rkunix を打つ前に待ち受けにする。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSim } from '../helpers/sim.mjs';
import {
  KERNEL, USER, VA_KSTACK_PC, VA_KSTACK_PS, OP_RTT,
  isFetch, word, diskReader, symbolTable, armPcData, captureAt,
} from '../helpers/v6-trace.mjs';

const ICODE = [
  0o104413,   // sys exec; init; initp
  0o000014,
  0o000010,
  0o000777,   // br .
  0o000014,   // initp: init; 0
  0o000000,
  0o062457,   // init: </etc/init\0>
  0o061564,
  0o064457,
  0o064556,
  0o000164,
];
const OP_SYS_EXEC  = ICODE[0];
const OP_MTPI_R1   = 0o006621;       // copyout のループの mtpi (r1)+
const OP_SETD      = 0o170011;
const ICODE_POST   = 900;            // プリセットの Post
const PS_FIRST_USER = 0o170000;      // start が積む PS（現モード・前モードとも User）
const VEC_TRAP     = 0o34;           // TRAP 命令（sys）のベクタ
const WORD_COPY_TICKS = 34;          // copyout の 1 語ぶん
const MAX_BOOT_CYCLES = 60_000_000;
const FETCH_TICKS   = 2;              // 1 回のフェッチが ring に占めるサンプル数
const START_TAIL_ROWS = 24;          // start の 3 命令（mov・clr・rtt）のバスサイクルが入る数

describe('Unix V6: 最初のユーザープロセス icode', () => {
  let sim;
  let kernel;
  let cap;
  let beforeRaw;     // トリガーより前の ring（生のサンプル）

  beforeAll(async () => {
    sim = await loadSim();
    const rom = sim.runTo('@', { maxCycles: 5_000_000 });
    expect(rom.timeout, 'ブート ROM の @ が出ない').toBeFalsy();
    kernel = symbolTable(diskReader(sim)('/rkunix'));
    armPcData(sim, 0, OP_SYS_EXEC, ICODE_POST);
    sim.sendStr('rkunix\r');
    cap = captureAt(sim, { pc: 0, data: OP_SYS_EXEC, mode: USER, post: ICODE_POST, what: 'icode の sys exec' });
    beforeRaw = cap.raw.slice(0, cap.i0);
  }, 300000);

  const kernelNames = rows => rows.filter(x => isFetch(x) && x.cpu_cm === KERNEL).map(x => kernel.nameOf(x.addr_v));

  it('カーネルの中の icode[] は 11 語で、/etc/init の名前を含む', () => {
    const rkunix = diskReader(sim)('/rkunix');
    const text = Buffer.from(rkunix).toString('latin1');
    expect(text).toContain('/etc/init\0');
    expect(ICODE.length).toBe(11);
  });

  it('それまでユーザーモードの命令は 1 つも実行されていない', () => {
    // トリガーのフェッチ自身は 2 tick にまたがるので、その手前までを見る
    const earlier = beforeRaw.slice(0, -FETCH_TICKS);
    expect(earlier.some(x => isFetch(x) && x.cpu_cm === USER)).toBe(false);
  });

  it('copyout が、User の 0〜024 番地へ icode の 11 語を順に書く', () => {
    const writes = cap.before.filter(x => x.wr && x.cpu_cm === USER && x.isn === OP_MTPI_R1);
    expect(writes.map(x => x.addr_v)).toEqual(ICODE.map((_, i) => i * 2));
    expect(writes.map(x => x.data)).toEqual(ICODE);
    expect(kernel.nameOf(writes[0].pc)).toBe('copyout');
  });

  it('1 語を写すのに 34 tick かかる', () => {
    const ticks = beforeRaw
      .map((x, i) => ({ x, i }))
      .filter(({ x, i }) => x.wr && x.cpu_cm === USER && x.isn === OP_MTPI_R1 && !beforeRaw[i - 1].wr)
      .map(({ i }) => i);
    const gaps = ticks.slice(1).map((t, k) => t - ticks[k]);
    expect(gaps).toEqual(Array(ICODE.length - 1).fill(WORD_COPY_TICKS));
  });

  it('写した先は、UISA0 が指す物理メモリ（カーネルの 0 番地ではない）', () => {
    const first = cap.before.find(x => x.wr && x.cpu_cm === USER && x.isn === OP_MTPI_R1);
    expect(first.addr_v).toBe(0);
    expect(first.addr_p).toBe(sim.mmu().user[0].par * 64);
    expect(first.addr_p).toBeGreaterThan(0o100000);
  });

  it('main() から戻ると、start が PS 170000 と PC 0 を積んで rtt する', () => {
    const names = kernelNames(cap.before);
    expect(names.at(-1)).toBe('start');
    expect(names.lastIndexOf('main')).toBeGreaterThan(names.lastIndexOf('copyout'));
    const tail = cap.before.slice(-START_TAIL_ROWS);
    expect(tail.findLast(x => x.wr && x.addr_v === VA_KSTACK_PS).data).toBe(PS_FIRST_USER);
    expect(tail.findLast(x => x.wr && x.addr_v === VA_KSTACK_PC).data).toBe(0);
    expect(tail.findLast(x => isFetch(x) && x.cpu_cm === KERNEL).data).toBe(OP_RTT);
  });

  it('最初のユーザーモードの命令は、0 番地の sys exec。SP は 0', () => {
    const first = cap.raw[cap.i0];
    expect(first.addr_v).toBe(0);
    expect(first.data).toBe(OP_SYS_EXEC);
    expect(first.psw).toBe(PS_FIRST_USER);
    expect(first.sp).toBe(0);
  });

  it('sys exec はベクタ 034 でトラップし、戻り番地 2 と PS 170000 をカーネルスタックに積む', () => {
    const vecPc = cap.after.find(x => x.rd && x.cpu_cm === KERNEL && x.addr_p === VEC_TRAP);
    expect(kernel.nameOf(vecPc.data)).toBe('trap');
    expect(cap.after.find(x => x.wr && x.addr_v === VA_KSTACK_PS).data).toBe(PS_FIRST_USER);
    expect(cap.after.find(x => x.wr && x.addr_v === VA_KSTACK_PC).data).toBe(2);
  });

  it('trap() は 0 番地の 104413 を読み直して、システムコールの番号を取り出す', () => {
    const reread = cap.after.find(x => x.rd && !isFetch(x) && x.cpu_cm === USER && x.addr_v === 0);
    expect(reread.data).toBe(OP_SYS_EXEC);
    expect(kernel.nameOf(reread.pc)).toBe('fuiword');
  });

  it('止まった時点の User 0〜024 番地は icode のまま', () => {
    expect(ICODE.map((_, i) => sim.peekVirt(USER, i * 2))).toEqual(ICODE);
  });

  it('exec のあと、0 番地の最初の命令は init の SETD（170011）になり、login: が出る', () => {
    let reached = false;
    for (let cycles = 0; cycles < MAX_BOOT_CYCLES && !reached; cycles += 1000) {
      sim.step(1000);
      reached = sim.readRing(1000).some(x => isFetch(x) && x.cpu_cm === USER && x.addr_v === 0 &&
                                             sim.peekVirt(USER, 0) !== OP_SYS_EXEC);
    }
    expect(reached, 'exec のあと 0 番地へ来ない').toBe(true);
    expect(sim.peekVirt(USER, 0)).toBe(OP_SETD);
    expect(sim.runTo('login:', { maxCycles: MAX_BOOT_CYCLES }).timeout).toBeFalsy();
  });
});
