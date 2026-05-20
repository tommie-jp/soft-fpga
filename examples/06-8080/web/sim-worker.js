'use strict';

// Emscripten Module 設定オブジェクト（importScripts の前に定義する）
var Module = {
  onRuntimeInitialized: function () {
    RING_SIZE = Module._get_ring_size();
    ringBase  = Module._get_ring_ptr() >>> 2; // byte ptr → HEAPU32 index
    postMessage({ type: 'ready' });
    scheduleNext();
  }
};

importScripts('sim.js');

// ---- 状態 ----
var RING_SIZE     = 0;
var ringBase      = 0;
var running       = false;
var stepsPerFrame = 100000;

// ---- シミュレーションループ ----
function simLoop() {
  if (running) {
    // stepsPerFrame < 0 は「最高速度」センチネル (applySpeed が -1 を送信)
    var n = stepsPerFrame < 0 ? 100000 : stepsPerFrame;
    for (var i = 0; i < n; i++) Module._step();
  }

  // コンソール出力をドレイン
  var chars = [];
  var ch;
  while ((ch = Module._get_display_char()) !== -1) chars.push(ch & 0x7F);

  var head    = Module._get_head() >>> 0;
  var pc      = Module._get_pc()   >>> 0;
  var dirties = [
    !!Module._sim_get_disk_dirty(0),
    !!Module._sim_get_disk_dirty(1),
    !!Module._sim_get_disk_dirty(2),
    !!Module._sim_get_disk_dirty(3),
  ];

  // ring buffer スナップショット（Transferable で転送）
  var snap = new Uint32Array(RING_SIZE);
  for (var j = 0; j < RING_SIZE; j++) snap[j] = Module.HEAPU32[ringBase + j];

  postMessage(
    { type: 'frame', head: head, pc: pc, chars: chars, dirties: dirties, ringSnap: snap.buffer },
    [snap.buffer]
  );
}

// ---- スケジューリング ----
// 最高速度 (stepsPerFrame < 0): MessageChannel タイトループ
// 固定周波数 (stepsPerFrame >= 0): setTimeout で 16ms フレーム目標
var _mc = new MessageChannel();
_mc.port2.onmessage = function() {
  var t0 = performance.now();
  try {
    simLoop();
  } catch (e) {
    console.error('[Worker] simLoop:', e);
    running = false;
    postMessage({ type: 'error', message: String(e) });
    return; // エラー時は再スケジュールしない
  }
  if (stepsPerFrame < 0) {
    _mc.port1.postMessage(null); // 最高速度: 即時ループ
  } else {
    var delay = Math.max(0, 16 - (performance.now() - t0) | 0);
    setTimeout(scheduleNext, delay); // 固定周波数: ~60fps に抑制
  }
};

function scheduleNext() {
  _mc.port1.postMessage(null);
}

// ---- メインスレッドからのメッセージ ----
self.onmessage = function (e) {
  var data = e.data;
  switch (data.type) {

    case 'setRunning':
      running = data.running;
      break;

    case 'setSteps':
      stepsPerFrame = data.steps;
      break;

    case 'sendKey':
      Module._send_key(data.ch);
      break;

    case 'reset':
      Module._sim_init_disk(data.preset);
      running = (data.running !== undefined) ? data.running : true;
      break;

    case 'loadDisk': {
      var arr = new Uint8Array(data.data);
      var ptr = Module._malloc(arr.length);
      Module.HEAPU8.set(arr, ptr);
      Module._load_disk_drive(data.drive, ptr, arr.length);
      Module._free(ptr);
      break;
    }

    case 'getDiskData': {
      var ptr2 = Module._sim_get_disk_ptr(data.drive) >>> 0;
      var size = Module._sim_get_disk_size(data.drive);
      var copy = new Uint8Array(Module.HEAPU8.buffer, ptr2, size).slice();
      postMessage(
        { type: 'diskData', drive: data.drive, requestId: data.requestId, data: copy.buffer },
        [copy.buffer]
      );
      break;
    }

    case 'clearDirty':
      Module._sim_clear_disk_dirty(data.drive);
      break;

    case 'writeFS': {
      var arr2 = new Uint8Array(data.data);
      try {
        Module.FS.writeFile('/' + data.name, arr2);
        postMessage({ type: 'fsResult', requestId: data.requestId, ok: true });
      } catch (err) {
        postMessage({ type: 'fsResult', requestId: data.requestId, ok: false, error: err.message });
      }
      break;
    }

    case 'readFS': {
      try {
        var fileData = Module.FS.readFile('/' + data.name);
        var fileBuf  = fileData.slice().buffer;
        postMessage(
          { type: 'fsFile', requestId: data.requestId, name: data.name, data: fileBuf },
          [fileBuf]
        );
      } catch (err) {
        postMessage({ type: 'fsResult', requestId: data.requestId, ok: false, error: err.message });
      }
      break;
    }

    case 'listFS': {
      var entries = [];
      try {
        Module.FS.readdir('/').forEach(function (f) {
          if (f === '.' || f === '..') return;
          try {
            var st = Module.FS.stat('/' + f);
            if (Module.FS.isDir(st.mode)) return;
            if (st.size >= 65536) return;
            entries.push({ name: f, size: st.size, mtime: st.mtime });
          } catch (e) {}
        });
      } catch (e) {}
      postMessage({ type: 'fsEntries', requestId: data.requestId, entries: entries });
      break;
    }

    case 'deleteFS': {
      try { Module.FS.unlink('/' + data.name); } catch (e) {}
      postMessage({ type: 'fsResult', requestId: data.requestId, ok: true });
      break;
    }
  }
};
