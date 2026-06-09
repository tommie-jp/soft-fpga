'use strict';
// sft-v6fs.js — Unix V6 ファイルシステム パーサ / ライタ（純粋関数ライブラリ）
//
// RK05 ディスクイメージ（Unix V6 形式）を Uint8Array として直接読み書きする。
// Module / postMessage 等の Worker 依存は一切持たない。
// 利用元: examples/09-pdp11/web/sim-worker.js（importScripts で読み込み）
// テスト: examples/09-pdp11/tests/v6fs/v6fs.test.mjs
// 参考: Lions' Commentary on UNIX 6th Edition (filesystem.h / inode.h)

var V6_BLOCK_SIZE       = 512;  // バイト/ブロック
var V6_INODE_SIZE       = 32;   // バイト/inode
var V6_INODES_PER_BLOCK = 16;   // V6_BLOCK_SIZE / V6_INODE_SIZE
var V6_INODE_START      = 2;    // inode テーブル開始ブロック番号
var V6_ROOT_INODE       = 1;    // ルートディレクトリの inode 番号（1-indexed）

// ── 読み取り ──────────────────────────────────────────────────────────────

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
  var uid   = dv.getUint8(3);          // i_uid（offset 4 は i_gid）
  // i_size0 (1 byte, offset 5) + i_size1 (2 bytes LE, offset 6) で 3-byte ファイルサイズ
  var size  = (dv.getUint8(5) << 16) | dv.getUint16(6, true);
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
    for (var aj = 0; aj < 8 && written < size; aj++) {
      var indBlk = inode.addr[aj];
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

// ── 書き込みサポート ──────────────────────────────────────────────────────
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

// ── 汎用ディレクトリ操作 ──────────────────────────────────────────────────

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

// dirIno 以下を再帰的にリストして {name,path,ino,size,isDir,mode} を results に積む
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
