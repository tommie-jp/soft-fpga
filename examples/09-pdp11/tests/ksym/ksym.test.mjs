/**
 * ksym.test.mjs — a.out シンボル表の読み取りと、スタックフレームの鎖・Stack パネル表示モデルの単体テスト
 */
import { describe, it, expect } from 'vitest';
import {
  v6ParseNamelist, v6TextSymbols, v6NearestSym, v6FmtSym, pdp11WalkFrames, pdp11StackView,
} from './helpers/load-ksym.mjs';

const TYPE_ABS = 0o41, TYPE_TEXT_EXT = 0o42, TYPE_TEXT_LOCAL = 0o2, TYPE_BSS_EXT = 0o44;

/** テスト用の a.out を作る（text/data は 0 埋め）。 */
function makeAout({ text = 4, data = 2, syms = [], noReloc = 1, magic = 0o407 } = {}) {
  const body  = (text + data) * (noReloc ? 1 : 2);
  const bytes = new Uint8Array(16 + body + syms.length * 12);
  const put   = (off, v) => { bytes[off] = v & 0xFF; bytes[off + 1] = (v >> 8) & 0xFF; };
  put(0, magic); put(2, text); put(4, data); put(8, syms.length * 12); put(14, noReloc);
  syms.forEach(([name, type, value], i) => {
    const off = 16 + body + i * 12;
    for (let k = 0; k < name.length && k < 8; k++) bytes[off + k] = name.charCodeAt(k);
    put(off + 8, type); put(off + 10, value);
  });
  return bytes;
}

const SYMS = [
  ['_swtch', TYPE_TEXT_EXT, 0o15562],
  ['_newproc', TYPE_TEXT_EXT, 0o16026],
  ['cret', TYPE_TEXT_EXT, 0o3602],
  ['_u', TYPE_ABS, 0o140000],
  ['_proc', TYPE_BSS_EXT, 0o62646],
  ['loop', TYPE_TEXT_LOCAL, 0o15622],
];

describe('v6ParseNamelist', () => {
  it('再配置情報なしの a.out からシンボルを全部読む', () => {
    // Arrange
    const bytes = makeAout({ syms: SYMS });
    // Act
    const syms = v6ParseNamelist(bytes);
    // Assert
    expect(syms).toHaveLength(SYMS.length);
    expect(syms[0]).toEqual({ name: '_swtch', type: TYPE_TEXT_EXT, value: 0o15562 });
    expect(syms[1].name).toBe('_newproc');   // 8 文字ちょうど（NUL 終端なし）
  });

  it('再配置情報ありのときは、その分だけシンボル表が後ろにずれる', () => {
    const syms = v6ParseNamelist(makeAout({ syms: SYMS, noReloc: 0 }));
    expect(syms.map(s => s.name)).toEqual(SYMS.map(s => s[0]));
  });

  it('a.out でないデータ・短すぎるデータは空配列を返す', () => {
    expect(v6ParseNamelist(makeAout({ syms: SYMS, magic: 0o123 }))).toEqual([]);
    expect(v6ParseNamelist(new Uint8Array(8))).toEqual([]);
    expect(v6ParseNamelist(null)).toEqual([]);
  });

  it('シンボル表の大きさがファイルを超えていても、ある分だけ読む', () => {
    const bytes = makeAout({ syms: SYMS }).slice(0, 16 + 6 + 12 * 2 + 5);
    expect(v6ParseNamelist(bytes)).toHaveLength(2);
  });
});

describe('v6TextSymbols / v6NearestSym / v6FmtSym', () => {
  const table = v6TextSymbols(v6ParseNamelist(makeAout({ syms: SYMS })));

  it('テキストのシンボルだけを番地順に並べ、C の名前の先頭 _ を外す', () => {
    expect(table).toEqual([
      { addr: 0o3602, name: 'cret' },
      { addr: 0o15562, name: 'swtch' },
      { addr: 0o15622, name: 'loop' },
      { addr: 0o16026, name: 'newproc' },
    ]);
  });

  it('同じ番地にローカル名と C の名前があれば C の名前を残す', () => {
    const t = v6TextSymbols([
      { name: 'start', type: TYPE_TEXT_LOCAL, value: 0o100 },
      { name: '_main', type: TYPE_TEXT_EXT, value: 0o100 },
    ]);
    expect(t).toEqual([{ addr: 0o100, name: 'main' }]);
  });

  it('番地以下で最も近いシンボルとオフセットを返す', () => {
    expect(v6NearestSym(table, 0o16012)).toEqual({ name: 'loop', off: 0o16012 - 0o15622 });
    expect(v6NearestSym(table, 0o15562)).toEqual({ name: 'swtch', off: 0 });
    expect(v6NearestSym(table, 0o177776)).toEqual({ name: 'newproc', off: 0o177776 - 0o16026 });
  });

  it('最初のシンボルより前・空の表は null', () => {
    expect(v6NearestSym(table, 0o3600)).toBeNull();
    expect(v6NearestSym([], 0o100)).toBeNull();
  });

  it('"名前+8進オフセット" に整形し、遠すぎれば空文字にする', () => {
    expect(v6FmtSym(table, 0o16030)).toBe('newproc+2');
    expect(v6FmtSym(table, 0o3602)).toBe('cret');
    expect(v6FmtSym(table, 0o16030, 1)).toBe('');
    expect(v6FmtSym(table, 0o100)).toBe('');
  });
});

