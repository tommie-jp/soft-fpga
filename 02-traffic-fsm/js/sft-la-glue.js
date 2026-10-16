// sft-la-glue.js — Logic Analyzer の組み立てを 1 回で行う（Wasm 直呼び・メインスレッド用）
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

function setupLa(opts) {
  'use strict';
  // #la・#trig-detail などの DOM id と window.la を固定で使うため、1 ページにつき 1 回だけ呼べる。
  if (window.__sftLaMounted) throw new Error('setupLa は 1 ページに 1 回だけ呼べます');
  window.__sftLaMounted = true;

  var M = opts.Module;
  var cfg = opts.config;

  mountLaToolbar(opts.rootId, { canvasWidth: cfg.width });

  var ringSize  = M._get_ring_size();
  var ringWords = M._get_ring_words();
  var ringBase  = M._get_ring_ptr() >>> 2;   // byte → uint32 index

  var la = new RTLScopeLA(Object.assign({}, cfg, { ringSize: ringSize, ringWords: ringWords }));
  window.la = la;
  la.buildToggles();
  if (opts.zoomIdx !== undefined) la.setZoom(opts.zoomIdx);

  var ctrl = initLaCtrl({
    la: la,
    signals: opts.signals,
    storagePrefix: cfg.storagePrefix,
    backend: {
      freeze:          function () { M._sim_freeze_ring(); },
      thaw:            function () { M._sim_thaw_ring(); },
      isFrozen:        function () { return !!M._sim_ring_frozen(); },
      setLA:           function (on) { M._sim_set_la(on ? 1 : 0); },
      setPostDelay:    function (n) { M._sim_set_post_delay(n); },
      clearTrigger:    function () { M._sim_clear_trigger(); },
      setEdgeTrigger:  function (word, bit, dir) { M._sim_set_edge_trigger(word, bit, dir); },
      setValueTrigger: function (word, mask, cmp) { M._sim_set_value_trigger(word, mask, cmp); }
    },
    onArm: opts.onArm,
    triggerPresets: opts.triggerPresets,
    onPreset: opts.onPreset
  });

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
