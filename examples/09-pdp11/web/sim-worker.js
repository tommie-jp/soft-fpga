'use strict';

// PDP-11 / Unix V6 シミュレーション Web Worker
// 06-8080/web/sim-worker.js を参考に PDP-11 向けに簡略化

var Module = {
  onRuntimeInitialized: function () {
    RING_SIZE  = Module._get_ring_size();
    RING_WORDS = Module._get_ring_words();
    ringBase   = Module._get_ring_ptr() >>> 2;  // uint32_t* → HEAPU32 index
    postMessage({ type: 'ready' });
  }
};

importScripts('sim.js');

var RING_SIZE     = 0;
var RING_WORDS    = 4;
var ringBase      = 0;
var running       = false;
var stepsPerFrame = 200000;   // 1 フレームあたりのクロック数

// リング読み取り位置
var lastRingHead = 0;

// --- ディスクイメージを受け取る前に sim_init を遅延させるフラグ ---
var diskReady = false;

function startSim(diskBuffer) {
  // MEMFS にディスクイメージを書き込む
  var data = new Uint8Array(diskBuffer);
  Module.FS.writeFile('/disk0.rk', data);
  diskReady = true;
  Module._sim_init();
  postMessage({ type: 'started' });
  running = true;
  scheduleNext();
}

function scheduleNext() {
  setTimeout(simLoop, 0);
}

function simLoop() {
  if (!running) return;

  var t0 = Date.now();
  Module._step_n(stepsPerFrame);

  // TTY 出力を収集
  var chars = [];
  var ch;
  while ((ch = Module._get_display_char()) !== -1) {
    chars.push(ch & 0x7F);
  }
  if (chars.length > 0) {
    postMessage({ type: 'tty', chars: chars });
  }

  // ring buffer スナップショット（Logic Analyzer 用）
  var head = Module._get_ring_head();
  if (head !== lastRingHead) {
    // 新しいサンプルが追加された範囲を転送
    var startIdx = lastRingHead % RING_SIZE;
    var endIdx   = head % RING_SIZE;
    var u32      = Module.HEAPU32;

    // ダブルバッファリング: ArrayBuffer をコピーして転送
    var count = (head - lastRingHead);
    if (count > RING_SIZE) count = RING_SIZE;  // オーバーフロー対策

    var snap = new Uint32Array(count * RING_WORDS);
    for (var i = 0; i < count; i++) {
      var src = ringBase + ((lastRingHead + i) % RING_SIZE) * RING_WORDS;
      for (var w = 0; w < RING_WORDS; w++) {
        snap[i * RING_WORDS + w] = u32[src + w];
      }
    }
    postMessage({ type: 'ring', head: head, snap: snap.buffer }, [snap.buffer]);
    lastRingHead = head;
  }

  // 速度自動調整（目標 16ms/フレーム）
  var elapsed = Date.now() - t0;
  if (elapsed < 8 && stepsPerFrame < 2000000) {
    stepsPerFrame = Math.min(stepsPerFrame * 1.2 | 0, 2000000);
  } else if (elapsed > 20 && stepsPerFrame > 50000) {
    stepsPerFrame = Math.max(stepsPerFrame * 0.8 | 0, 50000);
  }

  scheduleNext();
}

self.onmessage = function (e) {
  var data = e.data;
  switch (data.type) {
    case 'start':
      startSim(data.disk);
      break;

    case 'key':
      if (running) Module._send_key(data.ch);
      break;

    case 'reset':
      running = false;
      if (diskReady) {
        Module._sim_init();
        running = true;
        lastRingHead = 0;
        scheduleNext();
        postMessage({ type: 'started' });
      }
      break;

    case 'speed':
      stepsPerFrame = data.steps | 0;
      break;

    case 'pause':
      running = false;
      postMessage({ type: 'paused' });
      break;

    case 'resume':
      if (!running && diskReady) {
        running = true;
        scheduleNext();
        postMessage({ type: 'resumed' });
      }
      break;
  }
};