describe('pdp11WalkFrames', () => {
  // 141606 → 141622 → 141640 と鎖がつながったスタック（値は実測の一部）
  const mem = {
    0o141606: 0o141622, 0o141610: 0o14442,
    0o141622: 0o141640, 0o141624: 0o45716,
    0o141640: 0, 0o141642: 0o20510,
  };
  const read = (va) => (va in mem ? mem[va] : -1);

  it('R5 の鎖を、保存された R5 が増えなくなるまでたどる', () => {
    expect(pdp11WalkFrames(read, 0o141606)).toEqual([
      { fp: 0o141606, savedFp: 0o141622, ret: 0o14442 },
      { fp: 0o141622, savedFp: 0o141640, ret: 0o45716 },
      { fp: 0o141640, savedFp: 0, ret: 0o20510 },
    ]);
  });

  it('奇数番地・読めない番地・範囲外では止まる', () => {
    expect(pdp11WalkFrames(read, 0o141607)).toEqual([]);
    expect(pdp11WalkFrames(read, 0o100000)).toEqual([]);
    expect(pdp11WalkFrames(read, 0o141606, { hi: 0o141620 })).toHaveLength(1);
  });

  it('maxFrames で打ち切る（鎖が輪になっていても止まる）', () => {
    const loop = (va) => (va === 0o1000 ? 0o2000 : va === 0o2000 ? 0o3000 : va === 0o3000 ? 0o4000 : 0o10);
    expect(pdp11WalkFrames(loop, 0o1000, { maxFrames: 2 })).toHaveLength(2);
  });
});

describe('pdp11StackView', () => {
  const table = [{ addr: 0o14252, name: 'sleep' }, { addr: 0o15562, name: 'swtch' }];
  const mem = {
    mode: 0, curMode: 0, base: 0o141602, sp: 0o141602, r5: 0o141606, pc: 0o16012,
    words: [0o30300, 0o63230, 0o141622, 0o14442],
    frames: [{ fp: 0o141606, savedFp: 0o141622, ret: 0o14442 }],
  };

  it('SP・R5・フレームの置き場に印を付け、戻り番地にシンボルを付ける', () => {
    const v = pdp11StackView(mem, table);
    expect(v.pcSym).toBe('swtch+230');
    expect(v.chain).toEqual([{ fp: 0o141606, ret: 0o14442, sym: 'sleep+170' }]);
    expect(v.rows.map(r => r.marks)).toEqual([['SP'], [], ['R5', 'fp'], ['ret']]);
    expect(v.rows[3]).toEqual({ va: 0o141610, val: 0o14442, marks: ['ret'], sym: 'sleep+170' });
    expect(v.rows[1].sym).toBe('');   // 戻り番地の置き場でない語にはシンボルを付けない
  });

  it('User モードの表示にはカーネルのシンボルを付けない', () => {
    const v = pdp11StackView({ ...mem, mode: 3, curMode: 3 }, table);
    expect(v.pcSym).toBe('');
    expect(v.chain[0].sym).toBe('');
  });

  it('動いていないモードを見ているときは SP・R5 の印を付けない', () => {
    const v = pdp11StackView({ ...mem, mode: 0, curMode: 3, frames: [] }, table);
    expect(v.rows.every(r => r.marks.length === 0)).toBe(true);
    expect(v.pcSym).toBe('');
  });

  it('入力のメッセージを書き換えない', () => {
    const frozen = JSON.parse(JSON.stringify(mem));
    pdp11StackView(mem, table);
    expect(mem).toEqual(frozen);
  });
});
