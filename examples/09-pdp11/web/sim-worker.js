'use strict';

// PDP-11 / Unix V6 Web Worker (Phase 4)
// rtlscope-la.js は index.html 側で動作するため、Worker では ring buffer を
// スナップショットとして転送するだけ。GPR と MMU は別メッセージで送る。

var Module = {
  onRuntimeInitialized: function () {
    RING_SIZE  = Module._get_ring_size();
    RING_WORDS = Module._get_ring_words();
    ringBase   = Module._get_ring_ptr() >>> 2;  // uint32_t* → HEAPU32 index
    gprBase16  = Module._get_gpr_ptr() >>> 1;   // uint16_t* → HEAPU16 index
    mmuBase32  = Module._get_mmu_ptr() >>> 2;   // uint32_t* → HEAPU32 index
    postMessage({ type: 'ready', ringBase: ringBase,
                  ringSize: RING_SIZE, ringWords: RING_WORDS });
    scheduleNext();
  }
};

importScripts('sim.js');

var RING_SIZE     = 0;
var RING_WORDS    = 5;
var ringBase      = 0;
var gprBase16     = 0;
var mmuBase32     = 0;
var running       = false;
var stepsPerFrame  = 200000;
var _lastEffSteps  = 200000;  // _sendRing が steps フィールドに使う実効値
var lastRingHead   = 0;
var mmuFrameCnt   = 0;

// Speed が setSpeed メッセージで固定されているかどうか
var _speedFixed  = false;
var _laEnabled   = true;
// 現在設定中のトリガー種別（0=NONE 1=PC 2=ISTATE 3=IOPAGE 4=TRAP 5=BUSERR 7=EXPR）
var _curTrigType = 0;
// 式トリガー: コンパイル済み Wasm エクスポート関数（null = 未設定）
// シグネチャ: eval(w0..w8: i32[9], pw0..pw8: i32[9]) → i32
var _exprEval = null;

// ── キー入力キュー（ペースト文字化け防止）─────────────────────────────────
// onmessage から受け取った文字をここにバッファし、simLoop で少しずつ
// _send_key() へ流す。con_in_buf(256B) のオーバーフローを防ぐ。
var keyQueue = [];
var KEY_DRAIN = 16;  // 1 simLoop フレームあたりの最大送出文字数

// ── ディスク初期化 ────────────────────────────────────────────────────────
var diskReady = false;

// ── ディスクバッファ保持（Unix V6 FS 読み取り用）──────────────────────────
var diskData = null;  // Uint8Array（V6 FS パース用にコピーを保持）

// WASM 側の最新ディスクを diskData に同期する。
// Unix カーネルはブロックを /disk0.rk に直接書くため、listFS 前に必ず呼ぶ。
function v6SyncDiskFromFS() {
  if (!diskReady) return;
  try { diskData = Module.FS.readFile('/disk0.rk'); } catch (e) {}
}

// diskData への変更（remove/move）を WASM 側の /disk0.rk に書き戻す。
function v6FlushDiskToFS() {
  if (!diskReady || !diskData) return;
  try { Module.FS.writeFile('/disk0.rk', diskData); } catch (e) {}
}

// ── マクロ（!script）状態 ──────────────────────────────────────────────────
// セグメント配列で管理: chars / sleep / expect の 3 種類
//   {type:'chars',  data:Uint8Array, pos:0}
//   {type:'sleep',  ms:200, until:0}       until は開始フレームで Date.now()+ms に確定
//   {type:'expect', str:'-', ms:200, deadline:0}
var macroSegments = [];   // パース済みセグメント配列
var macroSegIdx   = 0;    // 現在処理中のインデックス
var macroExpect   = null; // expect 待機中: {str, buf, deadline} | null

// マクロセグメントを 1 フレーム分進める
function injectMacro() {
  if (macroExpect) return;  // !expect 解決待ち: simLoop 側で TTY 出力を監視

  while (macroSegIdx < macroSegments.length) {
    var seg = macroSegments[macroSegIdx];

    if (seg.type === 'sleep') {
      if (seg.until === 0) seg.until = Date.now() + seg.ms;  // 初回: タイマー開始
      if (Date.now() < seg.until) return;                     // まだ待機中
      macroSegIdx++;
      continue;
    }

    if (seg.type === 'expect') {
      // expect 状態に移行: simLoop の TTY 出力監視に委譲
      macroExpect = { str: seg.str, buf: '', deadline: Date.now() + seg.ms };
      macroSegIdx++;
      return;
    }

    // type === 'chars'
    var space  = Module._sim_con_in_space ? Module._sim_con_in_space() : 100;
    var inject = Math.min(Math.max(0, space - 4), seg.data.length - seg.pos, 64);
    if (inject > 0) {
      for (var j = 0; j < inject; j++) Module._send_key(seg.data[seg.pos++]);
    }
    if (seg.pos >= seg.data.length) {
      macroSegIdx++;
      continue;  // 次セグメントへ
    }
    return;  // chars がまだ残っている: 次フレームで続き
  }

  // 全セグメント完了
  if (macroSegments.length > 0) {
    macroSegments = [];
    macroSegIdx   = 0;
    postMessage({ type: 'scriptEnded' });
  }
}

function startSim(diskBuffer) {
  var data = new Uint8Array(diskBuffer);
  // Unix V6 FS 読み取り用にコピーを保持（ディスクイメージを別途保管）
  diskData = data.slice();
  Module.FS.writeFile('/disk0.rk', data);
  diskReady = true;
  Module._sim_init();
  lastRingHead = 0;
  mmuFrameCnt  = 0;
  postMessage({ type: 'started' });
  running = true;
  scheduleNext();
  // fake_uart.v の fake_init_delay(8M クロック) に相当する待機後に
  // 'rkunix\r' を自動送信してスタンドアロンブートを起動する
  setTimeout(_autoBootV6, 3000);
}

function _autoBootV6() {
  if (!diskReady || !running) return;
  var cmd = 'rkunix\r';
  for (var i = 0; i < cmd.length; i++) Module._send_key(cmd.charCodeAt(i));
}

// ── シミュレーションループ ────────────────────────────────────────────────
function scheduleNext() { setTimeout(simLoop, 0); }

