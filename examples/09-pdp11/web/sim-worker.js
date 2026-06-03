'use strict';

// PDP-11 / Unix V6 Web Worker (Phase 3)
// rtlscope-la.js は index.html 側で動作するため、Worker では ring buffer を
// スナップショットとして転送するだけ。

var Module = {
  onRuntimeInitialized: function () {
    RING_SIZE  = Module._get_ring_size();
    RING_WORDS = Module._get_ring_words();
    ringBase   = Module._get_ring_ptr() >>> 2;  // uint32_t* → HEAPU32 index
    postMessage({ type: 'ready', ringBase: ringBase,
                  ringSize: RING_SIZE, ringWords: RING_WORDS });
    scheduleNext();
  }
};

importScripts('sim.js');

var RING_SIZE     = 0;
var RING_WORDS    = 5;
var ringBase      = 0;
var running       = false;
var stepsPerFrame = 200000;
var lastRingHead  = 0;

// ── ディスク初期化 ────────────────────────────────────────────────────────
var diskReady = false;

function startSim(diskBuffer) {
  var data = new Uint8Array(diskBuffer);
  Module.FS.writeFile('/disk0.rk', data);
  diskReady = true;
  Module._sim_init();
  lastRingHead = 0;
  postMessage({ type: 'started' });
  running = true;
  scheduleNext();
  // fake_uart.v の fake_init_delay(8M クロック) に相当する待機後に
  // 'rkunix\r' を自動送信してスタンドアロンブートを起動する
  setTimeout(_autoBootV6, 3000);
}

function _autoBootV6() {
  if (!diskReady || !running) return;
  var cmd = 'rkunix\r';
  for (var i = 0; i < cmd.length; i++) Module._send_key(cmd.charCodeAt(i));
}

// ── シミュレーションループ ────────────────────────────────────────────────
function scheduleNext() { setTimeout(simLoop, 0); }

function simLoop() {
  if (!running) return;

  var t0 = Date.now();
  Module._step_n(stepsPerFrame);

  // TTY 出力
  var chars = [];
  var ch;
  while ((ch = Module._get_display_char()) !== -1) chars.push(ch & 0x7F);
  if (chars.length > 0) postMessage({ type: 'tty', chars: chars });

  // トリガーヒット確認
  if (Module._sim_trigger_hit && Module._sim_trigger_hit()) {
    running = false;
    var pc = Module._get_pc ? Module._get_pc() : 0;
    postMessage({ type: 'triggered', pc: pc });
    // ring buffer を最終スナップショットとして転送
    _sendRing();
    return;
  }

  // ring buffer スナップショット転送
  _sendRing();

  // フレームレート自動調整
  var elapsed = Date.now() - t0;
  if (elapsed < 8  && stepsPerFrame < 2000000) stepsPerFrame = Math.min(stepsPerFrame * 1.2 | 0, 2000000);
  if (elapsed > 22 && stepsPerFrame > 50000)   stepsPerFrame = Math.max(stepsPerFrame * 0.8 | 0, 50000);

  scheduleNext();
}

function _sendRing() {
  var head = Module._get_ring_head() >>> 0;  // uint32 → unsigned JS number
  if (head === lastRingHead) return;

  var count = (head - lastRingHead) >>> 0;   // unsigned subtraction
  if (count > RING_SIZE) count = RING_SIZE;

  var snap = new Uint32Array(count * RING_WORDS);
  var u32  = Module.HEAPU32;
  for (var i = 0; i < count; i++) {
    var src = ringBase + ((lastRingHead + i) >>> 0) % RING_SIZE * RING_WORDS;
    for (var w = 0; w < RING_WORDS; w++) {
      snap[i * RING_WORDS + w] = u32[src + w];
    }
  }
  postMessage({ type: 'ring', head: head, snap: snap.buffer }, [snap.buffer]);
  lastRingHead = head;
}

// ── メッセージハンドラ ────────────────────────────────────────────────────
self.onmessage = function (e) {
  var d = e.data;
  switch (d.type) {
    case 'start':
      startSim(d.disk);
      break;

    case 'key':
      if (running || diskReady) Module._send_key(d.ch);
      break;

    case 'reset':
      running = false;
      if (diskReady) {
        Module._sim_init();
        lastRingHead = 0;
        running = true;
        postMessage({ type: 'started' });
        scheduleNext();
      }
      break;

    case 'pause':
      running = false;
      postMessage({ type: 'paused' });
      break;

    case 'resume':
      if (!running && diskReady) {
        if (Module._sim_clear_trigger) Module._sim_clear_trigger();
        running = true;
        postMessage({ type: 'resumed' });
        scheduleNext();
      }
      break;

    case 'set_trigger':
      if (Module._sim_set_pc_trigger) Module._sim_set_pc_trigger(d.pc >>> 0);
      break;

    case 'clear_trigger':
      if (Module._sim_clear_trigger) Module._sim_clear_trigger();
      break;

    case 'speed':
      stepsPerFrame = d.steps | 0;
      break;
  }
};
