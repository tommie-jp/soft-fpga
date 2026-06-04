// sft-8080-memwatch.js — MemWatch アドレス入力オーバーレイ + la._draw フック
//
// 06-8080 Web UI から分離。initMemWatch() は window.la 生成後・初描画前に呼ぶこと
// （la._draw / la._updateCanvas をフックするため）。index.html の initUI() 内で呼び出す。
// グローバル参照: window.la（bareword `la`）, workerSend（worker-bridge）。
// window._laMemWatchSet を公開（sim.setMemWatch から同期される）。

function initMemWatch() {
  var MEM_IDS    = ['mem1', 'mem2', 'mem3'];
  var mwEls      = [null, null, null];   // overlay 行 div
  var mwAddrs    = [0, 0, 0];            // 現在設定中のアドレス（有効なもののみ）
  var mwEnabled  = [false, false, false]; // アドレス入力済みフラグ

  var overlay = document.getElementById('la-mem-overlay');

  // 3 スロット分の行要素を生成
  for (var s = 0; s < 3; s++) {
    var row = document.createElement('div');
    row.style.cssText =
      'position:absolute;display:none;left:0;width:100px;' +
      'align-items:center;justify-content:flex-end;padding-right:4px;' +
      'box-sizing:border-box;pointer-events:none;';

    var inp = document.createElement('input');
    inp.type        = 'text';
    inp.maxLength   = 4;
    inp.placeholder = 'ADDR';
    inp.style.cssText =
      'width:52px;font-family:monospace;font-size:10px;padding:1px 3px;' +
      'border:1px solid #bbb;border-radius:2px;background:#fff8ef;color:#553300;' +
      'text-transform:uppercase;letter-spacing:.04em;pointer-events:all;' +
      'box-sizing:border-box;';
    inp.title = 'MEM' + (s + 1) + ' ウォッチアドレス（16進 4桁、例: 0350）';

    // アドレス確定時に WASM に通知
    (function(slot, input) {
      function applyAddr() {
        var raw = input.value.replace(/[^0-9a-fA-F]/g, '');
        if (!raw) return;
        var addr = parseInt(raw, 16) & 0xFFFF;
        mwAddrs[slot]   = addr;
        mwEnabled[slot] = true;
        input.value = addr.toString(16).toUpperCase().padStart(4, '0');
        workerSend({ type: 'setMemWatch', slot: slot, addr: addr, enable: true });
      }
      input.addEventListener('blur',    applyAddr);
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { applyAddr(); input.blur(); }
      });
    })(s, inp);

    row.appendChild(inp);
    overlay.appendChild(row);
    mwEls[s] = row;
  }

  // ── レイアウト計算ヘルパー ─────────────────────────────────────────────
  function _laLayout() {
    var laH  = la._laH || 0;
    var decH = (la._showDec && la._cbDec) ? la._DEC_LANE_H : 0;
    var sigY = la._TIME_RULER_H + decH;
    var sigH = laH - la._MARKER_LANE_H - 2 * la._TIME_RULER_H - decH;
    var sigs = la._getActiveSigs();
    var tH   = sigs.length > 0 ? sigH / sigs.length : la._TRACK_H;
    return { laH: laH, sigY: sigY, sigs: sigs, tH: tH };
  }

  // ── HTML オーバーレイ位置更新（入力欄の y 座標を信号行に合わせる）──
  function updateOverlay() {
    var canvas = document.getElementById('la');
    if (!canvas || !la) return;
    var lay = _laLayout();
    overlay.style.width  = canvas.offsetWidth  + 'px';
    overlay.style.height = canvas.offsetHeight + 'px';
    for (var s = 0; s < 3; s++) {
      var idx = -1;
      for (var i = 0; i < lay.sigs.length; i++) {
        if (lay.sigs[i].id === MEM_IDS[s]) { idx = i; break; }
      }
      var el = mwEls[s];
      if (idx < 0) { el.style.display = 'none'; continue; }
      var yTop = lay.sigY + idx * lay.tH;
      el.style.display    = 'flex';
      el.style.top        = yTop + 'px';
      el.style.height     = lay.tH + 'px';
      el.style.lineHeight = lay.tH + 'px';
    }
  }

  // ── canvas にアドレスを直接描画（スクリーンショットにも写る）──────────
  // RTLScopeLA の "M1" ラベルを上書きし、"23 M1[0350]" 形式で描く。
  // la._draw() が canvas を毎回クリア→再描画するため、その直後に呼ぶ。
  function drawMemWatchLabels() {
    var canvas = document.getElementById('la');
    if (!canvas || !la) return;
    var ctx = canvas.getContext('2d');
    var dpr = la._dpr || 1;
    var lay = _laLayout();
    var lw  = la._LABEL_W || 56;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'left';
    for (var s = 0; s < 3; s++) {
      if (!mwEnabled[s]) continue;
      var idx = -1;
      for (var i = 0; i < lay.sigs.length; i++) {
        if (lay.sigs[i].id === MEM_IDS[s]) { idx = i; break; }
      }
      if (idx < 0) continue;
      var yTop    = lay.sigY + idx * lay.tH;
      var tH      = lay.tH;
      var addrStr = mwAddrs[s].toString(16).toUpperCase().padStart(4, '0');
      var _decOff = (la._cbDec && la._showDec) ? 1 : 0;
      var _mwNum  = String(idx + 1 + _decOff).padStart(2, '0');
      var label   = _mwNum + ' ' + lay.sigs[idx].label + '[' + addrStr + ']';
      // 行全体（上下 2px マージン）を背景で塗り、既存ラベルを上書き
      ctx.fillStyle = 'rgba(255,248,239,0.92)';
      ctx.fillRect(0, yTop + 1, lw - 1, tH - 2);
      // 他のレーン名と同じ 12px monospace で描画
      ctx.font = '12px monospace';
      ctx.fillStyle = '#111';
      ctx.fillText(label, 3, yTop + tH * 0.65);
    }
    ctx.restore();
  }

  // ── 外部から状態を更新するブリッジ（sim.setMemWatch → 内部同期）──
  // テストコードや DevTools から sim.setMemWatch() を呼んだとき、
  // WASM にメッセージを送るだけでなく JS 側の mwEnabled/mwAddrs も更新する。
  window._laMemWatchSet = function(slot, addr) {
    if (slot < 0 || slot > 2) return;
    var en = (addr >= 0);
    mwEnabled[slot] = en;
    if (en) mwAddrs[slot] = addr & 0xFFFF;
    // 入力欄の表示値も同期
    var el = mwEls[slot];
    if (el) {
      var inp = el.querySelector('input');
      if (inp) inp.value = en
        ? (addr & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
        : '';
    }
    drawMemWatchLabels();
    updateOverlay();
  };

  // ── la._draw() をフックして両方の後処理を実行 ─────────────────────────
  // _draw は update() / _updateCanvas() / _schedDraw() の全経路から呼ばれる。
  var _origDraw = la._draw.bind(la);
  la._draw = function(heapu32, head) {
    _origDraw(heapu32, head);
    drawMemWatchLabels();
    updateOverlay();
  };

  // _updateCanvas() もフック（canvas リサイズ時に _draw を呼ばないケースがある）
  var _origUpdateCanvas = la._updateCanvas.bind(la);
  la._updateCanvas = function() {
    _origUpdateCanvas();
    drawMemWatchLabels();
    updateOverlay();
  };
}