function simLoop() {
  if (!running) return;

  // マクロセグメントを注入（ステップ前に行い遅延を最小化）
  injectMacro();

  // キューから最大 KEY_DRAIN 文字を con_in_buf へ流す
  // sim_con_in_space() があれば空き容量を尊重して溢れを防ぐ
  var space = (Module._sim_con_in_space ? Module._sim_con_in_space() : KEY_DRAIN);
  var drain = Math.min(keyQueue.length, Math.min(space, KEY_DRAIN));
  for (var ki = 0; ki < drain; ki++) Module._send_key(keyQueue.shift());

  var t0 = Date.now();
  // 式トリガー有効時: 1フレームで ring が複数周するとトリガーサンプルが上書きされて検出漏れになる。
  // RING_SIZE-1 に制限し ring を 1 周以内に収め、前フレーム末尾サンプルも保持（エッジ検出用）。
  var _effSteps = (_exprEval && stepsPerFrame > RING_SIZE - 1) ? (RING_SIZE - 1) : stepsPerFrame;
  _lastEffSteps = _effSteps;
  Module._step_n(_effSteps);

  // TTY 出力
  var chars = [];
  var ch;
  while ((ch = Module._get_display_char()) !== -1) chars.push(ch & 0x7F);
  if (chars.length > 0) {
    postMessage({ type: 'tty', chars: chars });
  }

  // ── !expect: TTY 出力をパターンマッチ ────────────────────────────────
  if (macroExpect && chars.length > 0) {
    var ttyStr = String.fromCharCode.apply(null, chars);
    macroExpect.buf = (macroExpect.buf + ttyStr).slice(-(macroExpect.str.length + 64));
    if (macroExpect.buf.indexOf(macroExpect.str) !== -1) {
      macroExpect = null;
    }
  }
  // expect タイムアウト確認
  if (macroExpect && Date.now() > macroExpect.deadline) {
    postMessage({ type: 'scriptWarn', msg: '!expect timeout: "' + macroExpect.str + '"' });
    macroExpect = null;
  }

  // ハードウェアトリガーヒット確認
  if (Module._sim_trigger_hit && Module._sim_trigger_hit()) {
    running = false;
    var pc       = Module._get_pc ? Module._get_pc() : 0;
    var fireHead = Module._get_trig_fire_head ? (Module._get_trig_fire_head() >>> 0) : -1;
    postMessage({ type: 'triggered', pc: pc, trigType: _curTrigType, fireHead: fireHead });
    _sendRing();
    _sendGPR();
    return;
  }

  // 式トリガー（Wasm ネイティブ評価）: 新着サンプルを全スキャン
  // _effSteps <= RING_SIZE-1 の制限により ring は 1 周以内。lastRingHead から全サンプルが有効。
  if (_exprEval) {
    var _exHead  = Module._get_ring_head() >>> 0;
    var _exCount = (_exHead - lastRingHead) >>> 0;   // RING_SIZE-1 以下が保証される
    var _exStart = lastRingHead;
    var _h = Module.HEAPU32;
    for (var _xi = 0; _xi < _exCount; _xi++) {
      var _xabs = (_exStart + _xi) >>> 0;
      var _xb   = (_xabs % RING_SIZE) * RING_WORDS + ringBase;
      var _xpb  = (((_xabs - 1 + RING_SIZE) >>> 0) % RING_SIZE) * RING_WORDS + ringBase;
      if (_exprEval(
        _h[_xb],   _h[_xb+1], _h[_xb+2], _h[_xb+3], _h[_xb+4],
        _h[_xb+5], _h[_xb+6], _h[_xb+7], _h[_xb+8],
        _h[_xpb],  _h[_xpb+1],_h[_xpb+2],_h[_xpb+3],_h[_xpb+4],
        _h[_xpb+5],_h[_xpb+6],_h[_xpb+7],_h[_xpb+8]
      )) {
        _exprEval = null;
        running   = false;
        var _xPc  = Module._get_pc ? Module._get_pc() : 0;
        var _xFh  = (_xabs + 1) >>> 0;
        // 'triggered' を先に送り、後続 'ring' で UI がアンカー処理できるようにする
        postMessage({ type: 'triggered', pc: _xPc, trigType: 7, fireHead: _xFh });
        _sendRing();
        _sendGPR();
        return;
      }
    }
  }

  // ring buffer スナップショット転送（GPR を含む）
  _sendRing();

  // MMU は 15 フレームに 1 回（~250ms 間隔）
  mmuFrameCnt++;
  if ((mmuFrameCnt & 15) === 0) _sendMMU();

  // フレームレート自動調整（setSpeed で固定の場合、または式トリガーで _effSteps が上書き中はスキップ）
  // 式トリガー有効時は _effSteps が RING_SIZE-1 に固定されるため elapsed が常に短くなり
  // stepsPerFrame が 2M 上限まで膨れ上がるのを防ぐ。
  if (!_speedFixed && !_exprEval) {
    var elapsed = Date.now() - t0;
    if (elapsed < 8  && stepsPerFrame < 2000000) stepsPerFrame = Math.min(stepsPerFrame * 1.2 | 0, 2000000);
    if (elapsed > 22 && stepsPerFrame > 50000)   stepsPerFrame = Math.max(stepsPerFrame * 0.8 | 0, 50000);
  }

  scheduleNext();
}

function _sendRing() {
  var head = Module._get_ring_head() >>> 0;
  if (!_laEnabled) { lastRingHead = head; return; }
  if (head === lastRingHead) return;

  var count = (head - lastRingHead) >>> 0;
  if (count > RING_SIZE) count = RING_SIZE;

  var snap = new Uint32Array(count * RING_WORDS);
  var u32  = Module.HEAPU32;
  for (var i = 0; i < count; i++) {
    var src = ringBase + ((lastRingHead + i) >>> 0) % RING_SIZE * RING_WORDS;
    for (var w = 0; w < RING_WORDS; w++) {
      snap[i * RING_WORDS + w] = u32[src + w];
    }
  }

  // GPR を一緒に送る（uint16_t[7] = R0..R5, SP）
  var u16  = Module.HEAPU16;
  var gpr  = Array.from(u16.slice(gprBase16, gprBase16 + 7));

  postMessage({ type: 'ring', head: head, snap: snap.buffer, gpr: gpr, steps: _lastEffSteps }, [snap.buffer]);
  lastRingHead = head;
}

