/**
 * monaco-wasm-editor.js — Monaco Editor ラッパー（WASM FS / 他プロジェクト共用）
 *
 * ## 依存
 *   - Monaco Editor (AMD, CDN から動的ロード — 外部 <script> タグ不要)
 *   - xterm-jp106.js (オプション: attachJP106() で接続)
 *
 * ## 使い方
 * ```html
 * <script src="monaco-wasm-editor.js"></script>
 * <script>
 *   var ed = new MonacoWasmEditor({ container: '#editor-cm' });
 *   ed.open('main.c', text).then(function() {
 *     ed.attachJP106(window._jp106);  // JIS キーボード（任意）
 *   });
 *   ed.getValue();
 *   ed.setLineNumbers(false);
 *   ed.destroy();
 *
 *   // 事前ロード（WASM ロードと並行して Monaco を先読み）
 *   MonacoWasmEditor.preload();
 * </script>
 * ```
 *
 * ## 公開 API
 *   new MonacoWasmEditor(options)
 *   .open(name, text)      → Promise<void>   エディタを開く
 *   .getValue()            → string
 *   .setValue(text)        → void
 *   .setLineNumbers(bool)  → void            行番号 ON/OFF
 *   .setTheme(theme)       → void            'vs' | 'vs-dark'
 *   .attachJP106(jp106)    → void            XtermJP106 インスタンスを接続（後付け可）
 *   .focus()               → void
 *   .destroy()             → void            dispose + コンテナクリア
 *
 *   MonacoWasmEditor.preload([options])  → Promise<void>   Monaco を先読み
 *
 * ## オプション
 *   container   {string|HTMLElement}  マウント先（必須）
 *   cdnVersion  {string}  Monaco バージョン（default: '0.52.0'）
 *   cdnBase     {string}  CDN ベース URL 全体を上書きしたい場合
 *   theme       {string}  'vs' | 'vs-dark'（default: 'vs'）
 *   fontSize    {number}  フォントサイズ px（default: 14）
 *   fontFamily  {string}  フォントファミリー
 *   asciiOnly   {boolean} ASCII 以外の入力をブロック（default: true）
 *   minimap     {boolean} ミニマップ表示（default: false）
 *   wordWrap    {string}  'on' | 'off'（default: 'on'）
 *   langMap     {object}  追加拡張子マップ { 'V': 'plaintext', ... }
 *                         DEFAULT_LANG_MAP より優先される
 */
