/**
 * ring.mjs — リングバッファ解析ユーティリティ
 *
 * リングバッファのワードレイアウト (6 words/sample):
 *  Word 0: io_addr[7:0], DBIN[8], SYNC[9], WR_N[10], HLDA[11],
 *          WAIT[12], INTE[13], MEMR[14], MEMW[15],
 *          io_dout[23:16], io_req[24], io_wr[25], t_state[31:26]
 *  Word 1: cpu_addr[15:0], io_din[23:16], acc[31:24]
 *  Word 2: F[7:0], B[15:8], C[23:16], D[31:24]
 *  Word 3: E[7:0], H[15:8], L[23:16], dbus[31:24]
 *  Word 4: status_byte[7:0], IR[15:8]
 *  Word 5: PC[15:0], SP[31:16]
 *
 * vm80a 2フェーズクロック:
 *   f1 <= ~f1; f2 <= f1; → 1 T-stateにつきリングバッファサンプルが2個
 */

/** ワードオフセット定数 */
export const W = {
  CTRL:  0,   // Word 0: 制御信号
  ADDR:  1,   // Word 1: アドレスバス + acc
  REGS1: 2,   // Word 2: F, B, C, D
  REGS2: 3,   // Word 3: E, H, L, dbus
  IR:    4,   // Word 4: status_byte, IR
  PCSP:  5,   // Word 5: PC, SP
};

/** Word 0 ビットフラグ */
export const CTRL = {
  DBIN:  (1 << 8),
  SYNC:  (1 << 9),
  WR_N:  (1 << 10),
  HLDA:  (1 << 11),
  WAIT:  (1 << 12),
  INTE:  (1 << 13),
  MEMR:  (1 << 14),
  MEMW:  (1 << 15),
  IO_REQ:(1 << 24),
  IO_WR: (1 << 25),
};

/**
 * リングバッファ (HEAPU32 全体) からサンプル配列を取り出す。
 * @param {Uint32Array} heapu32 - WASM HEAPU32 ビュー
 * @param {number} ringBase  - リングバッファの先頭 HEAPU32 インデックス
 * @param {number} ringSize  - リングバッファのサンプル数
 * @param {number} head      - 現在の書き込みヘッド (環状インデックス)
 * @param {number} count     - 取り出すサンプル数 (未指定時: ringSize 全体)
 * @returns {Array<{w0,w1,w2,w3,w4,w5}>} サンプル配列 (head から遡った順 → 古い順)
 */
export function readRingBuffer(heapu32, ringBase, ringSize, head, count = ringSize) {
  const n = Math.min(count, ringSize);
  const samples = [];
  for (let i = n - 1; i >= 0; i--) {
    const idx = ((head - 1 - i + ringSize) % ringSize) * 6;
    samples.push({
      w0: heapu32[ringBase + idx + 0],
      w1: heapu32[ringBase + idx + 1],
      w2: heapu32[ringBase + idx + 2],
      w3: heapu32[ringBase + idx + 3],
      w4: heapu32[ringBase + idx + 4],
      w5: heapu32[ringBase + idx + 5],
    });
  }
  return samples;
}

/**
 * サンプルから各フィールドを展開したオブジェクトを返す。
 * @param {{w0,w1,w2,w3,w4,w5}} s
 * @returns {object}
 */
export function parseSample(s) {
  return {
    // Word 0 フィールド
    io_addr:     (s.w0 >>> 0)  & 0xFF,
    dbin:        !!(s.w0 & CTRL.DBIN),
    sync:        !!(s.w0 & CTRL.SYNC),
    wr_n:        !!(s.w0 & CTRL.WR_N),
    hlda:        !!(s.w0 & CTRL.HLDA),
    wait:        !!(s.w0 & CTRL.WAIT),
    inte:        !!(s.w0 & CTRL.INTE),
    memr:        !!(s.w0 & CTRL.MEMR),
    memw:        !!(s.w0 & CTRL.MEMW),
    io_dout:     (s.w0 >>> 16) & 0xFF,
    io_req:      !!(s.w0 & CTRL.IO_REQ),
    io_wr:       !!(s.w0 & CTRL.IO_WR),
    t_state:     (s.w0 >>> 26) & 0x3F,
    // Word 1 フィールド
    addr:        (s.w1 >>> 0)  & 0xFFFF,
    io_din:      (s.w1 >>> 16) & 0xFF,
    acc:         (s.w1 >>> 24) & 0xFF,
    // Word 2 フィールド
    f:           (s.w2 >>> 0)  & 0xFF,
    b:           (s.w2 >>> 8)  & 0xFF,
    c:           (s.w2 >>> 16) & 0xFF,
    d:           (s.w2 >>> 24) & 0xFF,
    // Word 3 フィールド
    e:           (s.w3 >>> 0)  & 0xFF,
    h:           (s.w3 >>> 8)  & 0xFF,
    l:           (s.w3 >>> 16) & 0xFF,
    dbus:        (s.w3 >>> 24) & 0xFF,
    // Word 4 フィールド
    status_byte: (s.w4 >>> 0)  & 0xFF,
    ir:          (s.w4 >>> 8)  & 0xFF,
    // Word 5 フィールド
    pc:          (s.w5 >>> 0)  & 0xFFFF,
    sp:          (s.w5 >>> 16) & 0xFFFF,
  };
}

