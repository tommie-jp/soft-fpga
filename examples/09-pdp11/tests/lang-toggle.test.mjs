/**
 * lang-toggle.test.mjs — js/sft-lang-toggle.js の切り替え先 URL の組み立てを検証する (DOM なし)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const JS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../js');
const win = {};
new Function('window', readFileSync(path.join(JS, 'sft-lang-toggle.js'), 'utf8'))(win);
const { nextHref } = win.SftLangToggle;

describe('nextHref', () => {
  it('lang が無い URL に、日本語なら lang=jp を足す', () => {
    expect(nextHref('https://x.test/03-uart/', 'ja')).toBe('https://x.test/03-uart/?lang=jp');
  });
  it('英語なら lang=en にする', () => {
    expect(nextHref('https://x.test/03-uart/', 'en')).toBe('https://x.test/03-uart/?lang=en');
  });
  it('lang=jp が付いた URL を英語へ替える', () => {
    expect(nextHref('https://x.test/p/?lang=jp', 'en')).toBe('https://x.test/p/?lang=en');
  });
  it('ほかの query と hash を残す', () => {
    expect(nextHref('https://x.test/p/?doc=2&lang=en#top', 'ja')).toBe('https://x.test/p/?doc=2&lang=jp#top');
  });
});
