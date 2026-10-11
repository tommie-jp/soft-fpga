// sft-8080-sim-api.js — window.sim テスト用パブリック API
//
// 06-8080 Web UI から分離。DevTools / xterm テストターミナル / Playwright page.evaluate() 用の
// 高レベル API。initUI ローカルに依存せず、グローバル参照のみ（機能不変）:
//   workerSend / workerRequest（sft-8080-worker-bridge.js）, running / curPreset（index の let）,
//   window.la, LA_SIGNALS_ALL（sft-8080-la-defs.js）, window._laMemWatchSet（MemWatch）。
// メソッド本体は実行時参照のため、読み込み順は問わない（worker-bridge の後に置く）。

// 使用例 (DevTools / テストターミナル):
//   sim.setTrigger({type:'reg', regId:9, value:0x0300})  // PC=0300 でトリガー
//   await sim.waitTrigger()                               // 発火を待つ
//   sim.readSample('addr', 0)   // → 0x0300 (発火サンプルの addr バス)
//   sim.readSample('dbus', 1)   // → オペコード (次のサンプル)
window.sim = {

  // ── 実行制御 ──────────────────────────────────────────────────────────

  /** シミュレーション再開 */
  run: function() {
    workerSend({ type: 'setRunning', running: true });
    running = true;
    var b = document.getElementById('btn-run');
    if (b) b.textContent = 'Pause';
  },

  /** シミュレーション一時停止 */
  pause: function() {
    workerSend({ type: 'setRunning', running: false });
    running = false;
    var b = document.getElementById('btn-run');
    if (b) b.textContent = 'Run';
  },

  /** リセット（CP/M 再起動）。preset 省略時は現在のプリセットを使用 */
  reset: function(preset) {
    var p = preset !== undefined ? preset : curPreset;
    workerSend({ type: 'reset', preset: p, running: true });
    running = true;
    var b = document.getElementById('btn-run');
    if (b) b.textContent = 'Pause';
  },

  // ── キー入力 ──────────────────────────────────────────────────────────

  /** CP/M ターミナルに 1 文字送信（ASCII コード or 1 文字の文字列） */
  sendKey: function(ch) {
    workerSend({ type: 'sendKey', ch: typeof ch === 'string' ? ch.charCodeAt(0) : (ch | 0) });
  },

  /** CP/M ターミナルに文字列を送信。'\n' は CR(0x0D) に変換する */
  sendString: function(str) {
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      workerSend({ type: 'sendKey', ch: c === 0x0A ? 0x0D : c });
    }
  },

  // ── トリガー設定 ──────────────────────────────────────────────────────

  /**
   * トリガーを設定する。
   *
   * opts.type = 'reg'   : {regId, value}  レジスタ値一致
   *   regId: 0=A 1=F 2=B 3=C 4=D 5=E 6=H 7=L 8=SP 9=PC 10=BC 11=DE 12=HL
   * opts.type = 'instr' : {pc, opc}  命令フェッチ (-1=任意)
   * opts.type = 'io'    : {port}     I/O アクセス (port 省略=any)
   * opts.type = 'call'  : {addr}     CALL 命令 (addr 省略=any)
   * opts.type = 'ret'   : {}         RET 命令
   * opts.type = 'edge'  : {word, bit, dir}  信号エッジ (dir: 0=↑, 1=↓)
   * opts.type = 'value' : {word, mask, cmp} ring buffer 値一致
   */
  setTrigger: function(opts) {
    switch (opts.type) {
      case 'reg':
        workerSend({ type: 'setRegTrigger', regId: opts.regId | 0, value: opts.value | 0 });
        break;
      case 'instr':
        workerSend({ type: 'setInstrTrigger',
          pc:  opts.pc  !== undefined ? (opts.pc  | 0) : -1,
          opc: opts.opc !== undefined ? (opts.opc | 0) : -1 });
        break;
      case 'io':
        workerSend({ type: 'setTrigger', trigType: 1,
          port: opts.port !== undefined ? (opts.port | 0) : 0xFF, addr: 0 });
        break;
      case 'call':
        workerSend({ type: 'setTrigger', trigType: 2,
          port: 0xFF, addr: opts.addr !== undefined ? (opts.addr | 0) : 0 });
        break;
      case 'ret':
        workerSend({ type: 'setTrigger', trigType: 3, port: 0xFF, addr: 0 });
        break;
      case 'edge':
        workerSend({ type: 'setEdgeTrigger',
          word: opts.word | 0, bit: opts.bit | 0, dir: opts.dir | 0 });
        break;
      case 'value':
        workerSend({ type: 'setValueTrigger',
          word: opts.word | 0, mask: opts.mask >>> 0, cmp: opts.cmp >>> 0 });
        break;
      default:
        console.warn('[sim.setTrigger] 未知の type:', opts.type);
    }
  },

  /** トリガーを解除する */
  clearTrigger: function() {
    workerSend({ type: 'clearTrigger' });
    // JS 側の LA 状態もリセット（stale な _trigOn/_trigHead を持ち越さないため）
    if (window.la) {
      window.la._trigOn   = false;
      window.la._trigHead = -1;
    }
  },

  /**
   * MemWatch: 指定スロット(0/1/2)のアドレスを設定してサンプリングを開始する。
   * addr=-1 または enable=false でそのスロットを無効化。
   * @param {number} slot  0/1/2
   * @param {number} addr  0x0000-0xFFFF (-1 で無効)
   */
  setMemWatch: function(slot, addr) {
    var en = (addr >= 0);
    workerSend({ type: 'setMemWatch', slot: slot | 0, addr: en ? addr & 0xFFFF : 0, enable: en });
    // IIFE 内の mwEnabled/mwAddrs と入力欄の表示値を同期する
    if (window._laMemWatchSet) window._laMemWatchSet(slot | 0, addr);
  },

  /**
   * トリガー後にリングバッファへ記録を続けるサンプル数を設定する。
   * 0 でトリガー直後に停止。デフォルト 100。
   */
  setPostDelay: function(n) {
    workerSend({ type: 'setPostDelay', n: n | 0 });
  },

  // ── トリガー待ち ──────────────────────────────────────────────────────

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

  // ── メモリ直接アクセス ───────────────────────────────────────────────

  /**
   * 指定アドレスにバイト列を書き込む（DDT の S コマンド相当）。
   * RAM と Verilator RTL RAM の両方を更新する。
   * @param {number} addr  先頭アドレス (0x0000–0xFFFF)
   * @param {number[]|Uint8Array} bytes  書き込むバイト列
   */
  writeMem: function(addr, bytes) {
    var buf = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
    var copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    workerSend({ type: 'writeMem', addr: addr | 0, bytes: copy }, [copy]);
  },

  /**
   * 指定アドレスから len バイト読み出す（DDT の D コマンド相当）。
   * @param {number} addr  先頭アドレス
   * @param {number} len   バイト数
   * @returns {Promise<Uint8Array>}
   */
  readMem: function(addr, len) {
    return workerRequest({ type: 'readMem', addr: addr | 0, length: len | 0 })
      .then(function(msg) { return new Uint8Array(msg.bytes); });
  },

  /**
   * PC レジスタを直接設定する（命令境界で呼ぶこと）。
   * 次の eval() から新しい PC で実行を開始する。
   * @param {number} addr  設定する PC 値
   */
  setPC: function(addr) {
    workerSend({ type: 'setPC', addr: addr | 0 });
  },

  /**
   * 指定アドレスから実行を開始する（DDT の G コマンド相当）。
   * setPC(addr) + run() のショートカット。
   * @param {number} addr  実行開始アドレス
   */
  runFrom: function(addr) {
    workerSend({ type: 'setPC',       addr: addr | 0 });
    workerSend({ type: 'setRunning',  running: true });
    running = true;
    var b = document.getElementById('btn-run');
    if (b) b.textContent = 'Pause';
  },

  /**
   * 全レジスタを読み出す（DDT の X コマンド相当）。
   * sim_snap_regs() が返す [A, F, B, C, D, E, H, L, SPH, SPL, PCH, PCL] を
   * 名前付きオブジェクトに変換して返す。
   * @returns {Promise<{a,f,b,c,d,e,h,l,sp,pc: number}>}
   */
  getRegs: function() {
    return workerRequest({ type: 'getRegs' }).then(function(msg) {
      var r = new Uint8Array(msg.regs);
      return {
        a:  r[0],
        f:  r[1],
        b:  r[2],
        c:  r[3],
        d:  r[4],
        e:  r[5],
        h:  r[6],
        l:  r[7],
        sp: (r[8] << 8) | r[9],
        pc: (r[10] << 8) | r[11],
      };
    });
  },

  /**
   * 1 命令だけ実行して次の M1 フェッチ境界で停止する（DDT の T コマンド相当）。
   * HLT 等のタイムアウト (400 クロック) でも停止する。
   * 戻り時: ring_frozen=true, trig_hit=true。
   * 再開前に thawRing() または clearTrigger() を呼んでフリーズを解除する。
   */
  stepInstr: function() {
    workerSend({ type: 'stepInstr' });
  },

  /**
   * ring buffer のフリーズを解除する。
   * stepInstr() 後に ring_frozen=true になるため、再開前に呼ぶ。
   * clearTrigger() / setTrigger() でも reset_trigger_state() 経由で自動解除される。
   */
  thawRing: function() {
    workerSend({ type: 'thawRing' });
  },

  /**
   * レジスタを設定する（部分指定可）。f は setFlags 経由。
   * 命令境界（stepInstr 後や pause 中）で呼ぶこと。
   *
   * regId 対応: a=0, b=1, c=2, d=3, e=4, h=5, l=6, sp=7
   * pc は setPC() / runFrom() に委譲する。
   *
   * @param {{a?,f?,b?,c?,d?,e?,h?,l?,sp?,pc?: number}} regs  設定するレジスタのサブセット
   */
  setRegs: function(regs) {
    // name → [regId, mask]
    var MAP = {
      a: [0, 0xFF], b: [1, 0xFF], c: [2, 0xFF],
      d: [3, 0xFF], e: [4, 0xFF], h: [5, 0xFF], l: [6, 0xFF],
      sp: [7, 0xFFFF],
    };
    Object.keys(regs).forEach(function(key) {
      if (key === 'pc') {
        workerSend({ type: 'setPC', addr: regs.pc & 0xFFFF });
      } else if (key === 'f') {
        workerSend({ type: 'setFlags', value: regs.f & 0xFF });
      } else if (MAP[key]) {
        workerSend({ type: 'setReg', regId: MAP[key][0], value: regs[key] & MAP[key][1] });
      } else {
        console.warn('[sim.setRegs] 不明なレジスタ:', key);
      }
    });
  },

  // ── ring buffer 読み取り ─────────────────────────────────────────────

  /**
   * トリガー位置から offset サンプル離れた位置の信号値を返す。
   * offset=0 = トリガー発火サンプル、+n = 後方、-n = 前方。
   * トリガー未発火・不明シグナルの場合は undefined を返す。
   *
   * @param {string} signalId  LA_SIGNALS_ALL の id ('addr','dbus','ir','acc' など)
   * @param {number} [offset=0]
   * @returns {number|undefined}
   */
  readSample: function(signalId, offset) {
    var l = window.la;
    if (!l || !l._trigOn || l._trigHead < 0) return undefined;
    var sig = LA_SIGNALS_ALL.find(function(s) { return s.id === signalId; });
    if (!sig) {
      console.warn('[sim.readSample] 不明なシグナル:', signalId);
      return undefined;
    }
    var off    = offset !== undefined ? (offset | 0) : 0;
    var absIdx = ((l._trigHead + off) >>> 0) & (l._ringSize - 1);
    var mask   = sig.width >= 32 ? 0xFFFFFFFF : ((1 << sig.width) - 1);
    return (l._lastHeapu32[absIdx * l._RW + (sig.word | 0)] >>> (sig.bit | 0)) & mask;
  },

  // ── 信号メタデータ / スクリーンショット ────────────────────────────

  /**
   * Logic Analyzer で参照・設定できる全信号のメタデータ一覧を返す。
   *
   * 各エントリ: { id, label, word, bit, width, type, writable }
   *   - id      : readSample() / setTrigger(type:'edge'|'value') で使う識別子
   *   - writable: true の信号は setRegs() / writeMem() / setPC() で書き換え可能
   *
   * 書き換え可能な信号 (writable=true):
   *   acc(A), reg_f(F), reg_b(B), reg_c(C), reg_d(D), reg_e(E), reg_h(H), reg_l(L), sp, pc
   *
   * @returns {Array<{id:string, label:string, word:number, bit:number, width:number, type:string, writable:boolean}>}
   */
  getSignals: function() {
    var WRITABLE = {
      acc: true, reg_f: true, reg_b: true, reg_c: true, reg_d: true,
      reg_e: true, reg_h: true, reg_l: true, sp: true, pc: true,
    };
    return LA_SIGNALS_ALL.map(function(s) {
      return {
        id:       s.id,
        label:    s.label,
        word:     s.word,
        bit:      s.bit,
        width:    s.width,
        type:     s.type,
        writable: WRITABLE[s.id] === true,
      };
    });
  },

  /**
   * Logic Analyzer キャンバスの現在の描画内容を PNG DataURL として返す。
   *
   * Playwright からの使用例:
   *   const dataUrl = await page.evaluate(() => sim.screenshotCanvas());
   *   // 'data:image/png;base64,...' → base64 デコードして .png に書き込み
   *   const base64 = dataUrl.split(',')[1];
   *   const buf = Buffer.from(base64, 'base64');
   *   fs.writeFileSync('la.png', buf);
   *
   * @param {string} [selector='#la']  キャンバス要素の CSS セレクタ
   * @returns {string}  'data:image/png;base64,...' 形式の DataURL
   */
  screenshotCanvas: function(selector) {
    var canvas = document.querySelector(selector || '#la');
    if (!canvas || canvas.tagName !== 'CANVAS')
      throw new Error('[sim.screenshotCanvas] キャンバスが見つかりません: ' + (selector || '#la'));
    return canvas.toDataURL('image/png');
  },

  // ── 状態取得 ────────────────────────────────────────────────────────

  /** トリガーが発火済みか */
  get trigFired() { return !!(window.la && window.la._trigOn); },

  /** トリガー発火位置（ring buffer 絶対インデックス）。未発火時は -1 */
  get trigHead()  { return window.la && window.la._trigOn ? (window.la._trigHead | 0) : -1; },

  /** シミュレーションが実行中か */
  get isRunning() { return !!running; },
};
