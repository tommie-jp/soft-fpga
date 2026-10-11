// sft-8080-worker-bridge.js — Web Worker 通信・フレーム受信・RAF 描画ループ
//
// 06-8080 Web UI から分離。Worker 起動・workerSend/workerRequest・onmessage・loop() を持つ。
// loop() の初回起動 requestAnimationFrame(loop) は initUI()（index.html）側で行う。
// グローバル参照: workerReady / running（index の let）, initUI（index の関数）, window.la,
//   updateRegPanel/processRingForIOLog/renderStackView/renderIOLog/renderCallTrace/lastCallLogHead
//   （sft-8080-debug-panel.js）, fmtHz/updateDirtyBtn（sft-8080-fs.js）。
// term はここで `var term` を宣言（グローバル）。initUI() が代入し、各モジュールが参照する。

// ---- Worker セットアップ ----
const RING_SIZE = 4096; // harness.cpp: static const int RING_SIZE = 4096
var term;
var reqId   = 0;
var pending = new Map();

const worker = new Worker('sim-worker.js?v=20260522g');

function workerSend(msg, transferables) {
  if (transferables) worker.postMessage(msg, transferables);
  else               worker.postMessage(msg);
}

function workerRequest(msg, transferables) {
  return new Promise(function(resolve) {
    var id = ++reqId;
    pending.set(id, resolve);
    var m = Object.assign({ requestId: id }, msg);
    if (transferables) worker.postMessage(m, transferables);
    else               worker.postMessage(m);
  });
}

// Worker から受け取るフレームデータ
var pendingChars = [];
var latestFrame  = null;
var frameCount   = 0;
var freqHead0 = 0, freqTime0 = performance.now(), freqDisp = '';
var dirtyState = [false, false, false, false];

// ── マクロ状態表示の更新（worker.onmessage から参照するためトップレベルに配置）──
function setMacroStatus(active, name) {
  var st  = document.getElementById('macro-status');
  var btn = document.getElementById('btn-macro-stop');
  if (!st || !btn) return;
  if (active) {
    st.textContent  = '▶ ' + (name || 'macro');
    st.style.display  = '';
    btn.style.display = '';
  } else {
    st.style.display  = 'none';
    btn.style.display = 'none';
  }
}

worker.onmessage = function(e) {
  var data = e.data;
  if (data.type === 'frame') {
    for (var i = 0; i < data.chars.length; i++) pendingChars.push(data.chars[i]);
    latestFrame = data;
    return;
  }
  if (data.type === 'ready') {
    workerReady = true;
    window.workerReady = true;  // Playwright テスト用
    initUI();
    return;
  }
  if (data.type === 'error') {
    console.error('[Worker]', data.message);
    running = false;
    document.getElementById('btn-run').textContent = 'Run';
    return;
  }
  if (data.type === 'triggerPause') {
    running = false;
    document.getElementById('btn-run').textContent = 'Run';
    return;
  }
  if (data.type === 'scriptStarted') {
    setMacroStatus(true, data.name);
    return;
  }
  if (data.type === 'scriptEnded') {
    setMacroStatus(false);
    return;
  }
  if (data.type === 'scriptError') {
    setMacroStatus(false);
    setTimeout(function() { term.write('\r\n\x1b[31m' + (data.msg || 'script error') + '\x1b[0m\r\n'); }, 80);
    return;
  }
  if (data.type === 'scriptWarn') {
    setTimeout(function() { term.write('\r\n\x1b[33m[warn] ' + (data.msg || 'script warning') + '\x1b[0m\r\n'); }, 80);
    return;
  }
  if (data.requestId && pending.has(data.requestId)) {
    pending.get(data.requestId)(data);
    pending.delete(data.requestId);
  }
};

// ---- RAF ループ（描画専用）----
function loop() {
  if (term && pendingChars.length) {
    term.write(String.fromCharCode.apply(null, pendingChars));
    pendingChars = [];
  }
  if (latestFrame) {
    var f = latestFrame; latestFrame = null;

    // ── レジスタ / 逆アセンブル更新 ──
    if (f.regs && f.pcBytes) {
      var regs8    = new Uint8Array(f.regs);
      var pcBytes3 = new Uint8Array(f.pcBytes);
      updateRegPanel(regs8, pcBytes3);
    }

    // ── フリーズバッジ ──
    var frozenBadge = document.getElementById('r-frozen-badge');
    if (frozenBadge) frozenBadge.style.display = f.frozen ? 'inline' : 'none';

    frameCount++;
    if (frameCount % 60 === 0) {
      var now = performance.now();
      var dc  = f.frozen ? 0 : (f.head - freqHead0) >>> 0;
      var dt  = now - freqTime0;
      freqDisp  = f.frozen ? 'frozen'
                : (running && dt > 0 ? fmtHz(Math.round(dc / (dt / 1000))) : 'paused');
      freqHead0 = f.head;
      freqTime0 = now;
      dirtyState = f.dirties;
      for (var d = 0; d < 4; d++) updateDirtyBtn(d, f.dirties[d]);
    }
    document.getElementById('cycle-info').textContent = freqDisp;

    // ── Ring Analyzer 描画 ──
    var ring32 = new Uint32Array(f.ringSnap);
    if (ring32.length > 0) {
      la.update(f.head, ring32, f.frozen,
                f.trigFireHead !== undefined ? f.trigFireHead : -1);
    }

    // ── I/O ログ更新 ──
    if (ring32.length > 0) processRingForIOLog(ring32, f.head >>> 0);

    // ── デバッグパネル更新 ──
    if (f.stackBytes && f.regs) {
      var regs8s = new Uint8Array(f.regs);
      var sp = ((regs8s[8] << 8) | regs8s[9]) & 0xFFFF;
      renderStackView(new Uint8Array(f.stackBytes), sp);
    }
    renderIOLog();
    if (f.callLog) {
      var cl32 = new Uint32Array(f.callLog);
      renderCallTrace(cl32, f.callLogHead);
      lastCallLogHead = f.callLogHead;
    }
  }
  requestAnimationFrame(loop);
}
