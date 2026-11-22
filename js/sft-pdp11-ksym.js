'use strict';
// sft-pdp11-ksym.js — Unix V6 の a.out シンボル表と、PDP-11 C のスタックフレームを読む純粋関数
//
// ブラウザ（index.html・sim-worker.js の importScripts）と Node（tests/ksym の vm）の両方で使う。
// DOM にも Worker にも依存しない。入力を書き換えず、新しい配列・オブジェクトを返す。
//
//   v6ParseNamelist(bytes)        a.out のシンボル表 → [{ name, type, value }]
//   v6TextSymbols(syms)           テキスト（命令）のシンボルだけを番地順に → [{ addr, name }]
//   v6NearestSym(table, addr)     addr 以下で最も近いシンボル → { name, off } | null
//   v6FmtSym(table, addr, max)    "fork+46" の形（8 進）。max より遠ければ ''
//   pdp11WalkFrames(read, fp, o)  R5 の鎖をたどる → [{ fp, savedFp, ret }]

// ── a.out ヘッダ（V6: 8 語 = 16 バイト）────────────────────────────────────
var V6_AOUT_HEADER_BYTES = 16;
var V6_AOUT_MAGICS       = [0o407, 0o410, 0o411];
var V6_AOUT_SYM_BYTES    = 12;      // 名前 8 バイト + 種別 1 語 + 値 1 語
var V6_AOUT_NAME_BYTES   = 8;
var V6_SYM_TYPE_MASK     = 0o37;    // 下位 5 ビットが種別、0o40 は外部シンボルの印
var V6_SYM_TYPE_TEXT     = 2;

function _v6Word(bytes, off) { return bytes[off] | (bytes[off + 1] << 8); }

// a.out のシンボル表を読む。a.out でない・シンボルが無いときは空配列。
function v6ParseNamelist(bytes) {
  if (!bytes || bytes.length < V6_AOUT_HEADER_BYTES) return [];
  if (V6_AOUT_MAGICS.indexOf(_v6Word(bytes, 0)) < 0) return [];
  var textSize = _v6Word(bytes, 2);
  var dataSize = _v6Word(bytes, 4);
  var symSize  = _v6Word(bytes, 8);
  var noReloc  = _v6Word(bytes, 14);          // 1 = 再配置情報なし
  // 再配置情報があるときは、text+data と同じ大きさの再配置表がシンボル表の前に入る
  var symStart = V6_AOUT_HEADER_BYTES + (textSize + dataSize) * (noReloc ? 1 : 2);
  var symEnd   = Math.min(symStart + symSize, bytes.length);
  var syms = [];
  for (var off = symStart; off + V6_AOUT_SYM_BYTES <= symEnd; off += V6_AOUT_SYM_BYTES) {
    var name = '';
    for (var i = 0; i < V6_AOUT_NAME_BYTES && bytes[off + i] !== 0; i++) {
      name += String.fromCharCode(bytes[off + i]);
    }
    if (!name) continue;
    syms.push({ name: name,
                type: _v6Word(bytes, off + V6_AOUT_NAME_BYTES),
                value: _v6Word(bytes, off + V6_AOUT_NAME_BYTES + 2) });
  }
  return syms;
}

// テキストのシンボルを番地順に並べる。C の名前に付く先頭の '_' は外す（_fork → fork）。
// 同じ番地に複数あるときは、C の名前（'_' 付き）を優先する。
function v6TextSymbols(syms) {
  var byAddr = {};
  (syms || []).forEach(function (s) {
    if ((s.type & V6_SYM_TYPE_MASK) !== V6_SYM_TYPE_TEXT) return;
    var isC  = s.name.charAt(0) === '_';
    var prev = byAddr[s.value];
    if (prev && prev.isC && !isC) return;
    byAddr[s.value] = { addr: s.value, name: isC ? s.name.slice(1) : s.name, isC: isC };
  });
  return Object.keys(byAddr)
    .map(function (k) { return { addr: byAddr[k].addr, name: byAddr[k].name }; })
    .sort(function (a, b) { return a.addr - b.addr; });
}

