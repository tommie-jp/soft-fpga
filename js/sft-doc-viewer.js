'use strict';
// sft-doc-viewer.js — Markdown document viewer (shared library)
//
// Usage:
//   <script src="sft-doc-viewer.js"></script>  ← load before marked.js
//   <script src="my-docs.js"></script>
//
//   // my-docs.js
//   var MY_LIST = [{ file: 'foo.md', label: 'Foo', fileEn: 'foo.md', labelEn: 'Foo' }];
//   var _viewer = new SftDocViewer(MY_LIST, { docsPath: 'docs/', docsPathEn: 'docs/en/' });
//   function openDoc(file) { _viewer.openDoc(file); }
//
// Required HTML structure (ids configurable via opts):
//   <div id="doc-modal">
//     <div id="doc-overlay"></div>
//     <div>
//       <button id="doc-prev">‹</button>
//       <select id="doc-select"></select>
//       <button id="doc-next">›</button>
//       <button id="doc-lang-btn">JA</button>   ← optional language toggle
//       <button id="doc-close">✕ Close</button>
//       <div id="doc-content"></div>
//     </div>
//   </div>

(function (global) {

  // ── Default CSS (#doc-content styles) ───────────────────────────────────
  var _CSS =
    '#doc-content{' +
      'flex:1;overflow-y:auto;overflow-x:hidden;padding:16px 24px;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
      'line-height:1.7;font-size:13px;color:#111;' +
      'overflow-wrap:break-word;word-break:break-word' +
    '}' +
    '#doc-content img{max-width:100%;height:auto}' +
    '#doc-content h1{font-size:18px;color:#1a2e78;border-bottom:2px solid #5a7acc;' +
      'padding-bottom:6px;margin-top:0;' +
      'display:flex;justify-content:space-between;align-items:baseline}' +
    '#doc-content .qr-link{font-size:11px;color:#8899cc;text-decoration:none;' +
      'flex-shrink:0;margin-left:10px;font-weight:normal}' +
    '#doc-content .qr-link:hover{color:#5a7acc;text-decoration:underline}' +
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

  // ── SftDocViewer ──────────────────────────────────────────────────────────
  // list    : [{ file: 'foo.md', label: '表示名', fileEn: 'foo.md', labelEn: 'Label' }, ...]
  // opts    : {
  //   docsPath   : 'docs/',        // fetch base path for JA docs (trailing slash required)
  //   docsPathEn : 'docs/en/',     // fetch base path for EN docs (trailing slash required)
  //   idModal    : 'doc-modal',
  //   idContent  : 'doc-content',
  //   idOverlay  : 'doc-overlay',
  //   idPrev     : 'doc-prev',
  //   idNext     : 'doc-next',
  //   idClose    : 'doc-close',
  //   idSelect   : 'doc-select',
  //   idLangBtn  : 'doc-lang-btn', // optional language toggle button id
  //   useHash    : false,          // true = use ?doc= query param for deep links
  // }
  function SftDocViewer(list, opts) {
    opts = opts || {};
    this.list         = list || [];
    this.docsPath     = opts.docsPath    || 'docs/';
    this._docsPathEn  = opts.docsPathEn  || this.docsPath + 'en/';
    this._idModal     = opts.idModal     || 'doc-modal';
    this._idContent   = opts.idContent   || 'doc-content';
    this._idOverlay   = opts.idOverlay   || 'doc-overlay';
    this._idPrev      = opts.idPrev      || 'doc-prev';
    this._idNext      = opts.idNext      || 'doc-next';
    this._idClose     = opts.idClose     || 'doc-close';
    this._idSelect    = opts.idSelect    || 'doc-select';
    this._idLangBtn   = opts.idLangBtn   || null;
    this._useHash     = !!opts.useHash;
    this._idx         = -1;
    try {
      var _urlLang = new URLSearchParams(window.location.search).get('lang');
      this._lang = _urlLang || localStorage.getItem('sft-doc-lang') || 'ja';
    } catch (e) { this._lang = 'ja'; }
    _injectCSS();
    this._populateSelect();
    this._bindListeners();
    if (this._useHash)   this._bindHash();
    if (this._idLangBtn) this._bindLangBtn();
  }

  SftDocViewer.prototype._el = function (id) {
    return document.getElementById(id);
  };

  SftDocViewer.prototype._getLabel = function (i) {
    return (this._lang === 'en' && this.list[i].labelEn)
      ? this.list[i].labelEn
      : this.list[i].label;
  };

  SftDocViewer.prototype._populateSelect = function () {
    var sel = this._el(this._idSelect);
    if (!sel) return;
    sel.innerHTML = '';
    for (var i = 0; i < this.list.length; i++) {
      var opt = document.createElement('option');
      opt.value       = this.list[i].file;
      opt.textContent = this._getLabel(i);
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

  SftDocViewer.prototype._bindHash = function () {
    var self = this;
    function _open() {
      // ?doc= query param takes priority (iOS camera app strips #)
      var qp = new URLSearchParams(window.location.search).get('doc');
      if (qp) {
        try { qp = decodeURIComponent(qp); } catch (e) {}
        self.openDoc(qp);
        return;
      }
      var hash = window.location.hash.slice(1);
      if (!hash) return;
      try { hash = decodeURIComponent(hash); } catch (e) {}
      self.openDoc(hash);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _open);
    } else {
      _open();
    }
    window.addEventListener('hashchange', _open);
  };

  SftDocViewer.prototype._bindLangBtn = function () {
    var self = this;
    var btn = this._el(this._idLangBtn);
    if (!btn) return;
    btn.textContent = this._lang.toUpperCase();
    btn.addEventListener('click', function () {
      var newLang = self._lang === 'en' ? 'ja' : 'en';
      self.setLang(newLang);
    });
  };

  SftDocViewer.prototype.setLang = function (lang) {
    this._lang = lang;
    try { localStorage.setItem('sft-doc-lang', lang); } catch (e) {}
    var btn = this._idLangBtn ? this._el(this._idLangBtn) : null;
    if (btn) btn.textContent = lang.toUpperCase();
    this._populateSelect();
    if (this._idx >= 0) this.openDoc(this.list[this._idx].file);
  };

  SftDocViewer.prototype.openDoc = function (file) {
    var self = this;
    var idx = -1;
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].file === file) { idx = i; break; }
    }
    this._idx = idx;
    if (this._useHash && file) {
      history.replaceState(null, '', '?doc=' + encodeURIComponent(file));
    }

    var prev = this._el(this._idPrev);
    var next = this._el(this._idNext);
    var sel  = this._el(this._idSelect);

    if (prev) {
      prev.textContent = idx > 0 ? '‹ ' + this._getLabel(idx - 1) : '‹';
      prev.disabled    = idx <= 0;
    }
    if (next) {
      var hasNext      = idx >= 0 && idx < this.list.length - 1;
      next.textContent = hasNext ? this._getLabel(idx + 1) + ' ›' : '›';
      next.disabled    = !hasNext;
    }
    if (sel && idx >= 0) sel.value = file;

    // Choose fetch path based on current language
    var useEn     = (this._lang === 'en' && idx >= 0 && this.list[idx].fileEn);
    var fetchPath = useEn
      ? this._docsPathEn + this.list[idx].fileEn
      : this.docsPath + file;
    var jaPath    = this.docsPath + file;

    fetch(fetchPath)
      .then(function (r) {
        if (!r.ok) {
          // Fall back to JA when EN file is missing
          if (useEn && r.status === 404) return fetch(jaPath).then(function (r2) {
            if (!r2.ok) throw new Error('HTTP ' + r2.status);
            return r2.text();
          });
          throw new Error('HTTP ' + r.status);
        }
        return r.text();
      })
      .then(function (md) {
        var html = marked.parse(md)
          .replace(/<table/g,    '<div class="table-wrap"><table')
          .replace(/<\/table>/g, '</table></div>');
        var content = self._el(self._idContent);
        content.innerHTML = html;
        // marked v9 does not generate heading ids — add them for TOC anchors
        content.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) {
          if (!h.id) {
            h.id = h.textContent.trim().toLowerCase()
              .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
          }
        });
        content.querySelectorAll('a').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (href.charAt(0) === '#') {
            // TOC anchor: scroll within doc-content, no navigation
            a.addEventListener('click', function (e) {
              e.preventDefault();
              var id = href.slice(1);
              var target = content.querySelector('#' + CSS.escape(id));
              if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return;
          }
          if (href.charAt(0) === '?' && href.indexOf('doc=') !== -1) {
            // Internal doc link: open within viewer
            a.addEventListener('click', function (e) {
              e.preventDefault();
              var docFile = new URLSearchParams(href.slice(1)).get('doc');
              if (docFile) self.openDoc(docFile);
            });
            return;
          }
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener');
        });
        content.scrollTop = 0;
        var modal = self._el(self._idModal);
        if (modal) modal.style.display = 'flex';
      })
      .catch(function (e) {
        alert('Failed to load document: ' + file + '\n' + e);
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
