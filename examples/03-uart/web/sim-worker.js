'use strict';

// 03-uart シミュレーション Worker
// 実行ループ・LA 制御・トリガー停止は js/sft-la-worker-core.js。ここは UART 固有の部分だけ。
//
// main → worker  sendByte{b} / reset{epoch}
// frame に載せる値: rx（前のフレームから増えた受信バイトの配列）

var RX_LOG_SIZE = 64;   // cxx/harness.cpp の RX_LOG_SIZE と一致させる
var sentRx = 0;         // main へ渡し済みの受信バイト数

var Module = {
  onRuntimeInitialized: function () {
    Module._sim_init();
    SftLaWorker.start(Module, {
      stepsPerFrame: 60,   // index.html のスライダーが setSteps で上書きする

      run: function (n) { Module._sim_run_n(n); },

      fields: function () {
        // ハーネスの記録は 64 字。それより古い分は飛ばす。
        var count = Module._get_rx_valid_count() >>> 0;
        var rx = [];
        for (var n = Math.max(sentRx, count - RX_LOG_SIZE); n < count; n++) {
          rx.push(Module._get_rx_byte(n));
        }
        sentRx = count;
        return { rx: rx };
      },

      onMessage: function (d, w) {
        switch (d.type) {
          case 'sendByte':
            Module._send_byte(d.b | 0);
            return true;

          case 'reset':
            w.setEpoch(d.epoch);
            Module._reset_sim();
            sentRx = 0;            // ハーネスは受信カウントを 0 に戻す
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
