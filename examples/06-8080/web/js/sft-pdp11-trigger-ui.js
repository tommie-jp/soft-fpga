'use strict';
// sft-pdp11-trigger-ui.js — トリガー設定 UI・式トリガー履歴・Playwright テスト API
//
// 依存（実行時に解決されるグローバル）:
//   worker / simStarted / simPaused / _laFreezeHead / _trigArmed / setStatus
//   （sft-pdp11-worker-bridge.js — 本ファイルより先に読み込むこと）,
//   la（index.html）, PDP11_KNOWN_PCS / _trigParse（sft-pdp11-la-defs.js /
//   trigger-expr.js）, trigCompileToWasm（trigger-expr-compiler.js）,
//   window._initTrigExprCM / _trigExprView（index.html の CodeMirror module）

// ── トリガープリセットプルダウン ─────────────────────────────────────────
(function() {
  var sel = document.getElementById('trig-preset');
  PDP11_KNOWN_PCS.forEach(function(k) {
    var opt = document.createElement('option');
    opt.value = k.pc.toString(8);
    opt.textContent = k.label + ' (0o' + k.pc.toString(8) + ')';
    opt.title = k.tip;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function() {
    if (sel.value) document.getElementById('trig-pc').value = sel.value;
    sel.value = '';
  });
})();

// ── トリガーボタン有効/無効 ───────────────────────────────────────────────
function _updateTrigButtons() {
  var btnSet  = document.getElementById('btn-trig-set');
  var isActive = _trigArmed || _laFreezeHead >= 0;
  btnSet.disabled = !simStarted;
  btnSet.classList.toggle('on', isActive);
  document.getElementById('btn-trig-resume').disabled = _laFreezeHead < 0;
}

// ── 式トリガー履歴（localStorage、最大 10 件）──────────────────────────
var _EXPR_HIST_KEY      = 'pdp11_expr_hist';
var _EXPR_HIST_DEFAULTS = [
  'VA == 06 && Mode == "USER" && ISN==0o60001',
];
window._loadExprHistory = function _loadExprHistory() {
  try {
    var h = JSON.parse(localStorage.getItem(_EXPR_HIST_KEY) || '[]');
    if (!Array.isArray(h) || h.length === 0) return _EXPR_HIST_DEFAULTS.slice();
    return h;
  } catch(e) { return _EXPR_HIST_DEFAULTS.slice(); }
};
function _saveExprHistory(expr) {
  if (!expr) return;
  var h = _loadExprHistory().filter(function(e) { return e !== expr; });
  h.unshift(expr);
  if (h.length > 10) h.length = 10;
  try { localStorage.setItem(_EXPR_HIST_KEY, JSON.stringify(h)); } catch(e) {}
}
window._renderExprHistory = function _renderExprHistory() {
  var sel = document.getElementById('trig-expr-hist');
  if (!sel) return;
  var h = window._loadExprHistory();
  sel.innerHTML = '<option value="" disabled selected>— 履歴 —</option>';
  h.forEach(function(expr) {
    var opt = document.createElement('option');
    opt.value = expr; opt.textContent = expr;
    sel.appendChild(opt);
  });
  sel.value = '';
};

// ── トリガー発火表示 ──────────────────────────────────────────────────────
function hideTrigHit() {
  document.getElementById('trig-hit').classList.remove('show');
}
// Playwright テスト用: PC trigger 発火 PC（null = 未発火）
window._pdp11TriggeredPC  = null;
window._pdp11BareReady    = false;
window._pdp11BareStepped  = false;

var _TRIG_LABELS = { 1: 'PC', 2: 'Fetch', 3: 'I/O', 4: 'TRAP', 5: 'BUSERR', 6: 'PC+Data', 7: 'Expr' };

function onTriggered(pc, trigType) {
  simPaused = true;
  window._pdp11TriggeredPC = pc;  // Playwright 検出用
  document.getElementById('btn-pause').textContent = 'Resume';
  var kind  = _TRIG_LABELS[trigType] || 'PC';
  var pcStr = '0o' + pc.toString(8);
  setStatus('Triggered: ' + kind + ' @ PC=' + pcStr);
  var el = document.getElementById('trig-hit');
  el.textContent = '⏸ Triggered! ' + kind + ' @ PC=' + pcStr;
  el.classList.add('show');
}

// Playwright テスト用: LA 表示信号をプログラムから設定する
window.pdp11SetSignals = function(ids) {
  if (!window.la) return;
  la._signals.forEach(function(s) { la._sigVisible[s.id] = false; });
  ids.forEach(function(id) { la._sigVisible[id] = true; });
  la._updateCanvas();
};

// Playwright テスト用: LA ズームを設定する（ズーム倍率の値を直接受け取る）
// LA_ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64]
window.pdp11SetZoom = function(z) {
  if (!window.la) return;
  var LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
  var idx = LEVELS.indexOf(z);
  if (idx >= 0) {
    la.setZoom(idx);
  } else {
    la._zoom = z;
    la._updateCanvas();
  }
  var lbl = document.getElementById('la-zoom-lbl');
  if (lbl) lbl.textContent = la.zoomLabel || (z + 'x');
};

// Playwright / sim_api.py 互換: Logic Analyzer キャンバスを PNG DataURL で返す
window.sim = window.sim || {};
window.sim.screenshotCanvas = function(selector) {
  var canvas = document.querySelector(selector || '#la');
  if (!canvas || canvas.tagName !== 'CANVAS')
    throw new Error('[sim.screenshotCanvas] canvas not found: ' + (selector || '#la'));
  return canvas.toDataURL('image/png');
};

// trig-type 変更: PC / DATA 入力行の表示切り替え
// 種別 1(PC) と 6(PC+データ) は VA 入力が必要。6 はさらに DATA 入力も表示する。
var _trigTypeEl = document.getElementById('trig-type');
_trigTypeEl.addEventListener('change', function() {
  var v = this.value;
  document.getElementById('trig-pc-row').style.display =
    (v === '1' || v === '6') ? '' : 'none';
  document.getElementById('trig-data-row').style.display =
    (v === '6') ? '' : 'none';
  document.getElementById('trig-expr-row').style.display =
    (v === '7') ? '' : 'none';
  if (v === '7') {
    if (window._initTrigExprCM) window._initTrigExprCM();
    if (window._renderExprHistory) window._renderExprHistory();
  } else {
    if (window._trigExprView) {
      window._exprSavedContent = window._trigExprView.state.doc.toString();
      window._trigExprView.destroy();
      window._trigExprView = null;
    }
  }
});
_trigTypeEl.dispatchEvent(new Event('change')); // デフォルト種別(Expr)の UI 初期化
window._renderExprHistory(); // 初期化時に履歴セレクトを描画

// ── 式トリガー 履歴セレクト ────────────────────────────────────────────
document.getElementById('trig-expr-hist').addEventListener('change', function() {
  var v = this.value;
  if (!v) return;
  if (window._trigExprView) {
    var view = window._trigExprView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
  } else {
    window._exprSavedContent = v;
  }
  this.value = '';
});

function _doClearTrigger() {
  _laFreezeHead = -1;
  _trigArmed = false;
  worker.postMessage({ type: 'clear_trigger' });
  _updateTrigButtons();
  hideTrigHit();
  setStatus(simPaused ? 'Paused' : 'Running');
}
document.getElementById('btn-trig-set').addEventListener('click', function() {
  if (_trigArmed || _laFreezeHead >= 0) { _doClearTrigger(); return; }
  var trigType = parseInt(document.getElementById('trig-type').value, 10);
  var trigVal  = 0;
  var lbl      = '?';
  _laFreezeHead = -1;
  _trigArmed = false;
  if (trigType === 7) {
    var exprStr = (window._trigExprView ? window._trigExprView.state.doc.toString() : '').trim();
    if (!exprStr) return;
    var ast;
    try {
      ast = _trigParse(exprStr);
    } catch(e) {
      alert('式パースエラー: ' + e.message);
      return;
    }
    var wasmBytes;
    try {
      wasmBytes = trigCompileToWasm(ast);
    } catch(e) {
      alert('式コンパイルエラー: ' + e.message + '\n\n数値比較を使用してください（例: VA == 06 の代わりに VA == 6）');
      return;
    }
    // ring_tick_mask = 0（毎 tick サンプリング）に自動切り替え
    document.getElementById('la-sample-sel').value = '0';
    worker.postMessage({ type: 'set_ring_tick_mask', mask: 0 });
    // Wasm バイナリを Worker に送り、同期インスタンス化させる
    var bytesCopy = new Uint8Array(wasmBytes).buffer;  // transferable コピー
    worker.postMessage({ type: 'set_expr_trigger', wasmBytes: bytesCopy }, [bytesCopy]);
    _saveExprHistory(exprStr);
    window._renderExprHistory();
    _trigArmed = true;
    _updateTrigButtons();
    setStatus('Trigger set (Wasm): ' + exprStr);
    hideTrigHit();
    return;
  }
  if (trigType === 1) {
    var raw = document.getElementById('trig-pc').value.trim();
    if (!raw) return;
    trigVal = parseInt(raw, 8);
    if (isNaN(trigVal)) { alert('8 進数で入力してください（例: 4014）'); return; }
    lbl = 'PC=0o' + trigVal.toString(8);
  } else if (trigType === 6) {
    // VA(下位16bit) + opcode(上位16bit) をパックする
    var rawVa = document.getElementById('trig-pc').value.trim();
    var rawOp = document.getElementById('trig-data').value.trim();
    if (!rawVa || !rawOp) return;
    var va = parseInt(rawVa, 8);
    var op = parseInt(rawOp, 8);
    if (isNaN(va) || isNaN(op)) { alert('VA・DATA とも 8 進数で入力してください'); return; }
    trigVal = (((op & 0xFFFF) << 16) | (va & 0xFFFF)) >>> 0;
    lbl = 'PC=0o' + va.toString(8) + ' DATA=0o' + op.toString(8);
  } else if (trigType === 2) {
    trigVal = 1;  // istate f1 = 1
    lbl = 'istate=f1';
  } else {
    var _l = { 3: 'I/O ページ', 4: 'TRAP', 5: 'BUSERR' };
    lbl = _l[trigType] || '?';
  }
  worker.postMessage({ type: 'set_trigger', trigType: trigType, val: trigVal });
  _trigArmed = true;
  _updateTrigButtons();
  setStatus('Trigger set: ' + lbl);
  hideTrigHit();
});

document.getElementById('btn-trig-resume').addEventListener('click', function() {
  hideTrigHit();
  worker.postMessage({ type: 'resume' });
  // ボタン状態は 'resumed' メッセージ受信時に更新される
});
