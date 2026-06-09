// v6fs.test.mjs — sft-v6fs.js (Unix V6 FS パーサ/ライタ) ユニットテスト
//
// 合成ミニディスク（make-disk.mjs）に対して読み書き API を検証する。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  V6_BLOCK_SIZE, V6_ROOT_INODE, V6_TMP_INO,
  v6ReadBlock, v6ReadInode, v6ListDir, v6FindPath, v6ReadFile,
  v6DskWrU16, v6DskWriteInode, v6DskAllocChainBlocks,
  v6DskFindTmpEntry, v6DskAddTmpEntry, v6DskFindFreeInode,
  v6ValidateName, v6DskWriteFile,
  v6DirFindEntry, v6DirRemoveEntry, v6DirAddEntry, v6RecurseDir,
} from './helpers/load-v6fs.mjs';
import { makeTestDisk } from './helpers/make-disk.mjs';

let disk;
beforeEach(() => { disk = makeTestDisk(); });

// ── 読み取り ──────────────────────────────────────────────────────────────

describe('v6ReadBlock', () => {
  it('512 バイトのブロックを返す', () => {
    const blk = v6ReadBlock(disk, 26);
    expect(blk.length).toBe(V6_BLOCK_SIZE);
    expect(String.fromCharCode(...blk.slice(0, 5))).toBe('Hello');
  });

  it('範囲外ブロックはゼロ埋めを返す', () => {
    const blk = v6ReadBlock(disk, 99999);
    expect(blk.length).toBe(V6_BLOCK_SIZE);
    expect(blk.every((b) => b === 0)).toBe(true);
  });
});

describe('v6ReadInode', () => {
  it('ルート inode を読み取る (dir mode / nlink / size / addr)', () => {
    const ino = v6ReadInode(disk, V6_ROOT_INODE);
    expect(ino.mode & 0x4000).toBeTruthy();
    expect(ino.nlink).toBe(2);
    expect(ino.size).toBe(6 * 16);
    expect(ino.addr[0]).toBe(25);
  });

  it('通常ファイル inode を読み取る', () => {
    const ino = v6ReadInode(disk, 2);
    expect(ino.mode).toBe(0x81A4);
    expect(ino.size).toBe(11);
    expect(ino.addr[0]).toBe(26);
  });
});

describe('v6ListDir', () => {
  it('ルートディレクトリのエントリを列挙する', () => {
    const entries = v6ListDir(disk, v6ReadInode(disk, V6_ROOT_INODE));
    const names = entries.map((e) => e.name);
    expect(names).toContain('.');
    expect(names).toContain('hello.txt');
    expect(names).toContain('usr');
    expect(names).toContain('tmp');
  });

  it('ino=0 のスロットはスキップする', () => {
    const entries = v6ListDir(disk, v6ReadInode(disk, V6_TMP_INO));
    expect(entries.map((e) => e.name)).toEqual(['.', '..']);
  });
});

describe('v6FindPath', () => {
  it('/ はルート inode を返す', () => {
    expect(v6FindPath(disk, '/')).toBe(V6_ROOT_INODE);
  });

  it('ファイル・ネストパスを解決する', () => {
    expect(v6FindPath(disk, '/hello.txt')).toBe(2);
    expect(v6FindPath(disk, '/usr/sub.txt')).toBe(5);
    expect(v6FindPath(disk, '/tmp')).toBe(V6_TMP_INO);
  });

  it('存在しないパスは -1', () => {
    expect(v6FindPath(disk, '/nope')).toBe(-1);
    expect(v6FindPath(disk, '/hello.txt/x')).toBe(-1);  // ファイルを dir として辿る
  });
});

