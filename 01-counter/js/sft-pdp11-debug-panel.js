'use strict';
// sft-pdp11-debug-panel.js — ブート進行・MMU パネル・レジスタ表示・Debug ログ
//
// 依存（実行時に解決されるグローバル）:
//   _ringWords（index.html）, fmtPSW11 / fmtIsn11（sft-pdp11-la-defs.js）
// updateRegs / updateMMUPanel / checkBootTTY / resetBootProgress は
// index.html の worker.onmessage ハンドラから呼ばれる。

// ── ブート進行追跡（TTY + PC 値ベース）──────────────────────────────────
// TTY に出るのは "@rkunix" と "login:" のみ。中間ステップは ring buffer の PC で検出する。
//   bootrom  : TTY の "@" か PC >= 0o173000 (ブートロム領域)
//   kernel   : PC が 0 付近に落ちる (0o0–0o20000)
//   mem=     : PC が 0o4000–0o10000 付近 (カーネル init 後半)
//   user     : Mode ビット = User (PSW[15:14] = 11)
//   login:   : TTY に "login" が出現

var bootBuf = '';
var bootDone = { bootrom:false, kernel:false, mem:false, user:false, login:false };

function checkBootTTY(s) {
  bootBuf += s;
  if (bootBuf.length > 512) bootBuf = bootBuf.slice(-512);
  if (!bootDone.bootrom && bootBuf.indexOf('@') >= 0) markBoot('bootrom');
  if (!bootDone.login   && bootBuf.indexOf('login') >= 0) markBoot('login');
}

function checkBootPC(pc, mode) {
  // bootrom 領域 (0o160000–0o177777 = 0xE000–0xFFFF)
  if (!bootDone.bootrom && pc >= 0xE000) markBoot('bootrom');
  // kernel 本体 (0 付近に制御が移った)
  if (!bootDone.kernel && bootDone.bootrom && pc < 0x2000) markBoot('kernel');
  // kernel init 後半 (0o4000 ≈ 0x800 を超えた辺り)
  if (!bootDone.mem && bootDone.kernel && pc >= 0x400 && pc < 0x3000) markBoot('mem');
  // user プロセス起動 (Mode = User = 3)
  if (!bootDone.user && bootDone.kernel && mode === 3) markBoot('user');
}

function markBoot(key) {
  if (bootDone[key]) return;
  bootDone[key] = true;
  var el = document.getElementById('bp-' + key);
  if (el) el.className = 'boot-step done';
  // 次のステップを current にする
  var order = ['bootrom','kernel','mem','user','login'];
  var next  = order[order.indexOf(key) + 1];
  if (next && !bootDone[next]) {
    var nel = document.getElementById('bp-' + next);
    if (nel && !nel.classList.contains('done')) nel.className = 'boot-step current';
  }
}

function resetBootProgress() {
  bootBuf = '';
  var order = ['bootrom','kernel','mem','user','login'];
  order.forEach(function(k) {
    bootDone[k] = false;
    var el = document.getElementById('bp-' + k);
    if (el) el.className = 'boot-step';
  });
  var first = document.getElementById('bp-bootrom');
  if (first) first.className = 'boot-step current';
}

// ── MMU パネル描画 ────────────────────────────────────────────────────────
var mmuVisible = false;

function updateMMUPanel(snap32) {
  // snap32: Uint32Array[16] — upper16=PAR, lower16=PDR
  // 0-7: Kernel I-space,  8-15: User I-space
  var kEl = document.getElementById('mmu-kernel');
  var uEl = document.getElementById('mmu-user');
  if (!kEl || !uEl) return;

  // ヘッダ行を保持しつつ行を再生成
  function renderCol(el, entries, startIdx) {
    var hdr = el.firstElementChild;
    while (el.childNodes.length > 1) el.removeChild(el.lastChild);
    for (var i = 0; i < 8; i++) {
      var v   = entries[i];
      var par = (v >>> 16) & 0x0FFF;  // 12-bit PAR
      var pdr = v & 0xFFFF;
      // PDP-11/34 の PAR は 64-word (128 byte) ブロック単位: PA = PAR × 0o200
      var phys = par * 0x80;           // 18-bit physical byte address

      var row   = document.createElement('div');
      row.className = 'mmu-row';

      var pEl   = document.createElement('span'); pEl.className = 'mmu-page'; pEl.textContent = i;
      var parEl = document.createElement('span'); parEl.className = 'mmu-par';
      parEl.textContent = par.toString(8).padStart(4,'0');
      var pdrEl = document.createElement('span'); pdrEl.className = 'mmu-pdr';
      pdrEl.textContent = pdr.toString(8).padStart(6,'0');
      var paEl  = document.createElement('span'); paEl.className = 'mmu-pa';
      paEl.textContent = '→' + phys.toString(8).padStart(6,'0');

      row.appendChild(pEl);
      row.appendChild(parEl);
      row.appendChild(pdrEl);
      row.appendChild(paEl);
      el.appendChild(row);
    }
  }

  renderCol(kEl, snap32.slice(0,  8), 0);
  renderCol(uEl, snap32.slice(8, 16), 8);
}

