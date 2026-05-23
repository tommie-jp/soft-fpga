/**
 * rtlscope-la.js  — RTLScopeLA: 汎用ロジックアナライザ Canvas ライブラリ
 *
 * IIFE + window.RTLScopeLA としてエクスポートする。
 * 8080 固有コード (M-CYC デコード, fmtFlags8080, CPM_REGIONS 背景色, T-state) は
 * コンストラクタ config のコールバックで注入する。
 */
(function(global) {
  'use strict';

  // ---- ズームレベル定義 ----
  var LA_ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

  /**
   * RTLScopeLA コンストラクタ
   *
   * @param {Object} config
   *   canvasId        {string}   Canvas 要素の ID (default: 'la')
   *   togglesId       {string}   トグル UI 挿入先の ID (default: 'la-toggles')
   *   signals         {Array}    信号定義配列
   *   groups          {Array}    グループ定義配列
   *   ringSize        {number}   リングバッファのサンプル数 (default: 4096)
   *   ringWords       {number}   1サンプルあたりのワード数 (default: 6)
   *   storagePrefix   {string}   localStorage プレフィックス (default: 'la_')
   *   width           {number}   キャンバス幅 (default: 900)
   *   labelWidth      {number}   ラベル幅 (default: 56)
   *   trackH          {number}   1トラックの高さ (default: 28)
   *   timeRulerH      {number}   時間ルーラーの高さ (default: 14)
   *   decodeLaneH     {number}   デコードレーン高さ (default: 22)
   *   decodeLane      {Object}   { label, render(ctx, params) } — null で非表示
   *   formatters      {Object}   { fmtName: fn(val)→str }
   *   signalBackground {Function} fn(sig, val) → fillStyle文字列 or null
   *   getTState       {Function} fn(word0) → number (T-state 番号); null でグリッド線なし
   *   getCursorExtra  {Function} fn(heapu32, ringSize, ringWords, absIdx) → str or null
   */
  function RTLScopeLA(config) {
    var self = this;
    var c = config || {};

    // ---- 設定値の保存 ----
    self._canvasId      = c.canvasId      || 'la';
    self._togglesId     = c.togglesId     || 'la-toggles';
    self._signals       = c.signals       || [];
    self._groups        = c.groups        || [];
    self._ringSize      = c.ringSize      || 4096;
    self._RW            = c.ringWords     || 6;
    self._prefix        = c.storagePrefix !== undefined ? c.storagePrefix : 'la_';
    self._initLA_W      = c.width         || 900;   // ユーザー指定の最大幅
    self._LA_W          = self._initLA_W;            // 実効幅（_updateCanvas で更新）
    self._LABEL_W       = c.labelWidth    || 56;
    self._TRACK_H       = c.trackH        || 28;
    self._TIME_RULER_H  = c.timeRulerH    || 14;
    self._MARKER_LANE_H = c.markerLaneH   || 18;  // マーカーラベル専用帯の高さ
    self._DEC_LANE_H    = c.decodeLaneH   || 22;

    // ---- コールバック ----
    self._cbDec         = c.decodeLane      || null;
    self._cbFmt         = c.formatters      || {};
    self._cbBg          = c.signalBackground || null;
    self._cbTs          = c.getTState       || null;
    self._cbCurExtra    = c.getCursorExtra   || null;

    // ---- 派生定数 ----
    self._VIEW_W = self._LA_W - self._LABEL_W;

    // ---- 状態変数 ----
    self._zoomIdx      = 2;   // 初期: 1x
    self._zoom         = 1;
    self._pan          = 0;
    self._cursorViewX  = -1;
    self._markerA      = null;
    self._markerB      = null;
    self._markerC      = null;
    self._markerAOn    = false;
    self._markerBOn    = false;
    self._markerCOn    = false;
    self._trigOn       = false;
    self._lastStartSamp = 0;
    self._lastHead     = 0;
    self._frozen       = false;
    self._on           = true;
    self._tDragIdx     = null;
    self._tDragY       = 0;
    self._trigHead     = -1;
    self._touchActive  = false;   // タッチ操作中フラグ（pan リセット抑止）
    self._panOverride  = false;   // ナビボタンによる pan 維持フラグ
    self._markerDrag   = null;    // 'A' | 'B' | 'C' | null (マーカードラッグ中)
    self._markerBtnApply = { A: null, B: null, C: null };  // toggles ボタンのスタイル更新 ref
    self._lastHeapu32  = null;    // update() でキャッシュした WASM メモリビュー（RAF 再描画用）
    self._rafPending   = false;   // requestAnimationFrame 発行済みフラグ

    // ナビゲーションボタン ID (config で上書き可能)
    self._navLL    = c.navLL    || 'la-nav-ll';
    self._navL     = c.navL     || 'la-nav-l';
    self._navR     = c.navR     || 'la-nav-r';
    self._navRR    = c.navRR    || 'la-nav-rr';
    self._markersId = c.markersId || null;   // マーカーボタン挿入先 ID（null で togglesId に同居）

    // ナビ用に draw で更新する状態
    self._lastSamplesInView = 0;
    self._lastTotalAvail    = 0;

    // デコードレーン表示状態
    self._showDec = localStorage.getItem(self._prefix + 'decode_lane') !== '0';

    // ---- visible フラグを localStorage から復元 ----
    self._sigVisible = {};
    self._signals.forEach(function(s) {
      var saved = localStorage.getItem(self._prefix + 'sig_' + s.id);
      self._sigVisible[s.id] = saved !== null ? saved === '1' : s.on;
    });

    // ---- 信号の表示順 (localStorage から復元) ----
    self._sigOrder = self._signals.map(function(s) { return s.id; });
    (function() {
      try {
        var sv = localStorage.getItem(self._prefix + 'sig_order');
        if (!sv) return;
        var parsed = JSON.parse(sv);
        var allIds = self._signals.map(function(s) { return s.id; });
        if (Array.isArray(parsed) &&
            allIds.every(function(id) { return parsed.indexOf(id) >= 0; })) {
          self._sigOrder = parsed;
        }
      } catch(e) {}
    })();

    // ---- Canvas / DPR 初期化 ----
    self._ctx  = null;
    self._laH  = 0;

    self._updateCanvas();
    self._bindEvents();
  }

  // ==================== パブリック API ====================

  /**
   * RAF ループから呼ぶ。フレームデータを受け取り描画する。
   */
  RTLScopeLA.prototype.update = function(head, heapu32, frozen, trigFireHead) {
    this.setFrozen(!!frozen);
    if (trigFireHead !== undefined && trigFireHead !== null) {
      var newTrig = (trigFireHead !== -1) ? (trigFireHead >>> 0) : -1;
      // 新しいトリガー発火を検出 → Trig を自動 ON してビュー中央に移動
      if (newTrig !== -1 && newTrig !== this._trigHead) {
        this._trigHead = newTrig;
        this._trigOn   = true;
        if (this._trigBtnApply) this._trigBtnApply();
        // head との距離から pan を計算してトリガーをビュー中央へ
        var h = head >>> 0;
        var samplesInView = Math.ceil(this._VIEW_W / this._zoom);
        var trigOffset = (h - newTrig) >>> 0;
        this._pan = Math.max(0, trigOffset - Math.floor(samplesInView / 2));
        this._panOverride = true;
      } else {
        this._trigHead = newTrig;
      }
    }
    this._lastHeapu32 = heapu32;          // RAF 再描画用にキャッシュ
    this._lastHead    = head >>> 0;
    if (!this._on || !this._ctx) return;
    this._draw(heapu32, head >>> 0);
  };

  /**
   * 次フレームで _draw() を呼ぶようスケジュールする。
   * マウス/タッチ操作によるパン・カーソル変化をスムーズに描画するために使う。
   * update() が同フレームで呼ばれる場合は RAF がキャンセルされるため二重描画はない。
   */
  RTLScopeLA.prototype._schedDraw = function() {
    if (this._rafPending || !this._on || !this._ctx || !this._lastHeapu32) return;
    this._rafPending = true;
    var self = this;
    requestAnimationFrame(function() {
      self._rafPending = false;
      if (self._on && self._ctx && self._lastHeapu32) {
        self._draw(self._lastHeapu32, self._lastHead);
      }
    });
  };

  /** ズームインデックスを設定する */
  RTLScopeLA.prototype.setZoom = function(idx) {
    var self = this;
    var oldZoom = self._zoom;
    self._zoomIdx = Math.max(0, Math.min(LA_ZOOM_LEVELS.length - 1, idx));
    self._zoom    = LA_ZOOM_LEVELS[self._zoomIdx];
    // ドロップダウン と レガシー lbl 両方を更新
    var sel = document.getElementById('la-zoom-sel');
    if (sel) sel.value = String(self._zoomIdx);
    var lbl = document.getElementById('la-zoom-lbl');
    if (lbl) lbl.textContent = self._zoom >= 1 ? self._zoom + 'x' : '1/' + Math.round(1 / self._zoom) + 'x';

    // カーソル中心ズーム（フリーズ中のみ）
    if (self._frozen) {
      var focusViewX = (self._cursorViewX >= 0 && self._cursorViewX <= self._VIEW_W)
                       ? self._cursorViewX
                       : self._VIEW_W / 2;
      var focusSamp     = self._lastStartSamp + Math.floor(focusViewX / oldZoom);
      var newSampInView = Math.ceil(self._VIEW_W / self._zoom);
      var newStartSamp  = focusSamp - Math.floor(focusViewX / self._zoom);
      self._pan = Math.max(0, (self._lastHead - newStartSamp - newSampInView) | 0);
    }
  };

  /** フリーズ状態を設定する */
  RTLScopeLA.prototype.setFrozen = function(b) {
    this._frozen = !!b;
    // タッチ操作中・ナビボタン pan 中は pan を維持する
    if (!b && !this._touchActive && !this._panOverride) this._pan = 0;
  };

  /** フリーズする */
  RTLScopeLA.prototype.freeze = function() { this.setFrozen(true); };

  /** フリーズ解除する */
  RTLScopeLA.prototype.thaw = function() { this.setFrozen(false); };

  /** ON/OFF を設定する */
  RTLScopeLA.prototype.setEnabled = function(b) {
    this._on = !!b;
  };

  /** トリガー発火ヘッドを設定する */
  RTLScopeLA.prototype.setTrigFireHead = function(head) {
    this._trigHead = (head !== undefined && head !== null && head !== -1) ? (head >>> 0) : -1;
  };

  /** トリガー位置をビューの中央へ移動する */
  RTLScopeLA.prototype.gotoTrig = function() {
    if (this._trigHead < 0) return;
    var samplesInView = Math.ceil(this._VIEW_W / this._zoom);
    var trigOffset    = ((this._lastHead >>> 0) - (this._trigHead >>> 0)) >>> 0;
    this._pan = Math.max(0, trigOffset - Math.floor(samplesInView / 2));
  };

  // ---- getter ----
  Object.defineProperty(RTLScopeLA.prototype, 'zoom', {
    get: function() { return this._zoom; }
  });

  Object.defineProperty(RTLScopeLA.prototype, 'zoomLabel', {
    get: function() {
      return this._zoom >= 1 ? this._zoom + 'x' : '1/' + Math.round(1 / this._zoom) + 'x';
    }
  });

  Object.defineProperty(RTLScopeLA.prototype, 'frozen', {
    get: function() { return this._frozen; }
  });

  Object.defineProperty(RTLScopeLA.prototype, 'enabled', {
    get: function() { return this._on; }
  });

  // ==================== トグル UI ====================

  RTLScopeLA.prototype.buildToggles = function() {
    var self = this;

    var el = document.getElementById(self._togglesId);
    if (!el) return;

    // 古いピッカーを破棄（buildToggles 再呼び出し対応）
    var pickerId = '_la_picker_' + self._togglesId;
    var oldPicker = document.getElementById(pickerId);
    if (oldPicker) oldPicker.parentNode.removeChild(oldPicker);

    // ── グループ色マップ: signal.id → group color ──
    var sigGroupColor = {};
    self._groups.forEach(function(grp) {
      var gc = grp.color || '#666';
      grp.ids.forEach(function(id) { sigGroupColor[id] = gc; });
    });

    // ── ピッカードロップダウン (body に fixed 配置) ──
    var picker = document.createElement('div');
    picker.id = pickerId;
    picker.style.cssText =
      'display:none;position:fixed;z-index:600;' +
      'background:#fff;border:1px solid #bbb;border-radius:4px;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.22);' +
      'padding:6px 10px 8px;max-width:460px;min-width:180px;';
    picker.addEventListener('click', function(e) { e.stopPropagation(); });
    document.body.appendChild(picker);

    function closePicker() { picker.style.display = 'none'; }
    document.addEventListener('click', closePicker);

    function positionPicker() {
      var rect = el.getBoundingClientRect();
      picker.style.top  = (rect.bottom + 4) + 'px';
      picker.style.left = rect.left + 'px';
      // 右端はみ出し補正（次フレームで幅確定後に調整）
      requestAnimationFrame(function() {
        var pw = picker.offsetWidth;
        var vw = window.innerWidth;
        var left = parseFloat(picker.style.left);
        if (left + pw > vw - 8) picker.style.left = Math.max(4, vw - pw - 8) + 'px';
      });
    }

    // ピッカー内チェックボックスを id で更新
    function updatePickerCheck(id, checked) {
      var cb = picker.querySelector('input[data-pid="' + id + '"]');
      if (!cb) return;
      var gc = sigGroupColor[id] || '#666';
      cb.checked = checked;
      cb.parentElement.className = 'sig-tog' + (checked ? ' on' : '');
      cb.parentElement.style.background = checked ? gc : '';
    }

    // ── ピッカー先頭: Marker セクション ──
    (function() {
      var mhdr = document.createElement('div');
      mhdr.style.cssText =
        'font-size:10px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;' +
        'color:#666;margin-bottom:4px;';
      mhdr.textContent = 'Marker';
      picker.appendChild(mhdr);

      var mRow = document.createElement('div');
      mRow.style.cssText =
        'display:flex;align-items:center;gap:4px;' +
        'padding-bottom:7px;margin-bottom:4px;border-bottom:1px solid #eee;';
      picker.appendChild(mRow);

      // マーカーボタン生成ヘルパー（ピッカー内に埋め込む）
      function _mkMarkerBtn(label, colorOn, getOn, setOn, getSamp, setSamp) {
        var btn = document.createElement('button');
        btn.textContent = label;
        var baseStyle = 'font-size:11px;font-weight:bold;padding:1px 8px;line-height:1.5;' +
                        'border:1px solid #aaa;cursor:pointer;font-family:monospace;' +
                        'min-width:28px;text-align:center;border-radius:3px;';
        function _apply() {
          if (getOn()) {
            btn.style.cssText = baseStyle + 'background:' + colorOn +
                                ';color:#fff;border-color:' + colorOn + ';';
          } else {
            btn.style.cssText = baseStyle + 'background:#e8e8e8;color:#888;';
          }
        }
        btn._refreshStyle = _apply;
        _apply();
        btn.addEventListener('click', function() {
          var next = !getOn();
          if (next && getSamp) {
            // ON のたびにビュー中央へ配置（再 ON も含む）
            setSamp(self._lastStartSamp + Math.floor(self._lastSamplesInView / 2));
          }
          setOn(next);
          // Freeze 中 かつ ON にしたとき: マーカー位置をビュー中央へパン
          // 実行中は panOverride をセットしない（ライブ追従を維持）
          if (next && self._frozen && getSamp && getSamp() !== null) {
            var samp = getSamp();
            var head = self._lastHead >>> 0;
            var sv   = self._lastSamplesInView;
            self._pan = Math.max(0, head - samp - Math.floor(sv / 2));
            self._panOverride = true;
          }
          self._schedDraw();
          _apply();
        });
        return btn;
      }

      var btnA = _mkMarkerBtn('A', '#0064e6',
        function() { return self._markerAOn; },
        function(v) { self._markerAOn = v; },
        function() { return self._markerA; },
        function(s) { self._markerA = s; });
      self._markerBtnApply.A = function() { btnA._refreshStyle(); };
      mRow.appendChild(btnA);

      var btnB = _mkMarkerBtn('B', '#c80050',
        function() { return self._markerBOn; },
        function(v) { self._markerBOn = v; },
        function() { return self._markerB; },
        function(s) { self._markerB = s; });
      self._markerBtnApply.B = function() { btnB._refreshStyle(); };
      mRow.appendChild(btnB);

      var btnC = _mkMarkerBtn('C', '#00a050',
        function() { return self._markerCOn; },
        function(v) { self._markerCOn = v; },
        function() { return self._markerC; },
        function(s) { self._markerC = s; });
      self._markerBtnApply.C = function() { btnC._refreshStyle(); };
      mRow.appendChild(btnC);

      var trigBtn = _mkMarkerBtn('Trig', '#cc0000',
        function() { return self._trigOn; },
        function(v) { self._trigOn = v; },
        null, null);
      self._trigBtnApply = function() { if (trigBtn._refreshStyle) trigBtn._refreshStyle(); };
      mRow.appendChild(trigBtn);
    })();

    // ── ピッカー内容を構築（グループ別） ──
    self._groups.forEach(function(grp, gi) {
      var gc = grp.color || '#666';

      var ghdr = document.createElement('div');
      ghdr.style.cssText =
        'font-size:10px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;' +
        'color:' + gc + ';margin-top:' + (gi > 0 ? '6px' : '0') + ';margin-bottom:3px;';
      ghdr.textContent = grp.label;
      picker.appendChild(ghdr);

      var gRow = document.createElement('div');
      gRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

      self._sigOrder.forEach(function(id) {
        if (grp.ids.indexOf(id) < 0) return;
        var s = null;
        for (var i = 0; i < self._signals.length; i++) {
          if (self._signals[i].id === id) { s = self._signals[i]; break; }
        }
        if (!s) return;

        var isOn = !!self._sigVisible[s.id];
        var lbl = document.createElement('label');
        lbl.className = 'sig-tog' + (isOn ? ' on' : '');
        lbl.style.background = isOn ? gc : '';
        if (s.tip) lbl.title = s.tip;
        lbl.innerHTML = '<input type="checkbox" data-pid="' + s.id + '"' +
                        (isOn ? ' checked' : '') + '> ' + s.label;

        lbl.querySelector('input').addEventListener('change', (function(sig, l, groupColor) {
          return function() {
            self._sigVisible[sig.id] = this.checked;
            localStorage.setItem(self._prefix + 'sig_' + sig.id, this.checked ? '1' : '0');
            l.className = 'sig-tog' + (this.checked ? ' on' : '');
            l.style.background = this.checked ? groupColor : '';
            self._updateCanvas();
            rebuildActiveBar();
          };
        })(s, lbl, gc));

        gRow.appendChild(lbl);
      });

      picker.appendChild(gRow);
    });

    // ── アクティブバーを再描画するヘルパー ──
    function rebuildActiveBar() {
      el.innerHTML = '';

      // デコードレーンチップ
      if (self._cbDec) {
        var decLabel = self._cbDec.label || 'DEC';
        var decChip = document.createElement('label');
        decChip.className = 'sig-tog' + (self._showDec ? ' on' : '');
        decChip.style.background   = self._showDec ? '#445566' : '';
        decChip.style.borderRadius = '10px';
        decChip.title = 'マシンサイクルデコードレーンの表示切替';
        decChip.innerHTML = '<input type="checkbox"' + (self._showDec ? ' checked' : '') + '> ' + decLabel;
        decChip.querySelector('input').addEventListener('change', function() {
          self._showDec = this.checked;
          localStorage.setItem(self._prefix + 'decode_lane', this.checked ? '1' : '0');
          decChip.className = 'sig-tog' + (this.checked ? ' on' : '');
          decChip.style.background = this.checked ? '#445566' : '';
          self._updateCanvas();
        });
        el.appendChild(decChip);
      }

      // 表示中の信号チップ（visible のみ、グループ色を使用）
      self._sigOrder.forEach(function(id) {
        if (!self._sigVisible[id]) return;
        var s = null;
        for (var i = 0; i < self._signals.length; i++) {
          if (self._signals[i].id === id) { s = self._signals[i]; break; }
        }
        if (!s) return;
        var gc = sigGroupColor[id] || s.color || '#666';
        var chip = document.createElement('label');
        chip.className = 'sig-tog on';
        chip.style.background = gc;
        chip.title = (s.tip ? s.tip.split('\n')[0] : s.label) + '\nクリックで非表示';
        chip.innerHTML = '<input type="checkbox" checked> ' + s.label;
        chip.querySelector('input').addEventListener('change', function() {
          self._sigVisible[s.id] = false;
          localStorage.setItem(self._prefix + 'sig_' + s.id, '0');
          self._updateCanvas();
          rebuildActiveBar();
          updatePickerCheck(s.id, false);
        });
        el.appendChild(chip);
      });

      // ＋ 追加ボタン
      var addBtn = document.createElement('button');
      addBtn.textContent = '＋';
      addBtn.title = '信号を追加 / 削除';
      addBtn.style.cssText =
        'font-size:12px;padding:1px 8px;line-height:1.6;' +
        'border:1px solid #aaa;cursor:pointer;background:#e8e8e8;color:#444;' +
        'font-family:monospace;border-radius:10px;flex-shrink:0;';
      addBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = picker.style.display !== 'none';
        closePicker();
        if (!isOpen) {
          positionPicker();
          picker.style.display = '';
        }
      });
      el.appendChild(addBtn);
    }

    // 初回アクティブバー描画
    rebuildActiveBar();
  };

  // ==================== LA OFF 表示 ====================

  RTLScopeLA.prototype._drawOff = function() {
    if (!this._ctx) return;
    var ctx = this._ctx;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, this._LA_W, this._laH || 60);
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Logic Analyzer OFF  (速度優先モード)', this._LA_W / 2, (this._laH || 60) / 2 + 5);
  };

  // ==================== 内部: アクティブ信号取得 ====================

  RTLScopeLA.prototype._getActiveSigs = function() {
    var self = this;
    return self._sigOrder
      .map(function(id) {
        for (var i = 0; i < self._signals.length; i++) {
          if (self._signals[i].id === id) return self._signals[i];
        }
        return null;
      })
      .filter(function(s) { return s && self._sigVisible[s.id]; });
  };

  // ==================== 内部: Canvas リサイズ ====================

  RTLScopeLA.prototype._updateCanvas = function() {
    var self = this;
    var canvas = document.getElementById(self._canvasId);
    if (!canvas) return;

    // DPR を毎回取得（ブラウザズーム変更・デバイス変更に対応）
    self._dpr = window.devicePixelRatio || 1;

    // コンテナ実幅を計測し、指定最大幅 (_initLA_W) 以下に収める
    // → CSS max-width:100% による縮小スケーリングを JS 側で先に吸収し、
    //   canvas 内部ピクセル = 表示 CSS px × DPR を実現して高精細描画する
    var parent = canvas.parentElement;
    var availW = parent ? parent.clientWidth : self._initLA_W;
    var cssW   = availW > 0 ? Math.min(self._initLA_W, availW) : self._initLA_W;
    self._LA_W   = Math.max(1, cssW);
    self._VIEW_W = self._LA_W - self._LABEL_W;

    var n = self._getActiveSigs().length || 1;
    self._laH = (self._showDec && self._cbDec ? self._DEC_LANE_H : 0)
               + n * self._TRACK_H
               + self._MARKER_LANE_H
               + 2 * self._TIME_RULER_H;

    // 物理ピクセル = CSS px × DPR（CSS スケーリングなし → ドット等倍で高精細）
    canvas.width  = Math.round(self._LA_W  * self._dpr);
    canvas.height = Math.round(self._laH   * self._dpr);
    canvas.style.width  = self._LA_W  + 'px';
    canvas.style.height = self._laH   + 'px';

    self._ctx = canvas.getContext('2d');
    self._ctx.setTransform(self._dpr, 0, 0, self._dpr, 0, 0);
  };

  // ==================== 内部: イベントバインド ====================

  RTLScopeLA.prototype._bindEvents = function() {
    var self = this;

    // ---- ウィンドウリサイズで canvas を再計測・再描画 ----
    // （DevTools 開閉・向き変更・ブラウザズーム変更に対応）
    window.addEventListener('resize', function() {
      self._updateCanvas();
    });

    // ---- ズームボタン ----
    var btnZoomIn  = document.getElementById('la-zoom-in');
    var btnZoomOut = document.getElementById('la-zoom-out');
    var btnZoomLbl = document.getElementById('la-zoom-lbl');
    if (btnZoomIn)  btnZoomIn.addEventListener('click',  function() { self.setZoom(self._zoomIdx + 1); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', function() { self.setZoom(self._zoomIdx - 1); });
    if (btnZoomLbl) btnZoomLbl.addEventListener('click', function() { self.setZoom(2); self._pan = 0; self._panOverride = false; });
    var selZoom = document.getElementById('la-zoom-sel');
    if (selZoom) selZoom.addEventListener('change', function() { self.setZoom(parseInt(this.value, 10)); });

    // ---- ナビゲーションボタン (<< < > >>) ----
    // pan を変更し、_panOverride=true にすることで setFrozen(false) 時もパン位置を維持する。
    // >> のみ _panOverride=false にして live 追従に戻す。
    function _navClampPan(p) {
      var max = Math.max(0, self._lastTotalAvail - self._lastSamplesInView);
      return Math.max(0, Math.min(p, max));
    }
    var btnNavLL = document.getElementById(self._navLL);
    var btnNavL  = document.getElementById(self._navL);
    var btnNavR  = document.getElementById(self._navR);
    var btnNavRR = document.getElementById(self._navRR);
    if (btnNavLL) btnNavLL.addEventListener('click', function() {
      self._pan = Math.max(0, self._lastTotalAvail - self._lastSamplesInView);
      self._panOverride = true;
      self._schedDraw();
    });
    if (btnNavL) btnNavL.addEventListener('click', function() {
      self._pan = _navClampPan(self._pan + self._lastSamplesInView);
      self._panOverride = true;
      self._schedDraw();
    });
    if (btnNavR) btnNavR.addEventListener('click', function() {
      self._pan = Math.max(0, self._pan - self._lastSamplesInView);
      self._panOverride = self._pan > 0;
      self._schedDraw();
    });
    if (btnNavRR) btnNavRR.addEventListener('click', function() {
      self._pan = 0;
      self._panOverride = false;
      self._schedDraw();
    });

    var canvas = document.getElementById(self._canvasId);
    if (!canvas) return;

    // ---- ホイールズーム ----
    // 業界標準: 上スクロール(deltaY < 0) = 拡大、下スクロール(deltaY > 0) = 縮小
    // (Google Maps / Figma / PulseView / GTKWave と同じ方向)
    canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      self.setZoom(self._zoomIdx + (e.deltaY > 0 ? -1 : 1));
      self._schedDraw();
    }, { passive: false });

    // ---- マーカー近傍判定ヘルパー ----
    // lx: canvas 論理座標 X → 'A' | 'B' | 'C' | null
    function _nearMarker(lx, snap) {
      snap = snap || 7;
      function mxOf(samp) {
        if (samp === null) return null;
        var off = samp - self._lastStartSamp;
        return self._LABEL_W - (self._lastSubPx || 0) + off * self._zoom;
      }
      var mxA = mxOf(self._markerA), mxB = mxOf(self._markerB), mxC = mxOf(self._markerC);
      if (mxA !== null && mxA >= self._LABEL_W && Math.abs(lx - mxA) <= snap) return 'A';
      if (mxB !== null && mxB >= self._LABEL_W && Math.abs(lx - mxB) <= snap) return 'B';
      if (mxC !== null && mxC >= self._LABEL_W && Math.abs(lx - mxC) <= snap) return 'C';
      return null;
    }

    // ---- マウスダウン ----
    var laDragX    = null;
    var laDragPan0 = 0;

    canvas.addEventListener('mousedown', function(e) {
      var rect = canvas.getBoundingClientRect();
      var lx   = e.clientX - rect.left;
      var ly   = e.clientY - rect.top;
      // マーカードラッグ判定（波形エリアのみ）
      if (lx >= self._LABEL_W) {
        var near = _nearMarker(lx);
        if (near) { self._markerDrag = near; return; }
      }
      if (lx < self._LABEL_W) {
        var decOff = (self._showDec && self._cbDec) ? self._DEC_LANE_H : 0;
        var sigHd  = self._laH - self._MARKER_LANE_H - 2 * self._TIME_RULER_H - decOff;
        var sigs   = self._getActiveSigs();
        var tHd    = sigs.length > 0 ? sigHd / sigs.length : self._TRACK_H;
        var tidx   = Math.floor((ly - self._TIME_RULER_H - decOff) / tHd);
        if (tidx >= 0 && tidx < sigs.length) {
          self._tDragIdx = tidx;
          self._tDragY   = ly;
        }
      } else {
        laDragX    = e.clientX;
        laDragPan0 = self._pan;
      }
    });

    // ---- マウスムーブ ----
    canvas.addEventListener('mousemove', function(e) {
      var rect = canvas.getBoundingClientRect();
      var lx   = e.clientX - rect.left;
      var ly   = e.clientY - rect.top;

      // マーカードラッグ中
      if (self._markerDrag) {
        var vxM = lx - self._LABEL_W + (self._lastSubPx || 0);
        var sampM = self._lastStartSamp + Math.floor(vxM / self._zoom);
        if      (self._markerDrag === 'A') self._markerA = sampM;
        else if (self._markerDrag === 'B') self._markerB = sampM;
        else                               self._markerC = sampM;
        canvas.style.cursor = 'col-resize';
        self._schedDraw();
        return;
      }

      var nearM = lx >= self._LABEL_W ? _nearMarker(lx) : null;
      self._cursorViewX = self._tDragIdx !== null ? -1 : Math.max(-1, lx - self._LABEL_W);
      canvas.style.cursor = self._tDragIdx !== null ? 'grabbing'
                          : lx < self._LABEL_W      ? 'grab'
                          : nearM                    ? 'col-resize'
                          :                           '';

      if (self._tDragIdx !== null) {
        self._tDragY = ly;
      } else if (laDragX !== null) {
        var dx = e.clientX - laDragX;
        self._pan = Math.max(0, laDragPan0 + dx / self._zoom);
      }
      self._schedDraw();
    });

    // ---- トラックドラッグ確定 ----
    function commitTrackDrag() {
      if (self._tDragIdx === null) return;
      var decOff2 = (self._showDec && self._cbDec) ? self._DEC_LANE_H : 0;
      var sigHc   = self._laH - self._MARKER_LANE_H - 2 * self._TIME_RULER_H - decOff2;
      var sigs    = self._getActiveSigs();
      var tHc     = sigs.length > 0 ? sigHc / sigs.length : self._TRACK_H;
      var insertAt = Math.max(0, Math.min(
        Math.round((self._tDragY - self._TIME_RULER_H - decOff2) / tHc),
        sigs.length
      ));
      var srcIdx = self._tDragIdx;
      self._tDragIdx = null;

      if (insertAt === srcIdx || insertAt === srcIdx + 1) return;

      var srcId    = sigs[srcIdx].id;
      var newOrder = self._sigOrder.filter(function(id) { return id !== srcId; });
      var newActive = newOrder
        .map(function(id) {
          for (var i = 0; i < self._signals.length; i++) {
            if (self._signals[i].id === id) return self._signals[i];
          }
          return null;
        })
        .filter(function(s) { return s && self._sigVisible[s.id]; });
      var effInsert = Math.max(0, Math.min(
        insertAt > srcIdx ? insertAt - 1 : insertAt,
        newActive.length
      ));
      var insertOrderIdx;
      if (effInsert < newActive.length) {
        insertOrderIdx = newOrder.indexOf(newActive[effInsert].id);
      } else {
        insertOrderIdx = newActive.length > 0
          ? newOrder.indexOf(newActive[newActive.length - 1].id) + 1
          : newOrder.length;
      }
      newOrder.splice(insertOrderIdx, 0, srcId);
      self._sigOrder = newOrder;
      localStorage.setItem(self._prefix + 'sig_order', JSON.stringify(self._sigOrder));
      self._updateCanvas();
    }

    // ---- MARKER_LANE クリック: そのマーカーをビュー中央にスクロール ----
    // lx: canvas 論理 x 座標

    // バッジ固定 x（OFF 時や ビュー外のフォールバック位置、_draw の _fixedX と同一）
    function _markerFixedX(idx) { return self._LABEL_W + [14, 36, 58, 88][idx]; }

    // samp が null or ビュー外なら固定バッジ位置を返す
    function _markerDisplayX(samp, fixedX) {
      if (samp === null) return fixedX;
      var mx = self._LABEL_W - (self._lastSubPx || 0) + (samp - self._lastStartSamp) * self._zoom;
      return (mx >= self._LABEL_W - 14 && mx <= self._LA_W + 14) ? mx : fixedX;
    }

    // samp をビュー中央になるよう pan を調整する
    function _centerOnSamp(samp) {
      if (samp === null) return;
      var head = self._lastHead >>> 0;
      var sv   = self._lastSamplesInView;
      self._pan = Math.max(0, head - samp - Math.floor(sv / 2));
      self._panOverride = true;
      self._schedDraw();
    }

    function _markerLaneClick(lx) {
      var snap = 20;  // バッジ幅の半分 + 余裕

      // ON 状態のマーカーバッジ付近をクリックしたら中央スクロール
      function tryMarker(samp, isOn, fixedX) {
        if (!isOn) return false;
        var mx = _markerDisplayX(samp, fixedX);
        if (Math.abs(lx - mx) > snap) return false;
        _centerOnSamp(samp);
        return true;
      }

      // TRIG: ON かつ発火済みのとき
      function tryTrig() {
        if (!self._trigOn || self._trigHead < 0) return false;
        var trigSamp = (self._trigHead >>> 0) - 1;
        var mx = _markerDisplayX(trigSamp, _markerFixedX(3));
        if (Math.abs(lx - mx) > snap) return false;
        _centerOnSamp(trigSamp);
        return true;
      }

      // 範囲外バッジは動的配置なのでキャッシュを優先、未初期化時は静的位置にフォールバック
      var _fxC = self._markerFixedXCache || [];
      tryMarker(self._markerA, self._markerAOn, _fxC[0] || _markerFixedX(0)) ||
      tryMarker(self._markerB, self._markerBOn, _fxC[1] || _markerFixedX(1)) ||
      tryMarker(self._markerC, self._markerCOn, _fxC[2] || _markerFixedX(2)) ||
      tryTrig();
    }

    canvas.addEventListener('mouseup', function() {
      self._markerDrag = null;
      commitTrackDrag();
      laDragX = null;
    });
    canvas.addEventListener('mouseleave', function() {
      self._markerDrag = null;
      commitTrackDrag();
      laDragX            = null;
      self._cursorViewX  = -1;
      canvas.style.cursor = '';
    });

    // ---- マウスクリック: MARKER_LANE 内ならトグル ----
    canvas.addEventListener('click', function(e) {
      if (self._markerDrag) return;  // ドラッグ後の click は無視
      var sc = { x: self._LA_W / canvas.getBoundingClientRect().width || 1,
                 y: self._laH  / canvas.getBoundingClientRect().height || 1 };
      var rect = canvas.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (rect.width  > 0 ? self._LA_W / rect.width  : 1);
      var ly = (e.clientY - rect.top)  * (rect.height > 0 ? self._laH  / rect.height : 1);
      if (ly >= self._laH - self._MARKER_LANE_H) {
        _markerLaneClick(lx);
      }
    });

    // ---- タッチ操作 ----
    // ※ canvas は CSS で max-width:100% によりモバイル幅に縮小されるため、
    //   タッチ座標（CSS px）を canvas 論理座標（canvas px）へ変換してから各判定に使う。
    var laTouch0 = null;

    // CSS 座標 → canvas 論理座標への変換スケールを取得
    function _touchScale() {
      var r = canvas.getBoundingClientRect();
      return {
        x: r.width  > 0 ? self._LA_W / r.width  : 1,
        y: r.height > 0 ? self._laH  / r.height : 1,
        rect: r
      };
    }

    canvas.addEventListener('touchstart', function(e) {
      var sc = _touchScale();
      if (e.touches.length === 1) {
        var tx = (e.touches[0].clientX - sc.rect.left) * sc.x;  // canvas logical px
        var ty = (e.touches[0].clientY - sc.rect.top)  * sc.y;
        // マーカードラッグ判定（タッチは SNAP を広く取る）
        if (tx >= self._LABEL_W) {
          var nearT = _nearMarker(tx, 14);
          if (nearT) {
            self._markerDrag  = nearT;
            self._touchActive = true;
            if (e.cancelable) e.preventDefault();
            return;
          }
        }
        if (tx < self._LABEL_W) {
          // ラベルエリア: 信号名の並び替えドラッグ開始
          var decOff = (self._showDec && self._cbDec) ? self._DEC_LANE_H : 0;
          var sigHd  = self._laH - self._MARKER_LANE_H - 2 * self._TIME_RULER_H - decOff;
          var sigs   = self._getActiveSigs();
          var tHd    = sigs.length > 0 ? sigHd / sigs.length : self._TRACK_H;
          var tidx   = Math.floor((ty - self._TIME_RULER_H - decOff) / tHd);
          if (tidx >= 0 && tidx < sigs.length) {
            self._tDragIdx  = tidx;
            self._tDragY    = ty;   // canvas logical px
            self._touchActive = true;
            laTouch0 = null;
          } else {
            laTouch0 = { x: e.touches[0].clientX, pan: self._pan,
                         dist: null, zoomIdx: self._zoomIdx, scaleX: sc.x,
                         tapCanvasX: tx, tapCanvasY: ty, moved: false };
            self._touchActive = true;
          }
        } else {
          laTouch0 = { x: e.touches[0].clientX, pan: self._pan,
                       dist: null, zoomIdx: self._zoomIdx, scaleX: sc.x,
                       tapCanvasX: tx, tapCanvasY: ty, moved: false };
          self._touchActive = true;
        }
      } else if (e.touches.length === 2) {
        self._tDragIdx = null;
        var tdx = e.touches[0].clientX - e.touches[1].clientX;
        var tdy = e.touches[0].clientY - e.touches[1].clientY;
        laTouch0 = { x: 0, pan: self._pan,
                     dist: Math.sqrt(tdx*tdx + tdy*tdy), zoomIdx: self._zoomIdx, scaleX: sc.x };
        self._touchActive = true;
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
      // マーカードラッグ中
      if (self._markerDrag) {
        if (e.cancelable) e.preventDefault();
        var scMD = _touchScale();
        var txMD = (e.touches[0].clientX - scMD.rect.left) * scMD.x;
        var vxMD = txMD - self._LABEL_W + (self._lastSubPx || 0);
        var sampMD = self._lastStartSamp + Math.floor(vxMD / self._zoom);
        if      (self._markerDrag === 'A') self._markerA = sampMD;
        else if (self._markerDrag === 'B') self._markerB = sampMD;
        else                               self._markerC = sampMD;
        self._schedDraw();
        return;
      }
      if (!laTouch0 && self._tDragIdx === null) return;
      if (e.cancelable) e.preventDefault();
      // 移動量でタップ/パンを判別（8px 以上動いたら moved=true）
      if (laTouch0 && !laTouch0.moved && laTouch0.tapCanvasX !== undefined) {
        var _sc2 = _touchScale();
        var _dx = (e.touches[0].clientX - _sc2.rect.left) * _sc2.x - laTouch0.tapCanvasX;
        var _dy = (e.touches[0].clientY - _sc2.rect.top)  * _sc2.y - laTouch0.tapCanvasY;
        if (_dx * _dx + _dy * _dy > 64) laTouch0.moved = true;
      }
      if (self._tDragIdx !== null) {
        // 信号名ドラッグ: canvas 論理 Y を追跡
        var scM = _touchScale();
        self._tDragY = (e.touches[0].clientY - scM.rect.top) * scM.y;
      } else if (e.touches.length === 1 && laTouch0 && laTouch0.dist === null) {
        // パン: CSS delta → canvas 論理 delta → float サンプル数（スムーズスクロール）
        var deltaCanvas = (e.touches[0].clientX - laTouch0.x) * (laTouch0.scaleX || 1);
        self._pan = Math.max(0, laTouch0.pan + deltaCanvas / self._zoom);
      } else if (e.touches.length === 2 && laTouch0 && laTouch0.dist !== null) {
        var tdx2 = e.touches[0].clientX - e.touches[1].clientX;
        var tdy2 = e.touches[0].clientY - e.touches[1].clientY;
        var dist2 = Math.sqrt(tdx2*tdx2 + tdy2*tdy2);
        var newIdx = laTouch0.zoomIdx + Math.round(Math.log2(dist2 / laTouch0.dist));
        self.setZoom(newIdx);
      }
      self._schedDraw();
    }, { passive: false });

    canvas.addEventListener('touchend', function() {
      // マーカードラッグ終了
      if (self._markerDrag) {
        self._markerDrag  = null;
        self._touchActive = false;
        laTouch0 = null;
        return;
      }
      self._touchActive = false;
      commitTrackDrag();
      // MARKER_LANE タップ判定（移動なし & 下部エリア）
      if (laTouch0 && !laTouch0.moved && laTouch0.tapCanvasY !== undefined &&
          laTouch0.tapCanvasY >= self._laH - self._MARKER_LANE_H) {
        _markerLaneClick(laTouch0.tapCanvasX);
      }
      if (!self._frozen) self._pan = 0;  // 実行中は最新データへ戻す
      laTouch0 = null;
    });
  };

  // ==================== 内部: 描画 ====================

  RTLScopeLA.prototype._draw = function(heapu32, head) {
    var self        = this;
    var ctx         = self._ctx;
    var ringSize    = self._ringSize;
    var RW          = self._RW;
    var LA_W        = self._LA_W;
    var LABEL_W     = self._LABEL_W;
    var VIEW_W      = self._VIEW_W;
    var TRACK_H     = self._TRACK_H;
    var TIME_RULER_H  = self._TIME_RULER_H;
    var MARKER_LANE_H = self._MARKER_LANE_H;
    var cbDec       = self._showDec ? self._cbDec : null;
    var cbFmt       = self._cbFmt;
    var cbBg        = self._cbBg;
    var cbTs        = self._cbTs;
    var cbCurExtra  = self._cbCurExtra;
    var laH         = self._laH;
    var laZoom      = self._zoom;

    self._lastHead = head;
    ctx.setTransform(self._dpr, 0, 0, self._dpr, 0, 0);

    var sigs  = self._getActiveSigs();
    var decH  = (cbDec) ? self._DEC_LANE_H : 0;
    var sigY  = TIME_RULER_H + decH;                              // 上部: T ルーラー + デコードレーン
    var sigH  = laH - MARKER_LANE_H - 2 * TIME_RULER_H - decH;  // 下部: MARKER_LANE を除く
    var tH    = sigs.length > 0 ? sigH / sigs.length : TRACK_H;

    // ── 背景 ──
    ctx.fillStyle = '#e0e0ea'; ctx.fillRect(0, 0,             LA_W, TIME_RULER_H);   // 上部 T ルーラー
    if (cbDec) {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, TIME_RULER_H, LA_W, decH);
    }
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, sigY,          LA_W, sigH);
    ctx.fillStyle = '#e0e0ea'; ctx.fillRect(0, sigY + sigH,   LA_W, TIME_RULER_H);   // 下部 T ルーラー
    ctx.fillStyle = '#c8c8d8'; ctx.fillRect(0, laH - MARKER_LANE_H, LA_W, MARKER_LANE_H); // マーカーレーン

    // ── 信号エリア外枠 + ラベル縦区切り ──
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    // 波形表示エリアを囲む矩形（ラベル幅より右）
    ctx.strokeRect(LABEL_W + 0.5, sigY + 0.5, VIEW_W - 1, sigH - 1);
    // ラベルエリア | 波形エリア の縦区切り（タイムルーラも貫く）
    ctx.beginPath();
    ctx.moveTo(LABEL_W + 0.5, 0); ctx.lineTo(LABEL_W + 0.5, laH);
    ctx.stroke();

    // ── ズーム / パン計算 ──
    // pan は float（ドット単位スムーズスクロール）で管理する。
    // pan=0（T=0 表示）のときのみ右マージンを設けて T=0 ラベルを見せる。
    var totalAvail    = Math.min(head >>> 0, ringSize);
    var MARGIN_W      = (self._pan === 0) ? Math.round(VIEW_W * 0.10) : 0;
    var DATA_W        = VIEW_W - MARGIN_W;
    var samplesInView = Math.min(Math.ceil(DATA_W / laZoom), ringSize);
    self._pan = Math.max(0, Math.min(self._pan, Math.max(0, totalAvail - samplesInView)));
    var panInt   = Math.floor(self._pan);
    var panFrac  = self._pan - panInt;
    var extraSamp = (panFrac > 0 && totalAvail > panInt + samplesInView) ? 1 : 0;
    // サブピクセルシフト量:
    // extraSamp=1 のとき startSamp が 1 サンプル手前(=laZoom px)にずれるため
    // (1 - panFrac)*laZoom で補正することで連続したスムーズスクロールになる。
    var subPx    = extraSamp * (1 - panFrac) * laZoom;
    var SIG_X    = LABEL_W - subPx;           // 信号描画開始 x（LABEL_W から左にずれる）
    self._lastSubPx = subPx;                  // イベントハンドラ用に保存
    var samples   = Math.min(samplesInView + extraSamp, totalAvail - panInt);
    var startSamp = (head >>> 0) - panInt - samples;
    self._lastStartSamp     = startSamp;
    self._lastSamplesInView = samplesInView;
    self._lastTotalAvail    = totalAvail;

    // ── ラベルプレパス（クリップなし）──
    // デコードレーンラベル（ラベルエリア: x < LABEL_W）
    if (cbDec && samples > 0) {
      ctx.fillStyle = '#555'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(cbDec.label || 'DEC', 2, TIME_RULER_H + decH * 0.72);
    }
    // 信号名 + トラック区切り線（全幅）
    for (var t = 0; t < sigs.length; t++) {
      var _sig = sigs[t];
      var _yb  = sigY + t * tH;
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, _yb + tH); ctx.lineTo(LA_W, _yb + tH); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(_sig.label, 3, _yb + tH * 0.65);
    }

    // MARKER_LANE 区切り線 + 「Marker」固定テキスト（クリップなし）
    var mlaneY = laH - MARKER_LANE_H;
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, mlaneY); ctx.lineTo(LA_W, mlaneY); ctx.stroke();
    ctx.fillStyle = '#666'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Marker', 2, mlaneY + MARKER_LANE_H - 5);

    // ── 信号コンテンツ（クリップ: LABEL_W ～ LA_W）──
    // SIG_X = LABEL_W - subPx でサブピクセル精度のスムーズスクロールを実現する。
    // LABEL_W 左側にはみ出た描画はクリップで自動的に非表示になる。
    ctx.save();
    ctx.beginPath();
    ctx.rect(LABEL_W, 0, VIEW_W, laH);
    ctx.clip();

    // ── デコードレーン描画 ──
    if (cbDec && samples > 0) {
      var decY = TIME_RULER_H;
      cbDec.render(ctx, {
        ctx:        ctx,
        heapu32:    heapu32,
        ringSize:   ringSize,
        ringWords:  RW,
        startSamp:  startSamp,
        samples:    samples,
        laZoom:     laZoom,
        decY:       decY,
        decH:       decH,
        labelW:     LABEL_W,
        sigX:       SIG_X,
        laW:        LA_W
      });
    }

    // ── 各信号波形を描画（ラベルはプレパス済み）──
    if (samples > 0) {
      for (var t = 0; t < sigs.length; t++) {
        var sig   = sigs[t];
        var yBase = sigY + t * tH;
        var MASK  = (sig.width < 32) ? ((1 << sig.width) - 1) : 0xFFFFFFFF;
        var sw    = sig.word || 0;

        if (sig.type === 'bit') {
          var yHigh = yBase + 4, yLow = yBase + tH - 4;

          if (laZoom >= 1) {
            // ── 等倍 / ズームイン ──
            ctx.globalAlpha = 0.15; ctx.fillStyle = sig.color;
            var fillStart = null;
            for (var i = 0; i < samples; i++) {
              var gw = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
              var v  = (gw >> sig.bit) & 1, fx = SIG_X + i * laZoom;
              if (v && fillStart === null) fillStart = fx;
              if (!v && fillStart !== null) {
                ctx.fillRect(fillStart, yHigh, fx - fillStart, yLow - yHigh); fillStart = null;
              }
            }
            if (fillStart !== null)
              ctx.fillRect(fillStart, yHigh, SIG_X + samples * laZoom - fillStart, yLow - yHigh);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = sig.color; ctx.lineWidth = 1.5; ctx.beginPath();
            var gw0b = heapu32[(startSamp & (ringSize - 1)) * RW + sw];
            ctx.moveTo(SIG_X, ((gw0b >> sig.bit) & 1) ? yHigh : yLow);
            for (var i = 0; i < samples; i++) {
              var gw = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
              var v  = (gw >> sig.bit) & 1, x = SIG_X + i * laZoom;
              ctx.lineTo(x, v ? yHigh : yLow); ctx.lineTo(x + laZoom, v ? yHigh : yLow);
            }
            ctx.stroke();

          } else {
            // ── ズームアウト: OR 集約 ──
            var pixCount = Math.ceil(samples * laZoom);
            ctx.globalAlpha = 0.20; ctx.fillStyle = sig.color;
            for (var px = 0; px < pixCount; px++) {
              var si0 = Math.floor(px / laZoom), si1 = Math.min(Math.ceil((px + 1) / laZoom), samples);
              var agg = 0;
              for (var si = si0; si < si1; si++) {
                var gw = heapu32[((startSamp + si) & (ringSize - 1)) * RW + sw];
                agg |= (gw >> sig.bit) & 1;
              }
              if (agg) ctx.fillRect(SIG_X + px, yHigh, 1, yLow - yHigh);
            }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = sig.color; ctx.lineWidth = 1.5; ctx.beginPath();
            var firstPx = true;
            for (var px = 0; px < pixCount; px++) {
              var si0 = Math.floor(px / laZoom), si1 = Math.min(Math.ceil((px + 1) / laZoom), samples);
              var agg = 0;
              for (var si = si0; si < si1; si++) {
                var gw = heapu32[((startSamp + si) & (ringSize - 1)) * RW + sw];
                agg |= (gw >> sig.bit) & 1;
              }
              var xp = SIG_X + px, y = agg ? yHigh : yLow;
              if (firstPx) { ctx.moveTo(xp, y); firstPx = false; } else ctx.lineTo(xp, y);
              ctx.lineTo(xp + 1, y);
            }
            ctx.stroke();
          }

        } else {
          // ── hex 信号 ──
          var hexPad = sig.width > 8 ? 4 : 2;
          var yTop = yBase + 4, yMid = yBase + tH / 2, yBot = yBase + tH - 4;

          // 背景色コールバック
          if (cbBg) {
            if (laZoom >= 1) {
              for (var i = 0; i < samples; i++) {
                var gw  = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
                var val = (gw >> sig.bit) & MASK;
                var bgc = cbBg(sig, val);
                if (bgc) {
                  ctx.fillStyle = bgc;
                  ctx.fillRect(SIG_X + i * laZoom, yBase, laZoom, tH);
                }
              }
            } else {
              var pixC = Math.ceil(samples * laZoom);
              for (var px = 0; px < pixC; px++) {
                var si0 = Math.floor(px / laZoom);
                var gw  = heapu32[((startSamp + si0) & (ringSize - 1)) * RW + sw];
                var val = (gw >> sig.bit) & MASK;
                var bgc = cbBg(sig, val);
                if (bgc) {
                  ctx.fillStyle = bgc;
                  ctx.fillRect(SIG_X + px, yBase, 1, tH);
                }
              }
            }
          }

          // hex セグメント描画
          var gw0h = heapu32[(startSamp & (ringSize - 1)) * RW + sw];
          var pv   = (gw0h >> sig.bit) & MASK, ss = SIG_X, segs = [];
          for (var i = 1; i < samples; i++) {
            var gw = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
            var v  = (gw >> sig.bit) & MASK, xn = SIG_X + i * laZoom;
            if (v !== pv) { segs.push({ x: ss, w: xn - ss, val: pv }); ss = xn; pv = v; }
          }
          segs.push({ x: ss, w: SIG_X + samples * laZoom - ss, val: pv });

          // ── 左端縦棒抑制: view 外にデータがあり値が連続している場合は縦棒なし ──
          var v0h = (gw0h >> sig.bit) & MASK;
          var hasLeftTrans = true;
          if (startSamp > 0) {
            var gwPrevL = heapu32[((startSamp - 1) & (ringSize - 1)) * RW + sw];
            hasLeftTrans = ((gwPrevL >> sig.bit) & MASK) !== v0h;
          }
          // ── 右端縦棒抑制: view 後のサンプルが存在し値が連続している場合は縦棒なし ──
          var nextSampAbsH = startSamp + samples;  // = head - pan
          var hasRightTrans = false;
          if (nextSampAbsH < (head >>> 0)) {
            var vL = (heapu32[((nextSampAbsH - 1) & (ringSize - 1)) * RW + sw] >> sig.bit) & MASK;
            var vN = (heapu32[(nextSampAbsH         & (ringSize - 1)) * RW + sw] >> sig.bit) & MASK;
            hasRightTrans = (vL !== vN);
          }

          ctx.lineWidth = 1;
          for (var si = 0; si < segs.length; si++) {
            var s = segs[si];
            if (s.w < 0.5) continue;
            ctx.strokeStyle = sig.color;
            var drawL = (si > 0) || hasLeftTrans;
            var drawR = (si < segs.length - 1) || hasRightTrans;
            (function(seg, dL, dR) {
              [[yTop,yTop],[yBot,yBot],[yTop,yBot],[yTop,yBot]].forEach(function(ys, ii) {
                ctx.beginPath();
                if (ii < 2)        { ctx.moveTo(seg.x, ys[0]);         ctx.lineTo(seg.x + seg.w, ys[0]); }
                else if (ii === 2) { if (!dL) return; ctx.moveTo(seg.x, yTop);         ctx.lineTo(seg.x, yBot); }
                else               { if (!dR) return; ctx.moveTo(seg.x + seg.w, yTop); ctx.lineTo(seg.x + seg.w, yBot); }
                ctx.stroke();
              });
            })(s, drawL, drawR);

            if (sig.fmt === 'dec') {
              // 10進表示
              if (laZoom >= 4 && s.w > 4) {
                ctx.fillStyle = sig.color; ctx.textAlign = 'center';
                ctx.font = '11px monospace';
                ctx.fillText(String(s.val), s.x + s.w / 2, yMid + 4);
              }
            } else if ((laZoom >= 4 && s.w > 4) || s.w > 24) {
              ctx.fillStyle = sig.color; ctx.textAlign = 'center';
              if (sig.fmt && cbFmt[sig.fmt]) {
                ctx.font = '10px monospace';
                ctx.fillText(cbFmt[sig.fmt](s.val), s.x + s.w / 2, yMid + 4);
              } else {
                ctx.font = '11px monospace';
                var _fullLbl  = s.val.toString(16).toUpperCase().padStart(hexPad, '0');
                var _shortLbl = s.val.toString(16).toUpperCase();
                var _fullThresh = hexPad === 4 ? 40 : 28;
                ctx.fillText(s.w > _fullThresh ? _fullLbl : _shortLbl,
                             s.x + s.w / 2, yMid + 3);
              }
            }
          }
        }
      } // end signal loop
    }

    // ── T ステートグリッド線 ──
    if (cbTs && samples > 0 && laZoom >= 1) {
      for (var gi = 0; gi < samples; gi++) {
        var gw0g = heapu32[((startSamp + gi) & (ringSize - 1)) * RW];
        var ts   = cbTs(gw0g);
        if (ts === 1) {
          var gx = SIG_X + gi * laZoom;
          ctx.save();
          ctx.strokeStyle = 'rgba(80,80,200,0.28)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(gx, sigY); ctx.lineTo(gx, sigY + sigH); ctx.stroke();
          ctx.restore();
        } else if (laZoom >= 4 && ts > 1 && (ts & 1) === 1) {
          var gx = SIG_X + gi * laZoom;
          ctx.save();
          ctx.strokeStyle = 'rgba(80,80,200,0.10)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(gx, sigY); ctx.lineTo(gx, sigY + sigH); ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ── MARKER_LANE バッジ + マーカー縦線 ──
    // ON のときのみバッジを表示（OFF のときは Marker レーンに表示しない）
    // [3] は Trig 用固定位置。A/B/C の固定位置は後で動的計算する。
    var _fixedX = [0, 0, 0, LABEL_W + 88];
    function drawMarker(mLabel, mSamp, isOn, mLineColor, mBadgeColor, fixedX) {
      if (!isOn) return;  // OFF のときはバッジ非表示
      var hasSamp = mSamp !== null;
      var off     = hasSamp ? mSamp - startSamp : null;
      var mx      = hasSamp ? SIG_X + off * laZoom : fixedX;
      var inView  = hasSamp && off >= 0 && off < samples;
      var showAtPos = hasSamp && mx >= SIG_X - 12 && mx <= LA_W + 12;

      // 縦線・バッジとも信号領域（x >= LABEL_W）のみに表示
      ctx.save();
      ctx.beginPath();
      ctx.rect(LABEL_W, 0, LA_W - LABEL_W, laH);
      ctx.clip();

      // ── 縦線: 範囲外は端にクランプして常に表示 ──
      if (hasSamp) {
        var lineX = inView ? mx
                  : (mx < LABEL_W ? LABEL_W    // 左（過去）はみ出し → 左端
                                  : LA_W - 1); // 右（未来）はみ出し → 右端
        ctx.strokeStyle = mLineColor;
        ctx.lineWidth   = inView ? 2.5 : 1.5;
        ctx.setLineDash(inView ? [6, 4] : [2, 5]);
        ctx.globalAlpha = inView ? 1.0 : 0.45;
        ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, mlaneY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
      }

      // ── バッジ: ビュー内ならその位置 / ビュー外なら固定位置 ──
      var bx = showAtPos ? mx : fixedX;
      var BW = 20, BH = MARKER_LANE_H;
      ctx.fillStyle = mBadgeColor;
      ctx.fillRect(bx - BW / 2, mlaneY, BW, BH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(mLabel, bx, mlaneY + BH - 4);
      ctx.restore();
    }
    // A-B 差分: ハイライト + T ステート数ラベル
    if (self._markerAOn && self._markerBOn && self._markerA !== null && self._markerB !== null) {
      var diff = Math.abs(self._markerA - self._markerB);
      var offA = self._markerA - startSamp, offB = self._markerB - startSamp;
      var xL = SIG_X + Math.max(0, Math.min(offA, offB)) * laZoom;
      var xR = SIG_X + Math.min(samples, Math.max(offA, offB)) * laZoom;
      if (xR > xL && xR > LABEL_W && xL < LA_W) {
        ctx.fillStyle = 'rgba(120,120,255,0.07)';
        ctx.fillRect(xL, sigY, xR - xL, sigH);
      }
      var diffT   = Math.round(diff / 2);
      var diffStr = 'A-B: ' + diffT + ' T';
      ctx.font = '11px monospace'; ctx.textAlign = 'left';
      var dw = ctx.measureText(diffStr).width;
      ctx.fillStyle = 'rgba(215,215,245,0.93)';
      ctx.fillRect(LABEL_W + 2, sigY + sigH - 15, dw + 6, 14);
      ctx.fillStyle = '#224'; ctx.fillText(diffStr, LABEL_W + 5, sigY + sigH - 4);
    }

    // ── トラックドラッグ ビジュアル ──
    if (self._tDragIdx !== null && self._tDragIdx < sigs.length) {
      ctx.fillStyle = 'rgba(60,100,255,0.12)';
      ctx.fillRect(0, sigY + self._tDragIdx * tH, LA_W, tH);
      ctx.fillStyle = 'rgba(40,80,220,0.9)';
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(sigs[self._tDragIdx].label, 3, sigY + self._tDragIdx * tH + tH * 0.65);
      var insertAt = Math.max(0, Math.min(Math.round((self._tDragY - sigY) / tH), sigs.length));
      var iy = sigY + insertAt * tH;
      ctx.save();
      ctx.strokeStyle = 'rgba(40,80,220,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(LABEL_W, iy); ctx.lineTo(LA_W, iy); ctx.stroke();
      ctx.fillStyle = 'rgba(40,80,220,0.85)';
      ctx.beginPath();
      ctx.moveTo(LABEL_W, iy); ctx.lineTo(LABEL_W + 8, iy - 4); ctx.lineTo(LABEL_W + 8, iy + 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // ── トリガー発火位置 ──
    // ON かつトリガーが発火済みのときのみバッジ表示（OFF のときは非表示）
    (function() {
      var hasTrig = self._trigHead >= 0;
      if (!hasTrig || !self._trigOn) return;
      var TBW = 34, TBH = MARKER_LANE_H;
      var trigFixX = _fixedX[3];
      var fireOff = ((self._trigHead >>> 0) - 1) - startSamp;
      var fx = SIG_X + fireOff * laZoom;
      var fireX = (fx >= SIG_X - 18 && fx <= LA_W + 18) ? fx : trigFixX;
      var inView = fireOff >= 0 && fireOff < samples;
      ctx.save();
      if (inView) {
        ctx.strokeStyle = 'rgba(220,0,0,0.85)'; ctx.lineWidth = 2.5;
        ctx.setLineDash([3, 6]);
        ctx.beginPath(); ctx.moveTo(fireX, 0); ctx.lineTo(fireX, mlaneY); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#dc0000';
      ctx.fillRect(fireX - TBW / 2, mlaneY, TBW, TBH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('TRIG', fireX, mlaneY + TBH - 4);
      ctx.restore();
    })();

    // ── クロックルーラー（クリップ内: tick はサブピクセルシフト済み）──
    if (samples > 0) {
      var NICE = [2, 4, 10, 20, 40, 100, 200, 400, 1000, 2000, 4000, 8000];
      var rawSamp  = (laZoom >= 16) ? 2 : (80 / laZoom);
      var tickSamp = NICE[NICE.length - 1];
      for (var ni = 0; ni < NICE.length; ni++) {
        if (NICE[ni] >= rawSamp) { tickSamp = NICE[ni]; break; }
      }
      var firstTick = Math.ceil(startSamp / tickSamp) * tickSamp;

      ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(LABEL_W, sigY);        ctx.lineTo(LA_W, sigY);        ctx.stroke();
      ctx.beginPath(); ctx.moveTo(LABEL_W, sigY + sigH); ctx.lineTo(LA_W, sigY + sigH); ctx.stroke();

      ctx.font = '10px monospace'; ctx.textAlign = 'center';

      for (var tick = firstTick; ; tick += tickSamp) {
        var toff = tick - startSamp;
        var tx2  = SIG_X + toff * laZoom;
        if (tx2 >= LA_W - 1) break;  // キャンバス右端を超えたら終了
        // LABEL_W 左側はクリップで自動非表示（tx2 < LABEL_W の continue 不要）
        // tNum = tick - head（整数）: ヘッドを 0 とした過去方向負の T オフセット
        var tNum = toff - samples - panInt;
        var lbl2 = (tNum === 0 ? '0' : (tNum > 0 ? '+' + tNum : '' + tNum));

        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(tx2, 0); ctx.lineTo(tx2, 5); ctx.stroke();
        ctx.fillStyle = '#444'; ctx.fillText(lbl2, tx2, 12);

        ctx.beginPath(); ctx.moveTo(tx2, sigY); ctx.lineTo(tx2, sigY + 5); ctx.stroke();

        ctx.beginPath(); ctx.moveTo(tx2, sigY + sigH); ctx.lineTo(tx2, sigY + sigH + 5); ctx.stroke();
        ctx.fillStyle = '#444'; ctx.fillText(lbl2, tx2, sigY + sigH + 11);
      }
    }

    // ── クリップ解除 ──
    ctx.restore();

    // ── マーカー縦線 + バッジ（クリップなし: 範囲外クランプ線を確実に表示）──
    // 範囲外バッジは「左寄せ / 右寄せ」「文字順ソート / 重なり防止」で動的配置
    (function() {
      var BAD_W = 20, BAD_GAP = 2, STEP = BAD_W + BAD_GAP;
      var _mkrs = [
        { label:'A', samp:self._markerA, on:self._markerAOn,
          lc:'rgba(0,100,230,0.85)', bc:'#0064e6' },
        { label:'B', samp:self._markerB, on:self._markerBOn,
          lc:'rgba(200,0,80,0.85)',  bc:'#c80050' },
        { label:'C', samp:self._markerC, on:self._markerCOn,
          lc:'rgba(0,160,80,0.85)',  bc:'#00a050' },
      ];

      // 各マーカーが「ビュー内（showAtPos）」か「左範囲外」か「右範囲外」かを判定
      var leftOut = [], rightOut = [];
      _mkrs.forEach(function(m) {
        if (!m.on || m.samp === null) return;
        var off = m.samp - startSamp;
        var mx  = SIG_X + off * laZoom;
        m._showAtPos = mx >= SIG_X - 12 && mx <= LA_W + 12;
        if (!m._showAtPos) {
          if (mx < LABEL_W) leftOut.push(m);  // 左（過去）方向
          else              rightOut.push(m); // 右（未来）方向
        }
      });

      // 左寄せ: samp 昇順（古い順）で LABEL_W の右端から右へ並べる
      leftOut.sort(function(a, b) { return a.samp - b.samp; });
      leftOut.forEach(function(m, i) {
        m._fixedX = LABEL_W + BAD_W / 2 + i * STEP;
      });

      // 右寄せ: samp 昇順（小さい方が左）で右詰め、最後（最大値）が右端に来る
      rightOut.sort(function(a, b) { return a.samp - b.samp; });
      rightOut.forEach(function(m, i) {
        m._fixedX = LA_W - BAD_W / 2 - (rightOut.length - 1 - i) * STEP;
      });

      // ビュー内マーカーには fixedX 不要（drawMarker が showAtPos で無視する）
      // クリックハンドラー用にバッジの実際の表示 x をキャッシュする
      self._markerFixedXCache = _mkrs.map(function(m) {
        return m._fixedX || LABEL_W + BAD_W / 2;
      });
      _mkrs.forEach(function(m) {
        drawMarker(m.label, m.samp, m.on, m.lc, m.bc, m._fixedX || LABEL_W + BAD_W / 2);
      });
    })();

    // ── カーソル（縦破線 + 値オーバーレイ、クリップなし）──
    if (self._cursorViewX >= 0 && self._cursorViewX <= VIEW_W && samples > 0) {
      var cursorX   = LABEL_W + self._cursorViewX;
      // サブピクセルシフトを加味してカーソル位置のサンプルインデックスを補正する
      var cursorOff = Math.max(0, Math.min(Math.floor((self._cursorViewX + subPx) / laZoom), samples - 1));
      ctx.save();
      ctx.strokeStyle = 'rgba(200,80,0,0.8)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cursorX, sigY); ctx.lineTo(cursorX, sigY + sigH); ctx.stroke();
      ctx.restore();
      var parts = [];
      var absIdx = startSamp + cursorOff;
      for (var t2 = 0; t2 < sigs.length; t2++) {
        var sig2  = sigs[t2], sw2 = sig2.word || 0;
        var MASK2 = sig2.width < 32 ? ((1 << sig2.width) - 1) : 0xFFFFFFFF;
        var gw2   = heapu32[((startSamp + cursorOff) & (ringSize - 1)) * RW + sw2];
        var v2    = (gw2 >> sig2.bit) & MASK2;
        if (sig2.type === 'bit') {
          parts.push(sig2.label + '=' + v2);
        } else if (sig2.fmt && cbFmt[sig2.fmt]) {
          parts.push(sig2.label + '=' + cbFmt[sig2.fmt](v2));
        } else {
          var hpad = sig2.width > 8 ? 4 : 2;
          parts.push(sig2.label + '=' + v2.toString(16).toUpperCase().padStart(hpad, '0'));
        }
      }
      // カーソル追加情報コールバック
      if (cbCurExtra) {
        var extra = cbCurExtra(heapu32, ringSize, RW, absIdx);
        if (extra) parts.unshift(extra);
      }
      var text = parts.join('  ');
      ctx.font = '11px monospace'; ctx.textAlign = 'left';
      var tw = ctx.measureText(text).width;
      var tx = cursorX + 6;
      if (tx + tw + 4 > LA_W) tx = cursorX - tw - 10;
      ctx.fillStyle = 'rgba(255,255,200,0.93)';
      ctx.fillRect(tx - 2, sigY + 1, tw + 6, 16);
      ctx.fillStyle = '#333'; ctx.fillText(text, tx, sigY + 13);
    }

    // ── クロックルーラー T ラベル（ラベルエリア x=2、クリップなし）──
    if (samples > 0) {
      ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('T', 2, 11);
      ctx.fillText('T', 2, sigY + sigH + 11);
    }

    // ── 右端縦線（タイムルーラーを含むキャンバス全高 — 最後に重ねて確実に表示）──
    // LA_W - 0.5 だと DPR×2 時に右半ピクセルがクリップされるため LA_W - 1 に配置
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(LA_W - 1, 0);
    ctx.lineTo(LA_W - 1, laH);
    ctx.stroke();
  };

  // ==================== エクスポート ====================

  global.RTLScopeLA = RTLScopeLA;

})(window);
