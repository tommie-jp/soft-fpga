'use strict';
// sft-pdp11-la-defs.js — PDP-11 / Unix V6 Logic Analyzer 信号定義
//
// ring buffer ビットレイアウト (RING_WORDS = 5):
//  Word0: [17:0]=addr_p [18]=wr [19]=rd [21:20]=cm [22]=byte [23]=trap [24]=halt [25]=int [30:26]=rk
//  Word1: [15:0]=data [31:16]=psw
//  Word2: [15:0]=pc [31:16]=addr_v
//  Word3: [7:0]=int_vec [15:8]=int_ipl
//  Word4: 予備

var RING_WORDS_PDP11 = 5;

// ── PSW フォーマッター ────────────────────────────────────────────────────
// 表示例: "KK P6 T.NZVC"
function fmtPSW11(val) {
  var cm  = (val >>> 14) & 3;
  var pm  = (val >>> 12) & 3;
  var pri = (val >>>  5) & 7;
  var t   = (val >>>  7) & 1;
  var n   = (val >>>  3) & 1;
  var z   = (val >>>  2) & 1;
  var v   = (val >>>  1) & 1;
  var c   = (val       ) & 1;
  var m   = ['K', 'S', '?', 'U'];
  return m[cm] + m[pm] + 'P' + pri
       + (t ? 'T' : '.') + (n ? 'N' : '.') + (z ? 'Z' : '.')
       + (v ? 'V' : '.') + (c ? 'C' : '.');
}

// CPU モード表示
function fmtMode11(val) {
  return ['Kernel', 'Super', '??', 'User'][val & 3];
}

// 8 進表示（先頭ゼロ埋め）
function fmtOct(val, width) {
  var digits = Math.ceil(width * Math.LOG2E * Math.LOG10E) + 1;
  return (val >>> 0).toString(8).padStart(digits > 1 ? 6 : 2, '0');
}

// ── 信号定義 ─────────────────────────────────────────────────────────────

var LA_SIGNALS_PDP11 = [
  // === バスアドレス ===
  {
    id:'addr_p', label:'PhysAddr', word:0, bit:0, type:'hex', width:18, color:'#fa8', on:true,
    tip:'Unibus 物理アドレス（MMU 変換後 18 ビット）。I/O ページ = 0o760000–0o777777'
  },
  {
    id:'addr_v', label:'VA', word:2, bit:16, type:'hex', width:16, color:'#fc6', on:false,
    tip:'仮想アドレス（MMU 変換前 CPU 側アドレス）'
  },
  // === バスデータ ===
  {
    id:'data', label:'Data', word:1, bit:0, type:'hex', width:16, color:'#0c8', on:true,
    tip:'バスデータ（RD なら読み値、WR なら書き値）'
  },
  // === バス制御 ===
  {
    id:'bus_wr', label:'WR', word:0, bit:18, type:'bit', width:1, color:'#f44', on:true,
    tip:'バス書き込みストローブ（メモリ・I/O への書き込みサイクルで High）'
  },
  {
    id:'bus_rd', label:'RD', word:0, bit:19, type:'bit', width:1, color:'#4c4', on:true,
    tip:'バス読み出しストローブ（メモリ・I/O からの読み出しサイクルで High）'
  },
  {
    id:'byte_op', label:'BYTE', word:0, bit:22, type:'bit', width:1, color:'#88f', on:false,
    tip:'バイト操作フラグ（MOVB/CMPB 等のバイト命令で High）'
  },
  // === CPU 状態 ===
  {
    id:'pc', label:'PC', word:2, bit:0, type:'hex', width:16, color:'#4fc', on:true,
    fmt:'oct', tip:'プログラムカウンタ（8 進表示）'
  },
  {
    id:'psw', label:'PSW', word:1, bit:16, type:'hex', width:16, color:'#8af', on:false,
    fmt:'psw11', tip:'プロセッサステータスワード。フォーマット: CM PM P# TNZVC'
  },
  {
    id:'cm', label:'Mode', word:0, bit:20, type:'hex', width:2, color:'#6f6', on:true,
    fmt:'mode11', tip:'CPU 現在モード (00=Kernel, 11=User)'
  },
  {
    id:'pri', label:'Pri', word:1, bit:21, type:'dec', width:3, color:'#fb6', on:false,
    tip:'割り込み優先レベル（PSW[7:5]）。KW11=6, RK11=5'
  },
  // === トラップ / ホルト ===
  {
    id:'trapped', label:'TRAP', word:0, bit:23, type:'bit', width:1, color:'#f80', on:true,
    tip:'トラップ発生フラグ（バストラップ・奇数アドレス・未定義命令）'
  },
  {
    id:'halted', label:'HALT', word:0, bit:24, type:'bit', width:1, color:'#f00', on:true,
    tip:'CPU ホルトフラグ（HALT 命令実行でアサート）'
  },
  // === 割り込み ===
  {
    id:'bus_int', label:'INT', word:0, bit:25, type:'bit', width:1, color:'#ff0', on:true,
    tip:'割り込みリクエスト中フラグ（KW11/RK11 等から）'
  },
  {
    id:'int_vec', label:'Vec', word:3, bit:0, type:'hex', width:8, color:'#ffa', on:false,
    fmt:'oct', tip:'割り込みベクタ（8 進）。KW11=0o100, RK11=0o220, TTY RX=0o60, TX=0o64'
  },
  {
    id:'int_ipl', label:'IPL', word:3, bit:8, type:'dec', width:8, color:'#ff8', on:false,
    tip:'割り込み優先レベル'
  },
  // === RK11 ディスク ===
  {
    id:'rk_state', label:'RK', word:0, bit:26, type:'hex', width:5, color:'#f0f', on:true,
    tip:'RK11 ステート（0=Idle、非 0 でディスク転送中）'
  },
];

