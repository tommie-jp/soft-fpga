// bench_eis.mjs — EIS vs ソフトウェア実装 クロック数実測
// 使い方: node verif/bench_eis.mjs
import Module from '../examples/09-pdp11/tests/sim-test.mjs';

const m = await Module();
const START = 0x200; // 0o1000

function initBare()          { m._sim_init_bare(START); }
function writeWord(a, w)     { m._sim_write_word(a, w); }
function ringHead()          { return m._get_ring_head(); }
function stepN(n)            { m._step_n(n); }

function load(words) {
  for (const [addr, word] of Object.entries(words))
    writeWord(Number(addr), word);
}

function bench(name, words, maxTicks = 50000) {
  initBare();
  load(words);
  const h0 = ringHead();
  stepN(maxTicks);
  const cycles = ringHead() - h0;
  return { name, cycles };
}

// ──────────────────────────────────────────────────────────────
// プログラム定義 (アドレス単位: バイト, 先頭 = 0x200 = 0o1000)
// EIS 命令は pdp11asm.py 未対応のため生ワードで埋め込む
//   MUL r1, r0  = 0o070001 = 28673
//   ASH r1, r0  = 0o072001 = 29697
//   DIV r2, r0  = 0o071002 = 29186
// ──────────────────────────────────────────────────────────────

// ─── リファレンス: セットアップのみ + HALT ────────────────────
const REF = {
  0x200: 0o012700, 0x202: 5,    // mov #5, r0
  0x204: 0o012701, 0x206: 3,    // mov #3, r1
  0x208: 0,                     // halt
};

// ─── EIS MUL r1, r0 ──────────────────────────────────────────
const EIS_MUL = {
  0x200: 0o012700, 0x202: 5,    // mov #5, r0
  0x204: 0o012701, 0x206: 3,    // mov #3, r1
  0x208: 0o070001,              // mul r1, r0
  0x20a: 0,                     // halt
};

// ─── ソフトウェア MUL (shift-and-add 16bit × 16bit) ──────────
// mov #5, r0 / mov #3, r1 / clr r2 / mov #020, r3
// loop: asr r1 / bcc skip / add r0, r2 / skip: asl r0 / sob r3, loop / halt
// (pdp11asm.py で生成した値をそのまま使用)
const SW_MUL = {
  0x200: 0o012700, 0x202: 5,      // mov #5, r0
  0x204: 0o012701, 0x206: 3,      // mov #3, r1
  0x208: 0o005002,                // clr r2
  0x20a: 0o012703, 0x20c: 0o020,  // mov #020, r3  (16ループ)
  0x20e: 0o006201,                // asr r1
  0x210: 0o103001,                // bcc +1   (skip add)
  0x212: 0o060002,                // add r0, r2
  0x214: 0o006300,                // asl r0
  0x216: 0o077305,                // sob r3, loop  (offset -5)
  0x218: 0,                       // halt
};

// ─── EIS ASH r1, r0 (r0 を r1 ビット左シフト) ────────────────
const EIS_ASH = {
  0x200: 0o012700, 0x202: 1,    // mov #1, r0
  0x204: 0o012701, 0x206: 7,    // mov #7, r1  (シフト量 7)
  0x208: 0o072001,              // ash r1, r0
  0x20a: 0,                     // halt
};

// ─── ソフトウェア ASH (asl ループ 7 回) ──────────────────────
// mov #1, r0 / mov #7, r1 / loop: asl r0 / sob r1, loop / halt
const SW_ASH = {
  0x200: 0o012700, 0x202: 1,    // mov #1, r0
  0x204: 0o012701, 0x206: 7,    // mov #7, r1
  0x208: 0o006300,              // asl r0
  0x20a: 0o077102,              // sob r1, loop  (offset -2)
  0x20c: 0,                     // halt
};

// ─── EIS DIV r2, r0 (r0:r1 ÷ r2) ────────────────────────────
const EIS_DIV = {
  0x200: 0o005000,              // clr r0   (高ワード 0)
  0x202: 0o012701, 0x204: 13,  // mov #13, r1 (低ワード 13)
  0x206: 0o012702, 0x208: 5,   // mov #5,  r2 (除数)
  0x20a: 0o071002,              // div r2, r0   → r0=2, r1=3
  0x20c: 0,                     // halt
};

// ─── ソフトウェア DIV (非復元法 / 16÷16→16bit) ───────────────
// シフト法: 16 ループ × (mov + asl + cmp + blt + sub + sob) ≈ 6 命令/回
// ここでは単純な引き算ループで概算
// mov #0, r0(high) / mov #13, r1(low=dividend) / mov #5, r2(divisor)
// clr r3 (quotient) / loop: cmp r1, r2 / blt done / sub r2, r1 / inc r3 / br loop / done: halt
const SW_DIV = {
  0x200: 0o005001,              // clr r1  (quotient starts 0, r1 will be quotient)
  0x202: 0o012700, 0x204: 13,  // mov #13, r0  (dividend)
  0x206: 0o012702, 0x208: 5,   // mov #5,  r2  (divisor)
  0x20a: 0o020002,              // cmp r0, r2
  0x20c: 0o002403,              // blt done  (+3 words → 0x214)
  0x20e: 0o160200,              // sub r2, r0
  0x210: 0o005201,              // inc r1
  0x212: 0o000773,              // br loop  (-5 words → 0x20a)
  0x214: 0,                     // halt
};

// ──────────────────────────────────────────────────────────────
const results = [
  bench('Reference (setup + halt)',        REF),
  bench('EIS MUL  mul r1,r0  (5×3)',       EIS_MUL),
  bench('SW  MUL  shift-add 16bit×16bit',  SW_MUL),
  bench('EIS ASH  ash r1,r0  (<<7)',       EIS_ASH),
  bench('SW  ASH  asl×7 loop',             SW_ASH),
  bench('EIS DIV  div r2,r0  (13÷5)',      EIS_DIV),
  bench('SW  DIV  sub loop   (13÷5)',      SW_DIV),
];

const refCycles = results[0].cycles;

console.log('\n=== EIS vs ソフトウェア クロック数比較 ===\n');
console.log(`${'命令/ルーチン'.padEnd(38)} ${'総clk'.padStart(7)} ${'命令clk'.padStart(8)} ${'SW/EIS'.padStart(8)}`);
console.log('-'.repeat(66));

let eisMul, swMul, eisAsh, swAsh, eisDiv, swDiv;
for (const r of results) {
  const net = r.cycles - refCycles;
  const netStr = r.name.startsWith('Ref') ? '      —' : String(net).padStart(7);
  console.log(`${r.name.padEnd(38)} ${String(r.cycles).padStart(7)} ${netStr}`);
  if (r.name.includes('EIS MUL'))  eisMul = net;
  if (r.name.includes('SW  MUL'))  swMul  = net;
  if (r.name.includes('EIS ASH'))  eisAsh = net;
  if (r.name.includes('SW  ASH'))  swAsh  = net;
  if (r.name.includes('EIS DIV'))  eisDiv = net;
  if (r.name.includes('SW  DIV'))  swDiv  = net;
}

console.log('\n--- 高速化率 (SW ÷ EIS) ---');
console.log(`MUL: ${(swMul  / eisMul).toFixed(1)}x  (EIS ${eisMul} clk vs SW ${swMul} clk)`);
console.log(`ASH: ${(swAsh  / eisAsh).toFixed(1)}x  (EIS ${eisAsh} clk vs SW ${swAsh} clk)`);
console.log(`DIV: ${(swDiv  / eisDiv).toFixed(1)}x  (EIS ${eisDiv} clk vs SW ${swDiv} clk)`);
