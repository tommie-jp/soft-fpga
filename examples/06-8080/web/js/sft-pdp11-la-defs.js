'use strict';
// sft-pdp11-la-defs.js — PDP-11 / Unix V6 Logic Analyzer 信号定義
//
// ring buffer ビットレイアウト (RING_WORDS = 9):
//  Word0: [17:0]=addr_p [18]=wr [19]=rd [21:20]=cm [22]=byte [23]=trap [24]=halt [25]=int [30:26]=rk
//  Word1: [15:0]=data [31:16]=psw
//  Word2: [15:0]=pc [31:16]=addr_v
//  Word3: [7:0]=int_vec [15:8]=int_ipl [17]=bus_error [18]=waited [19]=nxm [20]=iopage [21]=trap_bus [22]=trap_abort [23]=trap_odd
//  Word4: [4:0]=istate [20:5]=isn
//  Word5: [15:0]=R0 [31:16]=R1
//  Word6: [15:0]=R2 [31:16]=R3
//  Word7: [15:0]=R4 [31:16]=R5
//  Word8: [15:0]=SP [31:16]=M1(メモリプローブ値)

var RING_WORDS_PDP11 = 9;

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

// CPU マイクロステート（istate）を記号で表示: f1/c1/s1../d1../e1/w1/t0../i1
// 値の定義は vendor/cpus-pdp11/rtl/pdp11.v の parameter ブロック（5 ビット）。
var ISTATE_NAMES_PDP11 = [
  'h1', 'f1', 'c1', 's1', 's2', 's3', 's4', 'd1',  //  0-7
  'd2', 'd3', 'd4', 'e1', 'w1', 'o1', 'o2', 'o3',  //  8-15
  '?',  'p1', 't0', 't1', 't2', 't3', 't4', 'i1'   // 16-23 (16 は未使用)
];
function fmtIstate11(val) {
  var i = val & 0x1f;
  return ISTATE_NAMES_PDP11[i] !== undefined ? ISTATE_NAMES_PDP11[i] : ('?' + i);
}

// 8 進表示（先頭ゼロ埋め）
function fmtOct(val, width) {
  var digits = Math.ceil(width * Math.LOG2E * Math.LOG10E) + 1;
  return (val >>> 0).toString(8).padStart(digits > 1 ? 6 : 2, '0');
}

// ── PDP-11 命令逆アセンブラ（ISN 表示用） ─────────────────────────────────
// ring buffer に記録された 16 bit オペコード語を簡易ニモニックに変換する。
// 後続ワード（即値・インデックス・分岐先）は ISN 単一語からは読めないため、
// #imm / X(Rn) / adr / .±n などのプレースホルダで示す。

function _reg11(r) {
  return r === 7 ? 'PC' : (r === 6 ? 'SP' : 'R' + r);
}

// 6 bit オペランドフィールド (mode[5:3] reg[2:0]) を文字列化
function _opnd11(field) {
  var mode = (field >>> 3) & 7;
  var reg  = field & 7;
  var rn = _reg11(reg);
  switch (mode) {
    case 0: return rn;
    case 1: return '(' + rn + ')';
    case 2: return reg === 7 ? '#imm'  : '(' + rn + ')+';
    case 3: return reg === 7 ? '@#adr' : '@(' + rn + ')+';
    case 4: return '-(' + rn + ')';
    case 5: return '@-(' + rn + ')';
    case 6: return reg === 7 ? 'adr'   : 'X(' + rn + ')';
    case 7: return reg === 7 ? '@adr'  : '@X(' + rn + ')';
  }
  return '?';
}

// 分岐オフセット（符号付き 8 bit、ワード単位）を ".±n" で表す
function _soff11(v) {
  var off = v & 0xFF;
  if (off > 127) off -= 256;
  return '.' + (off >= 0 ? '+' : '') + off;
}

// 2 オペランド命令: op4 = bits[15:12]（1-6=ワード, 9-14=バイト/SUB）
var _DOP11  = { 1:'MOV',  2:'CMP',  3:'BIT',  4:'BIC',  5:'BIS',  6:'ADD' };
var _DOPB11 = { 1:'MOVB', 2:'CMPB', 3:'BITB', 4:'BICB', 5:'BISB', 6:'SUB' };

