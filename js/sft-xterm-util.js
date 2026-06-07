'use strict';

/**
 * SftTerminalUI — ターミナル COPY/PASTE/Ctrl ボタン共通ライブラリ
 *
 * opts:
 *   term        {Terminal}      xterm.js インスタンス
 *   sendKey     {function(ch)}  文字コード 1 つを送信するコールバック
 *   isActive    {function()}    送信可否を返す関数（省略時は常に true）
 *   flashBtn    {function(id)}  ボタン点滅エフェクトのコールバック（省略可）
 *   pasteDelay  {number}        貼り付け時の文字間隔 ms（デフォルト 50）
 */
function SftTerminalUI(opts) {
  var term       = opts.term;
  var sendKey    = opts.sendKey;
  var isActive   = opts.isActive   || function() { return true; };
  var flashBtn   = opts.flashBtn   || function() {};
  var pasteDelay = opts.pasteDelay != null ? opts.pasteDelay : 50;

  var self = this;

  // ── ペースト送出（CR/LF 正規化 + ペーシング） ────────────────────────────
  this.doPaste = function(text) {
    if (!text || !isActive()) return;
    var chars = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code === 0x0A && i > 0 && text.charCodeAt(i - 1) === 0x0D) continue;
      if (code === 0x0A) code = 0x0D;
      chars.push(code);
    }
    var idx = 0;
    function _next() {
      if (idx >= chars.length) return;
      sendKey(chars[idx++]);
      setTimeout(_next, pasteDelay);
    }
    _next();
  };

  // ── ペーストダイアログ（動的生成・ダークテーマ） ─────────────────────────
  this.showPasteDialog = function() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);'
      + 'display:flex;align-items:center;justify-content:center;';
    ov.innerHTML =
      '<div style="background:#1e1e1e;border-radius:6px;padding:14px 16px;min-width:320px;'
      + 'max-width:90vw;box-shadow:0 4px 24px rgba(0,0,0,.8);font-size:13px;color:#ddd;">'
      + '<div style="margin-bottom:8px;">ペーシング送信（1文字 / ' + pasteDelay + 'ms、文字化けしません）<br>'
      + '<span style="font-size:11px;color:#aaa;">\\n は自動的に \\r (Enter) へ変換されます。</span></div>'
      + '<textarea id="_sft-ptd-ta" rows="5"'
      + ' style="width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;'
      + 'background:#111;border:1px solid #555;padding:6px;resize:vertical;color:#eee;"'
      + ' placeholder="ここに Ctrl+V で貼り付け"></textarea>'
      + '<div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">'
      + '<button id="_sft-ptd-ok"  style="padding:3px 16px;cursor:pointer;'
      + 'background:#333;border:1px solid #666;color:#eee;border-radius:3px;">Send</button>'
      + '<button id="_sft-ptd-can" style="padding:3px 16px;cursor:pointer;'
      + 'background:#333;border:1px solid #666;color:#eee;border-radius:3px;">Cancel</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    var ta  = ov.querySelector('#_sft-ptd-ta');
    var ok  = ov.querySelector('#_sft-ptd-ok');
    var can = ov.querySelector('#_sft-ptd-can');
    ta.focus();
    function close() {
      if (!document.body.contains(ov)) return;
      document.body.removeChild(ov);
      if (term) term.focus();
    }
    ok.addEventListener('click', function() { var t = ta.value; close(); self.doPaste(t); });
    can.addEventListener('click', close);
    ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
    ov.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ok.click();
    });
  };

  // ── COPY ボタン設定 ───────────────────────────────────────────────────────
  this.setupCopyBtn = function(id) {
    document.getElementById(id).addEventListener('click', function() {
      var sel = term.getSelection ? term.getSelection() : '';
      if (!sel) { if (term) term.focus(); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sel).then(function() {
          if (term.clearSelection) term.clearSelection();
          flashBtn(id);
          if (term) term.focus();
        }).catch(function() {
          window.prompt('選択テキスト（Ctrl+C でコピー）:', sel);
          if (term) term.focus();
        });
      } else {
        window.prompt('選択テキスト（Ctrl+C でコピー）:', sel);
        if (term) term.focus();
      }
    });
  };

  // ── PASTE ボタン設定 ──────────────────────────────────────────────────────
  this.setupPasteBtn = function(id) {
    document.getElementById(id).addEventListener('click', function() {
      if (!isActive()) return;
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function(text) {
          if (text) {
            self.doPaste(text);
            flashBtn(id);
          } else {
            self.showPasteDialog();
          }
          if (term) term.focus();
        }).catch(function() {
          self.showPasteDialog();
        });
      } else {
        self.showPasteDialog();
      }
    });
  };

  // ── Ctrl ボタン設定（data-ch 属性） ───────────────────────────────────────
  // opts.clearOnInterrupt: ^C(3) / ^Z(26) 押下時に呼ぶ関数
  this.setupCtrlBtns = function(selector, ctrlOpts) {
    var clearFn = ctrlOpts && ctrlOpts.clearOnInterrupt;
    document.querySelectorAll(selector).forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!isActive()) return;
        var code = parseInt(btn.dataset.ch);
        if (clearFn && (code === 3 || code === 26)) clearFn();
        sendKey(code);
        if (term) term.focus();
      });
    });
  };
}
