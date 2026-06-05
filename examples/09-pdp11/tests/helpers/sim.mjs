/**
 * sim.mjs — PDP-11 / Unix V6 WASM テストローダー
 *
 * 使い方:
 *   const sim = await loadSim();          // sim_init 済み（ディスクは埋め込み /disk0.rk）
 *   await sim.bootToLogin();              // V6 を起動して login: まで進める
 *   sim.pc(); sim.gpr(); sim.mmu(); sim.readRing();
 *
 * sim-test.mjs は build-wasm-09.sh のテストビルド（MODULARIZE + EXPORT_ES6 +
 * ENVIRONMENT=node）で生成される。
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIM_MJS = join(__dirname, '..', 'sim-test.mjs');

let _factory = null;
async function getFactory() {
  if (!_factory) _factory = (await import(SIM_MJS)).default;
  return _factory;
}

/** sim_init 済みの Sim ラッパーを返す（テストごとに独立インスタンス）。 */
export async function loadSim() {
  const factory = await getFactory();
  const M = await factory();
  return new Sim(M);
}

export class Sim {
  constructor(M) {
    this.M = M;
    this.ringSize  = M._get_ring_size();
    this.ringWords = M._get_ring_words();   // 5
    M._sim_init();
  }

  step(n) { this.M._step_n(n); }
  pc()    { return this.M._get_pc() & 0xFFFF; }
  sendKey(ch) { this.M._send_key(ch); }
  sendStr(s)  { for (let i = 0; i < s.length; i++) this.M._send_key(s.charCodeAt(i)); }

  /** 溜まったコンソール出力を取り出す（ASCII 7bit）。 */
  drain() {
    let s = '', c;
    while ((c = this.M._get_display_char()) >= 0) s += String.fromCharCode(c & 0x7f);
    return s;
  }

  /** GPR スナップショット { r0..r5, sp }（16bit）。 */
  gpr() {
    const base = this.M._get_gpr_ptr() >>> 1;   // HEAPU16 index
    const h = this.M.HEAPU16;
    return {
      r0: h[base], r1: h[base+1], r2: h[base+2], r3: h[base+3],
      r4: h[base+4], r5: h[base+5], sp: h[base+6],
    };
  }

  /** MMU スナップショット { kernel[8], user[8] }（各 {par, pdr}）。 */
  mmu() {
    this.M._sim_update_mmu();
    const base = this.M._get_mmu_ptr() >>> 2;   // HEAPU32 index
    const h = this.M.HEAPU32;
    const seg = (i) => ({ par: (h[base+i] >>> 16) & 0xFFFF, pdr: h[base+i] & 0xFFFF });
    const out = [];
    for (let i = 0; i < 16; i++) out.push(seg(i));
    return { kernel: out.slice(0, 8), user: out.slice(8, 16) };
  }

  ringHead() { return this.M._get_ring_head() >>> 0; }

  /** 直近 count サンプルを古い順で返す（harness.cpp の語レイアウト準拠）。 */
  readRing(count = 64) {
    const head = this.ringHead();
    const total = Math.min(head, this.ringSize);
    const n = Math.min(count, total);
    const base = this.M._get_ring_ptr() >>> 2;  // HEAPU32 index
    const h = this.M.HEAPU32;
    const out = [];
    for (let k = n; k >= 1; k--) {
      const slot = (head - k) % this.ringSize;
      const p = base + slot * this.ringWords;
      const w0 = h[p], w1 = h[p+1], w2 = h[p+2], w3 = h[p+3];
      out.push({
        addr_p:  w0 & 0x3FFFF,
        wr:      (w0 >>> 18) & 1,
        rd:      (w0 >>> 19) & 1,
        cpu_cm:  (w0 >>> 20) & 3,
        byte_op: (w0 >>> 22) & 1,
        trapped: (w0 >>> 23) & 1,
        halted:  (w0 >>> 24) & 1,
        bus_int: (w0 >>> 25) & 1,
        rk_state:(w0 >>> 26) & 0x1F,
        data:    w1 & 0xFFFF,
        psw:     (w1 >>> 16) & 0xFFFF,
        pc:      w2 & 0xFFFF,
        addr_v:  (w2 >>> 16) & 0xFFFF,
        int_vec: w3 & 0xFF,
        int_ipl: (w3 >>> 8) & 0xFF,
      });
    }
    return out;
  }

  /**
   * コンソールに substr が現れるまでステップする。
   * @returns {{out:string, cycles:number, timeout?:boolean}}
   */
  runTo(substr, { maxCycles = 30_000_000, chunk = 200_000 } = {}) {
    let out = '', cycles = 0;
    while (cycles < maxCycles) {
      this.step(chunk); cycles += chunk;
      out += this.drain();
      if (out.indexOf(substr) >= 0) return { out, cycles };
    }
    return { out, cycles, timeout: true };
  }

  /** bootrom @ → rkunix → login: まで進める。 */
  bootToLogin({ maxCycles = 40_000_000 } = {}) {
    const a = this.runTo('@', { maxCycles: 5_000_000 });
    if (a.timeout) return { ...a, stage: 'bootrom' };
    this.sendStr('rkunix\r');
    const b = this.runTo('login:', { maxCycles });
    return { out: a.out + b.out, cycles: a.cycles + b.cycles, timeout: b.timeout, stage: b.timeout ? 'login' : 'done' };
  }
}
