'use strict';

// 10-td4 シミュレーション Worker
// 実行ループ・LA 制御・トリガー停止は js/sft-la-worker-core.js。ここは TD4 固有の部分だけ。
//
// main → worker  setHz{hz} / step / reset{epoch} / setRom{rom:[16]} / setIn{v}
// worker → main  frame に state0 / state1 (いまの状態。ring と同じビットの並び) と rom (16 バイト) を載せる
//
// TD4 は 1 Hz〜数 Hz で命令を目で追うのが見どころなので、速さはクロック毎秒 (hz) で持つ。
// 1 フレームに進めるクロック数は経過時間から出し、端数は次のフレームへ持ち越す。

var MAX_CLOCKS_PER_FRAME = 100000;   // タブが裏に回って間が空いても一度に回しすぎない

var Module = {
  onRuntimeInitialized: function () {
    Module._sim_init();

    var hz    = 2;
    var carry = 0;     // 持ち越したクロックの端数
    var lastT = 0;     // 前に run を呼んだ時刻 (0 = 走り始め)

    function readRom() {
      var rom = new Array(16);
      for (var i = 0; i < 16; i++) rom[i] = Module._get_rom(i);
      return rom;
    }

    SftLaWorker.start(Module, {
      run: function () {
        var now = performance.now();
        if (lastT === 0) lastT = now;
        carry += hz * (now - lastT) / 1000;
        lastT = now;
        var n = Math.min(Math.floor(carry), MAX_CLOCKS_PER_FRAME);
        carry -= Math.floor(carry);
        if (n > 0) Module._sim_run_n(n);
      },

      fields: function () {
        return {
          state0: Module._get_state(0) >>> 0,
          state1: Module._get_state(1) >>> 0,
          rom:    readRom()
        };
      },

      onMessage: function (d, w) {
        switch (d.type) {
          case 'setHz':
            hz = Math.max(0.1, +d.hz || 1);
            return true;

          case 'step':
            if (w.isRunning()) return true;
            // トリガーで止まった後は、そのままでは sim_run_n が即座に打ち切るので、解除してから進める
            if (Module._sim_trigger_hit()) Module._sim_thaw_ring();
            Module._sim_run_n(1);
            return true;

          case 'reset':
            w.setEpoch(d.epoch);
            Module._reset_sim();
            w.setRunning(false);
            lastT = 0; carry = 0;
            return true;

          case 'setRom':
            for (var i = 0; i < 16; i++) Module._set_rom(i, d.rom[i] | 0);
            return true;

          case 'setIn':
            Module._set_in(d.v | 0);
            return true;
        }
        return false;
      }
    });

    // Run を押し直したとき、止まっていた間の時間を一度に回さないよう、時刻を測り直す
    var origOnMessage = self.onmessage;
    self.onmessage = function (e) {
      if (e.data && e.data.type === 'setRunning' && e.data.running) { lastT = 0; carry = 0; }
      origOnMessage(e);
    };
  }
};

importScripts('sim.js');
importScripts('js/sft-la-worker-core.js');