// 分岐 / EMT / TRAP: op8 = bits[15:8]
var _BR11 = {};
_BR11[0o001] = 'BR';  _BR11[0o002] = 'BNE'; _BR11[0o003] = 'BEQ'; _BR11[0o004] = 'BGE';
_BR11[0o005] = 'BLT'; _BR11[0o006] = 'BGT'; _BR11[0o007] = 'BLE';
_BR11[0o200] = 'BPL'; _BR11[0o201] = 'BMI'; _BR11[0o202] = 'BHI'; _BR11[0o203] = 'BLOS';
_BR11[0o204] = 'BVC'; _BR11[0o205] = 'BVS'; _BR11[0o206] = 'BCC'; _BR11[0o207] = 'BCS';

// EIS（拡張命令）: op7 = bits[15:9]
var _EIS11 = {};
_EIS11[0o070] = 'MUL'; _EIS11[0o071] = 'DIV'; _EIS11[0o072] = 'ASH';
_EIS11[0o073] = 'ASHC'; _EIS11[0o074] = 'XOR';

// 単一オペランド命令: op10 = bits[15:6]
var _SOP11 = {};
_SOP11[0o0001] = 'JMP';  _SOP11[0o0003] = 'SWAB';
_SOP11[0o0050] = 'CLR';  _SOP11[0o0051] = 'COM';  _SOP11[0o0052] = 'INC';  _SOP11[0o0053] = 'DEC';
_SOP11[0o0054] = 'NEG';  _SOP11[0o0055] = 'ADC';  _SOP11[0o0056] = 'SBC';  _SOP11[0o0057] = 'TST';
_SOP11[0o0060] = 'ROR';  _SOP11[0o0061] = 'ROL';  _SOP11[0o0062] = 'ASR';  _SOP11[0o0063] = 'ASL';
_SOP11[0o0065] = 'MFPI'; _SOP11[0o0066] = 'MTPI'; _SOP11[0o0067] = 'SXT';
_SOP11[0o1050] = 'CLRB'; _SOP11[0o1051] = 'COMB'; _SOP11[0o1052] = 'INCB'; _SOP11[0o1053] = 'DECB';
_SOP11[0o1054] = 'NEGB'; _SOP11[0o1055] = 'ADCB'; _SOP11[0o1056] = 'SBCB'; _SOP11[0o1057] = 'TSTB';
_SOP11[0o1060] = 'RORB'; _SOP11[0o1061] = 'ROLB'; _SOP11[0o1062] = 'ASRB'; _SOP11[0o1063] = 'ASLB';

// 引数なし命令
var _NOP11 = {};
_NOP11[0o000001] = 'WAIT'; _NOP11[0o000002] = 'RTI'; _NOP11[0o000003] = 'BPT';
_NOP11[0o000004] = 'IOT';  _NOP11[0o000005] = 'RESET'; _NOP11[0o000006] = 'RTT';

// コンディションコード操作 (0o000240-0o000277)
function _ccc11(v) {
  if (v === 0o000240) return 'NOP';
  var set = (v & 0o20) !== 0;
  if ((v & 0o17) === 0o17) return set ? 'SCC' : 'CCC';
  return (set ? 'SE' : 'CL')
       + ((v & 0o10) ? 'N' : '') + ((v & 0o04) ? 'Z' : '')
       + ((v & 0o02) ? 'V' : '') + ((v & 0o01) ? 'C' : '');
}

