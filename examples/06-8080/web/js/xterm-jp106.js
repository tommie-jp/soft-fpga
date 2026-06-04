/**
 * xterm-jp106.js — xterm.js 向け日本語 106 キーボード補正ライブラリ
 *
 * ## 動機
 * Windows の Google IME（英数モード）や US キーボードレイアウト設定のとき、
 * xterm.js に日本語 106 キーボードを接続すると記号キーが US 配列として
 * 解釈されてしまう。e.key は OS/IME の状態に依存するため使えず、
 * e.code（物理キー位置）+ e.shiftKey で JP 106 配列を明示的にルックアップする。
 *
 * ## キー処理の優先順位
 *  1. captureCtrl  — ブラウザに取られる Ctrl+key を document capture で横取り
 *  2. SUPPRESS_CODES — IMEキー・システムキーを抑制（レイアウト問わず）
 *  3. extraMap     — アプリ定義のカスタムキーシーケンス（レイアウト問わず）
 *  4. JP106_TABLE  — jp106 モード時の記号リマップ
 *  5. xterm.js 委任 — F1〜F12 / 矢印 / ナビゲーション
 *
 * ## 使い方
 * ```html
 * <script src="xterm-jp106.js"></script>
 * <script>
 *   var jp = new XtermJP106({
 *     term:        term,
 *     onSendKey:   function(charCode) { workerSend({ type:'sendKey', ch:charCode }); },
 *     onSendSeq:   function(seq) {
 *       for (var i = 0; i < seq.length; i++)
 *         workerSend({ type:'sendKey', ch: seq.charCodeAt(i) });
 *     },
 *     onInputChar: function(ch) { inputBuf += ch; histIdx = -1; },
 *     storageKey:  'cpm_kbd_layout',
 *     autoDetect:  true,
 *     debug:       false,
 *   });
 *   jp.bindLayoutBar(document.querySelectorAll('input[name="kbd-layout"]'));
 * </script>
 * ```
 *
 * ## 公開 API
 * - `getLayout()` / `setLayout(layout)` / `bindLayoutBar(radios)` / `detect()`
 * - `XtermJP106.TABLE`            JP106 記号マップ
 * - `XtermJP106.SUPPRESS_CODES`   抑制キー一覧
 * - `XtermJP106.FKEY_SEQ`         F キー ESC シーケンス参照表
 * - `XtermJP106.NAV_SEQ`          ナビゲーション ESC シーケンス参照表
 * - `XtermJP106.DETECT_PROBES`    自動検知照合キー
 * - `XtermJP106.DEFAULT_CTRL_CAPTURE` ブラウザ横取りデフォルトリスト
 */