describe('v6ReadFile', () => {
  it('直接ブロックの小ファイルを読む', () => {
    const data = v6ReadFile(disk, v6ReadInode(disk, 2));
    expect(new TextDecoder().decode(data)).toBe('Hello, V6!\n');
  });

  it('large フラグの間接ブロックファイルを読む', () => {
    const data = v6ReadFile(disk, v6ReadInode(disk, 3));
    expect(data.length).toBe(600);
    expect(data[0]).toBe(0);
    expect(data[255]).toBe(255);
    expect(data[512]).toBe(0xAA);
    expect(data[599]).toBe(0xAA);
  });
});

// ── 低レベル書き込み ───────────────────────────────────────────────────────

describe('v6DskWrU16', () => {
  it('リトルエンディアンで 16bit を書く', () => {
    v6DskWrU16(disk, 0, 0x1234);
    expect(disk[0]).toBe(0x34);
    expect(disk[1]).toBe(0x12);
  });
});

describe('v6DskWriteInode / v6ReadInode ラウンドトリップ', () => {
  it('書いた inode を読み戻せる', () => {
    v6DskWriteInode(disk, 10, {
      mode: 0x81A4, nlink: 1, uid: 3, gid: 0,
      size: 0x12345, addr: [30, 31, 0, 0, 0, 0, 0, 0],
    });
    const ino = v6ReadInode(disk, 10);
    expect(ino.mode).toBe(0x81A4);
    expect(ino.uid).toBe(3);
    expect(ino.size).toBe(0x12345);  // 3 バイトサイズ (size0 << 16 | size1)
    expect(ino.addr[0]).toBe(30);
    expect(ino.addr[1]).toBe(31);
  });
});

describe('v6DskAllocChainBlocks', () => {
  it('チェーンブロックから先頭エントリを返す', () => {
    expect(v6DskAllocChainBlocks(disk, 3)).toEqual([30, 31, 32]);
  });

  it('チェーンより多い要求は throw', () => {
    expect(() => v6DskAllocChainBlocks(disk, 11)).toThrow(/chain too small/);
  });

  it('s_nfree=0 は disk full を throw', () => {
    v6DskWrU16(disk, V6_BLOCK_SIZE + 4, 0);
    expect(() => v6DskAllocChainBlocks(disk, 1)).toThrow(/disk full/);
  });
});

describe('v6DskFindFreeInode', () => {
  it('mode=0 の空き inode を返す', () => {
    const ino = v6DskFindFreeInode(disk, 6);
    expect(ino).toBe(6);  // ino 1-5, 96 以外は未使用
  });

  it('使用中はスキップする', () => {
    expect(v6DskFindFreeInode(disk, 96)).toBe(97);
  });
});

describe('v6ValidateName', () => {
  it('有効な名前を許可する', () => {
    expect(v6ValidateName('hello.c')).toBeTruthy();
    expect(v6ValidateName('a'.repeat(14))).toBeTruthy();
  });

  it('無効な名前を拒否する', () => {
    expect(v6ValidateName('')).toBeFalsy();
    expect(v6ValidateName('a'.repeat(15))).toBeFalsy();
    expect(v6ValidateName('a b')).toBeFalsy();    // スペース
    expect(v6ValidateName('日本語')).toBeFalsy();  // 非 ASCII
  });
});

// ── /tmp 専用書き込み ─────────────────────────────────────────────────────

describe('v6DskFindTmpEntry / v6DskAddTmpEntry', () => {
  it('追加したエントリを見つけられる', () => {
    expect(v6DskFindTmpEntry(disk, 'foo.c')).toBeNull();
    expect(v6DskAddTmpEntry(disk, 200, 'foo.c')).toBe(true);
    const ent = v6DskFindTmpEntry(disk, 'foo.c');
    expect(ent).not.toBeNull();
    expect(ent.ino).toBe(200);
  });
});

