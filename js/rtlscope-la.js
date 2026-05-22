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
    self._LA_W          = c.width         || 900;
    self._LABEL_W       = c.labelWidth    || 56;
    self._TRACK_H       = c.trackH        || 28;
    self._TIME_RULER_H  = c.timeRulerH    || 14;
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
    self._lastStartSamp = 0;
    self._lastHead     = 0;
    self._frozen       = false;
    self._on           = true;
    self._tDragIdx     = null;
    self._tDragY       = 0;
    self._trigHead     = -1;

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
    self._dpr  = window.devicePixelRatio || 1;
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
      this._trigHead = (trigFireHead !== -1) ? (trigFireHead >>> 0) : -1;
    }
    if (!this._on || !this._ctx) return;
    this._draw(heapu32, head >>> 0);
  };

  /** ズームインデックスを設定する */
  RTLScopeLA.prototype.setZoom = function(idx) {
    var self = this;
    var oldZoom = self._zoom;
    self._zoomIdx = Math.max(0, Math.min(LA_ZOOM_LEVELS.length - 1, idx));
    self._zoom    = LA_ZOOM_LEVELS[self._zoomIdx];
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
    if (!b) this._pan = 0;
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
    el.innerHTML = '';

    // デコードレーンボタン (decodeLane が設定されている場合のみ)
    if (self._cbDec) {
      var decLabel = self._cbDec.label || 'DEC';
      var decBtn = document.createElement('label');
      decBtn.className = 'sig-tog' + (self._showDec ? ' on' : '');
      decBtn.style.background   = self._showDec ? '#445566' : '';
      decBtn.style.borderRadius = '10px';
      decBtn.title = 'マシンサイクルデコードレーンの表示切替。';
      decBtn.innerHTML = '<input type="checkbox"' + (self._showDec ? ' checked' : '') + '> ' + decLabel;
      decBtn.querySelector('input').addEventListener('change', function() {
        self._showDec = this.checked;
        localStorage.setItem(self._prefix + 'decode_lane', this.checked ? '1' : '0');
        decBtn.className = 'sig-tog' + (this.checked ? ' on' : '');
        decBtn.style.background = this.checked ? '#445566' : '';
        self._updateCanvas();
      });
      el.appendChild(decBtn);

      var sep = document.createElement('span');
      sep.style.cssText = 'color:#bbb;font-size:13px;align-self:center;margin:0 2px;user-select:none;';
      sep.textContent = '|';
      el.appendChild(sep);
    }

    // グループ別シグナルトグル
    self._groups.forEach(function(grp, gi) {
      var glbl = document.createElement('span');
      glbl.style.cssText = 'font-size:10px;color:#888;align-self:center;margin-right:1px;user-select:none;white-space:nowrap;';
      glbl.textContent = grp.label + ':';
      el.appendChild(glbl);

      self._sigOrder.forEach(function(id) {
        if (grp.ids.indexOf(id) < 0) return;
        var s = null;
        for (var i = 0; i < self._signals.length; i++) {
          if (self._signals[i].id === id) { s = self._signals[i]; break; }
        }
        if (!s) return;
        var lbl = document.createElement('label');
        lbl.className = 'sig-tog' + (self._sigVisible[s.id] ? ' on' : '');
        lbl.style.background = self._sigVisible[s.id] ? s.color : '';
        if (s.tip) lbl.title = s.tip;
        lbl.innerHTML = '<input type="checkbox"' + (self._sigVisible[s.id] ? ' checked' : '') + '> ' + s.label;
        lbl.querySelector('input').addEventListener('change', (function(sig, l) {
          return function() {
            self._sigVisible[sig.id] = this.checked;
            localStorage.setItem(self._prefix + 'sig_' + sig.id, this.checked ? '1' : '0');
            l.className = 'sig-tog' + (this.checked ? ' on' : '');
            l.style.background = this.checked ? sig.color : '';
            self._updateCanvas();
          };
        })(s, lbl));
        el.appendChild(lbl);
      });

      if (gi < self._groups.length - 1) {
        var gsep = document.createElement('span');
        gsep.style.cssText = 'color:#ddd;font-size:13px;align-self:center;margin:0 1px;user-select:none;';
        gsep.textContent = '|';
        el.appendChild(gsep);
      }
    });
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
    var n = self._getActiveSigs().length || 1;
    self._laH = (self._showDec && self._cbDec ? self._DEC_LANE_H : 0)
               + n * self._TRACK_H
               + 2 * self._TIME_RULER_H;
    var canvas = document.getElementById(self._canvasId);
    if (!canvas) return;
    canvas.width  = self._LA_W * self._dpr;
    canvas.height = self._laH  * self._dpr;
    canvas.style.width  = self._LA_W + 'px';
    canvas.style.height = self._laH  + 'px';
    self._ctx = canvas.getContext('2d');
    self._ctx.setTransform(self._dpr, 0, 0, self._dpr, 0, 0);
  };

  // ==================== 内部: イベントバインド ====================

  RTLScopeLA.prototype._bindEvents = function() {
    var self = this;

    // ---- ズームボタン ----
    var btnZoomIn  = document.getElementById('la-zoom-in');
    var btnZoomOut = document.getElementById('la-zoom-out');
    var btnZoomLbl = document.getElementById('la-zoom-lbl');
    if (btnZoomIn)  btnZoomIn.addEventListener('click',  function() { self.setZoom(self._zoomIdx + 1); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', function() { self.setZoom(self._zoomIdx - 1); });
    if (btnZoomLbl) btnZoomLbl.addEventListener('click', function() { self.setZoom(2); self._pan = 0; });

    var canvas = document.getElementById(self._canvasId);
    if (!canvas) return;

    // ---- ホイールズーム ----
    canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      self.setZoom(self._zoomIdx + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });

    // ---- マウスダウン ----
    var laDragX    = null;
    var laDragPan0 = 0;

    canvas.addEventListener('mousedown', function(e) {
      var rect = canvas.getBoundingClientRect();
      var lx   = e.clientX - rect.left;
      var ly   = e.clientY - rect.top;
      if (lx < self._LABEL_W) {
        var decOff = (self._showDec && self._cbDec) ? self._DEC_LANE_H : 0;
        var sigHd  = self._laH - 2 * self._TIME_RULER_H - decOff;
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

      self._cursorViewX = self._tDragIdx !== null ? -1 : Math.max(-1, lx - self._LABEL_W);
      canvas.style.cursor = self._tDragIdx !== null ? 'grabbing'
                          : lx < self._LABEL_W      ? 'grab'
                          :                           '';

      if (self._tDragIdx !== null) {
        self._tDragY = ly;
      } else if (laDragX !== null) {
        var dx = e.clientX - laDragX;
        self._pan = Math.max(0, laDragPan0 + Math.round(dx / self._zoom));
      }
    });

    // ---- トラックドラッグ確定 ----
    function commitTrackDrag() {
      if (self._tDragIdx === null) return;
      var decOff2 = (self._showDec && self._cbDec) ? self._DEC_LANE_H : 0;
      var sigHc   = self._laH - 2 * self._TIME_RULER_H - decOff2;
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

    canvas.addEventListener('mouseup', function() {
      commitTrackDrag();
      laDragX = null;
    });
    canvas.addEventListener('mouseleave', function() {
      commitTrackDrag();
      laDragX            = null;
      self._cursorViewX  = -1;
      canvas.style.cursor = '';
    });

    // ---- A/B マーカー ----
    canvas.addEventListener('click', function(e) {
      var rect = canvas.getBoundingClientRect();
      var vx   = (e.clientX - rect.left) - self._LABEL_W;
      if (vx < 0) return;
      var samp = self._lastStartSamp + Math.floor(vx / self._zoom);
      if (e.shiftKey) { self._markerB = samp; }
      else             { self._markerA = samp; }
    });
    canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var vx   = (e.clientX - rect.left) - self._LABEL_W;
      if (vx < 0) return;
      self._markerB = self._lastStartSamp + Math.floor(vx / self._zoom);
    });

    // ---- タッチ操作 ----
    var laTouch0 = null;
    canvas.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        laTouch0 = { x: e.touches[0].clientX, pan: self._pan, dist: null, zoomIdx: self._zoomIdx };
      } else if (e.touches.length === 2) {
        var tdx = e.touches[0].clientX - e.touches[1].clientX;
        var tdy = e.touches[0].clientY - e.touches[1].clientY;
        laTouch0 = { x: 0, pan: self._pan, dist: Math.sqrt(tdx*tdx + tdy*tdy), zoomIdx: self._zoomIdx };
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      if (!laTouch0) return;
      e.preventDefault();
      if (e.touches.length === 1 && laTouch0.dist === null) {
        var delta = Math.round(-(e.touches[0].clientX - laTouch0.x) / self._zoom);
        self._pan = Math.max(0, laTouch0.pan + delta);
      } else if (e.touches.length === 2 && laTouch0.dist !== null) {
        var tdx2 = e.touches[0].clientX - e.touches[1].clientX;
        var tdy2 = e.touches[0].clientY - e.touches[1].clientY;
        var dist2 = Math.sqrt(tdx2*tdx2 + tdy2*tdy2);
        var newIdx = laTouch0.zoomIdx + Math.round(Math.log2(dist2 / laTouch0.dist));
        self.setZoom(newIdx);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function() { laTouch0 = null; });
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
    var TIME_RULER_H = self._TIME_RULER_H;
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
    var sigY  = TIME_RULER_H + decH;
    var sigH  = laH - 2 * TIME_RULER_H - decH;
    var tH    = sigs.length > 0 ? sigH / sigs.length : TRACK_H;

    // ── 背景 ──
    ctx.fillStyle = '#e0e0ea'; ctx.fillRect(0, 0,            LA_W, TIME_RULER_H);
    if (cbDec) {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, TIME_RULER_H, LA_W, decH);
    }
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, sigY,         LA_W, sigH);
    ctx.fillStyle = '#e0e0ea'; ctx.fillRect(0, sigY + sigH,  LA_W, TIME_RULER_H);

    // ── ズーム / パン計算 ──
    var totalAvail    = Math.min(head >>> 0, ringSize);
    var samplesInView = Math.min(Math.ceil(VIEW_W / laZoom), ringSize);
    self._pan = Math.max(0, Math.min(self._pan, Math.max(0, totalAvail - samplesInView)));
    var samples   = Math.min(samplesInView, totalAvail - self._pan);
    var startSamp = (head >>> 0) - self._pan - samples;
    self._lastStartSamp = startSamp;

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
        laW:        LA_W
      });
    }

    // ── 各信号を描画 ──
    for (var t = 0; t < sigs.length; t++) {
      var sig   = sigs[t];
      var yBase = sigY + t * tH;
      var MASK  = (sig.width < 32) ? ((1 << sig.width) - 1) : 0xFFFFFFFF;
      var sw    = sig.word || 0;

      // トラック区切り線 + ラベル
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, yBase + tH); ctx.lineTo(LA_W, yBase + tH); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(sig.label, 3, yBase + tH * 0.65);
      if (!samples) continue;

      if (sig.type === 'bit') {
        var yHigh = yBase + 4, yLow = yBase + tH - 4;

        if (laZoom >= 1) {
          // ── 等倍 / ズームイン ──
          ctx.globalAlpha = 0.15; ctx.fillStyle = sig.color;
          var fillStart = null;
          for (var i = 0; i < samples; i++) {
            var gw = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
            var v  = (gw >> sig.bit) & 1, fx = LABEL_W + i * laZoom;
            if (v && fillStart === null) fillStart = fx;
            if (!v && fillStart !== null) {
              ctx.fillRect(fillStart, yHigh, fx - fillStart, yLow - yHigh); fillStart = null;
            }
          }
          if (fillStart !== null)
            ctx.fillRect(fillStart, yHigh, LABEL_W + samples * laZoom - fillStart, yLow - yHigh);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = sig.color; ctx.lineWidth = 1.5; ctx.beginPath();
          var gw0b = heapu32[(startSamp & (ringSize - 1)) * RW + sw];
          ctx.moveTo(LABEL_W, ((gw0b >> sig.bit) & 1) ? yHigh : yLow);
          for (var i = 0; i < samples; i++) {
            var gw = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
            var v  = (gw >> sig.bit) & 1, x = LABEL_W + i * laZoom;
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
            if (agg) ctx.fillRect(LABEL_W + px, yHigh, 1, yLow - yHigh);
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
            var xp = LABEL_W + px, y = agg ? yHigh : yLow;
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
                ctx.fillRect(LABEL_W + i * laZoom, yBase, laZoom, tH);
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
                ctx.fillRect(LABEL_W + px, yBase, 1, tH);
              }
            }
          }
        }

        // hex セグメント描画
        var gw0h = heapu32[(startSamp & (ringSize - 1)) * RW + sw];
        var pv   = (gw0h >> sig.bit) & MASK, ss = LABEL_W, segs = [];
        for (var i = 1; i < samples; i++) {
          var gw = heapu32[((startSamp + i) & (ringSize - 1)) * RW + sw];
          var v  = (gw >> sig.bit) & MASK, xn = LABEL_W + i * laZoom;
          if (v !== pv) { segs.push({ x: ss, w: xn - ss, val: pv }); ss = xn; pv = v; }
        }
        segs.push({ x: ss, w: LABEL_W + samples * laZoom - ss, val: pv });
        ctx.lineWidth = 1;
        for (var si = 0; si < segs.length; si++) {
          var s = segs[si];
          if (s.w < 0.5) continue;
          ctx.strokeStyle = sig.color;
          (function(seg) {
            [[yTop,yTop],[yBot,yBot],[yTop,yBot],[yTop,yBot]].forEach(function(ys, ii) {
              ctx.beginPath();
              if (ii < 2)        { ctx.moveTo(seg.x, ys[0]);         ctx.lineTo(seg.x + seg.w, ys[0]); }
              else if (ii === 2) { ctx.moveTo(seg.x, yTop);          ctx.lineTo(seg.x, yBot); }
              else               { ctx.moveTo(seg.x + seg.w, yTop);  ctx.lineTo(seg.x + seg.w, yBot); }
              ctx.stroke();
            });
          })(s);

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

    // ── T ステートグリッド線 ──
    if (cbTs && samples > 0 && laZoom >= 1) {
      for (var gi = 0; gi < samples; gi++) {
        var gw0g = heapu32[((startSamp + gi) & (ringSize - 1)) * RW];
        var ts   = cbTs(gw0g);
        if (ts === 1) {
          var gx = LABEL_W + gi * laZoom;
          ctx.save();
          ctx.strokeStyle = 'rgba(80,80,200,0.28)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(gx, sigY); ctx.lineTo(gx, sigY + sigH); ctx.stroke();
          ctx.restore();
        } else if (laZoom >= 4 && ts > 1 && (ts & 1) === 1) {
          var gx = LABEL_W + gi * laZoom;
          ctx.save();
          ctx.strokeStyle = 'rgba(80,80,200,0.10)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(gx, sigY); ctx.lineTo(gx, sigY + sigH); ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ── A/B マーカー ──
    function drawMarker(mLabel, mSamp, mColor) {
      if (mSamp === null) return;
      var off = mSamp - startSamp;
      if (off < 0 || off >= samples) return;
      var mx = LABEL_W + off * laZoom;
      ctx.save();
      ctx.strokeStyle = mColor; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(mx, sigY); ctx.lineTo(mx, sigY + sigH); ctx.stroke();
      ctx.fillStyle = mColor;
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(mLabel, mx, sigY + 10);
      ctx.restore();
    }
    drawMarker('A', self._markerA, 'rgba(0,100,230,0.9)');
    drawMarker('B', self._markerB, 'rgba(200,0,80,0.9)');

    // A-B 差分: ハイライト + T ステート数ラベル
    if (self._markerA !== null && self._markerB !== null) {
      var diff = Math.abs(self._markerA - self._markerB);
      var offA = self._markerA - startSamp, offB = self._markerB - startSamp;
      var xL = LABEL_W + Math.max(0, Math.min(offA, offB)) * laZoom;
      var xR = LABEL_W + Math.min(samples, Math.max(offA, offB)) * laZoom;
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

    // ── トリガー発火位置（赤縦線）──
    if (self._trigHead >= 0 && samples > 0) {
      var fireOff = ((self._trigHead >>> 0) - 1) - startSamp;
      if (fireOff >= 0 && fireOff < samples) {
        var fireX = LABEL_W + fireOff * laZoom;
        ctx.save();
        ctx.strokeStyle = 'rgba(220,0,0,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(fireX, TIME_RULER_H);
        ctx.lineTo(fireX, sigY + sigH + TIME_RULER_H);
        ctx.stroke();
        ctx.fillStyle = 'rgba(220,0,0,0.85)';
        ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
        ctx.fillText('TRIG', fireX, TIME_RULER_H - 2);
        ctx.restore();
      }
    }

    // ── カーソル（縦破線 + 値オーバーレイ）──
    if (self._cursorViewX >= 0 && self._cursorViewX <= VIEW_W && samples > 0) {
      var cursorX   = LABEL_W + self._cursorViewX;
      var cursorOff = Math.max(0, Math.min(Math.floor(self._cursorViewX / laZoom), samples - 1));
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

    // ── クロックルーラー ──
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

      for (var tick = firstTick; tick < startSamp + samples; tick += tickSamp) {
        var toff = tick - startSamp;
        var tx2  = LABEL_W + toff * laZoom;
        if (tx2 < LABEL_W || tx2 > LA_W) continue;
        var tNum = Math.round(toff / 2);
        var lbl2 = '' + tNum;

        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(tx2, 0); ctx.lineTo(tx2, 5); ctx.stroke();
        ctx.fillStyle = '#444'; ctx.fillText(lbl2, tx2, 12);

        ctx.beginPath(); ctx.moveTo(tx2, sigY); ctx.lineTo(tx2, sigY + 5); ctx.stroke();

        ctx.beginPath(); ctx.moveTo(tx2, sigY + sigH); ctx.lineTo(tx2, sigY + sigH + 5); ctx.stroke();
        ctx.fillStyle = '#444'; ctx.fillText(lbl2, tx2, laH - 2);
      }

      ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('T', 2, 11);
      ctx.fillText('T', 2, laH - 2);
    }

    // ── ズーム/パン情報オーバーレイ ──
    if (laZoom !== 1 || self._pan !== 0) {
      var zStr = laZoom >= 1 ? laZoom + 'x' : '1/' + Math.round(1 / laZoom) + 'x';
      var info = zStr + ' | ' + samples + ' smpl' + (self._pan > 0 ? ' | -' + self._pan : '');
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.font = '10px monospace'; ctx.textAlign = 'right';
      ctx.fillText(info, LA_W - 4, sigY - 3);
    }
  };

  // ==================== エクスポート ====================

  global.RTLScopeLA = RTLScopeLA;

})(window);