(function() {
  var btn   = document.getElementById('btn-mmu-collapse');
  var panel = btn && btn.closest('.mmu-panel');
  var body  = document.getElementById('mmu-tables');
  if (!btn || !panel || !body) return;

  btn.addEventListener('click', function() {
    var collapsed = panel.classList.toggle('collapsed');
    if (collapsed) {
      body.style.height = body.offsetHeight + 'px';
      requestAnimationFrame(function() { body.style.height = '0'; });
    } else {
      var mmuContent = document.getElementById('mmu-content');
      var target = (mmuContent ? mmuContent.offsetHeight : 128) +
                   (document.getElementById('mmu-resizer') ? 5 : 0);
      body.style.height = target + 'px';
      body.addEventListener('transitionend', function onEnd() {
        body.removeEventListener('transitionend', onEnd);
        body.style.height = '';
      });
    }
  });
})();

// ── CPU Log パネル ────────────────────────────────────────────────────────
// trap イベントとモード遷移を時系列で統合表示する。
//   { type:'trap', pc, psw, sys }     — トラップ発生（sys call / bus error 等）
//   { type:'mode', from, to, pc }     — Kernel ↔ User モード遷移

// Unix V6 システムコール番号 → 名前（番号 = インデックス）
var _V6SYS = [
  'indir','exit','fork','read','write','open','close','wait',       // 0-7
  'creat','link','unlink','exec','chdir','time','mknod','chmod',    // 8-15
  'chown','break','stat','seek','getpid','mount','umount','setuid', // 16-23
  'getuid','stime','ptrace',null,'fstat',null,null,'stty',          // 24-31
  'gtty','access','nice','sleep','sync','kill','switch',null,       // 32-39
  'setpgrp','dup','pipe','times','profil',null,'setgid','getgid','signal' // 40-48
];

// obs_word4 ビットレイアウト:
//   bits[ 4: 0] istate
//   bits[20: 5] isn (TRAP 命令本体)
//   bits[31:24] sys 0 (indir) の .word N（非 indir 時は 0）
// Unix V6 の sys 命令は TRAP: 0x8900–0x89FF（EMT は 0x8800–0x88FF）
function _decodeSys(word4) {
  var isn = (word4 >>> 5) & 0xFFFF;
  if ((isn & 0xFF00) !== 0x8900) return null;   // TRAP 以外
  var n = isn & 0xFF;
  // sys 0 (indir): bits[31:24] に harness が .word N を詰めている。
  // 名前が引けた場合はそのまま sys N (name) として表示（"0→" 不要）。
  // 名前が引けない（ユーザー仮想アドレス起因のゴミ読みを含む）は indir にフォールバック。
  if (n === 0) {
    var indirect_n = (word4 >>> 24) & 0xFF;
    if (indirect_n > 0 && indirect_n < _V6SYS.length && _V6SYS[indirect_n]) {
      return { n: indirect_n, name: _V6SYS[indirect_n] };
    }
    return { n: 0, name: 'indir' };
  }
  return { n: n, name: (n < _V6SYS.length && _V6SYS[n]) || null };
}

var _cpuLog          = [];
var _prevMode        = -1;
var _cpuLogEnabled   = false;
var _cpuLogExecCapture = false;
var _lastTrap        = null;  // 直前に記録した trap { pc, psw, w4 } — フレーム間重複除去用
var _processToken    = -1;    // exec キャプチャ時に確定した UIPAR0 (-1 = フィルタなし)
var _waitingNewCtx   = false; // exec 後、最初の ctx_new=1 で _processToken を更新する
var _pendingUipar0   = -1;    // exec/fork 後、UIPAR0 が変わるまで旧 UIPAR0 の syscall をスキップ

