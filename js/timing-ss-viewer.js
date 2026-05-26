/**
 * timing-ss-viewer.js — タイミング図スクリーンショットビューアーライブラリ
 *
 * 使い方:
 *   TimingSSViewer.init(container, data);
 *
 * data 形式:
 *   {
 *     runs: {
 *       "timing-YYYY-MM-DD-HHMM": ["00-nop.png", "01-add-b.png", ...],
 *       ...
 *     }
 *   }
 *
 * container 内に以下の要素を生成する:
 *   #tsv-bar        — ナビゲーションバー（3カラムグリッド）
 *   #tsv-img-wrap   — 画像表示エリア
 *
 * URL パラメーター:
 *   ?run=timing-YYYY-MM-DD-HHMM&i=0
 *
 * キーボード操作（select 非フォーカス時のみ有効）:
 *   ← / PgUp  — 前へ
 *   → / PgDn  — 次へ
 *   Home      — 最初へ
 *   End       — 最後へ
 */

/* global */ const TimingSSViewer = (() => {
  'use strict';

  // ── ユーティリティ ───────────────────────────────────────────────────────

  /** "00-nop.png" → "00 NOP" */
  function label(filename) {
    const stem = filename.replace(/\.png$/, '');
    const m = stem.match(/^(\d+)-(.+)$/);
    if (!m) return stem;
    return m[1] + ' ' + m[2].toUpperCase().replace(/-/g, ' ');
  }

  // ── DOM 生成 ─────────────────────────────────────────────────────────────

  function buildDOM(container) {
    container.innerHTML = [
      '<div id="tsv-bar">',
      '  <div class="tsv-bar-left">',
      '    <button id="tsv-btn-ll" title="最初へ (Home)">&#x00AB;</button>',
      '    <button id="tsv-btn-l"  title="前へ (← / PgUp)">&#x2039;</button>',
      '  </div>',
      '  <div class="tsv-bar-center">',
      '    <select id="tsv-case-sel" title="ケースを選択"></select>',
      '    <span   id="tsv-counter"></span>',
      '  </div>',
      '  <div class="tsv-bar-right">',
      '    <button id="tsv-btn-r"  title="次へ (→ / PgDn)">&#x203A;</button>',
      '    <button id="tsv-btn-rr" title="最後へ (End)">&#x00BB;</button>',
      '    <a id="tsv-raw-link"  class="tsv-bar-link" href="#"          target="_blank" rel="noopener">PNG ↗</a>',
      '    <a id="tsv-back-link" class="tsv-bar-link" href="index.html">▤ Gallery</a>',
      '  </div>',
      '</div>',
      '<div id="tsv-img-wrap">',
      '  <img id="tsv-main-img" alt="">',
      '</div>',
    ].join('\n');
  }

  // ── 初期化 ───────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} container - ビューアーを挿入する要素
   * @param {{ runs: Record<string, string[]> }} data - 画像データ
   */
  function init(container, data) {
    buildDOM(container);

    const runs    = data.runs || {};
    const runKeys = Object.keys(runs);

    const params = new URLSearchParams(location.search);
    let runKey = params.get('run') || '';
    let idx    = parseInt(params.get('i') || '0', 10);

    if (!runKey || !runs[runKey]) runKey = runKeys[0] || '';

    function images() { return runs[runKey] || []; }

    // ── ドロップダウン ─────────────────────────────────────────────────

    function populateSelect() {
      const sel = document.getElementById('tsv-case-sel');
      sel.innerHTML = '';
      images().forEach((fn, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = label(fn);
        sel.appendChild(opt);
      });
    }

    // ── レンダリング ───────────────────────────────────────────────────

    function render() {
      const imgs = images();
      const fn   = imgs[idx] || '';
      const src  = runKey + '/' + fn;

      document.getElementById('tsv-main-img').src         = src;
      document.getElementById('tsv-case-sel').value        = idx;
      document.getElementById('tsv-counter').textContent   = (idx + 1) + ' / ' + imgs.length;
      document.getElementById('tsv-raw-link').href         = src;
      document.getElementById('tsv-btn-ll').disabled       = (idx === 0);
      document.getElementById('tsv-btn-l' ).disabled       = (idx === 0);
      document.getElementById('tsv-btn-r' ).disabled       = (idx === imgs.length - 1);
      document.getElementById('tsv-btn-rr').disabled       = (idx === imgs.length - 1);
      document.title = '[' + (idx + 1) + '/' + imgs.length + '] ' + label(fn) + ' — Timing SS';
    }

    // ── ナビゲーション ─────────────────────────────────────────────────

    function navigate(newIdx) {
      idx = Math.max(0, Math.min(images().length - 1, newIdx));
      render();
      history.replaceState(
        null, '',
        '?run=' + encodeURIComponent(runKey) + '&i=' + idx
      );
    }

    // ── イベントリスナー ───────────────────────────────────────────────

    document.getElementById('tsv-btn-ll').addEventListener('click', () => navigate(0));
    document.getElementById('tsv-btn-l' ).addEventListener('click', () => navigate(idx - 1));
    document.getElementById('tsv-btn-r' ).addEventListener('click', () => navigate(idx + 1));
    document.getElementById('tsv-btn-rr').addEventListener('click', () => navigate(images().length - 1));

    // ドロップダウン: 選択後に blur() でキーボード操作を即座に有効化
    document.getElementById('tsv-case-sel').addEventListener('change', e => {
      navigate(parseInt(e.target.value, 10));
      e.target.blur();
    });

    // キーボード: select フォーカス中は無効化して select 内操作と干渉しない
    document.addEventListener('keydown', e => {
      if (document.activeElement === document.getElementById('tsv-case-sel')) return;
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { navigate(idx - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { navigate(idx + 1); e.preventDefault(); }
      if (e.key === 'Home') { navigate(0);                 e.preventDefault(); }
      if (e.key === 'End')  { navigate(images().length - 1); e.preventDefault(); }
    });

    // ── 初期描画 ───────────────────────────────────────────────────────

    populateSelect();
    render();
  }

  return { init };
})();
