// sft-la-toolbar.js — Logic Analyzer の操作 UI（ツールバー・トリガー・ナビ・canvas）を描画する
//
// 各 example の index.html は <div id="la-root"></div> を置き、
//   mountLaToolbar('la-root');
// を呼ぶだけでよい。DOM id は js/sft-la-ctrl.js と js/rtlscope-la.js が参照するものに揃えてある。
// ページ背景が暗くても読めるよう、全体を白いパネルで包む。

function mountLaToolbar(rootId, opts) {
  'use strict';
  var root = document.getElementById(rootId);
  if (!root) throw new Error('mountLaToolbar: #' + rootId + ' が見つかりません');
  var o = opts || {};
  // 表示言語 (既定は英語。?lang=jp で日本語)。js/rtlscope-la.js を先に読み込んでおくこと
  var ja = RTLScopeLA.pickLang(o.lang) === 'ja';
  function T(jaText, enText) { return ja ? jaText : enText; }
  var canvasW = o.canvasWidth || 900;

  if (!document.getElementById('sft-la-toolbar-style')) {
    var st = document.createElement('style');
    st.id = 'sft-la-toolbar-style';
    st.textContent = [
      '.la-panel { background:#fff; color:#111; padding:6px 8px; border-radius:4px; font-family:monospace; }',
      '.la-panel button { background:#e8e8e8; color:#222; border:1px solid #aaa; padding:3px 12px;',
      '  cursor:pointer; font-family:monospace; font-size:13px; }',
      '.la-panel button:hover { background:#d0d0d0; }',
      '.la-panel .sig-label { font-size:13px; color:#111; white-space:nowrap; }',
      '.la-ver { font-size:11px; color:#888; font-weight:normal; margin-left:4px; }',
      '.la-bar { display:flex; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:4px; }',
      '.la-panel .chk { display:inline-flex; align-items:center; gap:4px; cursor:pointer; font-size:13px;',
      '  padding:2px 7px; border:1px solid #aaa; border-radius:3px; background:#f8f8f8; user-select:none; color:#111; }',
      '.la-panel .chk input { cursor:pointer; margin:0; accent-color:#446; }',
      '.trig-bar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:2px; }',
      '#trig-detail { display:none; flex-wrap:wrap; align-items:center; gap:4px; padding:3px 0;',
      '  border-top:1px solid #e0e0e0; margin-top:2px; }',
      '#trig-detail select, #trig-detail input { font-family:monospace; font-size:13px; padding:1px 3px;',
      '  border:1px solid #aaa; background:#fff; color:#111; }',
      '#trig-val { width:90px; } #trig-post { width:80px; }',
      '.trig-theme { font-size:13px; margin-right:6px; }',
      '#trig-msg { font-size:12px; color:#555; }',
      '#la-nav { display:flex; align-items:center; padding:2px 0; margin-top:2px; }',
      '.la-nav-left { display:flex; align-items:center; gap:3px; flex:1; }',
      '.la-nav-center { display:flex; align-items:center; gap:3px; justify-content:center; }',
      '.la-nav-right { display:flex; align-items:center; gap:3px; flex:1; justify-content:flex-end; }',
      '#la-nav button { padding:1px 8px; line-height:1.4; min-width:28px; }',
      '#la-zoom-sel { font-size:13px; padding:1px 2px; line-height:1.4; font-family:monospace;',
      '  border:1px solid #aaa; background:#fff; color:#111; cursor:pointer; min-width:46px; text-align:center; }',
      '#la-toggles { display:flex; flex-wrap:wrap; gap:3px; }',
      '.sig-tog { display:inline-flex; align-items:center; gap:3px; font-size:13px; font-family:monospace;',
      '  padding:2px 8px; border-radius:10px; cursor:pointer; border:1px solid #bbb; background:#f0f0f0;',
      '  color:#444; user-select:none; white-space:nowrap; }',
      '.sig-tog.on { color:#fff; border-color:transparent; }',
      '.sig-tog input { display:none; }',
      '#la-wrap { position:relative; display:block; }',
      '#la-wrap canvas { display:block; max-width:100%; }'
    ].join('\n');
    document.head.appendChild(st);
  }

  root.innerHTML = [
    '<div class="la-panel">',
    '  <div class="la-bar">',
    '    <span class="sig-label">Logic Analyzer<span id="la-ver" class="la-ver"></span></span>',
    '    <button id="btn-la-toggle" title="' + T('Logic Analyzer ON/OFF。OFF の間は ring buffer への書き込みを止めます。', 'Logic Analyzer ON/OFF. While OFF, writes to the ring buffer are stopped.') + '">LA ON</button>',
    '    <label class="chk" title="' + T('信号レーンの塗りつぶし ON/OFF', 'Fill signal lanes ON/OFF') + '"><input type="checkbox" id="la-fill-chk" checked> Fill</label>',
    '    <label class="chk" title="' + T('信号レーンの網目パターン ON/OFF', 'Hatch pattern on signal lanes ON/OFF') + '"><input type="checkbox" id="la-hatch-chk"> Hatch</label>',
    '    <div id="la-toggles"></div>',
    '  </div>',
    '  <div class="trig-bar">',
    '    <button id="btn-freeze" title="' + T('波形の記録を止めて、いまの波形を保ちます (Hold)。もう一度押すと記録を再開します (Resume)。止めている間も回路は動き続けます。', 'Stop recording and keep the current waveform (Hold). Press again to resume recording (Resume). The circuit keeps running while held.') + '">⏸ Hold</button>',
    '    <button id="btn-trig-toggle" title="' + T('トリガー設定の表示／非表示', 'Show / hide the trigger settings') + '">⚙ Trigger ▸</button>',
    '  </div>',
    '  <div id="trig-detail">',
    '    <select id="trig-sig" title="' + T('トリガー対象の信号', 'Signal to trigger on') + '"></select>',
    '    <select id="trig-mode" title="' + T('トリガー条件', 'Trigger condition') + '">',
    '      <option value="eq" selected>==</option>',
    '      <option value="rise">↑ ' + T('立ち上がり', 'Rising') + '</option>',
    '      <option value="fall">↓ ' + T('立ち下がり', 'Falling') + '</option>',
    '    </select>',
    '    <input id="trig-val" type="text" placeholder="value (hex)" title="' + T('比較値（16 進。1 ビット信号は 0 / 1）', 'Compare value (hex; 0 / 1 for a 1-bit signal)') + '">',
    '    <input id="trig-post" type="text" placeholder="post (clks)" title="' + T('発火後に記録するクロック数（0 = 即停止）', 'Clocks to record after firing (0 = stop immediately)') + '">',
    '    <button id="btn-trig-set" title="' + T('トリガーを設定して実行を再開します', 'Arm the trigger and resume running') + '">Set</button>',
    '    <button id="btn-trig-clear" title="' + T('トリガーを解除します', 'Clear the trigger') + '">Clear</button>',
    '    <button id="btn-goto-trig" title="' + T('トリガー発火位置を画面中央へ移動します', 'Move the trigger position to the center of the view') + '">⊙ Trig</button>',
    '    <span id="trig-msg"></span>',
    '  </div>',
    '  <div id="la-nav">',
    '    <div class="la-nav-left">',
    '      <button id="la-nav-ll" title="' + T('最も古いデータへ', 'Go to the oldest data') + '">&#x00AB;</button>',
    '      <button id="la-nav-l" title="' + T('1 画面ぶん過去へ', 'Back one screen') + '">&#x2039;</button>',
    '    </div>',
    '    <div class="la-nav-center">',
    '      <button id="la-zoom-out" title="' + T('縮小（マウスホイール対応）', 'Zoom out (mouse wheel works too)') + '">−</button>',
    '      <select id="la-zoom-sel" title="' + T('ズーム倍率', 'Zoom level') + '">',
    '        <option value="0">1/4x</option><option value="1">1/2x</option><option value="2" selected>1x</option>',
    '        <option value="3">2x</option><option value="4">4x</option><option value="5">8x</option>',
    '        <option value="6">16x</option><option value="7">32x</option><option value="8">64x</option>',
    '      </select>',
    '      <button id="la-zoom-in" title="' + T('拡大（マウスホイール対応）', 'Zoom in (mouse wheel works too)') + '">＋</button>',
    '    </div>',
    '    <div class="la-nav-right">',
    '      <button id="la-nav-r" title="' + T('1 画面ぶん最新へ', 'Forward one screen') + '">&#x203A;</button>',
    '      <button id="la-nav-rr" title="' + T('最新データへ（ライブ追従）', 'Go to the latest data (follow live)') + '">&#x00BB;</button>',
    '    </div>',
    '  </div>',
    '  <div id="la-wrap"><canvas id="la" width="' + canvasW + '" height="120"></canvas></div>',
    '</div>'
  ].join('\n');
}