(function() {
  var chk = document.getElementById('btn-cpulog-toggle');
  if (!chk) return;
  chk.addEventListener('change', function() {
    _cpuLogEnabled = chk.checked;
  });
})();

(function() {
  var chk = document.getElementById('btn-cpulog-exec');
  if (!chk) return;
  chk.addEventListener('change', function() {
    _cpuLogExecCapture = chk.checked;
  });
})();

(function() {
  var btn = document.getElementById('btn-cpulog-clear');
  if (btn) btn.addEventListener('click', function() {
    _cpuLog.length = 0;
    _processToken  = -1;
    _waitingNewCtx = false;
    _renderCpuLog();
  });
})();

(function() {
  var btn = document.getElementById('btn-cpulog-copy');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var baseClkC = -1;
    for (var bi2 = _cpuLog.length - 1; bi2 >= 0; bi2--) {
      if (_cpuLog[bi2].clk >= 0) { baseClkC = _cpuLog[bi2].clk; break; }
    }
    var text = _cpuLog.map(function(r) {
      var timeCol = '';
      if (r.clk >= 0 && baseClkC >= 0) timeCol = '+' + ((r.clk - baseClkC) >>> 0) + '\t';
      if (r.type === 'trap') {
        var s = timeCol + oct6(r.pc) + '  TRAP';
        if (r.sys) s += '  ' + (r.sys.name ? r.sys.name + ' (' + r.sys.n + ')' : 'sys ' + r.sys.n);
        if (_processToken < 0 && r.uipar0 >= 0) s += '  [' + r.uipar0.toString(8) + ']';
        return s + '  PSW=' + hex4(r.psw);
      }
      return timeCol + oct6(r.pc) + '  ' + MODE_NAMES[r.from] + ' → ' + MODE_NAMES[r.to];
    }).join('\n');
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = 'Copy'; }, 1200);
    });
  });
})();

(function() {
  var btn   = document.getElementById('btn-eventlog-collapse');
  var panel = document.getElementById('debug-panel');
  var body  = document.getElementById('cpulog-body');
  if (!btn || !panel || !body) return;

  btn.addEventListener('click', function() {
    var collapsed = panel.classList.toggle('collapsed');
    if (collapsed) {
      body.style.height = body.offsetHeight + 'px';
      requestAnimationFrame(function() { body.style.height = '0'; });
    } else {
      var tabCpulog = document.getElementById('tab-cpulog');
      var target = (tabCpulog ? tabCpulog.offsetHeight : 120) +
                   (document.getElementById('cpulog-resizer') ? 5 : 0);
      body.style.height = target + 'px';
      body.addEventListener('transitionend', function onEnd() {
        body.removeEventListener('transitionend', onEnd);
        body.style.height = '';
      });
    }
  });
})();

