'use strict';
// sft-pdp11-sim-api.js — window.sim テスト用パブリック API
//
// DevTools / Playwright page.evaluate() 用の高レベル API。8080 版
// (sft-8080-sim-api.js) と同じ設計: グローバル参照のみで実行時に解決する。
//   worker / simStarted / simPaused / _laFreezeHead / _trigArmed /
//   _latestGpr / _latestSnap / _ringWords（sft-pdp11-worker-bridge.js）,
//   window.la, LA_SIGNALS_PDP11 / _trigParse（la-defs / trigger-expr.js）,
//   trigCompileToWasm（trigger-expr-compiler.js）
// sft-pdp11-trigger-ui.js が定義する window.sim.screenshotCanvas を保持する
// ため Object.assign で拡張する（読み込み順: trigger-ui の後）。
//
// 使用例 (DevTools / Playwright):
//   sim.setTrigger({type:'pc', pc:0o4014})   // PC=0o4014 でトリガー
//   await sim.waitTrigger()                  // 発火を待つ
//   sim.readSample('pc', 0)                  // → T=0 サンプルの PC
//   sim.getRegs()                            // → {r0..r5, sp, pc, psw, mode}

window.sim = window.sim || {};
Object.assign(window.sim, {

  // ── 実行制御 ──────────────────────────────────────────────────────────

  /** シミュレーション再開（pause / トリガー発火後の復帰） */
  run: function() {
    worker.postMessage({ type: 'resume' });
  },

  /** シミュレーション一時停止 */
  pause: function() {
    worker.postMessage({ type: 'pause' });
  },

  /** リセット（Unix V6 再ブート。ディスク内容は保持） */
  reset: function() {
    worker.postMessage({ type: 'reset' });
  },

  // ── キー入力 ──────────────────────────────────────────────────────────

  /** コンソールに 1 文字送信（ASCII コード or 1 文字の文字列） */
  sendKey: function(ch) {
    worker.postMessage({ type: 'key',
      ch: typeof ch === 'string' ? ch.charCodeAt(0) : (ch | 0) });
  },

  /** コンソールに文字列を送信。'\n' は CR(0x0D) に変換する */
  sendString: function(str) {
    var s = str.replace(/\n/g, '\r');
    worker.postMessage({ type: 'send_str', str: s });
  },

  // ── トリガー設定 ──────────────────────────────────────────────────────

  /**
   * トリガーを設定する。
   *
   * opts.type = 'pc'     : {pc}          PC 一致（数値）
   * opts.type = 'fetch'  : {}            命令フェッチ (istate=f1)
   * opts.type = 'io'     : {}            I/O ページアクセス
   * opts.type = 'trap'   : {}            TRAP
   * opts.type = 'buserr' : {}            バスエラー
   * opts.type = 'pcdata' : {pc, data}    PC + オペコード一致
   * opts.type = 'expr'   : {expr}        式トリガー（trigger-expr.js 構文）
   */
  setTrigger: function(opts) {
    switch (opts.type) {
      case 'pc':
        worker.postMessage({ type: 'set_trigger', trigType: 1, val: opts.pc >>> 0 });
        break;
      case 'fetch':
        worker.postMessage({ type: 'set_trigger', trigType: 2, val: 1 });
        break;
      case 'io':
        worker.postMessage({ type: 'set_trigger', trigType: 3, val: 0 });
        break;
      case 'trap':
        worker.postMessage({ type: 'set_trigger', trigType: 4, val: 0 });
        break;
      case 'buserr':
        worker.postMessage({ type: 'set_trigger', trigType: 5, val: 0 });
        break;
      case 'pcdata':
        worker.postMessage({ type: 'set_trigger', trigType: 6,
          val: ((((opts.data | 0) & 0xFFFF) << 16) | ((opts.pc | 0) & 0xFFFF)) >>> 0 });
        break;
      case 'expr': {
        var ast       = _trigParse(opts.expr);       // throw あり（呼び出し側で捕捉）
        var wasmBytes = trigCompileToWasm(ast);
        worker.postMessage({ type: 'set_ring_tick_mask', mask: 0 });
        var bytesCopy = new Uint8Array(wasmBytes).buffer;
        worker.postMessage({ type: 'set_expr_trigger', wasmBytes: bytesCopy }, [bytesCopy]);
        break;
      }
      default:
        console.warn('[sim.setTrigger] 未知の type:', opts.type);
        return;
    }
    _trigArmed = true;
    if (typeof _updateTrigButtons === 'function') _updateTrigButtons();
  },

  /** トリガーを解除する（LA の発火状態もリセット） */
  clearTrigger: function() {
    _laFreezeHead = -1;
    _trigArmed    = false;
    worker.postMessage({ type: 'clear_trigger' });
    if (window.la) {
      window.la._trigOn   = false;
      window.la._trigHead = -1;
    }
    if (typeof _updateTrigButtons === 'function') _updateTrigButtons();
  },

  /**
   * トリガーが発火するまで待機（Promise）。
   * @param {number} [timeoutMs=60000]
   * @returns {Promise<{trigHead:number}>}
   */
  waitTrigger: function(timeoutMs) {
    var ms = timeoutMs !== undefined ? timeoutMs : 60000;
    return new Promise(function(resolve, reject) {
      var t0  = Date.now();
      var tid = setInterval(function() {
        var l = window.la;
        if (l && l._trigOn && l._trigHead >= 0) {
          clearInterval(tid);
          resolve({ trigHead: l._trigHead });
        } else if (Date.now() - t0 >= ms) {
          clearInterval(tid);
          reject(new Error('sim.waitTrigger: timeout (' + ms + 'ms)'));
        }
      }, 50);
    });
  },

  // ── ベアメタルモード（タイミング図テスト用）───────────────────────────

  /** RAM クリア + initial_pc 設定（Unix V6 を起動せず素の CPU を使う） */
  initBare: function(startPc) {
    window._pdp11BareReady = false;
    worker.postMessage({ type: 'init_bare', start_pc: startPc >>> 0 });
  },

  /** ベアメタル: バイトアドレス addr に 16bit ワードを書く */
  writeWord: function(addr, word) {
    worker.postMessage({ type: 'write_word', addr: addr >>> 0, word: word & 0xFFFF });
  },

  /** ベアメタル: ワード列を連続アドレスに書く */
  writeWords: function(addr, words) {
    for (var i = 0; i < words.length; i++) {
      worker.postMessage({ type: 'write_word',
        addr: (addr + i * 2) >>> 0, word: words[i] & 0xFFFF });
    }
  },

  /** ベアメタル: トリガーなしで n tick 進める */
  stepBare: function(n) {
    window._pdp11BareStepped = false;
    worker.postMessage({ type: 'step_bare', n: n | 0 });
  },

  /** トリガー設定と実行開始をアトミックに行う（メッセージ競合回避） */
  setTriggerAndRun: function(trigType, val) {
    worker.postMessage({ type: 'set_trigger_and_run',
      trigType: trigType | 0, val: val >>> 0 });
  },

  /** LA の M1 信号用メモリプローブアドレスを設定（0xFFFFFFFF で無効） */
  setMemProbe: function(addr) {
    worker.postMessage({ type: 'set_mem_probe', addr: addr >>> 0 });
  },

  // ── レジスタ / ring buffer 読み取り ──────────────────────────────────

  /**
   * 最新のレジスタ値を返す（worker から届いた最新 ring スナップショット基準）。
   * @returns {{r0,r1,r2,r3,r4,r5,sp,pc,psw,mode:number}|null}
   */
  getRegs: function() {
    if (!_latestGpr || !_latestSnap || _latestSnap.length < _ringWords) return null;
    var last = _latestSnap.length - _ringWords;
    var w0 = _latestSnap[last], w1 = _latestSnap[last + 1], w2 = _latestSnap[last + 2];
    return {
      r0: _latestGpr[0], r1: _latestGpr[1], r2: _latestGpr[2],
      r3: _latestGpr[3], r4: _latestGpr[4], r5: _latestGpr[5],
      sp: _latestGpr[6],
      pc:   w2 & 0xFFFF,
      psw:  (w1 >>> 16) & 0xFFFF,
      mode: (w0 >>> 20) & 3,
    };
  },

  /**
   * トリガー位置から offset サンプル離れた位置の信号値を返す。
   * offset=0 = T=0 サンプル、+n = 後方、-n = 前方。
   * トリガー未発火・不明シグナルの場合は undefined。
   *
   * @param {string} signalId  LA_SIGNALS_PDP11 の id ('pc','addr_p','trapped' など)
   * @param {number} [offset=0]
   * @returns {number|undefined}
   */
  readSample: function(signalId, offset) {
    var l = window.la;
    if (!l || !l._trigOn || l._trigHead < 0) return undefined;
    var sig = LA_SIGNALS_PDP11.find(function(s) { return s.id === signalId; });
    if (!sig) {
      console.warn('[sim.readSample] 不明なシグナル:', signalId);
      return undefined;
    }
    var off    = offset !== undefined ? (offset | 0) : 0;
    var absIdx = ((l._trigHead + off) >>> 0) & (l._ringSize - 1);
    var mask   = sig.width >= 32 ? 0xFFFFFFFF : ((1 << sig.width) - 1);
    return (l._lastHeapu32[absIdx * l._RW + (sig.word | 0)] >>> (sig.bit | 0)) & mask;
  },

  /**
   * LA で参照できる全信号のメタデータ一覧を返す。
   * @returns {Array<{id:string, label:string, word:number, bit:number, width:number, type:string}>}
   */
  getSignals: function() {
    return LA_SIGNALS_PDP11.map(function(s) {
      return { id: s.id, label: s.label, word: s.word,
               bit: s.bit, width: s.width, type: s.type };
    });
  },

});

// ── 状態取得 getter ─────────────────────────────────────────────────────
// Object.assign は getter を「ロード時の値」としてコピーしてしまうため、
// アクセサは defineProperties で別途定義する。
Object.defineProperties(window.sim, {
  /** トリガーが発火済みか */
  trigFired: { get: function() { return !!(window.la && window.la._trigOn); } },

  /** トリガー発火位置（ring buffer 絶対インデックス）。未発火時は -1 */
  trigHead:  { get: function() {
    return window.la && window.la._trigOn ? (window.la._trigHead | 0) : -1;
  } },

  /** シミュレーションが開始済みか */
  isStarted: { get: function() { return !!simStarted; } },

  /** シミュレーションが一時停止中か */
  isPaused:  { get: function() { return !!simPaused; } },
});