(function (global) {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  // 1. JP 106 記号マップ
  //    [通常, Shift]  null = 送信なし（Shift+0 など JP106 未定義のキー）
  // ══════════════════════════════════════════════════════════════
  var TABLE = {
    'Digit1':       ['1',   '!'],
    'Digit2':       ['2',   '"'],   // US では @
    'Digit3':       ['3',   '#'],
    'Digit4':       ['4',   '$'],
    'Digit5':       ['5',   '%'],
    'Digit6':       ['6',   '&'],   // US では ^
    'Digit7':       ['7',   "'"],   // US では &
    'Digit8':       ['8',   '('],   // US では *
    'Digit9':       ['9',   ')'],
    'Digit0':       ['0',   null],  // Shift+0 は JP106 未定義
    'Minus':        ['-',   '='],   // US では - / _
    'Equal':        ['^',   '~'],   // US では = / +
    'BracketLeft':  ['@',   '`'],   // US では [ / {
    'BracketRight': ['[',   '{'],   // US では ] / }
    'Backslash':    [']',   '}'],   // US では \ / |
    'Semicolon':    [';',   '+'],   // US では ; / :
    'Quote':        [':',   '*'],   // US では ' / "
    'Comma':        [',',   '<'],
    'Period':       ['.',   '>'],
    'Slash':        ['/',   '?'],
    'IntlYen':      ['\\',  '|'],   // JP 固有: ¥マークキー
    'IntlRo':       ['\\',  '_'],   // JP 固有: ろキー
  };

  // ══════════════════════════════════════════════════════════════
  // 2. 常に抑制するキーコード（レイアウト問わず端末へ送らない）
  // ══════════════════════════════════════════════════════════════
  var SUPPRESS_CODES = {
    'Backquote':   '半角/全角',
    'NonConvert':  '無変換',
    'Convert':     '変換',
    'KanaMode':    'カタカナ/ひらがな',
    'MetaLeft':    'Windows キー (左)',
    'MetaRight':   'Windows キー (右)',
    'PrintScreen': 'PrintScreen',
    'ScrollLock':  'ScrollLock',
    'Pause':       'Pause/Break',
  };

  // ══════════════════════════════════════════════════════════════
  // 3. 参照用シーケンステーブル（xterm.js に委任する場合の確認用）
  // ══════════════════════════════════════════════════════════════

  var FKEY_SEQ = {
    'F1':  '\x1bOP',    'F2':  '\x1bOQ',    'F3':  '\x1bOR',    'F4':  '\x1bOS',
    'F5':  '\x1b[15~',  'F6':  '\x1b[17~',  'F7':  '\x1b[18~',  'F8':  '\x1b[19~',
    'F9':  '\x1b[20~',  'F10': '\x1b[21~',  'F11': '\x1b[23~',  'F12': '\x1b[24~',
  };

  var NAV_SEQ = {
    'ArrowUp':    '\x1b[A',  'ArrowDown':  '\x1b[B',
    'ArrowRight': '\x1b[C',  'ArrowLeft':  '\x1b[D',
    'Insert':   '\x1b[2~',   'Delete':   '\x1b[3~',
    'Home':     '\x1bOH',    'End':      '\x1bOF',
    'PageUp':   '\x1b[5~',   'PageDown': '\x1b[6~',
  };

  // ══════════════════════════════════════════════════════════════
  // 4. 自動検知プローブ
  // ══════════════════════════════════════════════════════════════
  var DETECT_PROBES = [
    { code: 'BracketLeft',  jp106: '@',  us: '[' },
    { code: 'Equal',        jp106: '^',  us: '=' },
    { code: 'Quote',        jp106: ':',  us: "'" },
    { code: 'Semicolon',    jp106: ';',  us: ';' },
  ];

  // ══════════════════════════════════════════════════════════════
  // 5. ブラウザに横取りされるキーの既定リスト
  //
  // 【Ctrl+key】
  //    制御文字コード = e.code の英字部分 & 0x1F
  //      'KeyW' → 'W'(0x57) & 0x1F = 0x17  (Ctrl+W = kill word / readline)
  //      'KeyD' → 'D'(0x44) & 0x1F = 0x04  (Ctrl+D = EOF / 端末では重大)
  //    captureCtrl: false で無効化。配列で対象を上書き可。
  //
  // 【Alt+矢印】
  //    Alt+← / Alt+→ はブラウザの「戻る/進む」が発動する。
  //    端末では ESC+b / ESC+f（単語ジャンプ）として送る (readline/emacs 互換)。
  //    captureAlt: false で無効化。
  // ══════════════════════════════════════════════════════════════

  // ターミナルにフォーカスがある間、Ctrl+[A-Z] を全て横取りする（デフォルト）。
  // ブラウザのタブ操作・検索・印刷等をまとめて阻止し、全制御文字を端末へ届ける。
  //
  //   Ctrl+A = 0x01 (SOH)   Ctrl+N = 0x0E (SO)
  //   Ctrl+B = 0x02 (STX)   Ctrl+O = 0x0F (SI)
  //   Ctrl+C = 0x03 (ETX)   Ctrl+P = 0x10 (DLE)
  //   Ctrl+D = 0x04 (EOT)   Ctrl+Q = 0x11 (DC1/XON)
  //   Ctrl+E = 0x05 (ENQ)   Ctrl+R = 0x12 (DC2)
  //   Ctrl+F = 0x06 (ACK)   Ctrl+S = 0x13 (DC3/XOFF)
  //   Ctrl+G = 0x07 (BEL)   Ctrl+T = 0x14 (DC4)
  //   Ctrl+H = 0x08 (BS)    Ctrl+U = 0x15 (NAK)
  //   Ctrl+I = 0x09 (HT)    Ctrl+V = 0x16 (SYN)
  //   Ctrl+J = 0x0A (LF)    Ctrl+W = 0x17 (ETB)
  //   Ctrl+K = 0x0B (VT)    Ctrl+X = 0x18 (CAN)
  //   Ctrl+L = 0x0C (FF)    Ctrl+Y = 0x19 (EM)
  //   Ctrl+M = 0x0D (CR)    Ctrl+Z = 0x1A (SUB)
  //
  // captureCtrl: false で無効化。string[] で特定キーのみ横取り（後方互換）。
  // Ctrl+Shift+I（DevTools）等の Shift 付きは対象外。
  // Ctrl+数字（タブ切り替え）も対象外（e.code = 'Digit*' のため）。
  //
  // 後方互換用: 旧デフォルトリスト（captureCtrl に配列で渡すと個別指定になる）
  var DEFAULT_CTRL_CAPTURE = [
    'KeyD', 'KeyF', 'KeyH', 'KeyJ', 'KeyL',
    'KeyN', 'KeyP', 'KeyR', 'KeyS', 'KeyT', 'KeyU', 'KeyW',
  ];

  // Alt+矢印キーの横取り設定
  // Alt+← / Alt+→ → ESC b / ESC f（readline 単語ジャンプ）
  // Alt+↑ / Alt+↓ → ESC < / ESC >（先頭・末尾履歴）
  var DEFAULT_ALT_CAPTURE = [
    { code: 'ArrowLeft',  seq: '\x1bb' },  // Alt+← = ESC b (backward-word)
    { code: 'ArrowRight', seq: '\x1bf' },  // Alt+→ = ESC f (forward-word)
    { code: 'ArrowUp',    seq: '\x1b<' },  // Alt+↑ = ESC < (beginning-of-history)
    { code: 'ArrowDown',  seq: '\x1b>' },  // Alt+↓ = ESC > (end-of-history)
  ];

  // ══════════════════════════════════════════════════════════════
  // 6. コンストラクタ
  // ══════════════════════════════════════════════════════════════
  /**
   * @param {object}         opts
   * @param {object}         opts.term          xterm.js Terminal インスタンス (必須)
   * @param {function}       opts.onSendKey     charCode を受け取るコールバック (必須)
   * @param {function}       [opts.onSendSeq]   ESC シーケンス文字列を受け取るコールバック
   * @param {function}       [opts.onInputChar] 印字可能文字を受け取るコールバック
   * @param {string}         [opts.storageKey]  localStorage キー (既定: 'xterm_jp106_layout')
   * @param {boolean}        [opts.debug]       コンソールログ (既定: false)
   * @param {boolean}        [opts.autoDetect]  true: localStorage 未設定時に自動検知
   * @param {boolean|Array}  [opts.captureCtrl] ブラウザに取られる Ctrl+key の横取り設定。
   *                                            true / 省略  → Ctrl+[A-Z] を全て横取り（推奨）
   *                                            string[]     → 指定コードのみ横取り（後方互換）
   *                                            false        → 横取りしない
   * @param {boolean|Array}  [opts.captureAlt]  Alt+矢印キーの横取り設定。
   *                                            true / 省略  → DEFAULT_ALT_CAPTURE を使用
   *                                            object[]     → { code, seq } の配列
   *                                            false        → 横取りしない
   * @param {object}         [opts.extraMap]    カスタムキー → シーケンスマップ
   */
  function XtermJP106(opts) {
    if (!opts || !opts.term)      { throw new Error('XtermJP106: opts.term が必要です'); }
    if (!opts || !opts.onSendKey) { throw new Error('XtermJP106: opts.onSendKey が必要です'); }

    this._term         = opts.term;
    this._onSendKey    = opts.onSendKey;
    this._onSendSeq    = opts.onSendSeq    || null;
    this._onInputChar  = opts.onInputChar  || function () {};
    this._storageKey   = opts.storageKey   || 'xterm_jp106_layout';
    this._debug        = opts.debug        || false;
    this._extraMap     = opts.extraMap     || {};
    this._boundRadios  = [];

    var saved = localStorage.getItem(this._storageKey);
    this._layout = saved || 'us';

    // captureCtrl の正規化
    // false → 無効  string[] → 指定リストのみ  true/省略 → 全 Ctrl+[A-Z]
    var cc = opts.captureCtrl;
    var ctrlCapture = (cc === false)    ? null  :
                      Array.isArray(cc) ? cc    :
                      'all';

    // captureAlt の正規化
    var ca = opts.captureAlt;
    var altCaptureList = (ca === false)    ? [] :
                         Array.isArray(ca) ? ca :
                         DEFAULT_ALT_CAPTURE;

    this._attach();
    if (ctrlCapture !== null)  { this._attachCapture(ctrlCapture); }
    if (altCaptureList.length) { this._attachAltCapture(altCaptureList); }
    if (opts.autoDetect && saved === null) { this.detect(); }
  }

  // ── 公開メソッド ──────────────────────────────────────────────

  XtermJP106.prototype.getLayout = function () {
    return this._layout;
  };

  XtermJP106.prototype.setLayout = function (layout) {
    this._layout = layout;
    localStorage.setItem(this._storageKey, layout);
    this._boundRadios.forEach(function (r) {
      r.checked = (r.value === layout);
    });
  };

  XtermJP106.prototype.bindLayoutBar = function (radios) {
    var self = this;
    self._boundRadios = [];
    radios.forEach(function (r) {
      self._boundRadios.push(r);
      r.checked = (r.value === self._layout);
      r.addEventListener('change', function () { self.setLayout(this.value); });
    });
  };

  /**
   * getLayoutMap() でキーボードレイアウトを検出し自動設定する。
   * Chrome/Edge 97+ のみ対応。非対応時は何もしない。
   * @returns {Promise<string|null>}
   */
  XtermJP106.prototype.detect = function () {
    var self = this;
    if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) {
      if (self._debug) {
        console.log('[KBD] autoDetect: Keyboard Layout Map API 非対応（Chrome/Edge 以外）');
      }
      return Promise.resolve(null);
    }
    return navigator.keyboard.getLayoutMap().then(function (map) {
      var jp106Score = 0, usScore = 0;
      DETECT_PROBES.forEach(function (probe) {
        var actual = map.get(probe.code);
        if (actual === probe.jp106) { jp106Score++; }
        if (actual === probe.us)    { usScore++;    }
        if (self._debug) {
          console.log('[KBD] autoDetect probe:', probe.code, '=', JSON.stringify(actual));
        }
      });
      var detected = (jp106Score >= usScore) ? 'jp106' : 'us';
      if (self._debug) {
        console.log('[KBD] autoDetect: jp106=' + jp106Score +
          ' us=' + usScore + ' → ' + detected);
      }
      if (detected !== self._layout) {
        console.log('[KBD] autoDetect: レイアウトを', JSON.stringify(detected), 'に自動設定');
        self.setLayout(detected);
      }
      return detected;
    }).catch(function (err) {
      if (self._debug) { console.warn('[KBD] autoDetect: getLayoutMap() エラー', err); }
      return null;
    });
  };

  // ── 内部メソッド ──────────────────────────────────────────────

  XtermJP106.prototype._sendSeq = function (seq) {
    if (this._onSendSeq) {
      this._onSendSeq(seq);
    } else {
      for (var i = 0; i < seq.length; i++) { this._onSendKey(seq.charCodeAt(i)); }
    }
  };

  /** ターミナル要素がフォーカスを持っているか */
  XtermJP106.prototype._hasFocus = function () {
    var el = this._term.element;
    return !!(el && el.contains(document.activeElement));
  };

  /**
   * Alt+矢印キーを横取りし、ブラウザの「戻る/進む」を防いで
   * readline 互換の ESC シーケンスをターミナルへ送る。
   *
   * Alt+←  → ESC b  (backward-word)
   * Alt+→  → ESC f  (forward-word)
   * Alt+↑  → ESC <  (beginning-of-history)
   * Alt+↓  → ESC >  (end-of-history)
   *
   * @param {{ code: string, seq: string }[]} altCaptureList
   */
  XtermJP106.prototype._attachAltCapture = function (altCaptureList) {
    var self = this;
    // { code → seq } の検索用マップを事前構築
    var altMap = {};
    altCaptureList.forEach(function (entry) { altMap[entry.code] = entry.seq; });

    document.addEventListener('keydown', function (e) {
      // Alt 単独（Ctrl / Meta / Shift なし）のみ対象
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
      if (!self._hasFocus()) { return; }

      var seq = altMap[e.code];
      if (!seq) { return; }

      e.preventDefault();
      e.stopPropagation();

      if (self._debug) {
        console.log('[KBD] capture Alt+' + e.code + ' → ' + JSON.stringify(seq));
      }
      self._sendSeq(seq);
    }, true);
  };

  /**
   * document capture フェーズで Ctrl+key を横取りし、ブラウザの
   * タブ操作・検索・印刷等を防いでターミナルへ制御文字を送る。
   *
   * イベント伝播の仕組み:
   *   capture: document → ... → term.element （ここで止める）
   *   bubble:  term.element → ... → document
   *
   * capture フェーズで stopPropagation() することで xterm.js の
   * bubble リスナに届かなくなり、二重送信を防ぐ。
   *
   * @param {'all'|string[]} mode
   *   'all'    → e.code が 'Key[A-Z]' の Ctrl+[A-Z] を全て横取り（推奨）
   *   string[] → 指定した e.code のみ横取り（後方互換）
   */
  XtermJP106.prototype._attachCapture = function (mode) {
    var self = this;
    var captureAll = (mode === 'all');

    document.addEventListener('keydown', function (e) {
      // Ctrl 単独（Meta / Alt / Shift なし）のみ対象
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) { return; }

      // ターミナルにフォーカスがあるときのみ横取り
      if (!self._hasFocus()) { return; }

      // e.code が 'Key[A-Z]' 形式（英字キー）か確認
      if (!/^Key[A-Z]$/.test(e.code)) { return; }

      // 個別リスト指定の場合はそのリストに含まれるか確認
      if (!captureAll && mode.indexOf(e.code) < 0) { return; }

      // 制御文字コードを計算: 'KeyW' → 'W'(0x57) & 0x1F = 0x17
      var letter   = e.code.slice(3);             // 'KeyW' → 'W'
      var ctrlChar = letter.charCodeAt(0) & 0x1F; // 0x57 & 0x1F = 0x17

      // ① ブラウザのデフォルト動作（タブ閉じ等）を阻止
      e.preventDefault();
      // ② xterm.js の bubble リスナに届かないようにする（二重送信防止）
      e.stopPropagation();

      if (self._debug) {
        console.log('[KBD] capture ^' + letter, '(0x' + ctrlChar.toString(16) + ')');
      }

      self._onSendKey(ctrlChar);
    }, true); // useCapture = true（capture フェーズで先行取得）
  };

  /** xterm.js の customKeyEventHandler を登録する */
  XtermJP106.prototype._attach = function () {
    var self = this;

    this._term.attachCustomKeyEventHandler(function (e) {

      if (self._debug) {
        console.log('[KBD]', {
          type:     e.type,
          code:     e.code,
          key:      e.key,
          keyCode:  e.keyCode,
          shift:    e.shiftKey,
          ctrl:     e.ctrlKey,
          alt:      e.altKey,
          meta:     e.metaKey,
          layout:   self._layout,
          entry:    TABLE[e.code] || null,
          charCode: e.key && e.key.length === 1 ? e.key.charCodeAt(0) : null,
        });
      }

      // Step 1: 常に抑制するキー（IME・システムキー）
      var suppressReason = SUPPRESS_CODES[e.code];
      if (suppressReason) {
        if (self._debug && e.type === 'keydown') {
          console.log('[KBD] suppress', e.code, '(' + suppressReason + ')');
        }
        return false;
      }

      // Step 2: extraMap — アプリ定義カスタムキー（修飾キーなし）
      if (self._extraMap[e.code] && !e.ctrlKey && !e.metaKey) {
        if (e.type !== 'keydown') { return false; }
        var mapVal = self._extraMap[e.code];
        var seq    = (typeof mapVal === 'function') ? mapVal(e) : mapVal;
        if (seq) {
          if (self._debug) {
            console.log('[KBD] extraMap', e.code, '→', JSON.stringify(seq));
          }
          self._sendSeq(seq);
        }
        return false;
      }

      // Step 3: US 配列 / Ctrl・Meta・Alt 付きは xterm.js に委任
      //   （Ctrl+key は _attachCapture が横取りしなかったものが届く）
      if (self._layout !== 'jp106') { return true; }
      if (e.ctrlKey || e.metaKey || e.altKey) { return true; }

      // Step 4: JP106 テーブルルックアップ
      var entry = TABLE[e.code];
      if (!entry) { return true; }

      // keypress / keyup は xterm.js に渡さない（二重送信防止）
      if (e.type !== 'keydown') { return false; }

      var ch = e.shiftKey ? entry[1] : entry[0];
      if (ch === null || ch === undefined) { return false; }

      var charCode = ch.charCodeAt(0);
      if (self._debug) {
        console.log('[KBD] jp106 remap →', JSON.stringify(ch),
          '(0x' + charCode.toString(16) + ')');
      }
      self._onInputChar(ch);
      self._onSendKey(charCode);
      return false;
    });
  };

  /**
   * textarea や任意の input 要素に JP106 キーボード補正を付与する。
   *
   * ターミナルと異なり captureCtrl / captureAlt は適用しない。
   * エディタ固有の Ctrl+S（保存）・Ctrl+A（全選択）等はそのまま通す。
   *
   * capture フェーズ（useCapture: true）で登録するため、CodeMirror など
   * 子要素の独自ハンドラより先に発火し、preventDefault() で二重入力を防ぐ。
   *
   * @param {Element}           el         キーイベントを受け取る DOM 要素（textarea / CM コンテナ等）
   * @param {function(string)?} [insertFn] 文字 ch を挿入するコールバック。
   *                                       省略時は textarea への直接書き込み
   *                                       (execCommand fallback + selectionStart 操作) を使用。
   *
   * @example
   *   // CodeMirror 6
   *   var container = document.getElementById('editor-cm');
   *   jp106.attachToInput(container, function(ch) {
   *     cmView.dispatch(cmView.state.replaceSelection(ch));
   *   });
   *
   *   // textarea
   *   jp106.attachToInput(textareaEl);
   */
  XtermJP106.prototype.attachToInput = function (el, insertFn) {
    var self = this;

    // 同一要素への二重登録を防ぐ
    if (el._xterm_jp106_attached) { return; }
    el._xterm_jp106_attached = true;

    el.addEventListener('keydown', function (e) {
      // JP106 モードでなければスキップ
      if (self._layout !== 'jp106') { return; }
      // Ctrl / Meta / Alt 付きはエディタのショートカットとして通す
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }

      // IME・システムキーは抑制
      if (SUPPRESS_CODES[e.code]) {
        e.preventDefault();
        return;
      }

      // JP106 テーブルルックアップ
      var entry = TABLE[e.code];
      if (!entry) { return; }

      var ch = e.shiftKey ? entry[1] : entry[0];
      if (ch === null || ch === undefined) {
        // Shift+0 など JP106 未定義キー：デフォルト動作だけ止める
        e.preventDefault();
        return;
      }

      // ブラウザのデフォルト入力（beforeinput / execCommand による文字挿入）を阻止
      e.preventDefault();

      if (self._debug) {
        console.log('[KBD] attachToInput jp106 remap →', JSON.stringify(ch));
      }

      if (insertFn) {
        insertFn(ch);
      } else {
        // textarea 直接操作（execCommand は deprecated のため両方用意）
        if (!document.execCommand('insertText', false, ch)) {
          var start = el.selectionStart;
          var end   = el.selectionEnd;
          el.value  = el.value.slice(0, start) + ch + el.value.slice(end);
          el.selectionStart = el.selectionEnd = start + ch.length;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, true); // capture フェーズ: CM の contenteditable ハンドラより先に発火
  };

  // ── 静的プロパティ ────────────────────────────────────────────
  XtermJP106.TABLE                = TABLE;
  XtermJP106.SUPPRESS_CODES       = SUPPRESS_CODES;
  XtermJP106.FKEY_SEQ             = FKEY_SEQ;
  XtermJP106.NAV_SEQ              = NAV_SEQ;
  XtermJP106.DETECT_PROBES        = DETECT_PROBES;
  XtermJP106.DEFAULT_CTRL_CAPTURE = DEFAULT_CTRL_CAPTURE;
  XtermJP106.DEFAULT_ALT_CAPTURE  = DEFAULT_ALT_CAPTURE;

  global.XtermJP106 = XtermJP106;

}(typeof window !== 'undefined' ? window : this));