// ── パネル高さリサイズ（Registers / MMU / Event Log）────────────────────────
(function() {
  var resizer = document.getElementById('regs-resizer');
  var body    = document.getElementById('regs-body');
  var content = document.getElementById('regs-grid');
  if (!resizer || !body || !content) return;
  var startY = 0, startH = 0, maxH = 0, MIN_H = 40;
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    body.style.height = '';  // auto に戻してパネルが追従するようにする
    startY = e.clientY; startH = content.offsetHeight;
    maxH = content.scrollHeight;  // 全レジスタ表示に必要な自然高さを上限にする
    resizer.classList.add('dragging');
    function onMove(e) {
      content.style.height = Math.min(maxH, Math.max(MIN_H, startH + e.clientY - startY)) + 'px';
    }
    function onUp() {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

(function() {
  var resizer = document.getElementById('mmu-resizer');
  var body    = document.getElementById('mmu-tables');
  var content = document.getElementById('mmu-content');
  if (!resizer || !body || !content) return;
  var startY = 0, startH = 0, maxH = 0, MIN_H = 40;
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    body.style.height = '';  // auto に戻してパネルが追従するようにする
    startY = e.clientY; startH = content.offsetHeight;
    maxH = content.scrollHeight;  // 全 PAR/PDR 表示に必要な自然高さを上限にする
    resizer.classList.add('dragging');
    function onMove(e) {
      content.style.height = Math.min(maxH, Math.max(MIN_H, startH + e.clientY - startY)) + 'px';
    }
    function onUp() {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

(function() {
  var resizer = document.getElementById('cpulog-resizer');
  var body    = document.getElementById('cpulog-body');
  var content = document.getElementById('tab-cpulog');
  if (!resizer || !body || !content) return;
  var startY = 0, startH = 0, MIN_H = 40, MAX_H = 600;
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    body.style.height = '';  // auto に戻してパネルが追従するようにする
    startY = e.clientY; startH = content.offsetHeight;
    resizer.classList.add('dragging');
    function onMove(e) {
      content.style.height = Math.min(MAX_H, Math.max(MIN_H, startH + e.clientY - startY)) + 'px';
    }
    function onUp() {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

function _renderCpuLog() {
  var el = document.getElementById('tab-cpulog');
  if (!el) return;
  var rows = _cpuLog.slice(0, 60);
  // 最古エントリ（末尾）の clk を基準にして相対時刻を計算する
  var baseClk = -1;
  for (var bi = rows.length - 1; bi >= 0; bi--) {
    if (rows[bi].clk >= 0) { baseClk = rows[bi].clk; break; }
  }
  var html = '<table class="dbg-table">' +
    '<thead><tr class="dbg-head">' +
    '<th class="dbg-time">+clk</th>' +
    '<th class="dbg-pc">PC</th>' +
    '<th class="dbg-trap"></th>' +
    '<th class="dbg-sys">syscall</th>' +
    '<th class="dbg-ctx">ctx</th>' +
    '<th class="dbg-psw">PSW</th>' +
    '</tr></thead><tbody>';
  for (var ri = 0; ri < rows.length; ri++) {
    var r = rows[ri];
    // 相対時刻列
    var timeStr = '';
    if (r.clk >= 0 && baseClk >= 0) {
      var delta = (r.clk - baseClk) >>> 0;  // 32bit 符号なし差分
      timeStr = '+' + delta;
    }
    if (r.type === 'trap') {
      var sysName = '', sysN = '';
      if (r.sys) {
        sysName = r.sys.name || ('sys&nbsp;' + r.sys.n);
        sysN    = r.sys.name ? '&nbsp;(' + r.sys.n + ')' : '';
      }
      var ctxCell = (_processToken < 0 && r.uipar0 >= 0)
        ? '<td class="dbg-ctx">' + r.uipar0.toString(8) + '</td>'
        : '<td></td>';
      html += '<tr class="dbg-row">' +
              '<td class="dbg-time">' + timeStr + '</td>' +
              '<td class="dbg-pc">' + oct6(r.pc) + '</td>' +
              '<td class="dbg-trap">TRAP</td>' +
              '<td class="dbg-sys">' + sysName + '<span class="dbg-sys-n">' + sysN + '</span></td>' +
              ctxCell +
              '<td class="dbg-psw">' + hex4(r.psw) + '</td>' +
              '</tr>';
    } else {
      var toKernel = (r.to === 0);
      html += '<tr class="dbg-row">' +
              '<td class="dbg-time">' + timeStr + '</td>' +
              '<td class="dbg-pc">' + oct6(r.pc) + '</td>' +
              '<td class="' + (toKernel ? 'dbg-u2k' : 'dbg-k2u') + '" colspan="3">' +
              MODE_NAMES[r.from] + ' → ' + MODE_NAMES[r.to] + '</td>' +
              '<td></td>' +
              '</tr>';
    }
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

// ── レジスタ表示 ──────────────────────────────────────────────────────────
var MODE_NAMES = ['Kernel', 'Super', '??', 'User'];

function oct6(v) { return (v >>> 0).toString(8).padStart(6, '0'); }
function oct4(v) { return (v >>> 0).toString(8).padStart(4, '0'); }
function hex4(v) { return (v >>> 0).toString(16).padStart(4, '0'); }

function updateGPRDisplay(gpr) {
  if (!gpr || gpr.length < 7) return;
  document.getElementById('r-r0').textContent = oct6(gpr[0]);
  document.getElementById('r-r1').textContent = oct6(gpr[1]);
  document.getElementById('r-r2').textContent = oct6(gpr[2]);
  document.getElementById('r-r3').textContent = oct6(gpr[3]);
  document.getElementById('r-r4').textContent = oct6(gpr[4]);
  document.getElementById('r-r5').textContent = oct6(gpr[5]);
  document.getElementById('r-sp').textContent  = oct6(gpr[6]);
}

function updateRegs(snap, gpr) {
  if (!snap || snap.length < _ringWords) return;
  var last = snap.length - _ringWords;
  var w0 = snap[last + 0], w1 = snap[last + 1], w2 = snap[last + 2];

  var pc   = w2 & 0xFFFF;
  var psw  = (w1 >>> 16) & 0xFFFF;
  var mode = (w0 >>> 20) & 3;
  var ap   = w0 & 0x3FFFF;
  var data = w1 & 0xFFFF;
  var rk   = (w0 >>> 26) & 0x1F;
  var trap = (w0 >>> 23) & 1;

  checkBootPC(pc, mode);

  document.getElementById('r-pc').textContent   = oct6(pc);
  document.getElementById('r-psw').textContent  = fmtPSW11(psw);
  var modeEl = document.getElementById('r-mode');
  modeEl.textContent = MODE_NAMES[mode];
  modeEl.className   = 'reg-val' + (mode === 3 ? ' user' : '');
  if (trap) modeEl.className = 'reg-val trap';

  // CPU バー更新
  var cpuPcEl  = document.getElementById('r-pc-bar');
  var cpuPswEl = document.getElementById('r-psw-bar');
  var cpuModeEl= document.getElementById('r-mode-bar');
  if (cpuPcEl)   cpuPcEl.textContent  = oct6(pc);
  if (cpuPswEl)  cpuPswEl.textContent = fmtPSW11(psw);
  if (cpuModeEl) {
    cpuModeEl.textContent = MODE_NAMES[mode];
    cpuModeEl.className   = 'r-val' + (mode === 3 ? ' user' : '') + (trap ? ' trap' : '');
  }
  // 逆アセンブル: Word4[20:5] = ISN
  var disEl = document.getElementById('r-disasm');
  if (disEl && snap.length > last + 4) {
    var _isn = (snap[last + 4] >>> 5) & 0xFFFF;
    disEl.textContent = (typeof fmtIsn11 === 'function' && _isn) ? fmtIsn11(_isn, null) : '';
  }
  document.getElementById('r-addr').textContent = oct6(ap);
  document.getElementById('r-data').textContent = hex4(data);
  var rkEl = document.getElementById('r-rk');
  rkEl.textContent = rk === 0 ? 'Idle' : 'St=' + rk;
  rkEl.className   = 'reg-val' + (rk !== 0 ? ' active' : '');

  if (gpr) updateGPRDisplay(gpr);

  // CPU Log 更新
  // exec キャプチャが ON の場合は _cpuLogEnabled が OFF でも exec 検出のためにスキャンする
  if (_cpuLogEnabled || _cpuLogExecCapture) {
    // TRAP は 1〜3 tick のパルスで最終サンプルに入らないことがあるため、
    // snap の全サンプルをスキャンして取り逃がしを防ぐ。
    // Mode 遷移は数フレーム続くため最終サンプルで十分。
    var updated = false;
    // _stoppedThisLoop: このバッチ内で exit 停止が起きたフラグ。
    // 同一バッチ内の後続 fork が exit 直後にキャプチャを再開するのを防ぐ（次バッチではリセット）。
    var _stoppedThisLoop = false;
    var count = (snap.length / _ringWords) | 0;
    for (var i = 0; i < count; i++) {
      var _base = i * _ringWords;

      // _waitingNewCtx は現在常に false（exec capture では _processToken を使わない）。
      if (_waitingNewCtx !== false && (_base + 9 < snap.length)) {
        var _cu = snap[_base + 9] & 0xFFF;
        if ((snap[_base + 9] >>> 12) & 1) {
          var _fromUipar0 = (typeof _waitingNewCtx === 'number') ? _waitingNewCtx : -1;
          if (_fromUipar0 < 0 || _cu !== _fromUipar0) {
            _processToken  = _cu;
            _waitingNewCtx = false;
          }
        }
      }

      if ((snap[_base] >>> 23) & 1) {
        var _w4  = snap[_base + 4];
        var _sys = _decodeSys(_w4);

        // exec キャプチャ: sys 11 (exec) または sys 2 (fork) を検出したらクリアして収集を自動 START。
        // _stoppedThisLoop で同一フレーム内の exit 直後の fork のみ抑制する。
        // exec が indir 経由で検出できない場合に備え、fork でも必ずキャプチャを開始する。
        // _pendingUipar0 により exec/fork 前の旧 UIPAR0 の syscall はスキップされる。
        if (_cpuLogExecCapture && _sys && (_sys.n === 11 || _sys.n === 2)) {
          if (!_cpuLogEnabled && !_stoppedThisLoop) {
            _cpuLog.length = 0;
            _lastTrap = null;
            _processToken = -1;
            _waitingNewCtx = false;
            // exec/fork を呼んだプロセスの UIPAR0 を保存。
            // UIPAR0 が変わるまで（a.out がロードされるまで）その UIPAR0 の syscall をスキップ。
            _pendingUipar0 = (_base + 9 < snap.length)
              ? (snap[_base + 9] & 0xFFF) : -1;
            _cpuLogEnabled = true;
            var _togEl = document.getElementById('btn-cpulog-toggle');
            if (_togEl) _togEl.checked = true;
          }
        }

        if (_cpuLogEnabled) {
          var _tpc  = snap[_base + 2] & 0xFFFF;
          var _tpsw = (snap[_base + 1] >>> 16) & 0xFFFF;
          // 直前と同一 trap はフレーム残留の重複 → スキップ
          var _isDup = _lastTrap &&
                       _lastTrap.pc === _tpc &&
                       _lastTrap.psw === _tpsw &&
                       _lastTrap.w4 === _w4;
          if (!_isDup) {
            _lastTrap = { pc:_tpc, psw:_tpsw, w4:_w4 };
            var _uipar0  = (_base + 9 < snap.length) ? (snap[_base + 9] & 0xFFF) : -1;
            // exec 後、UIPAR0 が変わったら _processToken を確定（a.out がロード完了したサイン）
            if (_pendingUipar0 >= 0 && _uipar0 >= 0 && _uipar0 !== _pendingUipar0) {
              _processToken  = _uipar0;
              _pendingUipar0 = -1;
            }
            // 未解決 indir はノイズ、プロセストークン不一致は別プロセス、
            // _pendingUipar0 と一致（exec 前の子プロセス）— いずれも除外
            var _skip = (_sys && _sys.n === 0 && _sys.name === 'indir')
                     || (_processToken >= 0 && _uipar0 >= 0 && _uipar0 !== _processToken)
                     || (_pendingUipar0 >= 0 && _uipar0 >= 0 && _uipar0 === _pendingUipar0);
            if (!_skip) {
              var _clk = (_base + 10 < snap.length) ? snap[_base + 10] : -1;
              _cpuLog.unshift({ type:'trap', pc:_tpc, psw:_tpsw, sys:_sys, uipar0:_uipar0, clk:_clk });
              updated = true;
            }

            // exec キャプチャ: exit を検出したら収集を自動 STOP。
            // _skip に依存しない（indir スキップ時も停止できるよう _w4[31:24] を参照）。
            if (_cpuLogExecCapture) {
              var _exitN = (_sys && _sys.n !== 0) ? _sys.n : ((_w4 >>> 24) & 0xFF);
              if (_exitN === 1) {
                _cpuLogEnabled = false;
                _pendingUipar0 = -1;
                _stoppedThisLoop = true;
                _waitingNewCtx = false;
                _togEl = document.getElementById('btn-cpulog-toggle');
                if (_togEl) _togEl.checked = false;
              }
            }
          }
        }
      }
    }
    if (_cpuLogEnabled && _prevMode !== -1 && mode !== _prevMode) {
      var _lastUipar0 = (snap.length >= _ringWords) ? (snap[last + 9] & 0xFFF) : -1;
      var _modeSkip = (_pendingUipar0 >= 0 && _lastUipar0 >= 0 && _lastUipar0 === _pendingUipar0)
                   || (_processToken >= 0 && _lastUipar0 >= 0 && _lastUipar0 !== _processToken);
      if (!_modeSkip) {
        var _lastClk = (snap.length >= _ringWords) ? snap[last + 10] : -1;
        _cpuLog.unshift({ type: 'mode', from: _prevMode, to: mode, pc: pc, clk: _lastClk });
        updated = true;
      }
    }
    if (updated) {
      if (_cpuLog.length > 120) _cpuLog.length = 120;
      _renderCpuLog();
    }
  }
  _prevMode = mode;
}
