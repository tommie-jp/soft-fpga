'use strict';
// sft-doc-viewer.js — Markdown ドキュメントビューア（共有ライブラリ）
//
// 使用方法:
//   <script src="sft-doc-viewer.js"></script>  ← marked.js より前に読むこと
//   <script src="my-docs.js"></script>
//
//   // my-docs.js
//   var MY_LIST = [{ file: 'foo.md', label: 'Foo' }];
//   var _viewer = new SftDocViewer(MY_LIST, { docsPath: 'docs/' });
//   function openDoc(file) { _viewer.openDoc(file); }
//
// 必要な HTML 構造（id は opts で変更可）:
//   <div id="doc-modal">
//     <div id="doc-overlay"></div>
//     <div>
//       <button id="doc-prev">‹</button>
//       <select id="doc-select"></select>
//       <button id="doc-next">›</button>
//       <button id="doc-close">✕</button>
//       <div id="doc-content"></div>
//     </div>
//   </div>

(function (global) {

  // ── デフォルト CSS (#doc-content スタイル) ──────────────────────────────
  var _CSS =
    '#doc-content{' +
      'flex:1;overflow-y:auto;overflow-x:hidden;padding:16px 24px;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
      'line-height:1.7;font-size:13px;color:#111;' +
      // 長い語・URL・連続英数字がブラウザ幅を超えないよう折り返す
      'overflow-wrap:break-word;word-break:break-word' +
    '}' +
    // 画像はペイン幅に収める（縦横比維持）
    '#doc-content img{max-width:100%;height:auto}' +
    '#doc-content h1{font-size:18px;color:#1a2e78;border-bottom:2px solid #5a7acc;' +
      'padding-bottom:6px;margin-top:0}' +
    '#doc-content h2{font-size:15px;color:#1a4896;border-bottom:1px solid #8aaad8;' +
      'padding-bottom:3px;margin-top:20px;font-weight:700}' +
    '#doc-content h3{font-size:13px;color:#1a5c30;margin-top:14px;font-weight:700}' +
    '#doc-content h4{font-size:12px;color:#6a2a78;margin-top:10px;font-weight:700}' +
    '#doc-content .table-wrap{overflow-x:auto}' +
    '#doc-content table{border-collapse:collapse;min-width:100%;margin:6px 0}' +
    '#doc-content th{background:#ccd8ee;color:#1a2e78}' +
    '#doc-content th,#doc-content td{border:1px solid #aabcd0;padding:3px 8px;' +
      'font-size:12px;text-align:left}' +
    '#doc-content code{background:#e8eef8;color:#960040;padding:1px 4px;' +
      'font-size:12px;border-radius:2px}' +
    '#doc-content pre{background:#f0f4fa;padding:8px 12px;overflow-x:auto;' +
      'border:1px solid #b8cce0;border-radius:3px}' +
    '#doc-content pre code{background:none;padding:0;white-space:pre;color:#111}' +
    '#doc-content blockquote{border-left:3px solid #7a9acc;margin:0;' +
      'padding-left:10px;color:#334}' +
    // ── スマホ幅: パディングを詰め、本文をブラウザ幅に合わせる ──
    '@media (max-width:600px){' +
      '#doc-content{padding:12px 14px;font-size:14px;line-height:1.6}' +
      '#doc-content h1{font-size:17px}' +
      '#doc-content h2{font-size:15px}' +
      '#doc-content pre{font-size:12px}' +
      '#doc-content th,#doc-content td{padding:2px 5px;font-size:11px}' +
    '}';

  function _injectCSS() {
    if (document.getElementById('sft-doc-viewer-style')) return;
    var s = document.createElement('style');
    s.id = 'sft-doc-viewer-style';
    s.textContent = _CSS;
    document.head.appendChild(s);
  }

  // ── SftDocViewer ─────────────────────────────────────────────────────────
  // list    : [{ file: 'foo.md', label: '表示名' }, ...]
  // opts    : {
  //   docsPath  : 'docs/',        // fetch するベースパス（末尾スラッシュ必須）
  //   idModal   : 'doc-modal',    // モーダルルート要素の id
  //   idContent : 'doc-content',  // レンダリング先要素の id
  //   idOverlay : 'doc-overlay',  // オーバーレイ要素の id
  //   idPrev    : 'doc-prev',     // 前へボタンの id
  //   idNext    : 'doc-next',     // 次へボタンの id
  //   idClose   : 'doc-close',    // 閉じるボタンの id
  //   idSelect  : 'doc-select',   // ドロップダウン <select> の id
  // }
  function SftDocViewer(list, opts) {
    opts = opts || {};
    this.list       = list || [];
    this.docsPath   = opts.docsPath  || 'docs/';
    this._idModal   = opts.idModal   || 'doc-modal';
    this._idContent = opts.idContent || 'doc-content';
    this._idOverlay = opts.idOverlay || 'doc-overlay';
    this._idPrev    = opts.idPrev    || 'doc-prev';
    this._idNext    = opts.idNext    || 'doc-next';
    this._idClose   = opts.idClose   || 'doc-close';
    this._idSelect  = opts.idSelect  || 'doc-select';
    this._idx = -1;
    _injectCSS();
    this._populateSelect();
    this._bindListeners();
  }

  SftDocViewer.prototype._el = function (id) {
    return document.getElementById(id);
  };

  SftDocViewer.prototype._populateSelect = function () {
    var sel = this._el(this._idSelect);
    if (!sel) return;
    sel.innerHTML = '';
    for (var i = 0; i < this.list.length; i++) {
      var opt = document.createElement('option');
      opt.value       = this.list[i].file;
      opt.textContent = this.list[i].label;
      sel.appendChild(opt);
    }
  };

  SftDocViewer.prototype._bindListeners = function () {
    var self    = this;
    var sel     = this._el(this._idSelect);
    var prev    = this._el(this._idPrev);
    var next    = this._el(this._idNext);
    var close   = this._el(this._idClose);
    var overlay = this._el(this._idOverlay);

    if (sel)     sel.addEventListener('change', function () { if (sel.value) self.openDoc(sel.value); });
    if (prev)    prev.addEventListener('click',  function () { self.prev(); });
    if (next)    next.addEventListener('click',  function () { self.next(); });
    if (close)   close.addEventListener('click', function () { self.close(); });
    if (overlay) overlay.addEventListener('click', function () { self.close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modal = self._el(self._idModal);
      if (modal && modal.style.display !== 'none') self.close();
    });
  };

  SftDocViewer.prototype.openDoc = function (file) {
    var self = this;
    var idx = -1;
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].file === file) { idx = i; break; }
    }
    this._idx = idx;

    var prev = this._el(this._idPrev);
    var next = this._el(this._idNext);
    var sel  = this._el(this._idSelect);

    if (prev) {
      prev.textContent = idx > 0 ? '‹ ' + this.list[idx - 1].label : '‹';
      prev.disabled    = idx <= 0;
    }
    if (next) {
      var hasNext      = idx >= 0 && idx < this.list.length - 1;
      next.textContent = hasNext ? this.list[idx + 1].label + ' ›' : '›';
      next.disabled    = !hasNext;
    }
    if (sel && idx >= 0) sel.value = file;

    fetch(this.docsPath + file)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (md) {
        var html = marked.parse(md)
          .replace(/<table/g,    '<div class="table-wrap"><table')
          .replace(/<\/table>/g, '</table></div>');
        var content = self._el(self._idContent);
        content.innerHTML = html;
        content.scrollTop = 0;
        var modal = self._el(self._idModal);
        if (modal) modal.style.display = 'flex';
      })
      .catch(function (e) {
        alert('ドキュメントを読み込めませんでした: ' + file + '\n' + e);
      });
  };

  SftDocViewer.prototype.close = function () {
    var modal = this._el(this._idModal);
    if (modal) modal.style.display = 'none';
  };

  SftDocViewer.prototype.prev = function () {
    if (this._idx > 0) this.openDoc(this.list[this._idx - 1].file);
  };

  SftDocViewer.prototype.next = function () {
    if (this._idx >= 0 && this._idx < this.list.length - 1)
      this.openDoc(this.list[this._idx + 1].file);
  };

  global.SftDocViewer = SftDocViewer;

}(window));