(function (global) {
  'use strict';

  // ── CDN デフォルト ─────────────────────────────────────────────
  var DEFAULT_CDN_VERSION = '0.52.0';
  var DEFAULT_CDN_BASE =
    'https://cdn.jsdelivr.net/npm/monaco-editor@' + DEFAULT_CDN_VERSION + '/min/vs';

  // ── 拡張子 → Monaco 言語 ID マップ（デフォルト） ───────────────
  // langMap オプションで個別に上書き可能
  var DEFAULT_LANG_MAP = {
    'C'  : 'cpp',
    'H'  : 'cpp',
    'CPP': 'cpp',
    'CC' : 'cpp',
    'CXX': 'cpp',
    'HPP': 'cpp',
    'TXT': 'plaintext',
    'MAC': 'plaintext',
    'ASM': 'plaintext',
    'S'  : 'plaintext',
    'INC': 'plaintext',
  };

  // ── Monaco AMD シングルトンロード ──────────────────────────────
  // 複数インスタンスが同一ページにあっても二重ロードしない。
  // 先に呼ばれた cdnBase が使われる（後続は同じ Promise を受け取る）。
  var _monacoLoadPromise = null;

  function _loadMonaco(cdnBase) {
    if (_monacoLoadPromise) return _monacoLoadPromise;
    _monacoLoadPromise = new Promise(function (resolve, reject) {

      function _setup() {
        // MonacoEnvironment が未設定のときだけ構成する（外部で設定済みの場合を尊重）
        if (!global.MonacoEnvironment) {
          global.MonacoEnvironment = {
            getWorkerUrl: function (moduleId, label) {
              // Worker を Blob URL で包む（CDN cross-origin 制約を回避）
              var workerPath = (label === 'typescript' || label === 'javascript')
                ? cdnBase + '/language/typescript/ts.worker.js'
                : cdnBase + '/base/worker/workerMain.js';
              var src = 'self.MonacoEnvironment={baseUrl:"' + cdnBase + '/"};'
                      + 'importScripts("' + workerPath + '");';
              return URL.createObjectURL(
                new Blob([src], { type: 'application/javascript' })
              );
            }
          };
        }
        global.require.config({ paths: { vs: cdnBase } });
        global.require(['vs/editor/editor.main'], function () {
          resolve(global.monaco);
        }, function (err) {
          console.error('[MonacoWasmEditor] Monaco のロードに失敗しました:', err);
          reject(err);
        });
      }

      // AMD loader (vs/loader.js) が既にある場合はそのまま使う
      if (global.require && global.require.config) {
        _setup();
        return;
      }

      // なければ <script> を動的注入してロード
      var script = document.createElement('script');
      script.src = cdnBase + '/loader.js';
      script.onload = _setup;
      script.onerror = function () {
        var msg = '[MonacoWasmEditor] loader.js のロードに失敗しました: ' + cdnBase;
        console.error(msg);
        reject(new Error(msg));
      };
      document.head.appendChild(script);
    });
    return _monacoLoadPromise;
  }

  // ── 言語 ID 解決 ────────────────────────────────────────────────
  function _getLang(name, langMap) {
    var dot = name.lastIndexOf('.');
    if (dot < 0) return 'plaintext';
    var ext = name.slice(dot + 1).toUpperCase();
    // インスタンスの langMap を優先し、なければ DEFAULT_LANG_MAP にフォールバック
    if (langMap && Object.prototype.hasOwnProperty.call(langMap, ext)) return langMap[ext];
    if (Object.prototype.hasOwnProperty.call(DEFAULT_LANG_MAP, ext)) return DEFAULT_LANG_MAP[ext];
    return 'plaintext';
  }

  // ══════════════════════════════════════════════════════════════
  // MonacoWasmEditor コンストラクタ
  // ══════════════════════════════════════════════════════════════
  function MonacoWasmEditor(options) {
    options = options || {};

    // コンテナ解決
    var container = options.container;
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) {
      throw new Error('[MonacoWasmEditor] container が見つかりません: ' + options.container);
    }

    this._container  = container;
    this._cdnBase    = options.cdnBase ||
      'https://cdn.jsdelivr.net/npm/monaco-editor@' +
      (options.cdnVersion || DEFAULT_CDN_VERSION) + '/min/vs';
    this._theme      = options.theme      || 'vs';
    this._fontSize   = options.fontSize   !== undefined ? options.fontSize   : 14;
    this._fontFamily = options.fontFamily || '"Courier New", Courier, monospace';
    this._asciiOnly  = options.asciiOnly  !== undefined ? options.asciiOnly  : true;
    this._minimap    = options.minimap    !== undefined ? options.minimap    : false;
    this._wordWrap   = options.wordWrap   || 'on';
    this._langMap    = options.langMap    || {};

    this._editor     = null;   // monaco.editor.IStandaloneCodeEditor
    this._jp106      = null;   // XtermJP106 インスタンス

    // 行番号の初期状態を localStorage から復元（デフォルト ON）
    this._lineNums = localStorage.getItem('editor-linenum') !== '0';
  }

  // ── open(name, text) → Promise<void> ──────────────────────────
  MonacoWasmEditor.prototype.open = function (name, text) {
    var self = this;
    return _loadMonaco(this._cdnBase).then(function () {
      self._makeEditor(text, _getLang(name, self._langMap));
      if (self._jp106)    self._setupJP106();
      if (self._asciiOnly) self._setupAsciiFilter();
    });
  };

  // ── エディタ生成 ───────────────────────────────────────────────
  MonacoWasmEditor.prototype._makeEditor = function (text, lang) {
    // 既存インスタンスを確実に破棄してからコンテナをクリア
    if (this._editor) { this._editor.dispose(); this._editor = null; }
    this._container.innerHTML = '';

    this._editor = global.monaco.editor.create(this._container, {
      value               : text,
      language            : lang,
      theme               : this._theme,
      automaticLayout     : true,         // ResizeObserver でコンテナリサイズに追従
      lineNumbers         : this._lineNums ? 'on' : 'off',
      fontFamily          : this._fontFamily,
      fontSize            : this._fontSize,
      scrollBeyondLastLine: false,
      minimap             : { enabled: this._minimap },
      wordWrap            : this._wordWrap,
    });

    this._editor.focus();
  };

  // ── JIS キーボード統合 ─────────────────────────────────────────
  // xterm-jp106.js の attachToInput(el, insertFn) を流用する。
  // insertFn コールバックで Monaco の executeEdits を呼ぶだけなので
  // JP106 ロジックを一切再実装しない。
  MonacoWasmEditor.prototype._setupJP106 = function () {
    if (!this._jp106 || !this._editor) return;
    var self = this;
    this._jp106.attachToInput(
      this._editor.getDomNode(),
      function (ch) {
        self._editor.executeEdits('jp106', [{
          range           : self._editor.getSelection(),
          text            : ch,
          forceMoveMarkers: true,
        }]);
      }
    );
  };

  // ── ASCII フィルタ ─────────────────────────────────────────────
  // beforeinput の capture フェーズで非 ASCII 文字をブロックする。
  // JIS キーボードリマップ後の insertFn 経由入力は executeEdits を直接叩くため
  // このフィルタとは干渉しない。
  MonacoWasmEditor.prototype._setupAsciiFilter = function () {
    if (!this._editor) return;
    this._editor.getDomNode().addEventListener('beforeinput', function (e) {
      if (!e.data) return;
      for (var i = 0; i < e.data.length; i++) {
        if (e.data.charCodeAt(i) > 127) { e.preventDefault(); return; }
      }
    }, true);
  };

  // ── 公開 API ───────────────────────────────────────────────────

  /** エディタの現在のテキストを返す。未初期化時は空文字列。 */
  MonacoWasmEditor.prototype.getValue = function () {
    return this._editor ? this._editor.getValue() : '';
  };

  /** エディタのテキストを置き換える。 */
  MonacoWasmEditor.prototype.setValue = function (text) {
    if (this._editor) this._editor.setValue(text);
  };

  /**
   * 行番号の表示/非表示を切り替える。
   * エディタが未初期化のときは状態だけ保存し、次の open() 時に反映する。
   */
  MonacoWasmEditor.prototype.setLineNumbers = function (on) {
    this._lineNums = !!on;
    if (this._editor) {
      this._editor.updateOptions({ lineNumbers: on ? 'on' : 'off' });
    }
  };

  /** Monaco テーマを切り替える（'vs' | 'vs-dark' | 'hc-black' 等）。 */
  MonacoWasmEditor.prototype.setTheme = function (theme) {
    this._theme = theme;
    if (global.monaco) global.monaco.editor.setTheme(theme);
  };

  /**
   * XtermJP106 インスタンスを接続する。
   * open() より前でも後でも呼べる。
   * open() 後に呼んだ場合はその場でキーボードリスナーを登録する。
   */
  MonacoWasmEditor.prototype.attachJP106 = function (jp106) {
    this._jp106 = jp106 || null;
    if (this._editor && this._jp106) this._setupJP106();
  };

  /** エディタにフォーカスを移す。 */
  MonacoWasmEditor.prototype.focus = function () {
    if (this._editor) this._editor.focus();
  };

  /** エディタを破棄してコンテナをクリアする。 */
  MonacoWasmEditor.prototype.destroy = function () {
    if (this._editor) { this._editor.dispose(); this._editor = null; }
    this._container.innerHTML = '';
  };

  // ── 静的メソッド: 事前ロード ───────────────────────────────────
  /**
   * Monaco をバックグラウンドで先読みする。
   * WASM バイナリのロードと並行して呼ぶと初回 open() が高速になる。
   * @param {object} [options]  cdnVersion / cdnBase のみ有効
   * @returns {Promise<void>}
   */
  MonacoWasmEditor.preload = function (options) {
    options = options || {};
    var cdnBase = options.cdnBase ||
      'https://cdn.jsdelivr.net/npm/monaco-editor@' +
      (options.cdnVersion || DEFAULT_CDN_VERSION) + '/min/vs';
    return _loadMonaco(cdnBase);
  };

  // ── グローバルエクスポート ─────────────────────────────────────
  global.MonacoWasmEditor = MonacoWasmEditor;

}(typeof window !== 'undefined' ? window : this));
