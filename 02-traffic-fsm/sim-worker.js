'use strict';

// 02-traffic-fsm シミュレーション Worker
// 実行ループ・LA 制御・トリガー停止は js/sft-la-worker-core.js。ここは信号機 FSM 固有の部分だけ。
//
// main → worker  pressBtn / reset{epoch}

var Module = {
  onRuntimeInitialized: function () {
    Module._sim_init();
    SftLaWorker.start(Module, {
      stepsPerFrame: 30,   // index.html のスライダーが setSteps で上書きする

      run: function (n) { Module._sim_run_n(n); },

      onMessage: function (d, w) {
        switch (d.type) {
          case 'pressBtn':
            Module._press_btn();
            return true;

          case 'reset':
            w.setEpoch(d.epoch);
            Module._reset_sim();
            w.setRunning(false);
            return true;
        }
        return false;
      }
    });
  }
};

importScripts('sim.js');
importScripts('js/sft-la-worker-core.js');