function _sendGPR() {
  var u16 = Module.HEAPU16;
  var gpr = Array.from(u16.slice(gprBase16, gprBase16 + 7));
  postMessage({ type: 'gpr', gpr: gpr });
}

function _sendMMU() {
  if (!Module._sim_update_mmu) return;
  Module._sim_update_mmu();
  var u32  = Module.HEAPU32;
  var size = Module._get_mmu_size ? Module._get_mmu_size() : 16;
  var snap = new Uint32Array(size);
  for (var i = 0; i < size; i++) snap[i] = u32[mmuBase32 + i];
  postMessage({ type: 'mmu', snap: snap.buffer }, [snap.buffer]);
}

// ── Unix V6 ファイルシステム パーサ ───────────────────────────────────────
// RK05 ディスクイメージ（Unix V6 形式）をブロック単位で読み取る。
// 参考: Lions' Commentary on UNIX 6th Edition (filesystem.h / inode.h)

var V6_BLOCK_SIZE       = 512;  // バイト/ブロック
var V6_INODE_SIZE       = 32;   // バイト/inode
var V6_INODES_PER_BLOCK = 16;   // V6_BLOCK_SIZE / V6_INODE_SIZE
var V6_INODE_START      = 2;    // inode テーブル開始ブロック番号
var V6_ROOT_INODE       = 1;    // ルートディレクトリの inode 番号（1-indexed）

// ブロック n を読み取る → Uint8Array(512)
function v6ReadBlock(disk, n) {
  var off = n * V6_BLOCK_SIZE;
  if (off + V6_BLOCK_SIZE > disk.length) return new Uint8Array(V6_BLOCK_SIZE);
  return disk.slice(off, off + V6_BLOCK_SIZE);
}

// inode ino (1-indexed) を読み取る → オブジェクト
function v6ReadInode(disk, ino) {
  var idx  = ino - 1;
  var blk  = V6_INODE_START + Math.floor(idx / V6_INODES_PER_BLOCK);
  var off  = (idx % V6_INODES_PER_BLOCK) * V6_INODE_SIZE;
  var buf  = v6ReadBlock(disk, blk);
  var dv   = new DataView(buf.buffer, buf.byteOffset + off, V6_INODE_SIZE);

  var mode  = dv.getUint16(0, true);   // i_mode (LE)
  var nlink = dv.getUint8(2);          // i_nlink
  var uid   = dv.getUint8(3);          // i_uid
  // i_size0 (1 byte, offset 4) + i_size1 (2 bytes LE, offset 6) で 3-byte ファイルサイズ
  var size  = (dv.getUint8(4) << 16) | dv.getUint16(6, true);
  // i_addr[8]: offset 8 から 8 つの 16-bit ブロック番号 (LE)
  var addr  = [];
  for (var i = 0; i < 8; i++) addr.push(dv.getUint16(8 + i * 2, true));
  // atime: offset 24-27 (4 bytes LE)、mtime: offset 28-31 (4 bytes LE)
  var mtime = dv.getUint32(28, true);

  return { mode: mode, nlink: nlink, uid: uid, size: size, addr: addr, mtime: mtime };
}

// ディレクトリ inode を読んでエントリ配列を返す
// 各エントリ: { ino, name }
function v6ListDir(disk, inode) {
  var entries = [];
  var data    = v6ReadFile(disk, inode);
  // ディレクトリエントリ: 2 バイト ino (LE uint16) + 14 バイト名前 = 16 バイト
  for (var off = 0; off + 16 <= data.length; off += 16) {
    var ino = data[off] | (data[off + 1] << 8);  // little-endian uint16
    if (ino === 0) continue;
    var name = '';
    for (var ni = 0; ni < 14; ni++) {
      var c = data[off + 2 + ni];
      if (c === 0) break;
      name += String.fromCharCode(c);
    }
    entries.push({ ino: ino, name: name });
  }
  return entries;
}

// パスを辿って inode 番号を返す（見つからなければ -1）
function v6FindPath(disk, path) {
  var parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(function(p) { return p.length > 0; });
  var ino   = V6_ROOT_INODE;
  for (var pi = 0; pi < parts.length; pi++) {
    var inode = v6ReadInode(disk, ino);
    if (!(inode.mode & 0x4000)) return -1;  // ディレクトリでない
    var entries = v6ListDir(disk, inode);
    var found = -1;
    for (var ei = 0; ei < entries.length; ei++) {
      if (entries[ei].name === parts[pi]) { found = entries[ei].ino; break; }
    }
    if (found === -1) return -1;
    ino = found;
  }
  return ino;
}

// inode のファイルデータを読み取る（direct + large file indirect 対応）
function v6ReadFile(disk, inode) {
  var V6_MAX_READ = 1024 * 1024;  // 1MB 上限
  var size    = Math.min(inode.size, V6_MAX_READ);
  var result  = new Uint8Array(size);
  var written = 0;

  // V6 large file フラグ: i_mode & 0x1000
  var isLarge = !!(inode.mode & 0x1000);

  function copyBlock(blkNum) {
    if (blkNum === 0 || written >= size) return;
    var blk  = v6ReadBlock(disk, blkNum);
    var need = Math.min(V6_BLOCK_SIZE, size - written);
    for (var i = 0; i < need; i++) result[written++] = blk[i];
  }

  if (!isLarge) {
    // 通常ファイル: addr[0..7] が直接ブロック番号
    for (var ai = 0; ai < 8 && written < size; ai++) {
      copyBlock(inode.addr[ai]);
    }
  } else {
    // ラージファイル: addr[0..7] が間接ブロック番号
    for (var ai = 0; ai < 8 && written < size; ai++) {
      var indBlk = inode.addr[ai];
      if (indBlk === 0) continue;
      var indBuf = v6ReadBlock(disk, indBlk);
      // 間接ブロックは 256 個の LE uint16 ブロック番号を格納
      for (var ii = 0; ii < 256 && written < size; ii++) {
        var bn = indBuf[ii * 2] | (indBuf[ii * 2 + 1] << 8);
        copyBlock(bn);
      }
    }
  }

  return result;
}

