'use strict';

// 04-6502 シミュレーション Worker（Apple-I / Dormann 共用）
// 実行ループ・LA 制御・トリガー停止は js/sft-la-worker-core.js。ここは 6502 固有の部分だけ。
//
// main → worker  setMode{mode,epoch} / reset{running,epoch} / stepInstr / sendKey{ch}
// frame に載せる値: cycles / pc / a / x / y / sp / p / state / trapped / passed / chars

var mode = 'apple1';   // 'apple1' | 'dormann'

var Module = {
  onRuntimeInitialized: function () {
    Module._sim_init();
    SftLaWorker.start(Module, {
      stepsPerFrame: 8000,   // index.html のスライダーが setSteps で上書きする

      run: function (n) {
        if (mode === 'apple1') Module._sim_run_n(n); else Module._step_n(n);
      },

      // Dormann はトラップを検出したら止まる（トリガー停止とは別扱い）
      finished: function () { return mode === 'dormann' && !!Module._is_trapped(); },
      canRun:   function () { return !(mode === 'dormann' && Module._is_trapped()); },

      fields: function () {
        // コンソール出力をドレイン（Apple-I のみ。Dormann は PIA を持たない）
        var chars = [];
        var ch;
        while ((ch = Module._get_display_char()) !== -1) chars.push(ch);
        return {
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
          chars: chars
        };
      },

      onMessage: function (d, w) {
        switch (d.type) {
          case 'setMode':
            mode = d.mode === 'dormann' ? 'dormann' : 'apple1';
            w.setEpoch(d.epoch);
            w.setRunning(false);
            if (mode === 'dormann') Module._dormann_init(); else Module._sim_init();
            return true;

          case 'reset':
            w.setEpoch(d.epoch);
            if (mode === 'dormann') Module._dormann_init(); else Module._reset_sim();
            w.setRunning(!!d.running);
            return true;

          case 'stepInstr':
            w.setRunning(false);
            Module._step_instruction();
            return true;

          case 'sendKey':
            Module._send_key(d.ch | 0);
            return true;
        }
        return false;
      }
    });
  }
};

importScripts('sim.js');
importScripts('js/sft-la-worker-core.js');
