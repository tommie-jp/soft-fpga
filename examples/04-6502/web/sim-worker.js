'use strict';

// 04-6502 シミュレーション Worker（Apple-I / Dormann 共用）
//
// メインスレッドとのやりとり:
//   main → worker  setRunning{running} / setSteps{steps} / setMode{mode,epoch} / reset{running,epoch} / stepInstr /
//                  sendKey{ch} / LA 制御（js/sft-la-glue.js の setupLaWorker と対）
//   worker → main  ready{ringSize,ringWords} / frame{...} / error{message}
//
// 実行の主導権は Worker が持つ。トリガー停止・Dormann のトラップ検出も Worker 側で running を
// 落とし、frame の trigPause / trapped で UI に知らせる。

var Module = {
  onRuntimeInitialized: function () {
    ringSize  = Module._get_ring_size();
    ringWords = Module._get_ring_words();
    ringBase  = Module._get_ring_ptr() >>> 2;   // byte → HEAPU32 index
    Module._sim_init();
    postMessage({ type: 'ready', ringSize: ringSize, ringWords: ringWords });
    loop();
  }
};

importScripts('sim.js');

// ---- 状態 ----
var ringSize      = 0;
var ringWords     = 0;
var ringBase      = 0;
var mode          = 'apple1';   // 'apple1' | 'dormann'
var running       = false;
var stepsPerFrame = 8000;       // 1 フレームあたりのクロック数（index.html のスライダーが送ってくる）
var laEnabled     = true;       // false の間は ring のコピーを省く
var laAck         = 0;          // 処理した LA 制御メッセージ数（frame に載せて main の楽観更新と突き合わせる）
var dirty         = true;       // 停止中でも、状態が変わったら 1 フレームだけ送る
var epoch         = 0;          // main が reset / setMode に付けてくる番号。frame に載せて返し、古いフレームを捨てさせる
var FRAME_MS      = 16;         // 60fps 目標

// ---- 1 フレーム ----
function tick() {
  var trigPause = false;

  if (running) {
    if (mode === 'apple1') {
      Module._sim_run_n(stepsPerFrame);
      if (Module._sim_trigger_hit()) { running = false; trigPause = true; }
    } else {
      Module._step_n(stepsPerFrame);
      if (Module._is_trapped()) {
        running = false;
      } else if (Module._sim_trigger_hit()) {
        running = false;
        trigPause = true;
      }
    }
    dirty = true;
  }

  if (!dirty) return;
  dirty = false;

  // コンソール出力をドレイン（Apple-I のみ。Dormann は PIA を持たない）
  var chars = [];
  var ch;
  while ((ch = Module._get_display_char()) !== -1) chars.push(ch);

  var snap = laEnabled
      ? Module.HEAPU32.subarray(ringBase, ringBase + ringSize * ringWords).slice()
      : new Uint32Array(0);

  postMessage({
    type: 'frame',
    laAck: laAck,
    epoch: epoch,
    head: Module._get_head() >>> 0,
    frozen: !!Module._sim_ring_frozen(),
    trigFireHead: Module._sim_get_trig_fire_head() | 0,
    trigPause: trigPause,
    cycles: Module._get_cycles() >>> 0,
    pc: Module._get_pc() >>> 0,
    a: Module._get_a() >>> 0,
    x: Module._get_x() >>> 0,
    y: Module._get_y() >>> 0,
    sp: Module._get_sp() >>> 0,
    p: Module._get_p() >>> 0,
    state: Module._get_state() >>> 0,
    trapped: !!Module._is_trapped(),
    passed: !!Module._is_passed(),
    running: running,
    chars: chars,
    ringSnap: snap.buffer
  }, [snap.buffer]);
}

// ---- スケジューリング ----
function loop() {
  var t0 = performance.now();
  try {
    tick();
  } catch (e) {
    console.error('[sim-worker] tick:', e);
    running = false;
    postMessage({ type: 'error', message: String(e) });
  }
  setTimeout(loop, Math.max(0, FRAME_MS - (performance.now() - t0)));
}

// ---- main からのメッセージ ----
self.onmessage = function (e) {
  var d = e.data;
  dirty = true;
  switch (d.type) {

    case 'setRunning':
      if (d.running) {
        // トリガーで Freeze 済みなら Thaw して再武装する（そのままでは run_n が即座に打ち切られる）
        if (Module._sim_trigger_hit()) Module._sim_thaw_ring();
        if (mode === 'dormann' && Module._is_trapped()) { running = false; break; }
      }
      running = !!d.running;
      break;

    case 'setSteps':
      stepsPerFrame = Math.max(1, d.steps | 0);
      break;

    case 'setMode':
      mode    = d.mode === 'dormann' ? 'dormann' : 'apple1';
      epoch   = d.epoch | 0;
      running = false;
      if (mode === 'dormann') Module._dormann_init(); else Module._sim_init();
      break;

    case 'reset':
      epoch = d.epoch | 0;
      if (mode === 'dormann') Module._dormann_init(); else Module._reset_sim();
      running = !!d.running;
      break;

    case 'stepInstr':
      running = false;
      Module._step_instruction();
      break;

    case 'sendKey':
      Module._send_key(d.ch | 0);
      break;

    // ── Logic Analyzer 制御（js/sft-la-glue.js の setupLaWorker と対）──
    case 'freezeRing':       Module._sim_freeze_ring();                                   laAck++; break;
    case 'thawRing':         Module._sim_thaw_ring();                                     laAck++; break;
    case 'clearTrigger':     Module._sim_clear_trigger();                                 laAck++; break;
    case 'setPostDelay':     Module._sim_set_post_delay(d.n | 0);                         laAck++; break;
    case 'setEdgeTrigger':   Module._sim_set_edge_trigger(d.word, d.bit, d.dir);          laAck++; break;
    case 'setValueTrigger':  Module._sim_set_value_trigger(d.word, d.mask, d.cmp);        laAck++; break;
    case 'setLA':
      laEnabled = !!d.enabled;
      Module._sim_set_la(laEnabled ? 1 : 0);
      laAck++;
      break;

    default:
      console.warn('[sim-worker] 未知のメッセージ:', d.type);
  }
};