// ── Unix V6 FS 書き込みサポート ──────────────────────────────────────────────
// TTY を完全にバイパスして /tmp/ 以下に小ファイル（最大 8 ブロック = 4KB）を書き込む。
// kernel の buffer cache との整合性:
//   - /tmp ディレクトリブロック (817) は boot+login 直後はキャッシュされていない。
//   - inode ブロック 14 (inode 193-208) も同様に未キャッシュ。
//   - データブロック (3108 番台) は kernel の in-memory free list に含まれない。
//   - i_mode を設定することで kernel ialloc() がスキップする。

var V6_TMP_INO     = 96;   // /tmp の inode 番号
var V6_TMP_DIR_BLK = 817;  // /tmp ディレクトリブロック番号 (block 0)
var V6_TMP_DIR_BL2 = 101;  // /tmp ディレクトリブロック番号 (block 1)

function v6DskWrU16(disk, off, val) {
  disk[off]     = val & 0xFF;
  disk[off + 1] = (val >> 8) & 0xFF;
}

// ディスクイメージ上の inode を書き込む
function v6DskWriteInode(disk, ino, f) {
  var idx  = ino - 1;
  var blk  = V6_INODE_START + Math.floor(idx / V6_INODES_PER_BLOCK);
  var base = blk * V6_BLOCK_SIZE + (idx % V6_INODES_PER_BLOCK) * V6_INODE_SIZE;
  v6DskWrU16(disk, base,     f.mode);
  disk[base + 2] = f.nlink & 0xFF;
  disk[base + 3] = f.uid   & 0xFF;
  disk[base + 4] = f.gid   & 0xFF;
  disk[base + 5] = (f.size >>> 16) & 0xFF;
  v6DskWrU16(disk, base + 6, f.size & 0xFFFF);
  for (var i = 0; i < 8; i++) v6DskWrU16(disk, base + 8 + i * 2, f.addr[i] || 0);
  for (var j = 24; j < 32; j++) disk[base + j] = 0;  // atime/mtime = 0
}

// superblock の s_free[0] が指すチェーンブロックから nBlocks 個取得する。
// 取得するのは先頭エントリ (index 0, 1, ...) = kernel が最後に割り当てるブロック = 最安全。
function v6DskAllocChainBlocks(disk, nBlocks) {
  var sbOff = V6_BLOCK_SIZE;                               // superblock は block 1
  var sNfree = disk[sbOff + 4] | (disk[sbOff + 5] << 8);  // s_nfree
  if (sNfree === 0) throw new Error('V6: disk full');
  var chainNo = disk[sbOff + 6] | (disk[sbOff + 7] << 8); // s_free[0] = chain link
  if (chainNo === 0) throw new Error('V6: no chain block');
  var cOff    = chainNo * V6_BLOCK_SIZE;
  var cNfree  = disk[cOff] | (disk[cOff + 1] << 8);
  if (cNfree < nBlocks) throw new Error('V6: chain too small');
  var blocks = [];
  for (var i = 0; i < nBlocks; i++) {
    var pos = cOff + 2 + i * 2;
    blocks.push(disk[pos] | (disk[pos + 1] << 8));
  }
  return blocks;
}

// /tmp ディレクトリから fname のエントリを探して { entOff, ino } を返す（なければ null）
function v6DskFindTmpEntry(disk, fname) {
  var dirs = [
    { blk: V6_TMP_DIR_BLK, cnt: 32 },
    { blk: V6_TMP_DIR_BL2, cnt: 1  }
  ];
  for (var di = 0; di < dirs.length; di++) {
    var base = dirs[di].blk * V6_BLOCK_SIZE;
    for (var ei = 0; ei < dirs[di].cnt; ei++) {
      var off  = base + ei * 16;
      var eIno = disk[off] | (disk[off + 1] << 8);
      if (eIno === 0) continue;
      var eName = '';
      for (var ni = 0; ni < 14; ni++) {
        var c = disk[off + 2 + ni]; if (c === 0) break;
        eName += String.fromCharCode(c);
      }
      if (eName === fname) return { entOff: off, ino: eIno };
    }
  }
  return null;
}

// /tmp ディレクトリの空きスロット（ino=0）に新エントリを追加する
function v6DskAddTmpEntry(disk, newIno, fname) {
  var dirs = [
    { blk: V6_TMP_DIR_BLK, cnt: 32 },
    { blk: V6_TMP_DIR_BL2, cnt: 1  }
  ];
  for (var di = 0; di < dirs.length; di++) {
    var base = dirs[di].blk * V6_BLOCK_SIZE;
    for (var ei = 0; ei < dirs[di].cnt; ei++) {
      var off = base + ei * 16;
      if ((disk[off] | (disk[off + 1] << 8)) !== 0) continue;  // occupied
      v6DskWrU16(disk, off, newIno);
      for (var ni = 0; ni < 14; ni++) disk[off + 2 + ni] = (ni < fname.length) ? fname.charCodeAt(ni) & 0x7F : 0;
      return true;
    }
  }
  return false;
}

// inode 番号 startIno 以降で i_mode == 0 の空き inode を探す
function v6DskFindFreeInode(disk, startIno) {
  var sbOff  = V6_BLOCK_SIZE;
  var sIsize = disk[sbOff] | (disk[sbOff + 1] << 8);
  var maxIno = (sIsize - 2) * V6_INODES_PER_BLOCK;
  for (var ino = startIno; ino <= maxIno; ino++) {
    var idx  = ino - 1;
    var base = (V6_INODE_START + Math.floor(idx / V6_INODES_PER_BLOCK)) * V6_BLOCK_SIZE
             + (idx % V6_INODES_PER_BLOCK) * V6_INODE_SIZE;
    if ((disk[base] | (disk[base + 1] << 8)) === 0) return ino;
  }
  return -1;
}

// ファイル名が V6 で有効かチェック（14 文字以下、ASCII 印字可能文字のみ）
function v6ValidateName(name) {
  return name && name.length > 0 && name.length <= 14 && /^[\x21-\x7e]+$/.test(name);
}

