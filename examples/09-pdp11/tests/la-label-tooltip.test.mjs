/**
 * la-label-tooltip.test.mjs — LA の信号名ツールチップの純粋関数と、全ページの信号定義の name を検証する。
 *
 * DOM は使わない。js/rtlscope-la.js を偽の window に読み込み、RTLScopeLA の静的関数
 * (tr / pickLang / laneIndex / formatName / tipContent) を呼ぶ。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const JS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../js');

function loadLib() {
  const win = {};
  new Function('window', readFileSync(path.join(JS, 'rtlscope-la.js'), 'utf8'))(win);
  return win.RTLScopeLA;
}
const LA = loadLib();

describe('tr / pickLang', () => {
  it('文字列はそのまま返す', () => expect(LA.tr('球', 'en')).toBe('球'));
  it('{ ja, en } は言語で選ぶ', () => {
    const v = { ja: '球', en: 'Ball' };
    expect(LA.tr(v, 'ja')).toBe('球');
    expect(LA.tr(v, 'en')).toBe('Ball');
  });
  it('足りない言語は ja → en の順に探す', () => {
    expect(LA.tr({ ja: '球' }, 'en')).toBe('球');
    expect(LA.tr({ en: 'Ball' }, 'ja')).toBe('Ball');
  });
  it('未定義は空文字', () => { expect(LA.tr(undefined, 'ja')).toBe(''); expect(LA.tr(null, 'en')).toBe(''); });
  it('設定の言語を ja / en に丸める', () => {
    expect(LA.pickLang('en-US')).toBe('en');
    expect(LA.pickLang('EN')).toBe('en');
    expect(LA.pickLang('ja')).toBe('ja');
    expect(LA.pickLang('fr')).toBe('ja');
  });
});

describe('laneIndex (ラベル欄の縦位置 → レーン番号)', () => {
  // 信号域 = 300 - 18 (マーカー) - 2 × 14 (上下のルーラー) = 254 px、1 レーン 25.4 px。描画 (_draw) と同じ式
  const g = { laH: 300, markerLaneH: 18, rulerH: 14, decOff: 0, n: 10 };
  it('最初のレーンの境目', () => {
    expect(LA.laneIndex(14, g)).toBe(0);
    expect(LA.laneIndex(39.3, g)).toBe(0);
    expect(LA.laneIndex(39.5, g)).toBe(1);
  });
  it('最後のレーン', () => expect(LA.laneIndex(267.9, g)).toBe(9));
  it('上の T ルーラーと下の端は対象外', () => {
    expect(LA.laneIndex(5, g)).toBe(-1);
    expect(LA.laneIndex(13.9, g)).toBe(-1);
    expect(LA.laneIndex(268, g)).toBe(-1);
    expect(LA.laneIndex(290, g)).toBe(-1);
  });
  it('デコードレーンがあると、その分だけ下がる', () => {
    const d = { ...g, decOff: 22 };            // 信号域 232 px、1 レーン 23.2 px
    expect(LA.laneIndex(14 + 22 - 1, d)).toBe(-1);   // デコードレーンの中
    expect(LA.laneIndex(14 + 22, d)).toBe(0);
  });
  it('信号が 0 本なら -1', () => expect(LA.laneIndex(50, { ...g, n: 0 })).toBe(-1));
});

describe('formatName / tipContent', () => {
  it('形式名', () => {
    expect(LA.formatName({ type: 'bit' }, {})).toBe('Bin');
    expect(LA.formatName({ type: 'hex', fmt: 'dec' }, {})).toBe('Dec');
    expect(LA.formatName({ type: 'hex', fmt: 'oct' }, {})).toBe('Oct');
    expect(LA.formatName({ type: 'hex', fmt: 'state' }, { state: () => '' })).toBe('state');
    expect(LA.formatName({ type: 'hex' }, {})).toBe('Hex');
  });
  const sig = { label: 'bx', width: 8, type: 'hex', fmt: 'dec', name: { ja: '球の横位置', en: 'Ball X' }, tip: '説明' };
  it('日本語', () => {
    expect(LA.tipContent(sig, 'ja', {})).toEqual({ title: 'bx  球の横位置', meta: '8 ビット · Dec', body: '説明' });
  });
  it('英語', () => {
    const c = LA.tipContent(sig, 'en', {});
    expect(c.title).toBe('bx  Ball X');
    expect(c.meta).toBe('8 bit · Dec');
  });
  it('name が無い / label と同じなら、タイトルは信号名だけ', () => {
    expect(LA.tipContent({ label: 'rst', type: 'bit', width: 1 }, 'ja', {}).title).toBe('rst');
    expect(LA.tipContent({ label: 'rst', type: 'bit', width: 1, name: 'rst' }, 'ja', {}).title).toBe('rst');
  });
  it('tip が無ければ body は空', () => expect(LA.tipContent({ label: 'x', type: 'bit' }, 'ja', {}).body).toBe(''));
  it('英語の tip を { ja, en } で持てる', () => {
    expect(LA.tipContent({ label: 'x', type: 'bit', tip: { ja: '日', en: 'en' } }, 'en', {}).body).toBe('en');
  });
});

describe('全ページの信号定義の name', () => {
  const files = readdirSync(JS).filter((f) => /^sft-.*-la-defs\.js$/.test(f));
  it('定義ファイルが見つかる', () => expect(files.length).toBeGreaterThanOrEqual(7));
  for (const f of files) {
    it(`${f}: すべての信号に ja と en の name がある`, () => {
      const ctx = vm.createContext({});
      const src = readFileSync(path.join(JS, f), 'utf8');
      // 信号の配列は、ファイルごとに名前が違う (XXX_LA_SIGNALS / LA_SIGNALS_XXX)。GROUPS・PRESETS は除く
      const names = [...src.matchAll(/^(?:var|const|let)\s+(\w*SIGNALS\w*)\s*=/gm)].map((m) => m[1]);
      expect(names.length, `${f}: 信号の配列が見つからない`).toBe(1);
      vm.runInContext(src + `\nthis.__sigs = ${names[0]};`, ctx);
      const sigs = ctx.__sigs;
      expect(sigs.length).toBeGreaterThan(0);
      for (const s of sigs) {
        expect(s.name, `${f}: ${s.id}`).toBeTruthy();
        expect(typeof s.name.ja, `${f}: ${s.id}.ja`).toBe('string');
        expect(typeof s.name.en, `${f}: ${s.id}.en`).toBe('string');
        expect(s.name.ja.length, `${f}: ${s.id}.ja`).toBeGreaterThan(0);
        expect(s.name.en.length, `${f}: ${s.id}.en`).toBeGreaterThan(0);
      }
    });
  }
});
