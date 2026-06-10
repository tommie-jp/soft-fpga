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
      body.style.height = body.scrollHeight + 'px';
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

// obs_word4 = {11'b0, isn[15:0], istate[4:0]} → bits[20:5] = ISN
// Unix V6 の sys 命令は TRAP: 0x8900–0x89FF（EMT は 0x8800–0x88FF）
function _decodeSys(word4) {
  var isn = (word4 >>> 5) & 0xFFFF;
  if ((isn & 0xFF00) !== 0x8900) return null;   // TRAP 以外
  var n = isn & 0xFF;
  return { n: n, name: (n < _V6SYS.length && _V6SYS[n]) || null };
}

var _cpuLog        = [];
var _prevMode      = -1;
var _cpuLogEnabled = false;

(function() {
  var chk = document.getElementById('btn-cpulog-toggle');
  if (!chk) return;
  chk.addEventListener('change', function() {
    _cpuLogEnabled = chk.checked;
  });
})();

(function() {
  var btn = document.getElementById('btn-cpulog-clear');
  if (btn) btn.addEventListener('click', function() {
    _cpuLog.length = 0;
    _renderCpuLog();
  });
})();

(function() {
  var btn = document.getElementById('btn-cpulog-copy');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var text = _cpuLog.map(function(r) {
      if (r.type === 'trap') {
        var s = oct6(r.pc) + '  TRAP';
        if (r.sys) s += '  sys ' + r.sys.n + (r.sys.name ? ' (' + r.sys.name + ')' : '');
        return s + '  PSW=' + hex4(r.psw);
      }
      return oct6(r.pc) + '  ' + MODE_NAMES[r.from] + ' → ' + MODE_NAMES[r.to];
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
  var body  = document.getElementById('tab-cpulog');
  if (!btn || !panel || !body) return;

  btn.addEventListener('click', function() {
    var collapsed = panel.classList.toggle('collapsed');
    if (collapsed) {
      body.style.overflow = 'hidden';
      body.style.height = body.offsetHeight + 'px';
      requestAnimationFrame(function() { body.style.height = '0'; });
    } else {
      body.style.height = body.scrollHeight + 'px';
      body.addEventListener('transitionend', function onEnd() {
        body.removeEventListener('transitionend', onEnd);
        body.style.height = '';
        body.style.overflow = '';
      });
    }
  });
})();

function _renderCpuLog() {
  var el = document.getElementById('tab-cpulog');
  if (!el) return;
  el.innerHTML = _cpuLog.slice(0, 60).map(function(r) {
    if (r.type === 'trap') {
      var sysStr = '';
      if (r.sys) {
        sysStr = '  <span class="dbg-sys">sys ' + r.sys.n +
                 (r.sys.name ? ' (' + r.sys.name + ')' : '') + '</span>';
      }
      return '<div class="dbg-row"><span class="dbg-pc">' + oct6(r.pc) + '</span>' +
             '<span class="dbg-trap">TRAP</span>' +
             sysStr +
             '<span class="dbg-psw">PSW=' + hex4(r.psw) + '</span></div>';
    }
    var toKernel = (r.to === 0);
    return '<div class="dbg-row"><span class="dbg-pc">' + oct6(r.pc) + '</span>' +
           '<span class="' + (toKernel ? 'dbg-u2k' : 'dbg-k2u') + '">' +
           MODE_NAMES[r.from] + ' → ' + MODE_NAMES[r.to] + '</span></div>';
  }).join('');
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
  if (_cpuLogEnabled) {
    // TRAP は 1〜3 tick のパルスで最終サンプルに入らないことがあるため、
    // snap の全サンプルをスキャンして取り逃がしを防ぐ。
    // Mode 遷移は数フレーム続くため最終サンプルで十分。
    var updated = false;
    var count = (snap.length / _ringWords) | 0;
    for (var i = 0; i < count; i++) {
      var _base = i * _ringWords;
      if ((snap[_base] >>> 23) & 1) {
        var _w4 = snap[_base + 4];
        _cpuLog.unshift({
          type: 'trap',
          pc:   snap[_base + 2] & 0xFFFF,
          psw:  (snap[_base + 1] >>> 16) & 0xFFFF,
          sys:  _decodeSys(_w4)
        });
        updated = true;
      }
    }
    if (_prevMode !== -1 && mode !== _prevMode) {
      _cpuLog.unshift({ type: 'mode', from: _prevMode, to: mode, pc: pc });
      updated = true;
    }
    if (updated) {
      if (_cpuLog.length > 120) _cpuLog.length = 120;
      _renderCpuLog();
    }
  }
  _prevMode = mode;
}