function fmtIsn11(v) {
  v = v & 0xFFFF;
  if (v === 0) return '';  // ring buffer 上は「命令未確定」を 0 で表す（HALT は表示しない）

  var op4 = (v >>> 12) & 0xF;
  var src = (v >>> 6) & 0o77;
  var dst = v & 0o77;
  if (op4 >= 1 && op4 <= 6)  return _DOP11[op4]    + ' ' + _opnd11(src) + ',' + _opnd11(dst);
  if (op4 >= 9 && op4 <= 14) return _DOPB11[op4 - 8] + ' ' + _opnd11(src) + ',' + _opnd11(dst);

  var op8 = (v >>> 8) & 0xFF;
  if (_BR11[op8])     return _BR11[op8] + ' ' + _soff11(v);
  if (op8 === 0o210)  return 'EMT ' + (v & 0xFF).toString(8);
  if (op8 === 0o211)  return 'TRAP ' + (v & 0xFF).toString(8);

  var op7 = (v >>> 9) & 0x7F;
  var reg = (v >>> 6) & 7;
  if (op7 === 0o004)  return 'JSR ' + _reg11(reg) + ',' + _opnd11(dst);
  if (op7 === 0o077)  return 'SOB ' + _reg11(reg) + ',off';
  if (_EIS11[op7]) {
    return op7 === 0o074
      ? 'XOR ' + _reg11(reg) + ',' + _opnd11(dst)
      : _EIS11[op7] + ' ' + _opnd11(dst) + ',' + _reg11(reg);
  }

  var op10 = (v >>> 6) & 0x3FF;
  if (_SOP11[op10])   return _SOP11[op10] + ' ' + _opnd11(dst);

  if ((v & 0o177770) === 0o000200)  return 'RTS ' + _reg11(v & 7);
  if (_NOP11[v])                    return _NOP11[v];
  if ((v & 0o177740) === 0o000240)  return _ccc11(v);

  return fmtOct(v, 16);  // 未対応（FP11 等）は 8 進フォールバック
}

// ── 信号定義 ─────────────────────────────────────────────────────────────