describe('v6DskWriteFile', () => {
  it('新規ファイルを /tmp に書き、パス解決と読み戻しができる', () => {
    const content = new TextEncoder().encode('main(){}\n');
    const res = v6DskWriteFile(disk, '/tmp/prog.c', content);
    expect(res.path).toBe('/tmp/prog.c');

    const ino = v6FindPath(disk, '/tmp/prog.c');
    expect(ino).toBe(res.ino);
    const data = v6ReadFile(disk, v6ReadInode(disk, ino));
    expect(new TextDecoder().decode(data)).toBe('main(){}\n');
  });

  it('既存ファイルを上書きしても inode 番号は変わらない', () => {
    const a = v6DskWriteFile(disk, '/tmp/x.txt', new TextEncoder().encode('one'));
    const b = v6DskWriteFile(disk, '/tmp/x.txt', new TextEncoder().encode('twotwo'));
    expect(b.ino).toBe(a.ino);
    const data = v6ReadFile(disk, v6ReadInode(disk, b.ino));
    expect(new TextDecoder().decode(data)).toBe('twotwo');
  });

  it('複数ブロックにまたがるファイルを書ける', () => {
    const content = new Uint8Array(1000).fill(0x42);
    const res = v6DskWriteFile(disk, '/tmp/big.bin', content);
    const data = v6ReadFile(disk, v6ReadInode(disk, res.ino));
    expect(data.length).toBe(1000);
    expect(data.every((x) => x === 0x42)).toBe(true);
  });

  it('4KB 超は throw', () => {
    expect(() => v6DskWriteFile(disk, '/tmp/huge', new Uint8Array(4097)))
      .toThrow(/大きすぎます/);
  });

  it('無効なファイル名は throw', () => {
    expect(() => v6DskWriteFile(disk, '/tmp/a b', new Uint8Array(1)))
      .toThrow(/無効なファイル名/);
  });
});

// ── 汎用ディレクトリ操作 ───────────────────────────────────────────────────

describe('v6DirFindEntry / v6DirRemoveEntry / v6DirAddEntry', () => {
  it('ルートのエントリを名前で見つける', () => {
    const ent = v6DirFindEntry(disk, V6_ROOT_INODE, 'hello.txt');
    expect(ent).not.toBeNull();
    expect(ent.ino).toBe(2);
  });

  it('削除するとエントリが消えパス解決も失敗する', () => {
    expect(v6DirRemoveEntry(disk, V6_ROOT_INODE, 'hello.txt')).toBe(true);
    expect(v6DirFindEntry(disk, V6_ROOT_INODE, 'hello.txt')).toBeNull();
    expect(v6FindPath(disk, '/hello.txt')).toBe(-1);
  });

  it('存在しないエントリの削除は false', () => {
    expect(v6DirRemoveEntry(disk, V6_ROOT_INODE, 'nope')).toBe(false);
  });

  it('削除→追加で移動を再現できる（moveV6File 相当）', () => {
    const ent = v6DirFindEntry(disk, V6_ROOT_INODE, 'hello.txt');
    expect(v6DirRemoveEntry(disk, V6_ROOT_INODE, 'hello.txt')).toBe(true);
    expect(v6DirAddEntry(disk, 4, 'hello.txt', ent.ino)).toBe(true);
    expect(v6FindPath(disk, '/usr/hello.txt')).toBe(2);
    expect(v6FindPath(disk, '/hello.txt')).toBe(-1);
  });
});

describe('v6RecurseDir', () => {
  it('depth=1 は直下のみ', () => {
    const results = [];
    v6RecurseDir(disk, V6_ROOT_INODE, '/', results, 1);
    const paths = results.map((r) => r.path);
    expect(paths).toContain('/hello.txt');
    expect(paths).toContain('/usr');
    expect(paths).not.toContain('/usr/sub.txt');
  });

  it('depth=2 はサブディレクトリも辿る', () => {
    const results = [];
    v6RecurseDir(disk, V6_ROOT_INODE, '/', results, 2);
    const paths = results.map((r) => r.path);
    expect(paths).toContain('/usr/sub.txt');
    const usr = results.find((r) => r.path === '/usr');
    expect(usr.isDir).toBe(true);
  });
});
