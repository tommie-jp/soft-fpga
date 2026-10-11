'use strict';
// trigger-expr.js — 式トリガー パーサ / エバリュエータ
//
// 依存: sft-pdp11-la-defs.js を先に読み込むこと
//   （LA_SIGNALS_PDP11 / fmtPSW11 / fmtMode11 / fmtIstate11 / fmtIsn11 /
//     _decodeBusCycle が定義されていること）
//
// JS 条件式構文
// 比較: ==, !=, <, >, <=, >=
// 論理: &&, ||, !
// カッコ: ()
// エッジ: signal.rising  signal.falling  signal.edge
// 数値: 04014(8進), 0o4014(8進ES6), 0x1FF(16進), 10(10進)
// 文字列: "F1"  "USER"  "FETCH"  "MOV R3,-(SP)"
// 例: PC == 04014 && RD == 1
//     RD.rising && PC >= 04000
//     ISN == "MOV R3,-(SP)" && istate == "F1"
//     !(PC == 0 || PC == 2)

var _TRIG_SIG_ALIASES = (function() {
  var m = {};
  LA_SIGNALS_PDP11.forEach(function(s) { m[s.id.toUpperCase()] = s.id; });
  m['ADDR'] = 'addr_p'; m['PA']  = 'addr_p'; m['VA']     = 'addr_v';
  m['WR']   = 'bus_wr'; m['RD']  = 'bus_rd'; m['BYTE']   = 'byte_op';
  m['MODE'] = 'cm';     m['CM']  = 'cm';
  m['ISTATE'] = 'istate'; m['ISN']    = 'isn';
  m['TRAP']   = 'trapped'; m['HALT']   = 'halted';
  m['INT']    = 'bus_int'; m['VEC']    = 'int_vec'; m['IPL'] = 'int_ipl';
  m['RK']     = 'rk_state';
  m['BUSERR'] = 'bus_error'; m['NXM']    = 'nxm_access';
  m['TBUS']   = 'trap_bus';  m['TABORT'] = 'trap_abort'; m['TODD'] = 'trap_odd';
  m['M1']     = 'mem_m1';
  m['CTX']    = 'ctx_new';
  return m;
})();

// 仮想信号: ring buffer の複数フィールドから計算する合成シグナル
// CYCLE/CYC/CYLE → バスサイクル種別文字列 (FETCH/MEM_RD/MEM_WR/IO_RD/IO_WR/TRAP/"")
var _TRIG_VIRT = {
  CYCLE: {
    id: 'cycle', label: 'Cycle', virtual: true,
    eval: function(ring, base) {
      var d = _decodeBusCycle(ring[base]>>>0, ring[base+1]>>>0, ring[base+2]>>>0);
      return d ? d.label : '';
    }
  }
};
var _TRIG_VIRT_ALIASES = { CYCLE:'CYCLE', CYC:'CYCLE', CYLE:'CYCLE' };

function _trigFindSig(name) {
  var up = name.toUpperCase();
  if (_TRIG_VIRT_ALIASES[up]) return _TRIG_VIRT[_TRIG_VIRT_ALIASES[up]];
  var id = _TRIG_SIG_ALIASES[up] || name.toLowerCase();
  for (var _k = 0; _k < LA_SIGNALS_PDP11.length; _k++) {
    if (LA_SIGNALS_PDP11[_k].id === id) return LA_SIGNALS_PDP11[_k];
  }
  return null;
}

// 文字列比較用フォーマッター（大文字化）
var _EXPR_FMT = {
  psw11:    function(v) { return fmtPSW11(v).toUpperCase(); },
  mode11:   function(v) { return fmtMode11(v).toUpperCase(); },
  istate11: function(v) { return fmtIstate11(v).toUpperCase(); },
  isn11:    function(v) { return (fmtIsn11(v) || '').toUpperCase(); },
  oct:      function(v) { return (v >>> 0).toString(8); },
  dec:      function(v) { return String(v >>> 0); },
};

