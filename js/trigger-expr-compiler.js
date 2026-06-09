'use strict';
// trigger-expr-compiler.js — 式 AST → Wasm バイナリ コンパイラ
//
// 依存: trigger-expr.js より後に読み込むこと（AST ノード構造を共有）
//
// trigCompileToWasm(ast) → Uint8Array
//
// 生成する Wasm 関数シグネチャ（メモリインポート不要）:
//   eval(w0..w8: i32[9], pw0..pw8: i32[9]) → i32
//   params 0-8:  現サンプルの ring ワード  (w0..w8)
//   params 9-17: 前サンプルの ring ワード  (pw0..pw8)
//
// 非対応（コンパイルエラーを throw）:
//   - 仮想信号 (CYCLE 等): ring 複数ワードから合成
//   - ISN 文字列比較: 後続ワード読み取りが必要
//   - PSW 文字列比較: 複合文字列フォーマット

// ── LEB128 ──────────────────────────────────────────────────────────────────
function _uleb128push(code, n) {
  n = n >>> 0;
  do {
    var b = n & 0x7F;
    n >>>= 7;
    if (n) b |= 0x80;
    code.push(b);
  } while (n);
}

function _sleb128push(code, n) {
  n = n | 0;
  var done = false;
  while (!done) {
    var b = n & 0x7F;
    n >>= 7;
    if ((n === 0 && (b & 0x40) === 0) || (n === -1 && (b & 0x40) !== 0)) done = true;
    else b |= 0x80;
    code.push(b);
  }
}

// ── Wasm バイナリ組み立てヘルパー ───────────────────────────────────────────
function _vecOf(body) {
  var out = [];
  _uleb128push(out, body.length);
  for (var i = 0; i < body.length; i++) out.push(body[i]);
  return out;
}

function _section(id, body) {
  var v = _vecOf(body);
  v.unshift(id);
  return v;
}

function _strBytes(s) {
  var bytes = [];
  _uleb128push(bytes, s.length);
  for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  return bytes;
}

// ── Wasm オペコード定数 ──────────────────────────────────────────────────────
var _W = {
  end:   0x0B,
  get:   0x20,  // local.get (+ ULEB128 index)
  const: 0x41,  // i32.const (+ SLEB128 value)
  eqz:   0x45,  // i32.eqz
  eq:    0x46,  // i32.eq
  ne:    0x47,  // i32.ne
  lt_u:  0x49,  // i32.lt_u
  gt_u:  0x4B,  // i32.gt_u
  le_u:  0x4D,  // i32.le_u
  ge_u:  0x4F,  // i32.ge_u
  and:   0x71,  // i32.and
  or:    0x72,  // i32.or
  shr_u: 0x76,  // i32.shr_u
};

// ── 文字列→数値変換テーブル ─────────────────────────────────────────────────
// 各シグナルのフォーマッター（_EXPR_FMT）に対応した逆引きテーブル。
// 追加するフォーマッターがあればここに増やす。
var _COMPILE_STR_TO_NUM = {
  mode11: { 'KERNEL': 0, 'SUPER': 1, '??': 2, 'USER': 3 },
  istate11: (function() {
    var names = [
      'h1','f1','c1','s1','s2','s3','s4','d1',  //  0-7
      'd2','d3','d4','e1','w1','o1','o2','o3',  //  8-15
      '?', 'p1','t0','t1','t2','t3','t4','i1'  // 16-23
    ];
    var m = {};
    names.forEach(function(n, i) { if (n !== '?') m[n.toUpperCase()] = i; });
    return m;
  })(),
  oct: null,  // 数値のまま比較するので逆引き不要
  dec: null,
};

// ── シグナル値を stack に push するコードを emit ────────────────────────────
// Wasm params:
//   0-8:  現サンプル w0..w8
//   9-17: 前サンプル pw0..pw8
function _emitSigVal(code, sig, isCur) {
  var paramIdx = (isCur ? 0 : 9) + (sig.word | 0);
  var bit   = (sig.bit   | 0);
  var width = (sig.width | 0) || 1;
  var mask  = width < 32 ? ((1 << width) - 1) : 0xFFFFFFFF;

  code.push(_W.get);
  _uleb128push(code, paramIdx);    // local.get wN or pwN

  if (bit > 0) {
    code.push(_W.const);
    _sleb128push(code, bit);
    code.push(_W.shr_u);           // >> bit
  }
  if (mask !== 0xFFFFFFFF) {
    code.push(_W.const);
    _sleb128push(code, mask);
    code.push(_W.and);             // & mask
  }
}

