// ring.mjs — テスト用 ring buffer ビルダー
// ring buffer は 9 words/sample（RING_WORDS_PDP11=9）の flat Uint32Array。
// テストでは 2 サンプル分 (cur=base=0, prev=prevBase=9) を作る。

export const WORDS     = 9;   // RING_WORDS_PDP11
export const BASE      = 0;   // 現サンプルの先頭 word インデックス
export const PREV_BASE = 9;   // 前サンプルの先頭 word インデックス

// 信号値を Uint32Array にセットする（符号なし 32 ビット演算）
function setSigField(arr, wordBase, sig, val) {
  const w    = wordBase + (sig.word || 0);
  const bits = sig.bit  || 0;
  const mask = sig.width < 32 ? ((1 << sig.width) - 1) : 0xFFFFFFFF;
  const shiftedMask = ((mask << bits) >>> 0);
  const shiftedVal  = (((val & mask) << bits) >>> 0);
  arr[w] = ((arr[w] >>> 0) & ~shiftedMask | shiftedVal) >>> 0;
}

/**
 * makeRing(signals, { cur, prev })
 *   signals: LA_SIGNALS_PDP11 配列
 *   cur:  { signalId: value, ... }  — BASE (0) に配置
 *   prev: { signalId: value, ... }  — PREV_BASE (9) に配置
 *   returns: Uint32Array(18)
 */
export function makeRing(signals, { cur = {}, prev = {} } = {}) {
  const r = new Uint32Array(WORDS * 2);

  for (const [id, val] of Object.entries(cur)) {
    const sig = signals.find(s => s.id === id);
    if (!sig) throw new Error('makeRing: 不明な信号 ID: ' + id);
    setSigField(r, BASE, sig, val);
  }
  for (const [id, val] of Object.entries(prev)) {
    const sig = signals.find(s => s.id === id);
    if (!sig) throw new Error('makeRing: 不明な信号 ID: ' + id);
    setSigField(r, PREV_BASE, sig, val);
  }
  return r;
}