// 再帰下降パーサ（JS 条件式構文）
function _trigParse(src) {
  var ci = 0;
  function skipWS() { while (ci < src.length && /\s/.test(src[ci])) ci++; }

  // 次の論理演算子 (&&/||) をピーク（位置は進めない）
  function peekLogOp() {
    var j = ci;
    while (j < src.length && /\s/.test(src[j])) j++;
    var s2 = src.slice(j, j + 2);
    return (s2 === '&&' || s2 === '||') ? s2 : null;
  }
  function consumeLogOp() { skipWS(); ci += 2; }

  function consumeIdent() {
    skipWS();
    var m = src.slice(ci).match(/^[A-Za-z][A-Za-z0-9_]*/);
    if (!m) throw new Error('識別子が必要: "' + src.slice(ci, ci + 8) + '"');
    ci += m[0].length;
    return m[0];
  }
  function consumeCmpOp() {
    skipWS();
    var s = src.slice(ci);
    if (s.slice(0, 2) === '==') { ci += 2; return '=='; }
    if (s.slice(0, 2) === '!=') { ci += 2; return '!='; }
    if (s.slice(0, 2) === '<=') { ci += 2; return '<='; }
    if (s.slice(0, 2) === '>=') { ci += 2; return '>='; }
    if (s[0] === '<') { ci++; return '<'; }
    if (s[0] === '>') { ci++; return '>'; }
    throw new Error('比較演算子 (==, !=, <, >, <=, >=) が必要: "' + s.slice(0, 5) + '"');
  }
  function consumeValue() {
    skipWS();
    if (ci >= src.length) throw new Error('値が必要（式が途中で終わっています）');
    // クォート文字列
    if (src[ci] === '"') {
      ci++;
      var qs = '';
      while (ci < src.length && src[ci] !== '"') qs += src[ci++];
      if (ci < src.length) ci++;
      return { t: 'STR', v: qs };
    }
    // 数値: 0o(8進ES6), 0x(16進), 0始まり(8進レガシー), それ以外(10進)
    if (/[0-9]/.test(src[ci])) {
      var ns = '';
      while (ci < src.length && /[A-Za-z0-9_]/.test(src[ci])) ns += src[ci++];
      var num;
      if (/^0[oO]/.test(ns))       num = parseInt(ns.slice(2), 8);
      else if (/^0[xX]/.test(ns))  num = parseInt(ns.slice(2), 16);
      else if (/^0[0-9]/.test(ns)) num = parseInt(ns, 8);
      else                          num = parseInt(ns, 10);
      if (isNaN(num)) throw new Error('数値が不正: ' + ns);
      return { t: 'NUM', v: num };
    }
    throw new Error('値は数値または "文字列" で指定してください: "' + src.slice(ci, ci + 10) + '"');
  }

  function parseExpr() { return parseOr(); }
  function parseOr() {
    var n = parseAnd();
    while (peekLogOp() === '||') { consumeLogOp(); n = {op:'||', l:n, r:parseAnd()}; }
    return n;
  }
  function parseAnd() {
    var n = parseNot();
    while (peekLogOp() === '&&') { consumeLogOp(); n = {op:'&&', l:n, r:parseNot()}; }
    return n;
  }
  function parseNot() {
    skipWS();
    if (ci < src.length && src[ci] === '!') { ci++; return {op:'!', a:parseNot()}; }
    return parseAtom();
  }
  function parseAtom() {
    skipWS();
    if (ci < src.length && src[ci] === '(') {
      ci++;
      var e = parseExpr();
      skipWS();
      if (ci >= src.length || src[ci] !== ')') throw new Error(') が必要: "' + (src[ci] || 'EOF') + '"');
      ci++;
      return e;
    }
    var name = consumeIdent();
    var sig  = _trigFindSig(name);
    if (!sig) throw new Error('不明な信号名: ' + name + '\n(PC, ISN, RD, WR, Data, Addr, istate, R0-R5 など)');
    skipWS();
    // エッジ検出: signal.rising / .falling / .edge
    if (ci < src.length && src[ci] === '.') {
      ci++;
      var prop = '';
      while (ci < src.length && /[A-Za-z]/.test(src[ci])) prop += src[ci++];
      prop = prop.toLowerCase();
      if (prop === 'rising')  return {op:'RISING',  sig:sig};
      if (prop === 'falling') return {op:'FALLING', sig:sig};
      if (prop === 'edge')    return {op:'EDGE',    sig:sig};
      throw new Error('エッジ指定は .rising, .falling, .edge のみ対応: ".' + prop + '"');
    }
    var op  = consumeCmpOp();
    var val = consumeValue();
    return {op:op, sig:sig, val:val};
  }

  skipWS();
  if (ci >= src.length) throw new Error('式が空です');
  var ast = parseExpr();
  skipWS();
  if (ci < src.length) throw new Error('式の末尾に余分な文字: "' + src.slice(ci, ci + 10) + '"');
  return ast;
}