var LA_SIGNALS_PDP11 = [
  // === バスアドレス ===
  {
    id:'addr_p', label:'PhysAddr', word:0, bit:0, type:'hex', width:18, color:'#c86820', on:true,
    fmt:'oct', tip:'Unibus 物理アドレス（MMU 変換後 18 ビット）。I/O ページ = 0o760000–0o777777'
  },
  {
    id:'addr_v', label:'VA', word:2, bit:16, type:'hex', width:16, color:'#a07020', on:false,
    fmt:'oct', tip:'仮想アドレス（MMU 変換前 CPU 側アドレス）'
  },
  // === バスデータ ===
  {
    id:'data', label:'Data', word:1, bit:0, type:'hex', width:16, color:'#0a7858', on:true,
    fmt:'oct', tip:'バスデータ（RD なら読み値、WR なら書き値）'
  },
  // === バス制御 ===
  {
    id:'bus_wr', label:'WR', word:0, bit:18, type:'bit', width:1, color:'#cc2020', on:true,
    tip:'バス書き込みストローブ（メモリ・I/O への書き込みサイクルで High）'
  },
  {
    id:'bus_rd', label:'RD', word:0, bit:19, type:'bit', width:1, color:'#1a8820', on:true,
    tip:'バス読み出しストローブ（メモリ・I/O からの読み出しサイクルで High）'
  },
  {
    id:'byte_op', label:'BYTE', word:0, bit:22, type:'bit', width:1, color:'#4048c8', on:false,
    tip:'バイト操作フラグ（MOVB/CMPB 等のバイト命令で High）'
  },
  // === CPU 状態 ===
  {
    id:'pc', label:'PC', word:2, bit:0, type:'hex', width:16, color:'#0898a8', on:true,
    fmt:'oct', tip:'プログラムカウンタ（8 進表示）'
  },
  {
    id:'psw', label:'PSW', word:1, bit:16, type:'hex', width:16, color:'#2868b0', on:false,
    fmt:'psw11', tip:'プロセッサステータスワード。フォーマット: CM PM P# TNZVC'
  },
  {
    id:'cm', label:'Mode', word:0, bit:20, type:'hex', width:2, color:'#208828', on:true,
    fmt:'mode11', tip:'CPU 現在モード (00=Kernel, 11=User)'
  },
  {
    id:'pri', label:'Pri', word:1, bit:21, type:'dec', width:3, color:'#986010', on:false,
    fmt:'dec', tip:'割り込み優先レベル（PSW[7:5]）。KW11=6, RK11=5'
  },
  // === トラップ / ホルト ===
  {
    id:'trapped', label:'TRAP', word:0, bit:23, type:'bit', width:1, color:'#c04010', on:true,
    tip:'トラップ発生フラグ（バストラップ・奇数アドレス・未定義命令）'
  },
  {
    id:'halted', label:'HALT', word:0, bit:24, type:'bit', width:1, color:'#cc0000', on:true,
    tip:'CPU ホルトフラグ（HALT 命令実行でアサート）'
  },
  // === 割り込み ===
  {
    id:'bus_int', label:'INT', word:0, bit:25, type:'bit', width:1, color:'#887010', on:true,
    tip:'割り込みリクエスト中フラグ（KW11/RK11 等から）'
  },
  {
    id:'int_vec', label:'Vec', word:3, bit:0, type:'hex', width:8, color:'#706010', on:false,
    fmt:'oct', tip:'割り込みベクタ（8 進）。KW11=0o100, RK11=0o220, TTY RX=0o60, TX=0o64'
  },
  {
    id:'int_ipl', label:'IPL', word:3, bit:8, type:'dec', width:8, color:'#706010', on:false,
    fmt:'dec', tip:'割り込み優先レベル'
  },
  // === RK11 ディスク ===
  {
    id:'rk_state', label:'RK', word:0, bit:26, type:'hex', width:5, color:'#9020a0', on:true,
    tip:'RK11 ステート（0=Idle、非 0 でディスク転送中）'
  },
  // === CPU マイクロステート / 命令 ===
  {
    id:'istate', label:'istate', word:4, bit:0, type:'hex', width:5, color:'#803870', on:false,
    fmt:'istate11', tip:'CPU マイクロステート（記号表示: f1=fetch c1=decode s*/d*=オペランド e1=execute w1=writeback o*=pop p1=push t*=trap i1=wait h1=halt）'
  },
  {
    id:'isn', label:'ISN', word:4, bit:5, type:'hex', width:16, color:'#704828', on:false,
    fmt:'oct', tip:'現在命令オペコード（8 進表示）'
  },
  // === バスエラー / NXM / トラップ詳細 ===
  {
    id:'bus_error',  label:'BUSERR',  word:3, bit:17, type:'bit', width:1, color:'#cc2020', on:false,
    tip:'バスエラー（アクセスタイムアウト・NXM）'
  },
  {
    id:'nxm_access', label:'NXM',     word:3, bit:19, type:'bit', width:1, color:'#b02828', on:false,
    tip:'存在しないメモリアクセス（Non-eXistent Memory）'
  },
  {
    id:'trap_bus',   label:'TBUS',    word:3, bit:21, type:'bit', width:1, color:'#b03810', on:false,
    tip:'バストラップ（bus abort / bus error trap）'
  },
  {
    id:'trap_abort', label:'TABORT',  word:3, bit:22, type:'bit', width:1, color:'#b03810', on:false,
    tip:'アボートトラップ（スタックオーバーフロー等）'
  },
  {
    id:'trap_odd',   label:'TODD',    word:3, bit:23, type:'bit', width:1, color:'#b03810', on:false,
    tip:'奇数アドレスアクセストラップ'
  },
  // === 汎用レジスタ (GPR) ===
  {
    id:'r0', label:'R0', word:5, bit:0,  type:'hex', width:16, color:'#2848a8', on:false,
    fmt:'oct', tip:'R0 汎用レジスタ（8 進表示）'
  },
  {
    id:'r1', label:'R1', word:5, bit:16, type:'hex', width:16, color:'#2848a8', on:false,
    fmt:'oct', tip:'R1 汎用レジスタ（8 進表示）'
  },
  {
    id:'r2', label:'R2', word:6, bit:0,  type:'hex', width:16, color:'#2848a8', on:false,
    fmt:'oct', tip:'R2 汎用レジスタ（8 進表示）'
  },
  {
    id:'r3', label:'R3', word:6, bit:16, type:'hex', width:16, color:'#2848a8', on:false,
    fmt:'oct', tip:'R3 汎用レジスタ（8 進表示）'
  },
  {
    id:'r4', label:'R4', word:7, bit:0,  type:'hex', width:16, color:'#2848a8', on:false,
    fmt:'oct', tip:'R4 汎用レジスタ（8 進表示）'
  },
  {
    id:'r5', label:'R5', word:7, bit:16, type:'hex', width:16, color:'#2848a8', on:false,
    fmt:'oct', tip:'R5 汎用レジスタ / フレームポインタ（8 進表示）'
  },
  {
    id:'sp', label:'SP',  word:8, bit:0,  type:'hex', width:16, color:'#2878a0', on:false,
    fmt:'oct', tip:'SP = r6[current_mode] スタックポインタ（8 進表示）'
  },
  // === メモリプローブ（M1） ===
  {
    id:'mem_m1', label:'M1', word:8, bit:16, type:'hex', width:16, color:'#507030', on:false,
    fmt:'oct', tip:'メモリプローブ値: sim_set_mem_probe(addr) で指定アドレスの RAM 内容を毎サンプル記録'
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

  if (trap)       return { label: 'TRAP',   short: 'T', color: 'rgba(255,80,0,0.75)'    };
  if (!rd && !wr) return null;

  // I/O ページ: 物理アドレス 0x1F000–0x1FFFF (= Unibus 0o760000–0o777777)
  var io = (ap >> 12) === 0x1F;

  if (rd && (av === pc))
                  return { label: 'FETCH',  short: 'F', color: 'rgba(40,120,230,0.65)'  };
  if (rd && io)   return { label: 'IO_RD',  short: 'r', color: 'rgba(0,190,130,0.65)'   };
  if (wr && io)   return { label: 'IO_WR',  short: 'w', color: 'rgba(230,110,0,0.65)'   };
  if (rd)         return { label: 'MEM_RD', short: 'R', color: 'rgba(30,170,30,0.65)'   };
  if (wr)         return { label: 'MEM_WR', short: 'W', color: 'rgba(190,40,0,0.65)'    };
  return null;
}

// ── RTLScopeLA コンフィグ ─────────────────────────────────────────────────

var PDP11_LA_CONFIG = {
  signals:       LA_SIGNALS_PDP11,
  ringWords:     RING_WORDS_PDP11,
  ringSize:      4096,
  width:         1600,
  labelWidth:    64,
  trackH:        24,
  timeRulerH:    14,
  decodeLaneH:   20,
  storagePrefix: 'pdp11_la_',

  formatters: {
    psw11:   function(v) { return fmtPSW11(v); },
    mode11:  function(v) { return fmtMode11(v); },
    istate11:function(v) { return fmtIstate11(v); },
    oct:     function(v, w) { return fmtOct(v, w); },
    dec:     function(v)    { return String(v >>> 0); }
  },

  decodeLane: {
    label: 'Cycle',
    render: function(ctx, p) {
      // p: { heapu32, ringSize, ringWords, startSamp, samples, laZoom, sigX, decY, decH }
      var RW = p.ringWords;
      var getD = function(si) {
        var b = ((si >>> 0) & (p.ringSize - 1)) * RW;
        return _decodeBusCycle(p.heapu32[b], p.heapu32[b + 1], p.heapu32[b + 2]);
      };
      var segStart = 0, segD = getD(p.startSamp);
      var flush = function(di) {
        if (!segD) return;
        var bx = p.sigX + segStart * p.laZoom;
        var bw = (di - segStart) * p.laZoom;
        if (bw < 0.5) return;
        ctx.fillStyle = segD.color;
        ctx.fillRect(bx, p.decY + 1, bw - 1, p.decH - 2);
        if (bw > 6) {
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          var lbl = bw > 26 ? segD.label : (segD.short || segD.label.charAt(0));
          ctx.font = bw > 26 ? 'bold 10px monospace' : 'bold 9px monospace';
          ctx.fillText(lbl, bx + bw / 2, p.decY + p.decH * 0.75);
          ctx.restore();
        }
      };
      for (var di = 1; di < p.samples; di++) {
        var nd = getD(p.startSamp + di);
        var diff = (!nd && segD) || (nd && !segD) ||
                   (nd && segD && nd.label !== segD.label);
        if (diff) { flush(di); segStart = di; segD = nd; }
      }
      flush(p.samples);
    }
  },

  // モード別背景色
  signalBackground: function(sig, val) {
    if (sig.id === 'cm') {
      if ((val & 3) === 0) return 'rgba(0,140,0,0.10)';   // kernel: 薄緑
      if ((val & 3) === 3) return 'rgba(40,80,220,0.10)'; // user:   薄青
    }
    if (sig.id === 'bus_int' && val) return 'rgba(140,100,0,0.22)';
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
