// make-disk.mjs — テスト用の合成 V6 ミニディスクイメージを組み立てる
//
// レイアウト（1000 ブロック = 512000 バイト）:
//   block 0      : boot（未使用）
//   block 1      : superblock（s_isize=15, s_nfree=10, s_free[0]=chain block 20）
//   block 2-16   : inode テーブル（15 ブロック = inode 1-240、/tmp の ino 96 を含む）
//   block 20     : free チェーンブロック（blocks 30-39 を保持）
//   block 25     : / ディレクトリデータ
//   block 26     : /hello.txt データ
//   block 27     : large.bin の間接ブロック
//   block 28, 29 : large.bin データ（600 バイト）
//   block 41     : /usr/sub.txt データ
//   block 42     : /usr ディレクトリデータ
//   block 101    : /tmp ディレクトリ block 1（V6_TMP_DIR_BL2）
//   block 817    : /tmp ディレクトリ block 0（V6_TMP_DIR_BLK）
//
// inode 割り当て:
//   ino 1 : / （dir）
//   ino 2 : /hello.txt（"Hello, V6!\n" 11 バイト）
//   ino 3 : /large.bin（large flag、間接ブロック経由 600 バイト）
//   ino 4 : /usr（dir、子に sub.txt = ino 5、空きスロット 1 個）
//   ino 5 : /usr/sub.txt（"sub\n" 4 バイト）
//   ino 96: /tmp（dir、addr[0]=817, addr[1]=101）
//
// 注: v6DskWriteFile は ino 199 以降の空き inode を使う。
//     maxIno = (s_isize - 2) * 16 = 208 のため s_isize=15 が必要。

const BLOCK = 512;
const INODE_SIZE = 32;
const INODE_START = 2;

function wrU16(disk, off, val) {
  disk[off] = val & 0xFF;
  disk[off + 1] = (val >> 8) & 0xFF;
}

function writeInode(disk, ino, { mode, nlink = 1, uid = 0, size = 0, addr = [] }) {
  const idx = ino - 1;
  const base = (INODE_START + Math.floor(idx / 16)) * BLOCK + (idx % 16) * INODE_SIZE;
  wrU16(disk, base, mode);
  disk[base + 2] = nlink;
  disk[base + 3] = uid;
  disk[base + 5] = (size >>> 16) & 0xFF;  // i_size0（offset 4 は i_gid）
  wrU16(disk, base + 6, size & 0xFFFF);
  for (let i = 0; i < 8; i++) wrU16(disk, base + 8 + i * 2, addr[i] || 0);
}

function writeDirEntry(disk, blockNo, slot, ino, name) {
  const off = blockNo * BLOCK + slot * 16;
  wrU16(disk, off, ino);
  for (let i = 0; i < 14; i++) {
    disk[off + 2 + i] = i < name.length ? name.charCodeAt(i) : 0;
  }
}

export function makeTestDisk() {
  const disk = new Uint8Array(1000 * BLOCK);

  // superblock (block 1): s_isize=15（inode ブロック数）, s_nfree=10, s_free[0]=20
  const sb = BLOCK;
  wrU16(disk, sb, 15);       // s_isize
  wrU16(disk, sb + 4, 10);   // s_nfree
  wrU16(disk, sb + 6, 20);   // s_free[0] = chain block

  // free チェーンブロック (block 20): cNfree=10, blocks 30..39
  wrU16(disk, 20 * BLOCK, 10);
  for (let i = 0; i < 10; i++) wrU16(disk, 20 * BLOCK + 2 + i * 2, 30 + i);

  // ino 1: / — IALLOC|IFDIR|0755 = 0xC1ED, エントリ 6 個 = 96 バイト
  writeInode(disk, 1, { mode: 0xC1ED, nlink: 2, size: 6 * 16, addr: [25] });
  writeDirEntry(disk, 25, 0, 1, '.');
  writeDirEntry(disk, 25, 1, 1, '..');
  writeDirEntry(disk, 25, 2, 2, 'hello.txt');
  writeDirEntry(disk, 25, 3, 3, 'large.bin');
  writeDirEntry(disk, 25, 4, 4, 'usr');
  writeDirEntry(disk, 25, 5, 96, 'tmp');

  // ino 2: /hello.txt — IALLOC|0644 = 0x81A4
  const hello = 'Hello, V6!\n';
  writeInode(disk, 2, { mode: 0x81A4, size: hello.length, addr: [26] });
  for (let i = 0; i < hello.length; i++) disk[26 * BLOCK + i] = hello.charCodeAt(i);

  // ino 3: /large.bin — IALLOC|ILARG|0644 = 0x91A4、間接ブロック 27 → データ 28,29
  writeInode(disk, 3, { mode: 0x91A4, size: 600, addr: [27] });
  wrU16(disk, 27 * BLOCK, 28);
  wrU16(disk, 27 * BLOCK + 2, 29);
  for (let i = 0; i < 512; i++) disk[28 * BLOCK + i] = i & 0xFF;        // block 28: 0..255 繰り返し
  for (let i = 0; i < 88; i++)  disk[29 * BLOCK + i] = 0xAA;            // block 29: 先頭 88 バイト

  // ino 4: /usr — dir、エントリ 3 個 + 空きスロット 1 個（size は 4 エントリ分）
  writeInode(disk, 4, { mode: 0xC1ED, nlink: 2, size: 4 * 16, addr: [42] });
  writeDirEntry(disk, 42, 0, 4, '.');
  writeDirEntry(disk, 42, 1, 1, '..');
  writeDirEntry(disk, 42, 2, 5, 'sub.txt');
  // slot 3 は ino=0 のまま（削除済みエントリの穴を模擬）

  // ino 5: /usr/sub.txt
  const sub = 'sub\n';
  writeInode(disk, 5, { mode: 0x81A4, size: sub.length, addr: [41] });
  for (let i = 0; i < sub.length; i++) disk[41 * BLOCK + i] = sub.charCodeAt(i);

  // ino 96: /tmp — dir、addr[0]=817（32 エントリ）, addr[1]=101（1 エントリ）
  writeInode(disk, 96, { mode: 0xC1ED, nlink: 2, size: 33 * 16, addr: [817, 101] });
  writeDirEntry(disk, 817, 0, 96, '.');
  writeDirEntry(disk, 817, 1, 1, '..');

  return disk;
}
