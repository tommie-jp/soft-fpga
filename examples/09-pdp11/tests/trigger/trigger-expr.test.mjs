// trigger-expr.test.mjs — 式トリガー パーサ / エバリュエータ ユニットテスト
// WASM 不要: 純 JS のパース・評価だけを検証する。

import { describe, it, expect } from 'vitest';
import {
  LA_SIGNALS_PDP11,
  _trigParse, _trigEvalExpr, _trigFindSig, trigCompileToWasm,
} from './helpers/load-expr.mjs';
import { makeRing, BASE, PREV_BASE } from './helpers/ring.mjs';

// ── 評価ヘルパー ──────────────────────────────────────────────────────────────
// cur/prev は { signalId: value } のオブジェクト
function eval_(expr, cur = {}, prev = {}) {
  const ast  = _trigParse(expr);
  const ring = makeRing(LA_SIGNALS_PDP11, { cur, prev });
  return _trigEvalExpr(ast, ring, BASE, PREV_BASE);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Part 1: 全信号単体テスト
// 各信号について「マッチする値 → true」「異なる値 → false」を確認する。
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 数値比較シグナルの自動テスト定義
// [sigId, testVal, 式の表記, 0 とは異なる値]
const NUMERIC_SIG_CASES = [
  // Bus Address
  ['addr_p',    0x1234, 'ADDR_P == 0x1234'],
  ['addr_v',    2060,   'ADDR_V == 0o4014'],  // 0o4014 = 2060 decimal
  ['data',      0xABCD, 'data == 0xABCD'],
  // Bus Control (bit)
  ['bus_wr',    1,      'bus_wr == 1'],
  ['bus_rd',    1,      'bus_rd == 1'],
  ['byte_op',   1,      'byte_op == 1'],
  // CPU State
  ['pc',        0x0200, 'pc == 0x200'],
  ['pri',       6,      'pri == 6'],
  // Trap / Halt (bit)
  ['trapped',   1,      'trapped == 1'],
  ['halted',    1,      'halted == 1'],
  // Interrupt (bit / multi-bit)
  ['bus_int',   1,      'bus_int == 1'],
  ['int_vec',   0x14,   'int_vec == 0x14'],
  ['int_ipl',   5,      'int_ipl == 5'],
  // RK11
  ['rk_state',  3,      'rk_state == 3'],
  // Instruction (numeric)
  ['istate',    1,      'istate == 1'],   // 1 = f1
  ['isn',       0xA0,   'isn == 0xA0'],   // NOP=0o000240=0xA0
  // Bus Error / Trap detail (bit)
  ['bus_error',  1,     'bus_error == 1'],
  ['nxm_access', 1,     'nxm_access == 1'],
  ['trap_bus',   1,     'trap_bus == 1'],
  ['trap_abort', 1,     'trap_abort == 1'],
  ['trap_odd',   1,     'trap_odd == 1'],
  // GPR
  ['r0',   0x0001, 'r0 == 1'],
  ['r1',   0x0002, 'r1 == 2'],
  ['r2',   0x0003, 'r2 == 3'],
  ['r3',   0x0004, 'r3 == 4'],
  ['r4',   0x0005, 'r4 == 5'],
  ['r5',   0x0006, 'r5 == 6'],
  ['sp',   0x7F00, 'sp == 0x7F00'],
  // Memory probe
  ['mem_m1', 0xBEEF, 'mem_m1 == 0xBEEF'],
];

describe('全信号単体: 数値比較', () => {
  for (const [id, val, expr] of NUMERIC_SIG_CASES) {
    it(`${id} ヒット: ${expr}`, () => {
      expect(eval_(expr, { [id]: val })).toBe(true);
    });
    it(`${id} ミス (値が異なる)`, () => {
      expect(eval_(expr, { [id]: 0 })).toBe(val === 0 ? true : false);
    });
  }

  // addr_v の値は実際の bit 幅分マスクされる
  it('addr_v はゼロ以外でマッチ確認', () => {
    // 0o4014 = 0x80C = 2060
    expect(eval_('addr_v == 2060', { addr_v: 2060 })).toBe(true);
    expect(eval_('addr_v == 2060', { addr_v: 0    })).toBe(false);
  });
});

// 文字列比較シグナルのテスト（fmt を持つ信号）
describe('全信号単体: 文字列比較', () => {
  it('istate == "F1" (値=1)', () => {
    expect(eval_('istate == "F1"', { istate: 1 })).toBe(true);
    expect(eval_('istate == "F1"', { istate: 0 })).toBe(false);  // 0=h1
  });
  it('istate == "H1" (値=0)', () => {
    expect(eval_('istate == "H1"', { istate: 0 })).toBe(true);
  });
  it('istate != "F1" (値≠1)', () => {
    expect(eval_('istate != "F1"', { istate: 2 })).toBe(true);  // 2=c1
    expect(eval_('istate != "F1"', { istate: 1 })).toBe(false);
  });

  it('cm == "Kernel" (値=0)', () => {
    expect(eval_('cm == "Kernel"', { cm: 0 })).toBe(true);
    expect(eval_('cm == "Kernel"', { cm: 3 })).toBe(false);  // 3=User
  });
  it('cm == "User" (値=3)', () => {
    expect(eval_('cm == "User"', { cm: 3 })).toBe(true);
  });
  it('cm != "User" (値=0)', () => {
    expect(eval_('cm != "User"', { cm: 0 })).toBe(true);
  });

  it('isn == "NOP" (値=0o000240=160)', () => {
    expect(eval_('isn == "NOP"', { isn: 0o000240 })).toBe(true);
    expect(eval_('isn == "NOP"', { isn: 0        })).toBe(false);
  });

  // psw: fmtPSW11(0) = "KKP0....." → 大文字化 = "KKP0....."
  it('psw: 値 0 は "KKP0....." にフォーマット', () => {
    expect(eval_('psw == "KKP0....."', { psw: 0 })).toBe(true);
    expect(eval_('psw != "KKP0....."', { psw: 1 })).toBe(true);  // C フラグ ON → "KKP0....C"
  });

  // pri は dec フォーマット
  // 注意: trigCompileToWasm は dec フォーマット文字列比較を非対応（_COMPILE_STR_TO_NUM.dec = null）
  //       → 本番では数値比較 pri == 6 を使うこと。JS eval のみでの検証。
  it('pri == "6" (文字列: dec フォーマット, JS eval のみ)', () => {
    expect(eval_('pri == "6"', { pri: 6 })).toBe(true);
    expect(eval_('pri == "6"', { pri: 5 })).toBe(false);
  });
});

// 仮想信号 CYCLE のテスト
describe('全信号単体: 仮想信号 CYCLE', () => {
  // FETCH 条件: bus_rd=1, addr_p が非 IO ページ, pc == addr_v
  const fetchRing = { bus_rd: 1, addr_p: 0x0100, pc: 0x0100, addr_v: 0x0100 };

  it('Cycle == "FETCH"', () => {
    expect(eval_('Cycle == "FETCH"', fetchRing)).toBe(true);
  });
  it('CYCLE == "FETCH" (大文字エイリアス)', () => {
    expect(eval_('CYCLE == "FETCH"', fetchRing)).toBe(true);
  });
  it('CYC == "FETCH" (短縮エイリアス)', () => {
    expect(eval_('CYC == "FETCH"', fetchRing)).toBe(true);
  });
  it('Cycle != "FETCH" (バス非アクティブ)', () => {
    expect(eval_('Cycle != "FETCH"', {})).toBe(true);  // rd=0,wr=0 → null → ""
  });
  it('Cycle == "MEM_RD" (bus_rd=1, addr_v≠pc)', () => {
    expect(eval_('Cycle == "MEM_RD"', { bus_rd: 1, addr_p: 0x0200, pc: 0x0100, addr_v: 0x0200 })).toBe(true);
  });
  it('Cycle == "MEM_WR" (bus_wr=1, 非 IO)', () => {
    expect(eval_('Cycle == "MEM_WR"', { bus_wr: 1, addr_p: 0x0200 })).toBe(true);
  });
  it('Cycle == "TRAP" (trapped=1)', () => {
    expect(eval_('Cycle == "TRAP"', { trapped: 1 })).toBe(true);
  });
});

// シグナルエイリアスのテスト（代表的なもの）
describe('全信号単体: エイリアス', () => {
  const ALIAS_CASES = [
    ['RD',     'bus_rd',    'RD == 1'],
    ['WR',     'bus_wr',    'WR == 1'],
    ['ADDR',   'addr_p',    'ADDR == 0x100'],
    ['PA',     'addr_p',    'PA == 0x100'],
    ['VA',     'addr_v',    'VA == 0x100'],
    ['PC',     'pc',        'PC == 0x100'],
    ['MODE',   'cm',        'MODE == 0'],
    ['CM',     'cm',        'CM == 0'],
    ['ISTATE', 'istate',    'ISTATE == 1'],
    ['ISN',    'isn',       'ISN == 0'],
    ['TRAP',   'trapped',   'TRAP == 1'],
    ['HALT',   'halted',    'HALT == 1'],
    ['INT',    'bus_int',   'INT == 1'],
    ['VEC',    'int_vec',   'VEC == 0x14'],
    ['IPL',    'int_ipl',   'IPL == 5'],
    ['RK',     'rk_state',  'RK == 3'],
    ['BUSERR', 'bus_error', 'BUSERR == 1'],
    ['NXM',    'nxm_access','NXM == 1'],
    ['TBUS',   'trap_bus',  'TBUS == 1'],
    ['TABORT', 'trap_abort','TABORT == 1'],
    ['TODD',   'trap_odd',  'TODD == 1'],
    ['M1',     'mem_m1',    'M1 == 0x1234'],
    ['BYTE',   'byte_op',   'BYTE == 1'],
  ];

  for (const [alias, sigId, expr] of ALIAS_CASES) {
    it(`${alias} → ${sigId}`, () => {
      const sig = _trigFindSig(alias);
      expect(sig).not.toBeNull();
      expect(sig.id).toBe(sigId);
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Part 2: 演算子テスト
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('論理演算子 &&', () => {
  it('true && true → true',   () => expect(eval_('bus_rd == 1 && bus_wr == 0', { bus_rd: 1, bus_wr: 0 })).toBe(true));
  it('true && false → false',  () => expect(eval_('bus_rd == 1 && bus_wr == 1', { bus_rd: 1, bus_wr: 0 })).toBe(false));
  it('false && true → false',  () => expect(eval_('bus_rd == 0 && bus_wr == 0', { bus_rd: 1, bus_wr: 0 })).toBe(false));
  it('false && false → false', () => expect(eval_('bus_rd == 0 && bus_wr == 1', { bus_rd: 1, bus_wr: 0 })).toBe(false));
  it('3 条件: a && b && c',    () => {
    expect(eval_('bus_rd == 1 && bus_wr == 0 && byte_op == 0', { bus_rd: 1 })).toBe(true);
    expect(eval_('bus_rd == 1 && bus_wr == 0 && byte_op == 1', { bus_rd: 1 })).toBe(false);
  });
});

describe('論理演算子 ||', () => {
  it('false || false → false', () => expect(eval_('bus_rd == 1 || bus_wr == 1', {})).toBe(false));
  it('false || true → true',   () => expect(eval_('bus_rd == 0 || bus_wr == 0', {})).toBe(true));
  it('true || false → true',   () => expect(eval_('bus_rd == 1 || bus_wr == 1', { bus_rd: 1 })).toBe(true));
  it('true || true → true',    () => expect(eval_('bus_rd == 1 || bus_wr == 0', { bus_rd: 1 })).toBe(true));
  it('3 条件: a || b || c',    () => {
    expect(eval_('trapped == 1 || halted == 1 || bus_error == 1', { halted: 1 })).toBe(true);
    expect(eval_('trapped == 1 || halted == 1 || bus_error == 1', {})).toBe(false);
  });
});

describe('論理演算子 !', () => {
  it('!(true) → false',  () => expect(eval_('!(bus_rd == 1)', { bus_rd: 1 })).toBe(false));
  it('!(false) → true',  () => expect(eval_('!(bus_rd == 1)', { bus_rd: 0 })).toBe(true));
  it('!!false → false',  () => expect(eval_('!!(bus_rd == 0)', { bus_rd: 1 })).toBe(false));
  it('!!true → true',    () => expect(eval_('!!(bus_rd == 1)', { bus_rd: 1 })).toBe(true));
});

describe('比較演算子: 数値 (pc=256=0o400=0x100)', () => {
  const V = 256;
  const cur = { pc: V };

  it('==: 一致 → true',    () => expect(eval_('pc == 256',  cur)).toBe(true));
  it('==: 不一致 → false', () => expect(eval_('pc == 257',  cur)).toBe(false));
  it('!=: 不一致 → true',  () => expect(eval_('pc != 257',  cur)).toBe(true));
  it('!=: 一致 → false',   () => expect(eval_('pc != 256',  cur)).toBe(false));
  it('<: 小 → true',       () => expect(eval_('pc < 257',   cur)).toBe(true));
  it('<: 等 → false',      () => expect(eval_('pc < 256',   cur)).toBe(false));
  it('<: 大 → false',      () => expect(eval_('pc < 255',   cur)).toBe(false));
  it('>: 大 → true',       () => expect(eval_('pc > 255',   cur)).toBe(true));
  it('>: 等 → false',      () => expect(eval_('pc > 256',   cur)).toBe(false));
  it('>: 小 → false',      () => expect(eval_('pc > 257',   cur)).toBe(false));
  it('<=: 小 → true',      () => expect(eval_('pc <= 257',  cur)).toBe(true));
  it('<=: 等 → true',      () => expect(eval_('pc <= 256',  cur)).toBe(true));
  it('<=: 大 → false',     () => expect(eval_('pc <= 255',  cur)).toBe(false));
  it('>=: 大 → true',      () => expect(eval_('pc >= 255',  cur)).toBe(true));
  it('>=: 等 → true',      () => expect(eval_('pc >= 256',  cur)).toBe(true));
  it('>=: 小 → false',     () => expect(eval_('pc >= 257',  cur)).toBe(false));
});

describe('数値リテラル形式: 4 書式の等価性 (256=0x100=0o400=0400)', () => {
  const cur = { pc: 256 };
  it('10 進: pc == 256',   () => expect(eval_('pc == 256',   cur)).toBe(true));
  it('16 進: pc == 0x100', () => expect(eval_('pc == 0x100', cur)).toBe(true));
  it('ES6 8 進: pc == 0o400', () => expect(eval_('pc == 0o400', cur)).toBe(true));
  it('レガシー 8 進: pc == 0400', () => expect(eval_('pc == 0400', cur)).toBe(true));
});

describe('エッジ検出: bus_rd', () => {
  it('.rising: prev=0, cur=1 → true',  () => expect(eval_('bus_rd.rising', {bus_rd:1}, {bus_rd:0})).toBe(true));
  it('.rising: prev=1, cur=1 → false', () => expect(eval_('bus_rd.rising', {bus_rd:1}, {bus_rd:1})).toBe(false));
  it('.rising: prev=0, cur=0 → false', () => expect(eval_('bus_rd.rising', {bus_rd:0}, {bus_rd:0})).toBe(false));
  it('.rising: prev=1, cur=0 → false', () => expect(eval_('bus_rd.rising', {bus_rd:0}, {bus_rd:1})).toBe(false));

  it('.falling: prev=1, cur=0 → true',  () => expect(eval_('bus_rd.falling', {bus_rd:0}, {bus_rd:1})).toBe(true));
  it('.falling: prev=0, cur=0 → false', () => expect(eval_('bus_rd.falling', {bus_rd:0}, {bus_rd:0})).toBe(false));
  it('.falling: prev=1, cur=1 → false', () => expect(eval_('bus_rd.falling', {bus_rd:1}, {bus_rd:1})).toBe(false));
  it('.falling: prev=0, cur=1 → false', () => expect(eval_('bus_rd.falling', {bus_rd:1}, {bus_rd:0})).toBe(false));

  it('.edge: prev=0, cur=1 → true',  () => expect(eval_('bus_rd.edge', {bus_rd:1}, {bus_rd:0})).toBe(true));
  it('.edge: prev=1, cur=0 → true',  () => expect(eval_('bus_rd.edge', {bus_rd:0}, {bus_rd:1})).toBe(true));
  it('.edge: prev=0, cur=0 → false', () => expect(eval_('bus_rd.edge', {bus_rd:0}, {bus_rd:0})).toBe(false));
  it('.edge: prev=1, cur=1 → false', () => expect(eval_('bus_rd.edge', {bus_rd:1}, {bus_rd:1})).toBe(false));
});

describe('エッジ検出: 多ビット信号 (pc)', () => {
  it('.rising: prev=0, cur=1 → true',  () => expect(eval_('pc.rising', {pc:1}, {pc:0})).toBe(true));
  it('.rising: prev=1, cur=1 → false', () => expect(eval_('pc.rising', {pc:1}, {pc:1})).toBe(false));
  it('.edge: 値変化あり → true',       () => expect(eval_('pc.edge', {pc:0x200}, {pc:0x100})).toBe(true));
  it('.edge: 値変化なし → false',      () => expect(eval_('pc.edge', {pc:0x100}, {pc:0x100})).toBe(false));
});

describe('カッコ: 優先度変更', () => {
  // && は || より先に評価される
  it('a || b && c: && が優先 (b=F,c=F なら全体 = a)', () => {
    // pc==256 || bus_rd==0 && bus_wr==1
    // bus_rd==0(T) && bus_wr==1(F) = F  →  pc==256(T) || F = T
    expect(eval_('pc == 256 || bus_rd == 0 && bus_wr == 1', { pc: 256 })).toBe(true);
    // bus_rd==0(T) && bus_wr==1(F) = F  →  pc == 0(F) || F = F
    expect(eval_('pc == 0 || bus_rd == 0 && bus_wr == 1', { pc: 256 })).toBe(false);
  });
  it('(a || b) && c: カッコで || を先に評価', () => {
    // (pc==256(T) || bus_rd==0(T)) && bus_wr==1(F) = T && F = F
    expect(eval_('(pc == 256 || bus_rd == 0) && bus_wr == 1', { pc: 256 })).toBe(false);
    // (pc==256(T) || bus_rd==0(T)) && bus_wr==0(T) = T && T = T
    expect(eval_('(pc == 256 || bus_rd == 0) && bus_wr == 0', { pc: 256 })).toBe(true);
  });
  it('!(a || b): ド・モルガン', () => {
    expect(eval_('!(pc == 0 || pc == 2)', { pc: 256 })).toBe(true);
    expect(eval_('!(pc == 0 || pc == 2)', { pc: 0   })).toBe(false);
    expect(eval_('!(pc == 0 || pc == 2)', { pc: 2   })).toBe(false);
  });
  it('二重カッコ', () => {
    expect(eval_('((pc == 256))', { pc: 256 })).toBe(true);
  });
});

describe('複合式', () => {
  it('PC == 0x100 && bus_rd == 1 && bus_wr == 0', () => {
    expect(eval_('pc == 0x100 && bus_rd == 1 && bus_wr == 0', { pc: 0x100, bus_rd: 1 })).toBe(true);
    expect(eval_('pc == 0x100 && bus_rd == 1 && bus_wr == 0', { pc: 0x100, bus_rd: 0 })).toBe(false);
  });
  it('istate == "F1" && bus_rd == 1', () => {
    expect(eval_('istate == "F1" && bus_rd == 1', { istate: 1, bus_rd: 1 })).toBe(true);
    expect(eval_('istate == "F1" && bus_rd == 1', { istate: 2, bus_rd: 1 })).toBe(false);
  });
  it('bus_rd.rising && pc >= 0x100', () => {
    expect(eval_('bus_rd.rising && pc >= 0x100', { bus_rd:1, pc:0x200 }, { bus_rd:0 })).toBe(true);
    expect(eval_('bus_rd.rising && pc >= 0x100', { bus_rd:1, pc:0x0FF }, { bus_rd:0 })).toBe(false);
  });
  it('Cycle == "FETCH" && pc == 0x100', () => {
    const fetchAt100 = { bus_rd:1, addr_p:0x100, pc:0x100, addr_v:0x100 };
    expect(eval_('Cycle == "FETCH" && pc == 0x100', fetchAt100)).toBe(true);
    expect(eval_('Cycle == "FETCH" && pc == 0x200', fetchAt100)).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Part 3: エラーケース
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('パースエラー', () => {
  const PARSE_ERR = [
    ['',             '式が空'],
    ['pc',           '比較演算子がない（識別子だけ）'],
    ['pc ==',        '値がない'],
    ['== 1',         '識別子が必要（先頭が演算子）'],
    ['unknown == 1', '不明な信号名'],
    ['pc == 1 extra','末尾に余分な文字'],
    ['(pc == 1',     ') がない'],
    ['pc == 1)',      '末尾に余分な )'],
    ['bus_rd.fly',   '不正なエッジ指定'],
    ['pc == 0x',     '不正な 16 進リテラル'],
  ];

  for (const [expr, desc] of PARSE_ERR) {
    it(`エラー: ${desc}  (${JSON.stringify(expr)})`, () => {
      expect(() => _trigParse(expr)).toThrow();
    });
  }
});

describe('評価エラー', () => {
  it('仮想信号 Cycle に数値比較 → parse 成功・eval でエラー', () => {
    const ast = _trigParse('Cycle == 1');
    const ring = makeRing(LA_SIGNALS_PDP11, {});
    expect(() => _trigEvalExpr(ast, ring, BASE, PREV_BASE)).toThrow();
  });
  it('仮想信号 Cycle に > 比較 → eval でエラー', () => {
    const ast = _trigParse('Cycle != "FETCH"');  // != はOK
    // > はパーサが通るが eval でエラーになる
    // (仮想信号は == と != のみ対応)
    // ここでは != がOKであることを確認
    const ring = makeRing(LA_SIGNALS_PDP11, {});
    expect(() => _trigEvalExpr(ast, ring, BASE, PREV_BASE)).not.toThrow();
  });
  it('fmt なし信号 (bus_rd) に文字列比較 → eval でエラー', () => {
    const ast  = _trigParse('bus_rd == "foo"');
    const ring = makeRing(LA_SIGNALS_PDP11, { bus_rd: 1 });
    expect(() => _trigEvalExpr(ast, ring, BASE, PREV_BASE)).toThrow();
  });
  it('仮想信号 Cycle にエッジ検出 → eval でエラー', () => {
    // パーサはエッジ構文を許すが eval で virtual チェックに引っかかる
    const ast  = _trigParse('Cycle.rising');
    const ring = makeRing(LA_SIGNALS_PDP11, {});
    expect(() => _trigEvalExpr(ast, ring, BASE, PREV_BASE)).toThrow();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Part 4: trigCompileToWasm テスト（本番評価パス）
//
// 本番の評価フローは _trigEvalExpr ではなく trigCompileToWasm → WASM 実行。
// Part 1-3 は JS eval (旧パス) を検証していたが、ここでは実際の WASM パスを検証する。
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// WASM をインスタンス化して eval 関数を呼び出すヘルパー
// ring[0..8] = cur サンプル、ring[9..17] = prev サンプル
async function evalWasm(expr, cur = {}, prev = {}) {
  const ast  = _trigParse(expr);
  const bytes = trigCompileToWasm(ast);
  const { instance } = await WebAssembly.instantiate(bytes);
  const ring = makeRing(LA_SIGNALS_PDP11, { cur, prev });
  return instance.exports.eval(
    ring[0],  ring[1],  ring[2],  ring[3],  ring[4],
    ring[5],  ring[6],  ring[7],  ring[8],
    ring[9],  ring[10], ring[11], ring[12], ring[13],
    ring[14], ring[15], ring[16], ring[17]
  );
}

// WASM eval の結果を JS eval と照合するヘルパー（差異があればテスト失敗）
async function expectWasmMatchesJs(expr, cur = {}, prev = {}) {
  const jsResult   = eval_(expr, cur, prev);
  const wasmResult = await evalWasm(expr, cur, prev);
  expect(!!wasmResult).toBe(!!jsResult);
}

// ── 4-1: 全数値信号の WASM ヒット / ミス ──────────────────────────────────────
describe('WASM: 全信号単体 — JS eval と一致確認', () => {
  // NUMERIC_SIG_CASES と同じケース（Cycle/ISN/PSW/pri文字列は除く）
  const WASM_SIG_CASES = [
    ['addr_p',    0x1234, 'ADDR_P == 0x1234'],
    ['addr_v',    2060,   'ADDR_V == 0o4014'],
    ['data',      0xABCD, 'data == 0xABCD'],
    ['bus_wr',    1,      'bus_wr == 1'],
    ['bus_rd',    1,      'bus_rd == 1'],
    ['byte_op',   1,      'byte_op == 1'],
    ['pc',        0x0200, 'pc == 0x200'],
    ['pri',       6,      'pri == 6'],         // 数値比較なら WASM 対応
    ['trapped',   1,      'trapped == 1'],
    ['halted',    1,      'halted == 1'],
    ['bus_int',   1,      'bus_int == 1'],
    ['int_vec',   0x14,   'int_vec == 0x14'],
    ['int_ipl',   5,      'int_ipl == 5'],
    ['rk_state',  3,      'rk_state == 3'],
    ['istate',    1,      'istate == 1'],
    ['isn',  0xA0, 'isn == 0xA0'],      // 数値比較は対応（文字列比較は非対応）
    ['psw',  0,    'psw == 0'],         // 数値比較は対応（文字列比較は非対応）
    ['bus_error',  1,     'bus_error == 1'],
    ['nxm_access', 1,     'nxm_access == 1'],
    ['trap_bus',   1,     'trap_bus == 1'],
    ['trap_abort', 1,     'trap_abort == 1'],
    ['trap_odd',   1,     'trap_odd == 1'],
    ['r0',   0x0001, 'r0 == 1'],
    ['r1',   0x0002, 'r1 == 2'],
    ['r2',   0x0003, 'r2 == 3'],
    ['r3',   0x0004, 'r3 == 4'],
    ['r4',   0x0005, 'r4 == 5'],
    ['r5',   0x0006, 'r5 == 6'],
    ['sp',   0x7F00, 'sp == 0x7F00'],
    ['mem_m1', 0xBEEF, 'mem_m1 == 0xBEEF'],
  ];

  for (const [id, val, expr] of WASM_SIG_CASES) {
    it(`${id} ヒット`, async () => {
      await expectWasmMatchesJs(expr, { [id]: val });
    });
    it(`${id} ミス`, async () => {
      await expectWasmMatchesJs(expr, { [id]: 0 });
    });
  }
});

// ── 4-2: 文字列比較（WASM 対応のもの）────────────────────────────────────────
describe('WASM: 文字列比較 — JS eval と一致確認', () => {
  it('istate == "F1" ヒット (値=1)', async () => {
    await expectWasmMatchesJs('istate == "F1"', { istate: 1 });
  });
  it('istate == "F1" ミス (値=0=h1)', async () => {
    await expectWasmMatchesJs('istate == "F1"', { istate: 0 });
  });
  it('istate != "F1" (値=2=c1)', async () => {
    await expectWasmMatchesJs('istate != "F1"', { istate: 2 });
  });
  it('cm == "Kernel" ヒット (値=0)', async () => {
    await expectWasmMatchesJs('cm == "Kernel"', { cm: 0 });
  });
  it('cm == "User" ヒット (値=3)', async () => {
    await expectWasmMatchesJs('cm == "User"', { cm: 3 });
  });
  it('cm != "Kernel" (値=3)', async () => {
    await expectWasmMatchesJs('cm != "Kernel"', { cm: 3 });
  });
});

// ── 4-3: 論理・比較演算子の WASM 検証 ────────────────────────────────────────
describe('WASM: 演算子 — JS eval と一致確認', () => {
  const V = 256; // pc の固定値
  const CUR = { pc: V };

  it('&&: true && true',   async () => await expectWasmMatchesJs('bus_rd == 1 && bus_wr == 0', { bus_rd: 1 }));
  it('&&: true && false',  async () => await expectWasmMatchesJs('bus_rd == 1 && bus_wr == 1', { bus_rd: 1 }));
  it('&&: false && true',  async () => await expectWasmMatchesJs('bus_rd == 0 && bus_wr == 0', { bus_rd: 1 }));
  it('||: false || true',  async () => await expectWasmMatchesJs('bus_rd == 0 || bus_wr == 0', {}));
  it('||: false || false', async () => await expectWasmMatchesJs('bus_rd == 1 || bus_wr == 1', {}));
  it('!: !(true)',         async () => await expectWasmMatchesJs('!(bus_rd == 1)', { bus_rd: 1 }));
  it('!: !(false)',        async () => await expectWasmMatchesJs('!(bus_rd == 1)', { bus_rd: 0 }));

  it('==',  async () => await expectWasmMatchesJs('pc == 256',  CUR));
  it('!=',  async () => await expectWasmMatchesJs('pc != 257',  CUR));
  it('<',   async () => await expectWasmMatchesJs('pc < 257',   CUR));
  it('>',   async () => await expectWasmMatchesJs('pc > 255',   CUR));
  it('<=',  async () => await expectWasmMatchesJs('pc <= 256',  CUR));
  it('>=',  async () => await expectWasmMatchesJs('pc >= 256',  CUR));

  it('.rising: prev=0,cur=1',  async () => await expectWasmMatchesJs('bus_rd.rising',  { bus_rd:1 }, { bus_rd:0 }));
  it('.rising: prev=1,cur=1',  async () => await expectWasmMatchesJs('bus_rd.rising',  { bus_rd:1 }, { bus_rd:1 }));
  it('.falling: prev=1,cur=0', async () => await expectWasmMatchesJs('bus_rd.falling', { bus_rd:0 }, { bus_rd:1 }));
  it('.falling: prev=0,cur=0', async () => await expectWasmMatchesJs('bus_rd.falling', { bus_rd:0 }, { bus_rd:0 }));
  it('.edge: 変化あり',        async () => await expectWasmMatchesJs('bus_rd.edge',    { bus_rd:1 }, { bus_rd:0 }));
  it('.edge: 変化なし',        async () => await expectWasmMatchesJs('bus_rd.edge',    { bus_rd:1 }, { bus_rd:1 }));

  it('カッコ: (a||b)&&c',      async () => await expectWasmMatchesJs('(pc == 256 || bus_rd == 0) && bus_wr == 0', CUR));
  it('複合: pc && rd && !wr',  async () => await expectWasmMatchesJs('pc == 256 && bus_rd == 0 && !(bus_wr == 1)', CUR));
  it('数値リテラル 0x100',      async () => await expectWasmMatchesJs('pc == 0x100', { pc: 256 }));
  it('数値リテラル 0o400',      async () => await expectWasmMatchesJs('pc == 0o400', { pc: 256 }));
  it('数値リテラル 0400',       async () => await expectWasmMatchesJs('pc == 0400',  { pc: 256 }));
});

// ── 4-4: trigCompileToWasm の非対応機能 → throw 確認 ─────────────────────────
// 本番では trigCompileToWasm がエラーを throw するため、ユーザーが式を入力すると
// アラートが出て設定できない。以下のケースは JS eval は成功するが WASM コンパイル不可。
describe('WASM コンパイル非対応: trigCompileToWasm が throw する', () => {
  it('仮想信号 Cycle == "FETCH"', () => {
    const ast = _trigParse('Cycle == "FETCH"');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('仮想信号 CYC (エイリアス)', () => {
    const ast = _trigParse('CYC == "FETCH"');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('ISN 文字列比較: isn == "NOP"', () => {
    const ast = _trigParse('isn == "NOP"');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('PSW 文字列比較: psw == "KKP0....."', () => {
    const ast = _trigParse('psw == "KKP0....."');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('dec フォーマット文字列比較: pri == "6"', () => {
    const ast = _trigParse('pri == "6"');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('oct フォーマット文字列比較: pc == "400"', () => {
    // oct フォーマットも _COMPILE_STR_TO_NUM.oct = null なので非対応
    const ast = _trigParse('pc == "400"');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('Cycle.rising (仮想信号エッジ)', () => {
    const ast = _trigParse('Cycle.rising');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
  it('istate11 以外の無効文字列値: istate == "INVALID"', () => {
    const ast = _trigParse('istate == "INVALID"');
    expect(() => trigCompileToWasm(ast)).toThrow();
  });
});