// ── バスサイクル デコードレーン ──────────────────────────────────────────

function _decodeBusCycle(w0, w1, w2) {
  var rd   = (w0 >>> 19) & 1;
  var wr   = (w0 >>> 18) & 1;
  var ap   = w0 & 0x3FFFF;
  var av   = (w2 >>> 16) & 0xFFFF;
  var pc   = w2 & 0xFFFF;
  var trap = (w0 >>> 23) & 1;

  if (trap)       return { label: 'TRAP',   color: 'rgba(255,80,0,0.75)'    };
  if (!rd && !wr) return null;

  // I/O ページ: 物理アドレス 0x1F000–0x1FFFF (= Unibus 0o760000–0o777777)
  var io = (ap >> 12) === 0x1F;

  if (rd && (av === pc))
                  return { label: 'FETCH',  color: 'rgba(40,120,230,0.65)'  };
  if (rd && io)   return { label: 'IO_RD',  color: 'rgba(0,190,130,0.65)'   };
  if (wr && io)   return { label: 'IO_WR',  color: 'rgba(230,110,0,0.65)'   };
  if (rd)         return { label: 'MEM_RD', color: 'rgba(30,170,30,0.65)'   };
  if (wr)         return { label: 'MEM_WR', color: 'rgba(190,40,0,0.65)'    };
  return null;
}

// ── RTLScopeLA コンフィグ ─────────────────────────────────────────────────

var PDP11_LA_CONFIG = {
  signals:       LA_SIGNALS_PDP11,
  ringWords:     RING_WORDS_PDP11,
  ringSize:      4096,
  width:         860,
  labelWidth:    64,
  trackH:        24,
  timeRulerH:    14,
  decodeLaneH:   20,
  storagePrefix: 'pdp11_la_',

  formatters: {
    psw11:  function(v) { return fmtPSW11(v); },
    mode11: function(v) { return fmtMode11(v); },
    oct:    function(v, w) { return fmtOct(v, w); },
    dec:    function(v)    { return String(v >>> 0); }
  },

  decodeLane: {
    label: 'Cycle',
    render: function(ctx, p) {
      // p: { x, y, w, h, w0, w1, w2, w3 }
      var d = _decodeBusCycle(p.w0, p.w1, p.w2);
      if (!d) return;
      ctx.fillStyle = d.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      if (p.w > 38) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(d.label, p.x + 2, p.y + p.h - 3);
      }
    }
  },

  // モード別背景色
  signalBackground: function(sig, val) {
    if (sig.id === 'cm') {
      if ((val & 3) === 0) return 'rgba(0,140,0,0.10)';   // kernel: 薄緑
      if ((val & 3) === 3) return 'rgba(40,80,220,0.10)'; // user:   薄青
    }
    if (sig.id === 'bus_int' && val) return 'rgba(255,220,0,0.15)';
    if (sig.id === 'trapped'  && val) return 'rgba(255,80,0,0.18)';
    return null;
  }
};

// 既知の PDP-11 / Unix V6 アドレス（トリガー補完用）
var PDP11_KNOWN_PCS = [
  { label: 'bootrom entry',     pc: 0o173000, tip: 'bootrom.v エントリ' },
  { label: 'kernel entry',      pc: 0o000000, tip: 'Unix V6 カーネル m40.s エントリ' },
  { label: 'printf(mem=)',      pc: 0o004014, tip: 'main.c: printf("mem=")' },
  { label: 'user mode RTT',     pc: 0o003512, tip: 'ユーザプロセスへの RTT 命令' },
  { label: 'login wait',        pc: 0o015670, tip: 'getty/login キー入力待ちループ' },
  { label: 'KW11 vec (0o100)',  pc: 0o000100, tip: 'KW11 ラインクロック割り込みベクタ' },
  { label: 'RK11 vec (0o220)',  pc: 0o000220, tip: 'RK11 ディスク割り込みベクタ' },
  { label: 'TTY RX vec (0o60)', pc: 0o000060, tip: 'DL11 受信割り込みベクタ' },
];