/**
 * サンプル配列を解析して、マシンサイクル毎のグループに分割する。
 * SYNC パルスの**立ち上がりエッジ** (0→1 遷移) が各マシンサイクルの T1 開始を示す。
 *
 * vm80a では SYNC は T1 の f1・f2 の両フェーズで High になるため、
 * 「SYNC=1」だけで分割すると 1 マシンサイクルが 2 グループに割れてしまう。
 * 立ち上がりエッジ検出により正しく 1 グループ/マシンサイクルにまとめる。
 *
 * @param {Array} samples  - parseSample 済みサンプルの配列
 * @returns {Array<{samples: Array, tStates: number, mCycleIdx: number}>}
 */
export function groupByMachineCycle(samples) {
  const cycles = [];
  let current = null;
  let prevSync = false; // 前サンプルの SYNC 状態（立ち上がり検出用）

  for (const s of samples) {
    // SYNC 立ち上がりエッジ = 前が 0 で今が 1
    const risingEdge = s.sync && !prevSync;
    if (risingEdge) {
      if (current) cycles.push(current);
      current = { samples: [s], mCycleIdx: cycles.length };
    } else if (current) {
      current.samples.push(s);
    }
    prevSync = s.sync;
  }
  if (current && current.samples.length > 0) cycles.push(current);

  // T-state 数 = サンプル数 / 2 (2フェーズクロックのため、偶数になる)
  for (const c of cycles) {
    c.tStates = c.samples.length / 2;
  }
  return cycles;
}

/**
 * 命令全体のタイミング情報を集計する。
 * @param {Array} parsedSamples
 * @returns {{
 *   machineCycles: number,    // マシンサイクル数
 *   totalTStates: number,     // 合計 T-state 数
 *   totalSamples: number,     // 合計サンプル数
 *   cycles: Array,            // マシンサイクル毎の詳細
 * }}
 */
export function analyzeTiming(parsedSamples) {
  const cycles = groupByMachineCycle(parsedSamples);
  const totalTStates = cycles.reduce((s, c) => s + c.tStates, 0);
  return {
    machineCycles: cycles.length,
    totalTStates,
    totalSamples: parsedSamples.length,
    cycles,
  };
}

/**
 * parsedSamples から最初の命令 1 個分のサンプルを抽出する。
 *
 * SYNC 立ち上がりエッジ (0→1) を命令境界として使用する。
 * startAddr での 2 回目の SYNC 立ち上がり = 無限ループ JMP が戻ったとき。
 *
 * @param {Array<object>} parsedSamples  - parseSample 済みサンプル配列
 * @param {number}        [startAddr]    - 命令先頭アドレス (省略時: 最初の SYNC 立ち上がりのアドレス)
 * @returns {Array<object>}
 */
export function extractFirstInstr(parsedSamples, startAddr) {
  // 最初の SYNC 立ち上がりを探す
  const firstSync = parsedSamples.findIndex(
    (s, i) => s.sync && (i === 0 || !parsedSamples[i - 1].sync)
  );
  if (firstSync < 0) return parsedSamples;

  const addr = startAddr ?? parsedSamples[firstSync].addr;
  let end = parsedSamples.length;
  let prev = parsedSamples[firstSync].sync;

  for (let i = firstSync + 1; i < parsedSamples.length; i++) {
    const isRising = parsedSamples[i].sync && !prev;
    if (isRising && parsedSamples[i].addr === addr) {
      end = i;
      break;
    }
    prev = parsedSamples[i].sync;
  }
  return parsedSamples.slice(firstSync, end);
}

/**
 * parsedSamples から最初の N マシンサイクル分のサンプルを抽出する。
 * SYNC 立ち上がりエッジを N 回カウントしたところで打ち切る。
 *
 * @param {Array<object>} parsedSamples
 * @param {number}        n - 抽出するマシンサイクル数
 * @returns {Array<object>}
 */
export function extractNMachineCycles(parsedSamples, n) {
  const firstSync = parsedSamples.findIndex(
    (s, i) => s.sync && (i === 0 || !parsedSamples[i - 1].sync)
  );
  if (firstSync < 0) return parsedSamples;

  let risingCount = 1; // 最初の SYNC は既にカウント済み
  let end = parsedSamples.length;
  let prev = parsedSamples[firstSync].sync;

  for (let i = firstSync + 1; i < parsedSamples.length; i++) {
    const isRising = parsedSamples[i].sync && !prev;
    if (isRising) {
      risingCount++;
      if (risingCount > n) { end = i; break; }
    }
    prev = parsedSamples[i].sync;
  }
  return parsedSamples.slice(firstSync, end);
}

/**
 * タイミング情報をデバッグ用テキストにフォーマットする。
 * @param {{cycles: Array, totalTStates: number}} timing
 * @returns {string}
 */
export function formatTiming(timing) {
  const lines = [];
  for (const c of timing.cycles) {
    const p = c.samples[0] ? c.samples[0] : {};
    lines.push(
      `  M${c.mCycleIdx + 1}: ${c.tStates}T (${c.samples.length} samples)` +
      ` addr=0x${(p.addr ?? 0).toString(16).padStart(4, '0')}` +
      ` status=0x${(p.status_byte ?? 0).toString(16).padStart(2, '0')}`
    );
  }
  return `総T-state: ${timing.totalTStates}, マシンサイクル: ${timing.machineCycles}\n` +
         lines.join('\n');
}
