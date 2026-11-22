'use strict';
// sft-pdp11-stack-panel.js — Stack / Memory パネル
//
// 止めた時点（トリガー・Pause・Hold・Step）と、動いている間の約 250 ms ごとに、
// スタックまたは任意の仮想アドレスから語を並べて見せる。R5 の鎖（C の呼び出し履歴）も出す。
// 読むのは RAM の中身だけで、バスサイクルは起こさない（LA の波形には写らない）。
//
// 依存（グローバル）:
//   worker（sft-pdp11-worker-bridge.js）, oct6 / oct4 / MODE_NAMES（sft-pdp11-debug-panel.js）,
//   pdp11StackView（sft-pdp11-ksym.js）
// 公開:
//   updateStackPanel(msg)   Worker の 'mem' を受けて描く
//   setKernelSyms(msg)      Worker の 'ksyms' を受けてシンボル表を持つ
//   onStackSimStarted()     シミュレーション開始・リセット後に設定を送り直す

var STACK_WORDS = 32;                 // 並べる語数
var _stackSyms     = [];              // [{ addr, name }]（番地順）
var _stackSymFile  = null;            // シンボル表を読んだファイル（'/rkunix' など）
var _stackSymAsked = false;
var _stackLastMsg  = null;

function _stackPanelOpen() {
  var panel = document.getElementById('stack-panel');
  return !!panel && !panel.classList.contains('collapsed');
}

// 入力欄（8 進。空なら SP）を読む。不正なら null。
function _stackReadBase() {
  var raw = document.getElementById('stack-base').value.trim();
  if (raw === '' || raw.toUpperCase() === 'SP') return 'sp';
  if (!/^[0-7]{1,6}$/.test(raw)) return null;
  var v = parseInt(raw, 8);
  return (v > 0xFFFF) ? null : v;
}

function _stackSendView() {
  var input = document.getElementById('stack-base');
  if (!_stackPanelOpen()) {
    worker.postMessage({ type: 'set_mem_view', enabled: false });
    return;
  }
  var base = _stackReadBase();
  input.classList.toggle('invalid', base === null);
  if (base === null) return;          // 直すまで前の表示のままにする
  var modeSel = document.getElementById('stack-mode').value;
  worker.postMessage({ type: 'set_mem_view', enabled: true, base: base, count: STACK_WORDS,
                       mode: (modeSel === 'auto') ? 'auto' : parseInt(modeSel, 10) });
  if (!_stackSymAsked) { _stackSymAsked = true; worker.postMessage({ type: 'get_ksyms' }); }
}

function setKernelSyms(msg) {
  _stackSyms    = msg.syms || [];
  _stackSymFile = msg.file || null;
  if (msg.error) console.warn('[stack] ' + msg.error);
  if (_stackLastMsg) updateStackPanel(_stackLastMsg);
}

function onStackSimStarted() {
  _stackSymAsked = false;             // ディスクを替えたかもしれないので取り直す
  _stackSendView();
}

function _stackEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateStackPanel(msg) {
  _stackLastMsg = msg;
  if (!_stackPanelOpen()) return;
  var view = pdp11StackView(msg, _stackSyms);

  var info = MODE_NAMES[msg.mode] +
    '  KISA6 ' + oct4(msg.kisa6) +
    '  PC ' + oct6(msg.pc) + (view.pcSym ? ' ' + view.pcSym : '') +
    '  SP ' + oct6(msg.sp) + '  R5 ' + oct6(msg.r5);
  document.getElementById('stack-info').textContent = info;

  // 呼び出しの鎖: いまの関数 ← 戻り先 ← その戻り先 …
  var chainEl = document.getElementById('stack-chain');
  if (view.chain.length === 0) {
    chainEl.innerHTML = '<div class="stack-empty">' +
      (msg.mode === msg.curMode ? 'no frame' : 'only for the running mode') + '</div>';
  } else {
    chainEl.innerHTML = view.chain.map(function (f, i) {
      return '<div class="stack-row">' +
        '<span class="stack-idx">#' + i + '</span>' +
        '<span class="stack-va">' + oct6(f.fp) + '</span>' +
        '<span class="stack-val">' + oct6(f.ret) + '</span>' +
        '<span class="stack-sym">' + _stackEsc(f.sym) + '</span></div>';
    }).join('');
  }

  var wordsEl = document.getElementById('stack-words');
  wordsEl.innerHTML = view.rows.map(function (r) {
    var cls = 'stack-row' + (r.marks.indexOf('SP') >= 0 ? ' is-sp' : '') +
                            (r.marks.indexOf('R5') >= 0 ? ' is-r5' : '');
    var note = r.marks.join(' ') + (r.sym ? ' ' + r.sym : '');
    return '<div class="' + cls + '">' +
      '<span class="stack-va">' + oct6(r.va) + '</span>' +
      '<span class="stack-val">' + (r.val < 0 ? '------' : oct6(r.val)) + '</span>' +
      '<span class="stack-sym">' + _stackEsc(note) + '</span></div>';
  }).join('');

  var src = document.getElementById('stack-symsrc');
  src.textContent = (msg.mode === 0 && _stackSymFile) ? 'symbols: ' + _stackSymFile : '';
}

(function () {
  var btn   = document.getElementById('btn-stack-collapse');
  var panel = document.getElementById('stack-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', function () {
    panel.classList.toggle('collapsed');
    _stackSendView();
  });
  document.getElementById('stack-mode').addEventListener('change', _stackSendView);
  document.getElementById('stack-base').addEventListener('change', function () {
    document.getElementById('stack-preset').value = '';
    _stackSendView();
  });
  document.getElementById('stack-preset').addEventListener('change', function () {
    if (this.value === '') return;
    document.getElementById('stack-base').value = (this.value === 'sp') ? '' : this.value;
    // u 領域（140000 番台）はカーネルの番地なので、モードも Kernel に合わせる
    if (this.value !== 'sp') document.getElementById('stack-mode').value = '0';
    _stackSendView();
  });
})();