// ring buffer から信号値を取り出す
function _trigSigVal(sig, ring, base) {
  var gw   = ring[base + (sig.word || 0)] >>> 0;
  var MASK = sig.width < 32 ? ((1 << sig.width) - 1) : 0xFFFFFFFF;
  return (gw >>> (sig.bit || 0)) & MASK;
}

// 1 サンプル評価（base=現サンプル, prevBase=1つ前サンプル）
function _trigEvalExpr(node, ring, base, prevBase) {
  var op = node.op;
  if (op === '||') return _trigEvalExpr(node.l, ring, base, prevBase) || _trigEvalExpr(node.r, ring, base, prevBase);
  if (op === '&&') return _trigEvalExpr(node.l, ring, base, prevBase) && _trigEvalExpr(node.r, ring, base, prevBase);
  if (op === '!')  return !_trigEvalExpr(node.a, ring, base, prevBase);

  var sig = node.sig;

  // エッジ検出（ビット信号のみ対応）
  if (op === 'RISING' || op === 'FALLING' || op === 'EDGE') {
    if (sig.virtual) throw new Error(sig.label + ' はエッジ検出非対応');
    var pv = _trigSigVal(sig, ring, prevBase);
    var cv = _trigSigVal(sig, ring, base);
    if (op === 'RISING')  return pv === 0 && cv !== 0;
    if (op === 'FALLING') return pv !== 0 && cv === 0;
    return pv !== cv;  // EDGE
  }

  // 仮想信号（Cycle など）: 文字列比較のみ
  if (sig.virtual) {
    if (node.val.t !== 'STR') throw new Error(sig.label + ' は文字列比較のみ対応 (例: Cycle == "FETCH")');
    var vStr = (sig.eval(ring, base) || '').toUpperCase();
    var rStr = node.val.v.toUpperCase();
    if (op === '==') return vStr === rStr;
    if (op === '!=') return vStr !== rStr;
    throw new Error(sig.label + ' は == と != のみ対応');
  }

  var sigV = _trigSigVal(sig, ring, base);

  // 文字列比較（フォーマッター経由）
  if (node.val.t === 'STR') {
    var fmt = sig.fmt && _EXPR_FMT[sig.fmt];
    if (!fmt) throw new Error(sig.label + ' は文字列比較非対応（数値で比較してください）');
    var sStr  = fmt(sigV).toUpperCase();
    var rStr2 = node.val.v.toUpperCase();
    if (op === '==') return sStr === rStr2;
    if (op === '!=') return sStr !== rStr2;
    throw new Error(sig.label + ' の文字列値は == と != のみ対応');
  }

  // 数値比較
  var n = node.val.v >>> 0;
  sigV = sigV >>> 0;
  if (op === '==') return sigV === n;
  if (op === '!=') return sigV !== n;
  if (op === '<')  return sigV < n;
  if (op === '>')  return sigV > n;
  if (op === '<=') return sigV <= n;
  if (op === '>=') return sigV >= n;
  throw new Error('不明な演算子: ' + op);
}
