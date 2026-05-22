'use strict';

// Emscripten Module 設定オブジェクト（importScripts の前に定義する）
var Module = {
  onRuntimeInitialized: function () {
    RING_SIZE = Module._get_ring_size();
    ringBase  = Module._get_ring_ptr() >>> 2; // byte ptr → HEAPU32 index
    callLogBase = Module._sim_get_call_log_ptr() >>> 0; // byte ptr
    postMessage({ type: 'ready' });
    scheduleNext();
  }
};

importScripts('sim.js');

// ---- 状態 ----
var RING_SIZE     = 0;
var ringBase      = 0;
var callLogBase   = 0;
var running       = false;
var stepsPerFrame = 100000;
var laEnabled     = true;   // Logic Analyzer 有効フラグ（false 時は ring コピーをスキップ）
var frameRateMs   = 16;     // フレームレート目標 ms (16=60fps, 33=30fps, 66=15fps) — 固定速度モードのみ有効
var fileTimes     = {};   // name → Date.now() ms (writeFS 時刻)

// ---- シミュレーションループ ----
function simLoop() {
  if (running) {
    // stepsPerFrame < 0 は「最高速度」センチネル (applySpeed が -1 を送信)
    var n = stepsPerFrame < 0 ? 100000 : stepsPerFrame;
    // sim_run_n が未エクスポート（旧 WASM）の場合は _step() ループにフォールバック
    if (Module._sim_run_n) {
      Module._sim_run_n(n);
    } else {
      for (var i = 0; i < n; i++) Module._step();
    }
  }

  // コンソール出力をドレイン
  var chars = [];
  var ch;
  while ((ch = Module._get_display_char()) !== -1) chars.push(ch & 0x7F);

  var head    = Module._get_head() >>> 0;
  var pc      = Module._get_pc()   >>> 0;
  var dirties = [
    !!Module._sim_get_disk_dirty(0),
    !!Module._sim_get_disk_dirty(1),
    !!Module._sim_get_disk_dirty(2),
    !!Module._sim_get_disk_dirty(3),
  ];

  // ring buffer スナップショット（Transferable で転送）
  // LA 無効時はスキップ → 空バッファを送信
  // 最高速度モードでも毎フレーム転送する（FPS制御は setTimeout 側で行う）
  var doRing = laEnabled;
  var snap = doRing
      ? Module.HEAPU32.subarray(ringBase, ringBase + RING_SIZE * 6).slice()
      : new Uint32Array(0);

  // ── デバッグ情報 ──

  // レジスタスナップショット [A, F, B, C, D, E, H, L, SPH, SPL, PCH, PCL]
  var regPtr  = Module._sim_snap_regs() >>> 0;
  var regData = new Uint8Array(Module.HEAPU8.buffer, regPtr, 12).slice();

  // PC 周辺 3 バイト（命令デコード用）
  var pcVal   = pc & 0xFFFF;
  var pcBytes = new Uint8Array(3);
  pcBytes[0]  = Module._sim_read_byte(pcVal);
  pcBytes[1]  = Module._sim_read_byte((pcVal + 1) & 0xFFFF);
  pcBytes[2]  = Module._sim_read_byte((pcVal + 2) & 0xFFFF);

  // スタックビュー: SP から 16 バイト
  var spH       = Module.HEAPU8[regPtr + 8];
  var spL       = Module.HEAPU8[regPtr + 9];
  var spVal     = ((spH << 8) | spL) & 0xFFFF;
  var stackData = new Uint8Array(16);
  for (var si = 0; si < 16; si++)
    stackData[si] = Module._sim_read_byte((spVal + si) & 0xFFFF);

  // コールトレースログ（64 エントリ × 2 uint32 × 4 バイト = 512 バイト）
  var callLogHead = Module._sim_get_call_log_head() >>> 0;
  var callLogSnap = new Uint8Array(Module.HEAPU8.buffer, callLogBase, 512).slice();

  // フリーズ / トリガー状態
  var frozen       = !!Module._sim_ring_frozen();
  var trigHit      = !!Module._sim_trigger_hit();
  var trigFired    = !!Module._sim_trigger_fired();
  var trigFireHead = Module._sim_get_trig_fire_head() | 0; // -1 = 未発火

  // トリガーヒット時: 自動ポーズ
  if (trigHit && running) {
    running = false;
    postMessage({ type: 'triggerPause' });
  }

  postMessage(
    {
      type: 'frame',
      head: head, pc: pc, chars: chars, dirties: dirties,
      ringSnap: snap.buffer,
      regs: regData.buffer, pcBytes: pcBytes.buffer, stackBytes: stackData.buffer,
      callLogHead: callLogHead, callLog: callLogSnap.buffer,
      frozen: frozen, trigHit: trigHit, trigFired: trigFired, trigFireHead: trigFireHead,
    },
    [snap.buffer, regData.buffer, pcBytes.buffer, stackData.buffer, callLogSnap.buffer]
  );
}

