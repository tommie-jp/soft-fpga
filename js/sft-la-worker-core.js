// sft-la-worker-core.js — Logic Analyzer 付き example の Worker 共通部分
//
// 各 example の sim-worker.js は「1 フレーム進める」「例固有の値を frame に載せる」「例固有のメッセージを
// 受ける」だけを書き、実行ループ・ring のスナップショット送信・LA 制御・トリガー停止はここに任せる。
// メインスレッド側は js/sft-la-glue.js の setupLaWorker() / openLaWorker() が対になる。
//
// 使い方（examples/NN/web/sim-worker.js）:
//
//   var Module = {
//     onRuntimeInitialized: function () {
//       Module._sim_init();
//       SftLaWorker.start(Module, {
//         stepsPerFrame: 60,                        // 既定の 1 フレームあたりクロック数
//         run:      function (n) { Module._sim_run_n(n); },       // 必須。実行中の各フレームで呼ばれる
//         fields:   function () { return { cycles: ... }; },       // 任意。frame に足す値
//         finished: function () { return !!Module._is_trapped(); },// 任意。true なら実行を止める（トラップなど）
//         canRun:   function () { return true; },                  // 任意。false の間は Run を受け付けない
//         onMessage: function (d, worker) { ...; return true; }    // 任意。例固有のメッセージ。処理したら true
//       });
//     }
//   };
//   importScripts('sim.js');
//   importScripts('js/sft-la-worker-core.js');     // ← Module の後。onRuntimeInitialized は非同期なので間に合う
//
// worker（onMessage の第 2 引数）: setRunning(on) / markDirty() / setEpoch(n) / isRunning()
//
// プロトコル（main → worker）:
//   setRunning{running} / setSteps{steps} / freezeRing / thawRing / clearTrigger / setPostDelay{n} /
//   setEdgeTrigger{word,bit,dir} / setValueTrigger{word,mask,cmp} / setLA{enabled}  … これらはここで処理する
//   それ以外は onMessage へ渡す
// プロトコル（worker → main）:
//   ready{ringSize,ringWords} / error{message} /
//   frame{laAck, epoch, head, frozen, trigFireHead, trigPause, running, ringSnap(ArrayBuffer), ...fields()}
//
// 約束:
//   - トリガー停止（ring.hit）で running を落とし、そのフレームだけ trigPause=true を載せる。
//   - 停止中は、メッセージで状態が変わったときだけ frame を送る（ring の転送を省く）。
//   - setRunning(true) はトリガー停止中なら Thaw して再武装する（そのままでは run が即座に打ち切られる）。
//   - LA 制御メッセージを 1 通処理するたびに laAck を 1 増やす（setupLaWorker の楽観更新と突き合わせる）。
//   - frame の epoch は、main が reset / モード切替で増やして送ってきた番号（古い frame を捨てるため）。

'use strict';

var SftLaWorker = (function () {

  function start(Module, hooks) {
    var ringSize  = Module._get_ring_size();
    var ringWords = Module._get_ring_words();
    var ringBase  = Module._get_ring_ptr() >>> 2;   // byte → HEAPU32 index
    var frameMs   = hooks.frameMs || 16;            // 60fps 目標

    var stepsPerFrame = hooks.stepsPerFrame || 1000;
    var running   = false;
    var laEnabled = true;     // false の間は ring のコピーを省く
    var laAck     = 0;
    var dirty     = true;
    var epoch     = 0;

    var worker = {
      isRunning: function () { return running; },
      markDirty: function () { dirty = true; },
      setEpoch:  function (n) { epoch = n | 0; },
      setRunning: function (on) {
        if (on && hooks.canRun && !hooks.canRun()) { running = false; return; }
        if (on && Module._sim_trigger_hit()) Module._sim_thaw_ring();
        running = !!on;
      }
    };

    function tick() {
      var trigPause = false;

      if (running) {
        hooks.run(stepsPerFrame);
        if (hooks.finished && hooks.finished()) {
          running = false;
        } else if (Module._sim_trigger_hit()) {
          running = false;
          trigPause = true;
        }
        dirty = true;
      }

      if (!dirty) return;
      dirty = false;

      var snap = laEnabled
          ? Module.HEAPU32.subarray(ringBase, ringBase + ringSize * ringWords).slice()
          : new Uint32Array(0);

      var msg = hooks.fields ? hooks.fields() : {};
      msg.type         = 'frame';
      msg.laAck        = laAck;
      msg.epoch        = epoch;
      msg.head         = Module._get_head() >>> 0;
      msg.frozen       = !!Module._sim_ring_frozen();
      msg.trigFireHead = Module._sim_get_trig_fire_head() | 0;
      msg.trigPause    = trigPause;
      msg.running      = running;
      msg.ringSnap     = snap.buffer;
      postMessage(msg, [snap.buffer]);
    }

    function loop() {
      var t0 = performance.now();
      try {
        tick();
      } catch (e) {
        console.error('[sim-worker] tick:', e);
        running = false;
        postMessage({ type: 'error', message: String(e) });
      }
      setTimeout(loop, Math.max(0, frameMs - (performance.now() - t0)));
    }

    self.onmessage = function (e) {
      var d = e.data;
      dirty = true;
      switch (d.type) {
        case 'setRunning': worker.setRunning(d.running); break;
        case 'setSteps':   stepsPerFrame = Math.max(1, d.steps | 0); break;

        // ── Logic Analyzer 制御（js/sft-la-glue.js の setupLaWorker と対）──
        case 'freezeRing':      Module._sim_freeze_ring();                           laAck++; break;
        case 'thawRing':        Module._sim_thaw_ring();                             laAck++; break;
        case 'clearTrigger':    Module._sim_clear_trigger();                         laAck++; break;
        case 'setPostDelay':    Module._sim_set_post_delay(d.n | 0);                 laAck++; break;
        case 'setEdgeTrigger':  Module._sim_set_edge_trigger(d.word, d.bit, d.dir);  laAck++; break;
        case 'setValueTrigger': Module._sim_set_value_trigger(d.word, d.mask, d.cmp); laAck++; break;
        case 'setLA':
          laEnabled = !!d.enabled;
          Module._sim_set_la(laEnabled ? 1 : 0);
          laAck++;
          break;

        default:
          if (!(hooks.onMessage && hooks.onMessage(d, worker))) {
            console.warn('[sim-worker] 未知のメッセージ:', d.type);
          }
      }
    };

    postMessage({ type: 'ready', ringSize: ringSize, ringWords: ringWords });
    loop();
  }

  return { start: start };
})();