// ── AST ノードを Wasm 命令列に変換（再帰） ─────────────────────────────────
function _emitNode(code, node) {
  var op = node.op;

  if (op === '&&') {
    _emitNode(code, node.l);
    _emitNode(code, node.r);
    code.push(_W.and);
    return;
  }
  if (op === '||') {
    _emitNode(code, node.l);
    _emitNode(code, node.r);
    code.push(_W.or);
    return;
  }
  if (op === '!') {
    _emitNode(code, node.a);
    code.push(_W.eqz);
    return;
  }

  var sig = node.sig;
  if (!sig) throw new Error('内部エラー: ノードに sig がありません');
  if (sig.virtual) throw new Error('"' + sig.label + '" は仮想信号のため Wasm コンパイル非対応（Cycle == "FETCH" → istate == "F1" && RD.rising で代替）');

  // ── エッジ検出 ─────────────────────────────────────────────────────────
  if (op === 'RISING') {
    // (cur != 0) && (prev == 0)
    _emitSigVal(code, sig, true);  // cur
    code.push(_W.const); _sleb128push(code, 0);
    code.push(_W.ne);              // cur != 0
    _emitSigVal(code, sig, false); // prev
    code.push(_W.eqz);             // prev == 0
    code.push(_W.and);
    return;
  }
  if (op === 'FALLING') {
    // (cur == 0) && (prev != 0)
    _emitSigVal(code, sig, true);  // cur
    code.push(_W.eqz);             // cur == 0
    _emitSigVal(code, sig, false); // prev
    code.push(_W.const); _sleb128push(code, 0);
    code.push(_W.ne);              // prev != 0
    code.push(_W.and);
    return;
  }
  if (op === 'EDGE') {
    _emitSigVal(code, sig, true);  // cur
    _emitSigVal(code, sig, false); // prev
    code.push(_W.ne);              // cur != prev
    return;
  }

  // ── 比較 ────────────────────────────────────────────────────────────────
  var numVal;
  if (node.val.t === 'STR') {
    // 文字列→数値変換: mode11 / istate11 のみ対応。isn11 / psw11 は非対応。
    var fmt = sig.fmt;
    var fmtTable = fmt && _COMPILE_STR_TO_NUM[fmt];
    if (!fmtTable) {
      throw new Error('"' + sig.label + '" 文字列比較は Wasm 非対応'
        + (sig.fmt === 'isn11' ? '（ISN は生オペコード数値で比較: ISN == 0o5001 など）' : '')
        + (sig.fmt === 'psw11' ? '（PSW は数値で比較: PSW == 0o0340 など）' : '')
        + (!sig.fmt ? '（数値で比較してください）' : ''));
    }
    numVal = fmtTable[node.val.v.toUpperCase()];
    if (numVal === undefined) {
      throw new Error('"' + node.val.v + '" は ' + sig.label + ' の有効な文字列値ではありません');
    }
    if (op !== '==' && op !== '!=') {
      throw new Error(sig.label + ' 文字列比較は == と != のみ対応');
    }
  } else {
    numVal = node.val.v >>> 0;
  }

  _emitSigVal(code, sig, true);    // 現サンプルの信号値
  code.push(_W.const);
  _sleb128push(code, numVal | 0);  // 比較値（SLEB128）

  switch (op) {
    case '==': code.push(_W.eq);   break;
    case '!=': code.push(_W.ne);   break;
    case '<':  code.push(_W.lt_u); break;
    case '>':  code.push(_W.gt_u); break;
    case '<=': code.push(_W.le_u); break;
    case '>=': code.push(_W.ge_u); break;
    default: throw new Error('不明な演算子: ' + op);
  }
}

// ── メイン: AST → Wasm バイナリ ────────────────────────────────────────────
function trigCompileToWasm(ast) {
  // 関数本体コードを生成
  var code = [];
  _emitNode(code, ast);
  code.push(_W.end);

  // 関数ボディ: [num_local_groups=0] + [code]
  var funcBody = [0x00].concat(code);

  // ── Type section: (i32 × 18) → i32 ─────────────────────────────────────
  var typeBody = [
    0x01,                         // 1 type
    0x60,                         // func
  ];
  _uleb128push(typeBody, 18);     // 18 params
  for (var pi = 0; pi < 18; pi++) typeBody.push(0x7F);  // i32 × 18
  typeBody.push(0x01, 0x7F);      // 1 result: i32

  // ── Function section ────────────────────────────────────────────────────
  var funcBody2 = [0x01, 0x00];   // 1 function, type index 0

  // ── Export section: "eval" → func 0 ─────────────────────────────────────
  var exportBody = [0x01]
    .concat(_strBytes('eval'))
    .concat([0x00, 0x00]);        // func kind, index 0

  // ── Code section ────────────────────────────────────────────────────────
  var codeBody = [0x01]           // 1 function body
    .concat(_vecOf(funcBody));

  // ── アセンブル ───────────────────────────────────────────────────────────
  var magic   = [0x00, 0x61, 0x73, 0x6D];
  var version = [0x01, 0x00, 0x00, 0x00];
  var all = magic.concat(version)
    .concat(_section(0x01, typeBody))
    .concat(_section(0x03, funcBody2))
    .concat(_section(0x07, exportBody))
    .concat(_section(0x0A, codeBody));

  return new Uint8Array(all);
}
