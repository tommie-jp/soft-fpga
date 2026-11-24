// sft-lang-toggle.js — ページの右上に出す EN/JA 切り替えボタン (文書ビューアを持たない 01〜05・91 用)
//
// 素の <script src> で読み込む。js/rtlscope-la.js のあと (RTLScopeLA.pickLang で現在の言語を知る)。
// 押すと、言語を localStorage の sft-doc-lang (文書ビューアの EN/JA ボタンと同じ鍵) に覚え、
// URL の ?lang= も替えて読み込み直す。URL が localStorage より優先されるので、URL も替えておかないと戻らない。
//   英語 → ?lang=jp、日本語 → ?lang=en
(function (global) {
  'use strict';

  var STORAGE_KEY = 'sft-doc-lang';

  /** href の ?lang= を、切り替え先の言語 ('ja' | 'en') に替えた URL を返す。ほかの query と hash はそのまま。 */
  function nextHref(href, nextLang) {
    var u = new URL(href);
    u.searchParams.set('lang', nextLang === 'ja' ? 'jp' : 'en');
    return u.toString();
  }

  function mount() {
    if (typeof RTLScopeLA === 'undefined') {
      console.error('[lang-toggle] js/rtlscope-la.js が先に読み込まれていません');
      return null;
    }
    var cur = RTLScopeLA.pickLang();
    var next = cur === 'ja' ? 'en' : 'ja';
    var btn = document.createElement('button');
    btn.id = 'lang-toggle';
    btn.type = 'button';
    btn.textContent = next === 'ja' ? 'JA' : 'EN';
    btn.title = next === 'ja' ? 'Switch the page to Japanese' : '表示を英語にする (Switch the page to English)';
    btn.style.cssText = 'position:fixed;top:6px;right:8px;z-index:1000;min-width:2.6em;opacity:.85;cursor:pointer;';
    btn.addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, next); }
      catch (e) { console.error('[lang-toggle] localStorage 書き込み失敗:', e); }
      location.replace(nextHref(location.href, next));
    });
    document.body.appendChild(btn);
    return btn;
  }

  global.SftLangToggle = { nextHref: nextHref, mount: mount };
  if (typeof document !== 'undefined' && document.body) mount();
})(typeof window !== 'undefined' ? window : globalThis);
