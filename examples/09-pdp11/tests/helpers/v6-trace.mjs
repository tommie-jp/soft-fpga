/**
 * v6-trace.mjs — Unix V6 を起動して、PC + Data トリガーで採った ring を調べるための共通部品
 *
 * docs/09-PDP11 の記事（29・32〜34 章）に対応する結合テストが使う。
 * トリガーの値は js/sft-pdp11-la-defs.js のプリセットと同じものを渡す。
 */
import { loadSim } from './sim.mjs';
import { v6ParseNamelist, v6TextSymbols, v6NearestSym } from '../ksym/helpers/load-ksym.mjs';
import { v6FindPath, v6ReadInode, v6ReadFile } from '../v6fs/helpers/load-v6fs.mjs';

export const KERNEL = 0;
export const USER   = 3;
export const TRIG_PC_DATA = 6;
export const AOUT_HEADER_BYTES = 16;

export const VA_KSTACK_PS = 0o141776;   // カーネルスタックの底。トラップが元の PS を積む
export const VA_KSTACK_PC = 0o141774;   // 同じく元の PC（u.u_ar0[R7]）
export const VA_KSTACK_R0 = 0o141772;   // call が退避した R0（u.u_ar0[R0]）
export const OP_RTT       = 0o000006;

const SAMPLE_EVERY_TICK = 0;            // ring_tick_mask: 1tick/smpl
const TRIGGER_MAX_CYCLES = 600_000_000;

export const isFetch = x => x.rd === 1 && x.istate === 1;

/** 同じ番地が続くバスサイクルの最後のサンプルだけを残す（データが確定した tick）。 */
export function settled(rows) {
  return rows.filter((x, i) => {
    const n = rows[i + 1];
    return !(n && n.addr_v === x.addr_v && n.rd === x.rd && n.wr === x.wr && n.cpu_cm === x.cpu_cm);
  });
}

export const word = (bytes, off) => bytes[off] | (bytes[off + 1] << 8);

/** 起動済みの sim から、ディスクの上のファイルを読む関数を作る（sync 済みの内容が見える）。 */
export function diskReader(sim) {
  const disk = sim.M.FS.readFile('/disk0.rk');
  return path => v6ReadFile(disk, v6ReadInode(disk, v6FindPath(disk, path)));
}

/** a.out（カーネルも含む）のテキストのシンボルを { 名前: 番地 } と、番地から名前を引く関数にする。 */
export function symbolTable(aout) {
  const table = v6TextSymbols(v6ParseNamelist(aout));
  const byName = Object.fromEntries(table.map(s => [s.name, s.addr]));
  const nameOf = addr => { const s = v6NearestSym(table, addr); return s ? s.name : ''; };
  return { byName, nameOf };
}

/** V6 を login: まで起動する。login が true なら root で入る。 */
export async function bootV6({ login = true } = {}) {
  const sim = await loadSim();
  const boot = sim.bootToLogin();
  if (boot.timeout) throw new Error(`V6 が起動しない（stage=${boot.stage}）`);
  if (login) sim.sendLine('root\r');
  return sim;
}

/** PC + Data トリガーを待ち受けにする（1tick/smpl が既定）。 */
export function armPcData(sim, pc, data, post, tickMask = SAMPLE_EVERY_TICK) {
  const M = sim.M;
  M._sim_set_ring_tick_mask(tickMask);
  M._sim_set_post_trig(post);
  M._sim_clear_trigger();
  M._sim_set_trigger(TRIG_PC_DATA, ((data << 16) | pc) >>> 0);
}

/**
 * トリガーが発火するまで進め、ring と、トリガーの命令をフェッチしたサンプルの添字 i0 を返す。
 * ring の末尾から post サンプル手前がトリガーの位置なので、同じ命令を何度も通っていても取り違えない。
 * 発火しなければ例外を投げる（テストがどこで止まったか分かるように what を付ける）。
 */
export function captureAt(sim, { pc, data, mode, post, what }) {
  if (!sim.runUntilTrigger({ maxCycles: TRIGGER_MAX_CYCLES })) {
    throw new Error(`トリガーが発火しない: ${what}`);
  }
  const raw = sim.readRing(sim.ringSize);
  const expected = raw.length - 1 - post;
  let i0 = -1;
  raw.forEach((x, i) => {
    if (!(isFetch(x) && x.cpu_cm === mode && x.addr_v === pc && x.data === data)) return;
    if (i0 < 0 || Math.abs(i - expected) < Math.abs(i0 - expected)) i0 = i;
  });
  if (i0 < 0) throw new Error(`ring にトリガーの命令が無い: ${what}`);
  sim.M._sim_clear_trigger();
  return { raw, i0, before: settled(raw.slice(0, i0)), after: settled(raw.slice(i0)) };
}

/** cat >name で 1 ファイルを書く（行は短く。端末の入力バッファを溢れさせない）。 */
export function writeV6File(sim, name, lines) {
  sim.sendLine(`cat >${name}\r`, null);
  sim.step(2_000_000);
  for (const line of lines) {
    sim.sendLine(line + '\r', null);
    sim.step(1_500_000);
  }
  sim.sendLine('\x04');
}