// ---- スケジューリング ----
// 最高速度 (stepsPerFrame < 0): MessageChannel タイトループ
// 固定周波数 (stepsPerFrame >= 0): setTimeout で 16ms フレーム目標
var _mc = new MessageChannel();
_mc.port2.onmessage = function() {
  var t0 = performance.now();
  try {
    simLoop();
  } catch (e) {
    console.error('[Worker] simLoop:', e);
    running = false;
    postMessage({ type: 'error', message: String(e) });
    return; // エラー時は再スケジュールしない
  }
  if (stepsPerFrame < 0) {
    _mc.port1.postMessage(null); // 最高速度: 即時ループ
  } else {
    var delay = Math.max(0, frameRateMs - (performance.now() - t0) | 0);
    setTimeout(scheduleNext, delay); // 固定周波数: フレームレート制御
  }
};

function scheduleNext() {
  _mc.port1.postMessage(null);
}

// ---- メインスレッドからのメッセージ ----
self.onmessage = function (e) {
  var data = e.data;
  switch (data.type) {

    case 'setRunning':
      running = data.running;
      break;

    case 'setSteps':
      stepsPerFrame = data.steps;
      break;

    case 'sendKey':
      Module._send_key(data.ch);
      break;

    case 'reset':
      Module._sim_init_disk(data.preset);
      running = (data.running !== undefined) ? data.running : true;
      break;

    case 'loadDisk': {
      var arr = new Uint8Array(data.data);
      var ptr = Module._malloc(arr.length);
      Module.HEAPU8.set(arr, ptr);
      Module._load_disk_drive(data.drive, ptr, arr.length);
      Module._free(ptr);
      break;
    }

    case 'getDiskData': {
      var ptr2 = Module._sim_get_disk_ptr(data.drive) >>> 0;
      var size = Module._sim_get_disk_size(data.drive);
      var copy = new Uint8Array(Module.HEAPU8.buffer, ptr2, size).slice();
      postMessage(
        { type: 'diskData', drive: data.drive, requestId: data.requestId, data: copy.buffer },
        [copy.buffer]
      );
      break;
    }

    case 'clearDirty':
      Module._sim_clear_disk_dirty(data.drive);
      break;

    case 'writeFS': {
      var arr2 = new Uint8Array(data.data);
      try {
        Module.FS.writeFile('/' + data.name, arr2);
        fileTimes[data.name] = data.mtime || Date.now();
        postMessage({ type: 'fsResult', requestId: data.requestId, ok: true });
      } catch (err) {
        postMessage({ type: 'fsResult', requestId: data.requestId, ok: false, error: err.message });
      }
      break;
    }

    case 'readFS': {
      try {
        var fileData = Module.FS.readFile('/' + data.name);
        var fileBuf  = fileData.slice().buffer;
        postMessage(
          { type: 'fsFile', requestId: data.requestId, name: data.name, data: fileBuf },
          [fileBuf]
        );
      } catch (err) {
        postMessage({ type: 'fsResult', requestId: data.requestId, ok: false, error: err.message });
      }
      break;
    }

    case 'listFS': {
      var entries = [];
      try {
        Module.FS.readdir('/').forEach(function (f) {
          if (f === '.' || f === '..') return;
          try {
            var st = Module.FS.stat('/' + f);
            if (Module.FS.isDir(st.mode)) return;
            if (st.size >= 65536) return;
            entries.push({ name: f, size: st.size, mtime: fileTimes[f] || (st.mtime * 1000) });
          } catch (e) {}
        });
      } catch (e) {}
      postMessage({ type: 'fsEntries', requestId: data.requestId, entries: entries });
      break;
    }

    case 'deleteFS': {
      try { Module.FS.unlink('/' + data.name); } catch (e) {}
      delete fileTimes[data.name];
      postMessage({ type: 'fsResult', requestId: data.requestId, ok: true });
      break;
    }

    // ── デバッグ制御 ──

    case 'freezeRing':
      Module._sim_freeze_ring();
      break;

    case 'thawRing':
      Module._sim_thaw_ring();
      break;

    case 'setTrigger':
      // data.trigType: 0=off 1=io_req 2=call 3=ret
      // data.port: ポートフィルタ (0xFF=any)
      // data.addr: ターゲットアドレスフィルタ (0=any)
      Module._sim_set_trigger(data.trigType, data.port || 0xFF, data.addr || 0);
      break;

    case 'clearTrigger':
      Module._sim_clear_trigger();
      break;

    case 'clearCallLog':
      Module._sim_clear_call_log();
      break;

    case 'setEdgeTrigger':
      // data.word: Word インデックス (0-4)
      // data.bit:  ビット番号 (0-31)
      // data.dir:  0=立ち上がり, 1=立ち下がり
      Module._sim_set_edge_trigger(data.word, data.bit, data.dir);
      break;

    case 'setValueTrigger':
      // data.word: Word インデックス (0-4)
      // data.mask: ビットマスク (uint32)
      // data.cmp:  比較値 (mask 適用後, uint32)
      console.log('[Worker] setValueTrigger word:', data.word,
                  'mask:0x' + (data.mask >>> 0).toString(16),
                  'cmp:0x'  + (data.cmp  >>> 0).toString(16));
      Module._sim_set_value_trigger(data.word, data.mask, data.cmp);
      break;

    case 'setPostDelay':
      // data.n: ポストトリガーのクロック数
      Module._sim_set_post_delay(data.n | 0);
      break;

    // ── DDT ステップ実行 ──

    case 'stepInstr':
      // 1 命令だけ実行して次の M1 フェッチ境界で停止する
      running = false;
      Module._sim_step_instr();
      scheduleNext();
      break;

    case 'setInstrTrigger':
      // data.pc:  ターゲット PC (-1 = 任意)
      // data.opc: ターゲット オペコード (-1 = 任意)
      Module._sim_set_instr_trigger(
        data.pc  !== undefined ? data.pc  : -1,
        data.opc !== undefined ? data.opc : -1
      );
      break;

    case 'setRegTrigger':
      // data.regId: レジスタ ID (0=A 1=F 2=B 3=C 4=D 5=E 6=H 7=L 8=SP 9=PC 10=BC 11=DE 12=HL)
      // data.value: 比較値 (8bit レジスタは下位 8bit, 16bit は下位 16bit)
      Module._sim_set_reg_trigger(data.regId | 0, data.value | 0);
      break;

    case 'setLA':
      // data.enabled: true=ON, false=OFF
      laEnabled = !!data.enabled;
      if (Module._sim_set_la_enabled) Module._sim_set_la_enabled(data.enabled ? 1 : 0);
      break;

    case 'setFrameRate':
      // data.fps: 60, 30, 15 など
      frameRateMs = data.fps > 0 ? Math.round(1000 / data.fps) : 16;
      break;
  }
};
