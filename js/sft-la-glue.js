// sft-la-glue.js — Logic Analyzer の組み立てを 1 回で行う
//   setupLa        : Wasm 直呼び（メインスレッドで動かす example 用）
//   setupLaWorker  : Wasm を Web Worker で動かす example 用（末尾のコメント参照）
//
//   var lag = setupLa({
//     Module: Module, rootId: 'la-root', config: COUNTER_LA_CONFIG, signals: COUNTER_LA_SIGNALS,
//     zoomIdx: 5, onArm: function () { setRunning(true); }
//   });
//   // 毎フレーム:
//   var head = lag.draw();                    // la.update() と Freeze ボタン同期を行い head を返す
//   if (running && lag.triggerHit()) pause(); // トリガー停止
//   Run ボタン: if (!running) lag.resume();   // トリガー停止後の再開（Thaw して再武装）
//
// 前提: Module が cxx/rtlscope_ring.h の RTLSCOPE_EXPORT_RING を公開していること。
// 読み込み順: *-la-defs.js → rtlscope-la.js → sft-la-toolbar.js → (sft-trigger-presets.js) → sft-la-ctrl.js → sft-la-glue.js
// トリガーのテーマ: opts.triggerPresets と opts.onPreset (sft-la-ctrl.js の initLaCtrl と同じ形)

// DOM・RTLScopeLA・コントロールを組み立てる（setupLa / setupLaWorker 共通）。
function _buildLa(opts, ringSize, ringWords, backend) {
  'use strict';
  // #la・#trig-detail などの DOM id と window.la を固定で使うため、1 ページにつき 1 回だけ呼べる。
  if (window.__sftLaMounted) throw new Error('setupLa は 1 ページに 1 回だけ呼べます');
  window.__sftLaMounted = true;

  var cfg = opts.config;
  mountLaToolbar(opts.rootId, { canvasWidth: cfg.width });

  var la = new RTLScopeLA(Object.assign({}, cfg, { ringSize: ringSize, ringWords: ringWords }));
  window.la = la;
  la.buildToggles();
  if (opts.zoomIdx !== undefined) la.setZoom(opts.zoomIdx);

  var ctrl = initLaCtrl({
    la: la,
    signals: opts.signals,
    storagePrefix: cfg.storagePrefix,
    backend: backend,
    onArm: opts.onArm,
    triggerPresets: opts.triggerPresets,
    onPreset: opts.onPreset
  });
  return { la: la, ctrl: ctrl };
}

function setupLa(opts) {
  'use strict';
  var M = opts.Module;

  var ringSize  = M._get_ring_size();
  var ringWords = M._get_ring_words();
  var ringBase  = M._get_ring_ptr() >>> 2;   // byte → uint32 index

  var built = _buildLa(opts, ringSize, ringWords, {
    freeze:          function () { M._sim_freeze_ring(); },
    thaw:            function () { M._sim_thaw_ring(); },
    isFrozen:        function () { return !!M._sim_ring_frozen(); },
    setLA:           function (on) { M._sim_set_la(on ? 1 : 0); },
    setPostDelay:    function (n) { M._sim_set_post_delay(n); },
    clearTrigger:    function () { M._sim_clear_trigger(); },
    setEdgeTrigger:  function (word, bit, dir) { M._sim_set_edge_trigger(word, bit, dir); },
    setValueTrigger: function (word, mask, cmp) { M._sim_set_value_trigger(word, mask, cmp); }
  });
  var la   = built.la;
  var ctrl = built.ctrl;

  // ring 全体を指す TypedArray ビュー。メモリ拡張で HEAPU32 が差し替わるため毎回取り直す。
  function ringView() {
    return M.HEAPU32.subarray(ringBase, ringBase + ringSize * ringWords);
  }

  return {
    la: la,
    ctrl: ctrl,
    ringSize: ringSize,
    ringWords: ringWords,
    ringView: ringView,
    // 直近サンプルの word を返す（サンプルが無ければ 0）
    latestWord: function (word) {
      var head = M._get_head() >>> 0;
      if (head === 0) return 0;
      return ringView()[((head - 1) & (ringSize - 1)) * ringWords + (word || 0)] >>> 0;
    },
    draw: function () {
      var head   = M._get_head() >>> 0;
      var frozen = !!M._sim_ring_frozen();
      la.update(head, ringView(), frozen, M._sim_get_trig_fire_head());
      ctrl.sync(frozen);
      return head;
    },
    triggerHit: function () { return !!M._sim_trigger_hit(); },
    // Run ボタンで実行を始める直前に呼ぶ。トリガーで Freeze 済みなら Thaw して再武装する
    // （そのままだと sim_run_n が即座に打ち切られ、何も進まない）。
    resume: function () {
      if (M._sim_trigger_hit()) M._sim_thaw_ring();
    }
  };
}