// V6 FS の /tmp/ に contentBytes を fname で書き込む（既存ファイルは上書き）。
// 戻り値: { ino, path }
function v6DskWriteFile(disk, path, contentBytes) {
  var fname = path.replace(/^\/+/, '').replace(/^tmp\/+/, '');
  if (fname.indexOf('/') !== -1) fname = fname.split('/').pop();
  if (!v6ValidateName(fname)) throw new Error('無効なファイル名: ' + fname);
  if (contentBytes.length > 8 * V6_BLOCK_SIZE) throw new Error('ファイルが大きすぎます（最大 4KB）');

  var nBlocks = Math.max(1, Math.ceil(contentBytes.length / V6_BLOCK_SIZE));
  var existing = v6DskFindTmpEntry(disk, fname);
  var newIno, addrArr;

  if (existing) {
    // 既存ファイルを上書き: inode はそのまま、データブロックを再割り当て
    newIno = existing.ino;
    var oldInode = v6ReadInode(disk, newIno);
    var oldAddr  = oldInode.addr.slice();
    var oldNBlk  = 0;
    for (var ai = 0; ai < 8; ai++) { if (oldAddr[ai]) oldNBlk++; else break; }
    addrArr = oldAddr.slice();
    if (nBlocks > oldNBlk) {
      var extra = v6DskAllocChainBlocks(disk, nBlocks - oldNBlk);
      for (var xi = 0; xi < extra.length; xi++) addrArr[oldNBlk + xi] = extra[xi];
    }
  } else {
    // 新規作成: 空き inode + チェーンブロック + ディレクトリエントリ
    newIno = v6DskFindFreeInode(disk, 199);
    if (newIno < 0) throw new Error('空き inode なし');
    var blks = v6DskAllocChainBlocks(disk, nBlocks);
    addrArr  = [0, 0, 0, 0, 0, 0, 0, 0];
    for (var bi = 0; bi < nBlocks; bi++) addrArr[bi] = blks[bi];
  }

  // データブロックにコンテンツを書き込む
  for (var bj = 0; bj < nBlocks; bj++) {
    var blkOff = addrArr[bj] * V6_BLOCK_SIZE;
    var srcOff = bj * V6_BLOCK_SIZE;
    for (var zi = 0; zi < V6_BLOCK_SIZE; zi++) disk[blkOff + zi] = 0;
    var cpLen = Math.min(V6_BLOCK_SIZE, contentBytes.length - srcOff);
    for (var ci = 0; ci < cpLen; ci++) disk[blkOff + ci] = contentBytes[srcOff + ci];
  }

  // inode を書き込む（IALLOC | 通常ファイル | rw-r--r-- = 0x81A4）
  v6DskWriteInode(disk, newIno, {
    mode: 0x81A4, nlink: 1, uid: 0, gid: 0,
    size: contentBytes.length, addr: addrArr
  });

  // 新規の場合のみディレクトリエントリを追加
  if (!existing && !v6DskAddTmpEntry(disk, newIno, fname)) {
    throw new Error('/tmp: 空きディレクトリエントリなし');
  }

  return { ino: newIno, path: '/tmp/' + fname };
}

// ── 汎用ディレクトリ操作 ──────────────────────────────────────────────────────

// 任意ディレクトリのエントリを名前で検索。戻り値: { off, ino } or null
function v6DirFindEntry(disk, dirInoNum, name) {
  var dirIno = v6ReadInode(disk, dirInoNum);
  var total  = Math.floor(dirIno.size / 16);
  var count  = 0;
  for (var bi = 0; bi < 8 && count < total; bi++) {
    var blkNum = dirIno.addr[bi];
    if (!blkNum) { count += 32; continue; }
    var blkBase   = blkNum * V6_BLOCK_SIZE;
    var inBlock   = Math.min(32, total - count);
    for (var ei = 0; ei < inBlock; ei++) {
      var off  = blkBase + ei * 16;
      var eIno = disk[off] | (disk[off + 1] << 8);
      if (eIno !== 0) {
        var eName = '';
        for (var ni = 0; ni < 14; ni++) {
          var c = disk[off + 2 + ni]; if (c === 0) break;
          eName += String.fromCharCode(c);
        }
        if (eName === name) return { off: off, ino: eIno };
      }
      count++;
    }
  }
  return null;
}

// 任意ディレクトリのエントリを削除（ino を 0 に）。戻り値: boolean
function v6DirRemoveEntry(disk, dirInoNum, name) {
  var entry = v6DirFindEntry(disk, dirInoNum, name);
  if (!entry) return false;
  disk[entry.off]     = 0;
  disk[entry.off + 1] = 0;
  return true;
}

// 任意ディレクトリの空きスロット (ino=0) にエントリを追加。戻り値: boolean
function v6DirAddEntry(disk, dirInoNum, name, newIno) {
  var dirIno = v6ReadInode(disk, dirInoNum);
  var total  = Math.floor(dirIno.size / 16);
  var count  = 0;
  for (var bi = 0; bi < 8 && count < total; bi++) {
    var blkNum = dirIno.addr[bi];
    if (!blkNum) { count += 32; continue; }
    var blkBase = blkNum * V6_BLOCK_SIZE;
    var inBlock = Math.min(32, total - count);
    for (var ei = 0; ei < inBlock; ei++) {
      var off  = blkBase + ei * 16;
      if ((disk[off] | (disk[off + 1] << 8)) === 0) {
        v6DskWrU16(disk, off, newIno);
        for (var ni = 0; ni < 14; ni++)
          disk[off + 2 + ni] = ni < name.length ? name.charCodeAt(ni) & 0x7F : 0;
        return true;
      }
      count++;
    }
  }
  return false;
}

// / を再帰的にリストして {name,path,ino,size,isDir,mode} の配列を返す
function v6RecurseDir(disk, dirIno, dirPath, results, depth) {
  if (depth <= 0) return;
  var inode   = v6ReadInode(disk, dirIno);
  var entries = v6ListDir(disk, inode);
  for (var ei = 0; ei < entries.length; ei++) {
    var e = entries[ei];
    if (e.name === '.' || e.name === '..') continue;
    var childPath = dirPath === '/' ? '/' + e.name : dirPath + '/' + e.name;
    var childIno  = v6ReadInode(disk, e.ino);
    var isDir     = !!(childIno.mode & 0x4000);
    results.push({
      name:  e.name,
      path:  childPath,
      ino:   e.ino,
      size:  childIno.size,
      isDir: isDir,
      mode:  childIno.mode
    });
    if (isDir && depth > 1) v6RecurseDir(disk, e.ino, childPath, results, depth - 1);
  }
}