// addr 以下で最も近いシンボル（table は v6TextSymbols の結果）。無ければ null。
function v6NearestSym(table, addr) {
  if (!table || table.length === 0 || addr < table[0].addr) return null;
  var lo = 0, hi = table.length - 1;
  while (lo < hi) {                              // table[lo].addr <= addr となる最大の lo
    var mid = (lo + hi + 1) >> 1;
    if (table[mid].addr <= addr) lo = mid; else hi = mid - 1;
  }
  return { name: table[lo].name, off: addr - table[lo].addr };
}

// "fork+46"（オフセットは 8 進、0 なら名前だけ）。maxOff より遠い・シンボルが無いときは ''。
function v6FmtSym(table, addr, maxOff) {
  var s = v6NearestSym(table, addr);
  if (!s) return '';
  if (maxOff !== undefined && s.off > maxOff) return '';
  return s.off === 0 ? s.name : s.name + '+' + s.off.toString(8);
}

// ── スタックフレーム ──────────────────────────────────────────────────────
// V6 の C コンパイラは関数の入口で csv を呼び、R5 をフレームポインタにする:
//   (R5)   = 呼び出し元の R5
//   2(R5)  = 戻り番地
// readWord(va) は 16 ビットの値か、読めないとき負の数を返す関数。
// スタックは上位番地へ向かって巻き戻るので、次の R5 が今の R5 以下になったら鎖の終わりとみなす。
var PDP11_MAX_FRAMES = 16;

function pdp11WalkFrames(readWord, fp, opts) {
  var o      = opts || {};
  var max    = o.maxFrames || PDP11_MAX_FRAMES;
  var lo     = (o.lo !== undefined) ? o.lo : 0;
  var hi     = (o.hi !== undefined) ? o.hi : 0xFFFE;
  var frames = [];
  var cur    = fp & 0xFFFF;
  while (frames.length < max) {
    if (cur & 1 || cur < lo || cur + 2 > hi) break;
    var saved = readWord(cur);
    var ret   = readWord(cur + 2);
    if (saved < 0 || ret < 0) break;
    frames.push({ fp: cur, savedFp: saved, ret: ret });
    if (saved <= cur) break;
    cur = saved;
  }
  return frames;
}

// ── Stack パネルの表示モデル ──────────────────────────────────────────────
// Worker の 'mem' メッセージ（{ mode, base, words, frames, sp, r5, pc }）とシンボル表から、
// 画面に並べる行を作る。シンボルを付けるのは Kernel モードのときだけ
// （表はカーネルの a.out のもので、ユーザープロセスの番地には当てはまらない）。
//   → { pcSym, chain: [{ fp, ret, sym }], rows: [{ va, val, marks: [..], sym }] }
//   marks: 'SP' / 'R5' / 'fp'（保存された R5 の置き場）/ 'ret'（戻り番地の置き場）
var PDP11_MODE_KERNEL = 0;

function pdp11StackView(mem, table) {
  var useSym = (mem.mode === PDP11_MODE_KERNEL) && table && table.length > 0;
  var sym    = function (addr) { return useSym ? v6FmtSym(table, addr) : ''; };
  var fpSlot = {}, retSlot = {};
  (mem.frames || []).forEach(function (f) { fpSlot[f.fp] = true; retSlot[f.fp + 2] = true; });
  var live = (mem.mode === mem.curMode);        // SP・R5 は「いまのモード」の値
  var rows = (mem.words || []).map(function (val, i) {
    var va    = (mem.base + i * 2) & 0xFFFF;
    var marks = [];
    if (live && va === mem.sp) marks.push('SP');
    if (live && va === mem.r5) marks.push('R5');
    if (fpSlot[va])  marks.push('fp');
    if (retSlot[va]) marks.push('ret');
    return { va: va, val: val, marks: marks, sym: (retSlot[va] && val >= 0) ? sym(val) : '' };
  });
  var chain = (mem.frames || []).map(function (f) {
    return { fp: f.fp, ret: f.ret, sym: sym(f.ret) };
  });
  return { pcSym: live ? sym(mem.pc) : '', chain: chain, rows: rows };
}