// ── Web Worker 版 ───────────────────────────────────────────────────────────
//
//   var lag = setupLaWorker({
//     worker: worker, ringSize: msg.ringSize, ringWords: msg.ringWords,   // Worker の 'ready' で受け取る
//     rootId: 'la-root', config: M6502_LA_CONFIG, signals: M6502_LA_SIGNALS,
//     zoomIdx: 6, onArm: function () { setRunning(true); }
//   });
//   worker.onmessage の 'frame' で:  lag.frame(msg);   // ringSnap・head・frozen・trigFireHead を取り込む
//   描画（rAF 内）:                  lag.draw();
//
// Worker 側の約束（examples/04-6502/web/sim-worker.js が実装例）:
//   - 次の制御メッセージを受けて cxx/rtlscope_ring.h の API を呼ぶ:
//       freezeRing / thawRing / setLA{enabled} / setPostDelay{n} / clearTrigger /
//       setEdgeTrigger{word,bit,dir} / setValueTrigger{word,mask,cmp}
//   - これらを 1 通処理するたびに laAck を 1 増やし、毎フレームの 'frame' に
//     {laAck, head, frozen, trigFireHead, ringSnap(ArrayBuffer, 空なら LA OFF)} を載せる。
//   - トリガー停止後の Run（thaw して再武装）は Worker 側の setRunning で行う。
//
// Freeze ボタンは押した直後に状態を読み返すため、メインスレッドに楽観的な影を持つ。
// 送った制御メッセージが全て ack されるまでは、フレームの frozen / trigFireHead を採用しない
// （飛行中の古いフレームで表示が一瞬戻るのを防ぐ）。
function setupLaWorker(opts) {
  'use strict';
  var worker = opts.worker;
  var sent   = 0;                       // 送った制御メッセージ数
  var view   = new Uint32Array(0);      // 直近の ring スナップショット（ring 全体）
  var shadow = { head: 0, frozen: false, trigFireHead: -1 };

  function cmd(msg) { sent++; worker.postMessage(msg); }

  var built = _buildLa(opts, opts.ringSize, opts.ringWords, {
    freeze:          function () { shadow.frozen = true; cmd({ type: 'freezeRing' }); },
    thaw:            function () { shadow.frozen = false; shadow.trigFireHead = -1; cmd({ type: 'thawRing' }); },
    isFrozen:        function () { return shadow.frozen; },
    setLA:           function (on) { cmd({ type: 'setLA', enabled: !!on }); },
    setPostDelay:    function (n) { cmd({ type: 'setPostDelay', n: n }); },
    clearTrigger:    function () { shadow.frozen = false; shadow.trigFireHead = -1; cmd({ type: 'clearTrigger' }); },
    setEdgeTrigger:  function (word, bit, dir) {
      shadow.frozen = false; shadow.trigFireHead = -1;
      cmd({ type: 'setEdgeTrigger', word: word, bit: bit, dir: dir });
    },
    setValueTrigger: function (word, mask, cmp) {
      shadow.frozen = false; shadow.trigFireHead = -1;
      cmd({ type: 'setValueTrigger', word: word, mask: mask, cmp: cmp });
    }
  });

  return {
    la: built.la,
    ctrl: built.ctrl,
    ringSize: opts.ringSize,
    ringWords: opts.ringWords,
    // Worker の 'frame' メッセージを取り込む
    frame: function (msg) {
      shadow.head = msg.head >>> 0;
      if (msg.ringSnap && msg.ringSnap.byteLength > 0) view = new Uint32Array(msg.ringSnap);
      if (msg.laAck >= sent) {
        shadow.frozen       = !!msg.frozen;
        shadow.trigFireHead = msg.trigFireHead | 0;
      }
    },
    // 直近サンプルの word を返す（サンプルが無ければ 0）
    latestWord: function (word) {
      if (shadow.head === 0 || view.length === 0) return 0;
      return view[((shadow.head - 1) & (opts.ringSize - 1)) * opts.ringWords + (word || 0)] >>> 0;
    },
    draw: function () {
      if (view.length > 0) {
        built.la.update(shadow.head, view, shadow.frozen, shadow.trigFireHead);
      }
      built.ctrl.sync(shadow.frozen);
      return shadow.head;
    }
  };
}
