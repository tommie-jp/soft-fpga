// sft-8080-debug-panel.js — Debug パネル（レジスタ表示・I/Oログ・スタック・コールトレース）
//
// 06-8080 Web UI から分離。素の <script src> で読み込み、トップレベル関数/変数を
// グローバルに公開（機能不変）。disasm8080 / addrSym / IO_SYMS（sft-8080-disasm.js）に依存するため、
// 必ず sft-8080-disasm.js の後に読み込むこと。
// 利用元: index.html の RAF loop()・worker frame ハンドラ・updateRegPanel。

// ---- 共通 16 進ヘルパ ----
function h2(n) { return (n & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
function h4(n) { return (n & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }

// ---- I/O ログ状態 ----
var ioLog        = [];   // [{port, data, isWrite}, ...]
var ioLogMaxLen  = 200;
var prevRingHead = 0;

// NOTE: ここの `idx * 6` は RING_WORDS=7 と不一致の既存ストライドバグ
//       （tests/helpers/ring.mjs で修正済みの問題と同根）。分離では機能不変を保つため
//       現状維持し、別コミットで RING_WORDS 連動へ修正予定。
function processRingForIOLog(ring32, newHead) {
  var n = Math.min((newHead - prevRingHead) >>> 0, 4096);
  for (var i = 0; i < n; i++) {
    var idx = (prevRingHead + i) & (4096 - 1);
    var s   = ring32[idx * 6] >>> 0;  // Word 0（6 ワード/サンプル）
    if (s & (1 << 24)) {  // io_req
      ioLog.push({ port: s & 0xFF, data: (s >> 16) & 0xFF, isWrite: !!(s & (1 << 25)) });
      if (ioLog.length > ioLogMaxLen) ioLog.shift();
    }
  }
  prevRingHead = newHead;
}

function updateRegPanel(regs8, pcBytes3) {
  var A = regs8[0], F = regs8[1];
  var B = regs8[2], C = regs8[3], D = regs8[4], E = regs8[5];
  var H = regs8[6], L = regs8[7];
  var SPH = regs8[8], SPL = regs8[9];
  var PCH = regs8[10], PCL = regs8[11];
  document.getElementById('r-a').textContent  = h2(A);
  // F フラグ: S Z . AC . P 1 C
  var flagStr =
    (F & 0x80 ? 'S' : 's') +
    (F & 0x40 ? 'Z' : 'z') +
    '.' +
    (F & 0x10 ? 'A' : 'a') +
    '.' +
    (F & 0x04 ? 'P' : 'p') +
    '1' +
    (F & 0x01 ? 'C' : 'c');
  document.getElementById('r-f').textContent  = flagStr;
  document.getElementById('r-bc').textContent = h2(B) + h2(C);
  document.getElementById('r-de').textContent = h2(D) + h2(E);
  document.getElementById('r-hl').textContent = h2(H) + h2(L);
  document.getElementById('r-sp').textContent = h2(SPH) + h2(SPL);
  document.getElementById('r-pc').textContent = h2(PCH) + h2(PCL);
  updatePcRegion((PCH << 8) | PCL);
  // 逆アセンブル表示
  var mnem = disasm8080(pcBytes3[0], pcBytes3[1], pcBytes3[2]);
  document.getElementById('r-disasm').textContent = mnem;
}

var _activeDbgTab = 'stack';
function switchDbgTab(tab) {
  _activeDbgTab = tab;
  document.querySelectorAll('.dbg-tab').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  document.getElementById('tab-stack').style.display     = tab === 'stack'     ? '' : 'none';
  document.getElementById('tab-iolog').style.display     = tab === 'iolog'     ? '' : 'none';
  document.getElementById('tab-calltrace').style.display = tab === 'calltrace' ? '' : 'none';
}

function renderStackView(stackBytes, sp) {
  if (_activeDbgTab !== 'stack') return;
  var el = document.getElementById('tab-stack');
  var rows = '';
  for (var i = 0; i < 8; i++) {
    var addr = (sp + i * 2) & 0xFFFF;
    var lo   = stackBytes[i * 2] & 0xFF;
    var hi   = stackBytes[i * 2 + 1] & 0xFF;
    var val  = (hi << 8) | lo;
    var sym  = addrSym(val);
    rows += '<div class="stk-row' + (i === 0 ? ' stk-sp' : '') + '">' +
      '<span class="stk-addr">' + (i === 0 ? 'SP→' : '+' + (i*2)) + '</span>' +
      '<span class="stk-hi">' + h2(hi) + '</span>' +
      '<span class="stk-lo">' + h2(lo) + '</span>' +
      '<span class="stk-val">$' + h4(val) + (sym ? ' <em>' + sym + '</em>' : '') + '</span>' +
      '</div>';
  }
  el.innerHTML = rows || '<div style="color:#aaa;">(empty)</div>';
}

function renderIOLog() {
  if (_activeDbgTab !== 'iolog') return;
  var el = document.getElementById('tab-iolog');
  if (!ioLog.length) { el.innerHTML = '<div style="color:#aaa;">(no I/O yet)</div>'; return; }
  var rows = '';
  var start = Math.max(0, ioLog.length - 60);
  for (var i = ioLog.length - 1; i >= start; i--) {
    var e = ioLog[i];
    var sym = IO_SYMS[e.port] || '';
    rows += '<div class="io-row">' +
      '<span class="io-dir ' + (e.isWrite ? 'io-out' : 'io-in') + '">' + (e.isWrite ? 'OUT' : 'IN') + '</span>' +
      '<span class="io-port">$' + h2(e.port) + '</span>' +
      '<span class="io-data">$' + h2(e.data) + '</span>' +
      '<span class="io-sym">' + sym + '</span>' +
      '</div>';
  }
  el.innerHTML = rows;
}

var lastCallLogHead = 0;
function renderCallTrace(callLog32, callLogHead) {
  if (_activeDbgTab !== 'calltrace') return;
  var el = document.getElementById('tab-calltrace');
  if (!callLogHead) { el.innerHTML = '<div style="color:#aaa;">(no calls yet)</div>'; return; }
  var count = Math.min(callLogHead >>> 0, 64);
  var head  = callLogHead >>> 0;
  var rows  = '';
  for (var i = 0; i < count && i < 40; i++) {
    var idx   = ((head - 1 - i) % 64 + 64) % 64;
    var w0    = callLog32[idx * 2    ] >>> 0;
    var w1    = callLog32[idx * 2 + 1] >>> 0;
    var from  = w0 & 0xFFFF;
    var isRet = (w0 >> 16) & 1;
    var to    = w1 & 0xFFFF;
    var sym   = addrSym(to);
    rows += '<div class="ct-row">' +
      '<span class="ct-type ' + (isRet ? 'ct-ret' : 'ct-call') + '">' + (isRet ? 'RET' : 'CALL') + '</span>' +
      '<span class="ct-from">$' + h4(from) + '</span>' +
      '<span class="ct-arr">→</span>' +
      '<span class="ct-to">$' + h4(to) + '</span>' +
      '<span class="ct-sym">' + sym + '</span>' +
      '</div>';
  }
  el.innerHTML = rows || '<div style="color:#aaa;">(empty)</div>';
}

// ---- PC リージョン表示（CP/M 2.2 メモリ領域: docs/06-8080/52-メモリマップ.md）----
var PC_REGIONS = [
  { lo: 0x0000, hi: 0x00FF, cls: 'r-page0', label: 'PAGE0' },
  { lo: 0x0100, hi: 0xDBFF, cls: 'r-tpa',   label: 'TPA'   },
  { lo: 0xDC00, hi: 0xE3FF, cls: 'r-ccp',   label: 'CCP'   },
  { lo: 0xE400, hi: 0xF1FF, cls: 'r-bdos',  label: 'BDOS'  },
  { lo: 0xF200, hi: 0xFFFF, cls: 'r-bios',  label: 'BIOS'  },
];
var _pcRegionEl = null;
function updatePcRegion(addr) {
  if (!_pcRegionEl) _pcRegionEl = document.getElementById('r-pc-region');
  var r = null;
  for (var i = 0; i < PC_REGIONS.length; i++) {
    if (addr >= PC_REGIONS[i].lo && addr <= PC_REGIONS[i].hi) { r = PC_REGIONS[i]; break; }
  }
  _pcRegionEl.className = 'pc-region' + (r ? ' ' + r.cls : '');
  _pcRegionEl.textContent = r ? r.label : '';
}
