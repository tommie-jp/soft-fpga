#!/usr/bin/env node
/**
 * debug-exit-repeat.mjs — exit(1) を 3 回連続実行して trapped_indirect_n のデバッグ出力を確認
 */
import { loadSim } from './helpers/sim.mjs';

const PACE = 80_000;  // 1文字ごとのサイクル数（文字落ち防止）

const sim = await loadSim();

function sendLine(s) {
  for (let i = 0; i < s.length; i++) { sim.sendKey(s.charCodeAt(i)); sim.step(PACE); }
  sim.sendKey(13); sim.step(PACE);
}

// ── ブート ──────────────────────────────────────────────────────────────
process.stderr.write('Booting V6...\n');
const a = sim.runTo('@', { maxCycles: 5_000_000 });
if (a.timeout) { process.stderr.write('BOOT TIMEOUT\n'); process.exit(1); }
sendLine('rkunix');
const b = sim.runTo('login:', { maxCycles: 40_000_000 });
if (b.timeout) { process.stderr.write('LOGIN TIMEOUT\n'); process.exit(1); }

// ── ログイン ────────────────────────────────────────────────────────────
sendLine('root');
const c = sim.runTo('#', { maxCycles: 10_000_000 });
if (!c.out.includes('#')) { process.stderr.write('PROMPT TIMEOUT\n'); process.exit(1); }
process.stderr.write('Logged in\n');

// ── a.out をコンパイル（exit のみ）──────────────────────────────────────
sendLine('cat >t.c');
sim.step(500_000);
sendLine('main(){exit(1);}');
sim.sendKey(4); sim.step(PACE);  // EOF
sim.runTo('#', { maxCycles: 5_000_000 });

sendLine('cc t.c');
sim.runTo('#', { maxCycles: 20_000_000 });
process.stderr.write('Compiled\n');

// ── a.out を 3 回実行 ──────────────────────────────────────────────────
const RING_WORDS = sim.ringWords;

function dumpTraps(label) {
  const h = sim.M.HEAPU32;
  const ringBase = sim.M._get_ring_ptr() >>> 2;
  const count = (sim.ringSize / RING_WORDS) | 0;
  const traps = [];
  for (let i = 0; i < count; i++) {
    const b = ringBase + i * RING_WORDS;
    const w0 = h[b], w1 = h[b+1], w4 = h[b+4], w9 = h[b+9];
    if ((w0 >>> 23) & 1) {
      const isn = (w4 >>> 5) & 0xFFFF;
      const indirect_n = (w4 >>> 24) & 0xFF;
      const uipar0 = w9 & 0xFFF;
      traps.push({ isn: isn.toString(16).padStart(4,'0'), indirect_n, uipar0: uipar0.toString(8) });
    }
  }
  process.stderr.write(label + ': ' + JSON.stringify(traps) + '\n');
}

for (let i = 1; i <= 3; i++) {
  process.stderr.write(`\n=== Run ${i} ===\n`);
  sendLine('a.out');
  sim.runTo('#', { maxCycles: 5_000_000 });
  dumpTraps(`Run${i} traps`);
  process.stderr.write(`Run ${i} done\n`);
}

process.stderr.write('\nDone\n');