// ── メッセージハンドラ ────────────────────────────────────────────────────
self.onmessage = function (e) {
  var d = e.data;
  switch (d.type) {
    case 'start':
      startSim(d.disk);
      break;

    case 'key':
      keyQueue.push(d.ch);  // diskReady を待たず先行入力バッファとして機能
      break;

    case 'send_str':
      for (var si = 0; si < d.str.length; si++) keyQueue.push(d.str.charCodeAt(si));
      break;

    case 'reset':
      running = false;
      macroSegments = []; macroSegIdx = 0; macroExpect = null;
      keyQueue = [];  // リセット時に先行入力バッファをクリア
      if (diskReady) {
        Module._sim_init();
        lastRingHead = 0;
        mmuFrameCnt  = 0;
        running = true;
        postMessage({ type: 'started' });
        scheduleNext();
      }
      break;

    case 'pause':
      running = false;
      postMessage({ type: 'paused' });
      break;

    case 'resume':
      if (!running && diskReady) {
        if (Module._sim_clear_trigger) Module._sim_clear_trigger();
        running = true;
        postMessage({ type: 'resumed' });
        scheduleNext();
      }
      break;

    // ── ベアメタルモード ──────────────────────────────────────────────────

    // Playwright テスト用: トリガー設定と実行開始をアトミックに行う。
    // resume + set_trigger を別メッセージで送ると setTimeout(simLoop,0) が
    // set_trigger より先に発火する競合が生じるため、1 メッセージにまとめる。
    case 'set_trigger_and_run': {
      if (Module._sim_clear_trigger) Module._sim_clear_trigger();
      var taType = (d.trigType !== undefined) ? (d.trigType | 0) : 1;
      var taVal  = (d.val     !== undefined) ? (d.val  >>> 0) : (d.pc >>> 0);
      _curTrigType = taType;
      if (Module._sim_set_trigger) {
        Module._sim_set_trigger(taType, taVal);
      } else if (Module._sim_set_pc_trigger) {
        Module._sim_set_pc_trigger(taVal);
      }
      diskReady = true;
      running   = true;
      postMessage({ type: 'resumed' });
      scheduleNext();
      break;
    }

    // Unix V6 ブートなし: RAM クリア + initial_pc 設定 + リセット
    case 'init_bare':
      if (Module._sim_init_bare) {
        Module._sim_init_bare(d.start_pc >>> 0);
        RING_WORDS  = Module._get_ring_words ? Module._get_ring_words() : RING_WORDS;
        RING_SIZE   = Module._get_ring_size  ? Module._get_ring_size()  : RING_SIZE;
        diskReady   = true;   // ディスク不要なのでそのまま実行可能
        running     = false;
        postMessage({ type: 'bare_ready', start_pc: d.start_pc });
      }
      break;

    // ベアメタル: バイトアドレス byte_addr にワードを書く
    case 'write_word':
      if (Module._sim_write_word) Module._sim_write_word(d.addr >>> 0, d.word >>> 0);
      break;

    // メモリプローブアドレス設定（LA の M1 信号用: 0xFFFFFFFF でプローブ無効）
    case 'set_mem_probe':
      if (Module._sim_set_mem_probe) Module._sim_set_mem_probe(d.addr >>> 0);
      break;

    // ベアメタル: トリガーなしで n_ticks だけ進める（ポストトリガー用）
    case 'step_bare': {
      var n = (d.n | 0);
      if (Module._sim_step_bare) Module._sim_step_bare(n);
      _sendRing();
      _sendGPR();
      postMessage({ type: 'bare_stepped' });
      break;
    }

    case 'set_trigger': {
      var stType = (d.trigType !== undefined) ? (d.trigType | 0) : 1;
      var stVal  = (d.val     !== undefined) ? (d.val  >>> 0) : (d.pc >>> 0);
      _curTrigType = stType;
      if (Module._sim_set_trigger) {
        Module._sim_set_trigger(stType, stVal);
      } else if (Module._sim_set_pc_trigger) {
        Module._sim_set_pc_trigger(stVal);
      }
      break;
    }

    case 'clear_trigger':
      _curTrigType = 0;
      _exprEval    = null;
      if (Module._sim_clear_trigger) Module._sim_clear_trigger();
      break;

    case 'speed':
      stepsPerFrame = d.steps | 0;
      break;

    // Speed セレクタ用（固定速度モード）
    case 'setSpeed':
      stepsPerFrame = d.steps | 0;
      _speedFixed   = true;
      break;

    case 'setLA':
      _laEnabled = !!d.enabled;
      break;

    case 'set_ring_tick_mask':
      if (Module._sim_set_ring_tick_mask) Module._sim_set_ring_tick_mask(d.mask >>> 0);
      break;

    case 'set_expr_trigger': {
      // UI スレッドが trigCompileToWasm() で生成した Wasm バイト列を受け取り
      // ここで同期インスタンス化する（Worker 内では同期 new WebAssembly.Module が許可されている）
      _exprEval = null;
      _curTrigType = 7;
      try {
        var _eMod  = new WebAssembly.Module(new Uint8Array(d.wasmBytes));
        var _eInst = new WebAssembly.Instance(_eMod, {});
        _exprEval  = _eInst.exports.eval;
      } catch (_eErr) {
        postMessage({ type: 'scriptWarn', msg: '式トリガー Wasm 初期化失敗: ' + _eErr.message });
      }
      break;
    }

    case 'exportDisk': {
      try {
        var _disk = Module.FS.readFile('/disk0.rk');
        postMessage({ type: 'diskExported', data: _disk.buffer }, [_disk.buffer]);
      } catch(_e) {
        postMessage({ type: 'diskExportError', msg: String(_e) });
      }
      break;
    }

    case 'poll_mmu':
      _sendMMU();
      break;

    // ── Freeze 機能 ───────────────────────────────────────────────────────
    // LA の表示を一時停止するためにシミュレーションを止める
    case 'step':
      if (!running) {
        Module._step_n(d.n || 300);
        var _sc = [];
        var _sch;
        while ((_sch = Module._get_display_char()) !== -1) _sc.push(_sch & 0x7F);
        if (_sc.length > 0) postMessage({ type: 'tty', chars: _sc });
        _sendRing();
        _sendGPR();
        postMessage({ type: 'stepped' });
      }
      break;

    case 'freeze':
      running = false;
      _sendRing();
      postMessage({ type: 'frozen' });
      break;

    case 'unfreeze':
      if (!running && diskReady) {
        running = true;
        postMessage({ type: 'unfrozen' });
        scheduleNext();
      }
      break;

    // ── Unix V6 FS 操作 ──────────────────────────────────────────────────
    // V6 ディスクイメージを直接パースして再帰的にリストを返す
    case 'listFS': {
      v6SyncDiskFromFS();  // WASM 側の最新ディスクを取得してから読む
      if (!diskData) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'ディスクが未ロードです' });
        break;
      }
      var lsPath = d.path || '/';
      var results = [];
      try {
        var lsIno = lsPath === '/' ? V6_ROOT_INODE : v6FindPath(diskData, lsPath);
        if (lsIno < 0) throw new Error('パスが見つかりません: ' + lsPath);
        var lsDirIno = v6ReadInode(diskData, lsIno);
        if (!(lsDirIno.mode & 0x4000)) throw new Error('ディレクトリではありません: ' + lsPath);
        var lsEntries = v6ListDir(diskData, lsDirIno);
        for (var lei = 0; lei < lsEntries.length; lei++) {
          var le = lsEntries[lei];
          if (le.name === '.' || le.name === '..') continue;
          var leChild = lsPath === '/' ? '/' + le.name : lsPath + '/' + le.name;
          var leIno   = v6ReadInode(diskData, le.ino);
          var leIsDir = !!(leIno.mode & 0x4000);
          results.push({
            name:  le.name,
            path:  leChild,
            ino:   le.ino,
            size:  leIno.size,
            isDir: leIsDir,
            mode:  leIno.mode,
            mtime: leIno.mtime
          });
        }
      } catch (err) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'listFS 失敗: ' + err.message });
        break;
      }
      postMessage({ type: 'fsEntries', requestId: d.requestId, entries: results, path: lsPath });
      break;
    }

    // V6 ディスクからファイル内容を読み出して返す
    case 'readFS': {
      v6SyncDiskFromFS();
      if (!diskData) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'ディスクが未ロードです' });
        break;
      }
      try {
        var ino = v6FindPath(diskData, d.path);
        if (ino === -1) throw new Error('ファイルが見つかりません: ' + d.path);
        var inode = v6ReadInode(diskData, ino);
        var fdata = v6ReadFile(diskData, inode);
        var buf   = fdata.slice().buffer;
        postMessage({ type: 'fsFile', requestId: d.requestId, path: d.path, data: buf }, [buf]);
      } catch (err) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'readFS 失敗: ' + err.message });
      }
      break;
    }

    // V6 FS ファイル削除（ディレクトリエントリを ino=0 にして nlink を減らす）
    case 'removeV6File': {
      if (!diskData) { postMessage({ type: 'v6OpError', op: 'remove', msg: 'ディスク未ロード' }); break; }
      try {
        var rmPath  = d.path;
        var rmParts = rmPath.split('/').filter(function(p) { return p.length > 0; });
        if (rmParts.length === 0) throw new Error('無効なパス');
        var rmName   = rmParts[rmParts.length - 1];
        var rmDirPth = rmParts.length === 1 ? '/' : ('/' + rmParts.slice(0, -1).join('/'));
        var rmDirIno = rmDirPth === '/' ? V6_ROOT_INODE : v6FindPath(diskData, rmDirPth);
        if (rmDirIno < 0) throw new Error('ディレクトリが見つかりません: ' + rmDirPth);
        var rmEnt = v6DirFindEntry(diskData, rmDirIno, rmName);
        if (!rmEnt) throw new Error('ファイルが見つかりません: ' + rmPath);
        var rmIno = v6ReadInode(diskData, rmEnt.ino);
        v6DskWriteInode(diskData, rmEnt.ino, {
          mode: rmIno.mode, nlink: Math.max(0, rmIno.nlink - 1),
          uid: rmIno.uid, gid: 0, size: rmIno.size, addr: rmIno.addr
        });
        v6DirRemoveEntry(diskData, rmDirIno, rmName);
        v6FlushDiskToFS();  // WASM 側にも反映
        postMessage({ type: 'v6OpDone', op: 'remove', path: rmPath });
      } catch (e) {
        postMessage({ type: 'v6OpError', op: 'remove', msg: e.message });
      }
      break;
    }

    // V6 FS ファイル移動（ディレクトリエントリを移動先に再登録）
    case 'moveV6File': {
      if (!diskData) { postMessage({ type: 'v6OpError', op: 'move', msg: 'ディスク未ロード' }); break; }
      try {
        var mvSrc    = d.srcPath;
        var mvDst    = d.dstDir;
        var mvParts  = mvSrc.split('/').filter(function(p) { return p.length > 0; });
        var mvFname  = mvParts[mvParts.length - 1];
        var mvSrcDir = mvParts.length === 1 ? '/' : ('/' + mvParts.slice(0, -1).join('/'));
        var mvSrcIno = mvSrcDir === '/' ? V6_ROOT_INODE : v6FindPath(diskData, mvSrcDir);
        if (mvSrcIno < 0) throw new Error('移動元ディレクトリが見つかりません: ' + mvSrcDir);
        var mvDstIno = mvDst === '/' ? V6_ROOT_INODE : v6FindPath(diskData, mvDst);
        if (mvDstIno < 0) throw new Error('移動先ディレクトリが見つかりません: ' + mvDst);
        var mvEnt = v6DirFindEntry(diskData, mvSrcIno, mvFname);
        if (!mvEnt) throw new Error('ファイルが見つかりません: ' + mvSrc);
        if (v6DirFindEntry(diskData, mvDstIno, mvFname))
          throw new Error('移動先に同名ファイルがあります: ' + mvDst + '/' + mvFname);
        if (!v6DirAddEntry(diskData, mvDstIno, mvFname, mvEnt.ino))
          throw new Error('移動先に空きディレクトリエントリがありません: ' + mvDst);
        v6DirRemoveEntry(diskData, mvSrcIno, mvFname);
        v6FlushDiskToFS();  // WASM 側にも反映
        postMessage({ type: 'v6OpDone', op: 'move', srcPath: mvSrc, dstDir: mvDst });
      } catch (e) {
        postMessage({ type: 'v6OpError', op: 'move', msg: e.message });
      }
      break;
    }

    // Emscripten FS（/）に書き込む（スクリプト保存用）
    case 'writeFS': {
      try {
        var arr = new Uint8Array(d.data);
        Module.FS.writeFile('/' + d.name, arr);
        postMessage({ type: 'fsWritten', requestId: d.requestId, name: d.name });
      } catch (err) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'writeFS 失敗: ' + err.message });
      }
      break;
    }

    // Emscripten FS からスクリプトファイルを削除
    case 'deleteFS': {
      try {
        Module.FS.unlink('/' + d.name);
        postMessage({ type: 'fsDeleted', requestId: d.requestId, name: d.name });
      } catch (err) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'deleteFS 失敗: ' + err.message });
      }
      break;
    }

    // Emscripten FS ファイル一覧を返す（スクリプト用）
    case 'listWasmFS': {
      try {
        var wfAll = Module.FS.readdir('/');
        var wfRes = [];
        for (var wfi = 0; wfi < wfAll.length; wfi++) {
          var wfn = wfAll[wfi];
          if (wfn === '.' || wfn === '..' || wfn === 'disk0.rk' || wfn[0] === '_') continue;
          try {
            var wst = Module.FS.stat('/' + wfn);
            if (Module.FS.isFile(wst.mode)) wfRes.push({ name: wfn, size: wst.size });
          } catch(we) { /* スキップ */ }
        }
        postMessage({ type: 'wasmFSEntries', requestId: d.requestId, entries: wfRes });
      } catch (err) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'listWasmFS 失敗: ' + err.message });
      }
      break;
    }

    // Emscripten FS ファイルを読み込んで返す（ダウンロード用）
    case 'readWasmFS': {
      try {
        var wrd = Module.FS.readFile('/' + d.name);
        var wrb = wrd.buffer.slice(wrd.byteOffset, wrd.byteOffset + wrd.byteLength);
        postMessage({ type: 'wasmFSFile', requestId: d.requestId, name: d.name, data: wrb }, [wrb]);
      } catch (err) {
        postMessage({ type: 'fsError', requestId: d.requestId, msg: 'readWasmFS 失敗: ' + err.message });
      }
      break;
    }

    // ── マクロ（!script）制御 ────────────────────────────────────────────
    // スクリプトファイルを Emscripten FS → V6 FS の順で探してパース・再生する
    case 'scriptRun': {
      var sname = d.name;
      var raw;
      // まず Emscripten FS から読む（アップロードされたスクリプト優先）
      try {
        raw = Module.FS.readFile('/' + sname);
      } catch (e) {
        raw = null;
        // Emscripten FS になければ V6 FS から読む
        if (diskData) {
          try {
            var sPath = d.path || '/' + sname;
            var sIno  = v6FindPath(diskData, sPath);
            if (sIno !== -1) {
              raw = v6ReadFile(diskData, v6ReadInode(diskData, sIno));
            }
          } catch (e2) { raw = null; }
        }
        if (!raw) {
          postMessage({ type: 'fsError', requestId: d.requestId, msg: sname + ': not found' });
          break;
        }
      }

      var text  = new TextDecoder('utf-8', { fatal: false }).decode(raw);
      var lines = text.split(/\r\n|\r|\n/);
      var segs  = [];
      var cbuf  = [];

      function _flushChars() {
        if (cbuf.length > 0) {
          segs.push({ type: 'chars', data: new Uint8Array(cbuf), pos: 0 });
          cbuf = [];
        }
      }

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];

        // !sleep N
        var mSleep = line.match(/^!sleep\s+(\d+)\s*$/i);
        if (mSleep) {
          _flushChars();
          segs.push({ type: 'sleep', ms: parseInt(mSleep[1], 10), until: 0 });
          continue;
        }

        // !expect STR [MS]  (\r と \n のエスケープシーケンスを展開)
        var mExpect = line.match(/^!expect\s+(\S+)(?:\s+(\d+))?\s*$/i);
        if (mExpect) {
          _flushChars();
          var expStr = mExpect[1].replace(/\\r/g, '\r').replace(/\\n/g, '\n');
          var expMs  = mExpect[2] ? parseInt(mExpect[2], 10) : 200;
          segs.push({ type: 'expect', str: expStr, ms: expMs, deadline: 0 });
          continue;
        }

        // 通常テキスト行: ^Z 除去 + 行末 CR を追加
        for (var ci = 0; ci < line.length; ci++) {
          if (line.charCodeAt(ci) !== 26) cbuf.push(line.charCodeAt(ci));
        }
        cbuf.push(13);  // 行末 CR
      }
      _flushChars();

      macroSegments = segs;
      macroSegIdx   = 0;
      macroExpect   = null;

      var total = segs.reduce(function(s, sg) {
        return s + (sg.type === 'chars' ? sg.data.length : 0);
      }, 0);
      postMessage({ type: 'scriptStarted', name: sname, total: total });
      break;
    }

    case 'scriptStop':
      macroSegments = [];
      macroSegIdx   = 0;
      macroExpect   = null;
      postMessage({ type: 'scriptEnded' });
      break;

    // V6 FS への直接書き込み（TTY バイパス）
    case 'v6WriteFile': {
      try {
        var wRaw = Module.FS.readFile('/disk0.rk');
        var wDsk = wRaw.slice();  // 書き込み可能なコピー
        var wContent = new Uint8Array(d.content);
        var wResult  = v6DskWriteFile(wDsk, d.path, wContent);
        Module.FS.writeFile('/disk0.rk', wDsk);
        diskData = wDsk;  // V6 FS リーダーキャッシュを更新
        postMessage({ type: 'v6WriteFileDone', requestId: d.requestId,
                      path: wResult.path, ino: wResult.ino });
      } catch (werr) {
        postMessage({ type: 'v6WriteFileError', requestId: d.requestId,
                      error: werr.message });
      }
      break;
    }
  }
};
