// sft-book-header.js — 教科書 (tommie-circuit-workbook) から開く動くページに、共通のヘッダーを付ける
//
// 使い方: <body> の直後に 1 行置く。data-page は下の PAGES の鍵。
//   <script src="js/sft-book-header.js" data-page="91-pong"></script>
// スクリプトの位置にヘッダーを差し込む。教科書の中の位置 (パンくず) と、このページを使うほかの題を出す。
// 色はページの背景 (明るい / 暗い) を見て選ぶ。
(function () {
  'use strict';

  const REPO = 'https://github.com/tommie-jp/tommie-circuit-workbook';
  const BOOK = { title: 'FPGA の教科書', titleEn: 'FPGA Textbook (Japanese)', dir: '06-fpga' };
  const CHAPTERS = {
    0: { title: '道具と準備', titleEn: 'Tools and setup', anchor: '第-0-章-道具と準備' },
    4: { title: 'Soft-FPGA ブラウザ編', titleEn: 'Soft-FPGA in the browser', anchor: '第-4-章-soft-fpga-ブラウザ編' },
    11: { title: 'CPU を作る', titleEn: 'Building a CPU', anchor: '第-11-章-cpu-を作る' },
    12: { title: '作品', titleEn: 'Projects', anchor: '第-12-章-作品' },
  };
  // 鍵は動くページ。topics の先頭が、パンくずに出す題 (教科書で先に出てくる題)。
  const PAGES = {
    '01-counter': [
      { id: '0-5', title: '最初の 1 本 — ブラウザの soft-fpga でカウンタの波形を見る', titleEn: 'First project — watch a counter waveform in the browser soft-FPGA', path: '00-tools/05-first-counter-web.md' },
      { id: '4-2', title: 'カウンタの 8 ビットをロジックアナライザの画面で見る', titleEn: 'Watching the counter\'s 8 bits on the logic analyzer screen', path: '04-soft-fpga-web/02-counter-logic-screen.md' },
    ],
    '02-traffic-fsm': [
      { id: '4-4', title: '信号機の状態機械 — 今の状態が図で光る', titleEn: 'Traffic-light state machine — the current state lights up in the diagram', path: '04-soft-fpga-web/04-traffic-fsm.md' },
    ],
    '03-uart': [
      { id: '4-6', title: 'UART のループバックを波形で見る', titleEn: 'UART loopback as waveforms', path: '04-soft-fpga-web/06-uart-loopback.md' },
    ],
    '04-6502': [
      { id: '4-11', title: '6502 の内部を見る — マイクロシーケンサとバス', titleEn: 'Inside the 6502 — microsequencer and bus', path: '04-soft-fpga-web/11-6502-microsequencer-bus.md' },
      { id: '11-7', title: '6502 を読む — Apple-I の wozmon を動かす', titleEn: 'Reading the 6502 — running Apple-I\'s wozmon', path: '11-cpu/07-wozmon.md' },
      { id: '11-8', title: '6502 で Integer BASIC を動かす', titleEn: 'Running Integer BASIC on the 6502', path: '11-cpu/08-integer-basic.md' },
    ],
    '06-8080': [
      { id: '4-12', title: '8080 と CP/M — I/O のバスを見る', titleEn: '8080 and CP/M — watching the I/O bus', path: '04-soft-fpga-web/12-8080-cpm-io-bus.md' },
      { id: '4-14', title: '命令エミュレータに無い信号 — T ステートを数える', titleEn: 'Signals an instruction emulator lacks — counting T-states', path: '04-soft-fpga-web/14-count-t-states.md' },
      { id: '11-9', title: '8080 で CP/M 2.2 を動かす', titleEn: 'Running CP/M 2.2 on the 8080', path: '11-cpu/09-cpm22.md' },
    ],
    '91-pong': [
      { id: '12-3', title: 'Pong — ゲートだけで動くゲーム', titleEn: 'Pong — a game built from gates only', path: '12-projects/03-pong.md' },
    ],
  };

  // 表示言語: 文書ビューア (sft-doc-viewer.js) と同じ判定。既定は英語。
  // 日本語は URL の ?lang=jp (?lang=ja も可)、なければ localStorage の sft-doc-lang。
  function normLang(v) {
    const l = String(v || '').toLowerCase();
    if (l === 'jp' || l === 'ja') return 'ja';
    if (l === 'en') return 'en';
    return null;
  }
  function isEnglish() {
    try {
      const lang = normLang(new URLSearchParams(window.location.search).get('lang')) ||
        normLang(localStorage.getItem('sft-doc-lang'));
      return lang !== 'ja';
    } catch (e) {
      console.error('sft-book-header: 表示言語を読めなかった (英語で表示):', e);
      return true;
    }
  }
  const EN = isEnglish();
  const T = EN
    ? { chapter: function (no, title) { return 'Chapter ' + no + ': ' + title; }, page: 'Live demo',
        navLabel: 'Breadcrumb (position in the textbook)', others: 'Also used in: ', sep: ' · ' }
    : { chapter: function (no, title) { return '第 ' + no + ' 章 ' + title; }, page: '動くページ',
        navLabel: 'パンくずリスト (教科書の中の位置)', others: 'このページを使うほかの題: ', sep: '・' };
  function pick(o, key) { return (EN && o[key + 'En']) || o[key]; }

  const script = document.currentScript;
  const topics = script && PAGES[script.dataset.page];
  if (!topics) {
    console.error('sft-book-header: data-page が PAGES に無い:', script && script.dataset.page);
    return;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { node.append(c); });
    return node;
  }
  function link(href, text) {
    return el('a', { href: href, target: '_blank', rel: 'noopener' }, [text]);
  }
  function topicLink(t) {
    return link(REPO + '/blob/main/' + BOOK.dir + '/' + t.path, t.id + ' ' + pick(t, 'title'));
  }

  // 背景の明るさで色を選ぶ (このページ群には白地と黒地の両方がある)
  function isDarkBackground() {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
    if (!m || (m.length === 4 && Number(m[3]) === 0)) return false;   // 透明 = 既定の白
    const lum = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    return lum < 128;
  }
  const C = isDarkBackground()
    ? { text: '#aaa', link: '#8cf', current: '#eee', line: '#444', sep: '#666' }
    : { text: '#555', link: '#0a58ca', current: '#111', line: '#ccc', sep: '#999' };

  const style = el('style', {}, [[
    '.sft-book-header { font: 13px/1.6 sans-serif; color: ' + C.text + '; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid ' + C.line + '; }',
    '.sft-book-header ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; }',
    '.sft-book-header li + li::before { content: "›"; margin: 0 .5em; color: ' + C.sep + '; }',
    '.sft-book-header a { color: ' + C.link + '; text-decoration: none; }',
    '.sft-book-header a:hover { text-decoration: underline; }',
    '.sft-book-header [aria-current] { color: ' + C.current + '; }',
    '.sft-book-header p { margin: 2px 0 0; }',
  ].join('\n')]);

  const main = topics[0];
  const chapterNo = Number(main.id.split('-')[0]);
  const chapter = CHAPTERS[chapterNo];
  const readme = REPO + '/blob/main/' + BOOK.dir + '/README.md#' + encodeURIComponent(chapter.anchor);
  const crumbs = el('ol', {}, [
    el('li', {}, [link(REPO, 'tommie-circuit-workbook')]),
    el('li', {}, [link(REPO + '/tree/main/' + BOOK.dir, pick(BOOK, 'title'))]),
    el('li', {}, [link(readme, T.chapter(chapterNo, pick(chapter, 'title')))]),
    el('li', {}, [topicLink(main)]),
    el('li', { 'aria-current': 'page' }, [T.page]),
  ]);
  const header = el('header', { class: 'sft-book-header' }, [
    el('nav', { 'aria-label': T.navLabel }, [crumbs]),
  ]);
  if (topics.length > 1) {
    const others = el('p', {}, [T.others]);
    topics.slice(1).forEach(function (t, i) {
      if (i > 0) others.append(T.sep);
      others.append(topicLink(t));
    });
    header.append(others);
  }
  document.head.append(style);
  script.before(header);
})();
