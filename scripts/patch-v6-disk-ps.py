#!/usr/bin/env python3
"""patch-v6-disk-ps.py — make `ps` / `ps -ag` work on the Unix V6 RK05 image.

The stock RK05 demo image cannot run `ps`:
  1. ps reads its namelist from /unix by default, but the booted kernel is
     /rkunix (a different build) -> wrong symbol addresses -> no output.
  2. ps refuses to run without a swap block-special whose device number equals
     the kernel's swapdev ("no swap device"), and /dev has no block devices.
     /etc/mknod itself traps (illegal instruction), so the node cannot be made
     from inside V6.

This script fixes both OFFLINE by editing the V6 filesystem directly:
  1. Hard-link /unix -> /rkunix (so the default namelist matches the kernel).
  2. Create /dev/rk0 and /dev/swap as block-special, dev == swapdev.

It is IDEMPOTENT: running it on an already-patched image is a no-op.
swapdev is auto-detected from /rkunix's symbol table (fallback: makedev(0,0)).

Usage:
  python3 scripts/patch-v6-disk-ps.py <disk.dsk> [<disk2.dsk> ...]
"""
import sys
import struct

BS = 512

# inode mode bits
IALLOC = 0o100000
IFMT   = 0o060000
IFDIR  = 0o040000
IFCHR  = 0o020000
IFBLK  = 0o060000
ILARG  = 0o010000

# superblock field offsets (within block 1)
SB_S_NINODE = 206
SB_S_INODE  = 208


class V6Disk:
    """Read/write helper for a V6 filesystem image held in memory."""

    def __init__(self, path):
        self.path = path
        with open(path, 'rb') as f:
            self.img = bytearray(f.read())

    # ── primitives ─────────────────────────────────────────────────────────
    def rword(self, off):
        return struct.unpack_from('<H', self.img, off)[0]

    def wword(self, off, val):
        struct.pack_into('<H', self.img, off, val & 0xFFFF)

    def blk(self, n):
        return self.img[n * BS:(n + 1) * BS]

    def inode_off(self, ino):
        return 2 * BS + (ino - 1) * 32

    def inode(self, ino):
        off = self.inode_off(ino)
        d = self.img[off:off + 32]
        mode, = struct.unpack_from('<H', d, 0)
        size0 = d[5]
        size1, = struct.unpack_from('<H', d, 6)
        addr = struct.unpack_from('<8H', d, 8)
        return dict(ino=ino, off=off, mode=mode, nlink=d[2],
                    size=(size0 << 16) | size1, addr=addr)

    # ── file data ──────────────────────────────────────────────────────────
    def data_blocks(self, ind):
        addr = ind['addr']
        if not (ind['mode'] & ILARG):
            return [a for a in addr if a]
        blocks = []
        for a in addr[:7]:
            if not a:
                continue
            ib = self.blk(a)
            blocks += [w for w, in struct.iter_unpack('<H', ib) if w]
        if addr[7]:
            for a, in struct.iter_unpack('<H', self.blk(addr[7])):
                if not a:
                    continue
                ib = self.blk(a)
                blocks += [w for w, in struct.iter_unpack('<H', ib) if w]
        return blocks

    def read_file(self, ind):
        data = b''.join(bytes(self.blk(b)) for b in self.data_blocks(ind))
        return data[:ind['size']]

    def readdir(self, ind):
        data = self.read_file(ind)
        out = []
        for i in range(0, len(data), 16):
            inum, = struct.unpack_from('<H', data, i)
            name = data[i + 2:i + 16].split(b'\0')[0].decode('latin1')
            out.append((i, inum, name))   # (slot_offset_in_file, inode, name)
        return out

    def lookup(self, path):
        cur = self.inode(1)
        if path == '/':
            return cur
        for part in path.strip('/').split('/'):
            ents = {n: i for _, i, n in self.readdir(cur) if i}
            if part not in ents:
                raise FileNotFoundError(path)
            cur = self.inode(ents[part])
        return cur

    def try_lookup(self, path):
        try:
            return self.lookup(path)
        except FileNotFoundError:
            return None

    def save(self):
        with open(self.path, 'wb') as f:
            f.write(self.img)


def read_swapdev(disk):
    """Read the kernel's compiled swapdev from /rkunix's symbol table.

    Returns the device number, or 0 (makedev(0,0)) if it cannot be determined.
    """
    try:
        rk = disk.lookup('/rkunix')
    except FileNotFoundError:
        return 0
    data = disk.read_file(rk)
    magic, tsz, dsz, bss, syms, entry, unused, relflg = struct.unpack_from('<8H', data, 0)
    if syms == 0:
        return 0
    sym_off = 16 + tsz + dsz                 # symtab follows header+text+data
    blob = data[sym_off:sym_off + syms]
    for i in range(0, len(blob), 12):
        name = blob[i:i + 8].split(b'\0')[0].decode('latin1')
        if name == '_swapdev':
            _typ, addr = struct.unpack_from('<HH', blob, i + 8)
            foff = 16 + addr                 # 0407: data initial value in file
            if 0 <= foff <= len(data) - 2:
                return struct.unpack_from('<H', data, foff)[0]
    return 0


def is_patched(disk):
    """True if /unix already aliases the kernel AND a swap block node exists."""
    unix = disk.try_lookup('/unix')
    rk = disk.try_lookup('/rkunix')
    if not (unix and rk and unix['ino'] == rk['ino']):
        return False
    dev = disk.try_lookup('/dev')
    if not dev:
        return False
    for _, ino, name in disk.readdir(dev):
        if ino:
            ind = disk.inode(ino)
            if (ind['mode'] & IFMT) == IFBLK:
                return True
    return False


def alloc_inode(disk):
    """Allocate a free inode via the superblock free-inode cache (V6 ialloc)."""
    base = 1 * BS
    ninode = disk.rword(base + SB_S_NINODE)
    while ninode > 0:
        ninode -= 1
        cand = disk.rword(base + SB_S_INODE + ninode * 2)
        if cand > 0 and disk.rword(disk.inode_off(cand)) == 0:   # mode==0 -> free
            disk.wword(base + SB_S_NINODE, ninode)               # commit pop
            return cand
    raise RuntimeError('inode cache exhausted; run icheck/fsck or rebuild image')


def make_block_special(disk, ino, dev):
    off = disk.inode_off(ino)
    for k in range(32):
        disk.img[off + k] = 0
    disk.wword(off + 0, IALLOC | IFBLK | 0o666)   # i_mode = 0160666
    disk.img[off + 2] = 1                          # i_nlink
    disk.wword(off + 8, dev)                        # i_addr[0] = device number


def add_dirent(disk, dir_ind, new_ino, new_name):
    """Write a (ino, name) entry into a free slot of dir without resizing."""
    nb = new_name.encode('latin1')
    assert len(nb) <= 14
    blocks = disk.data_blocks(dir_ind)
    consumed = 0
    for b in blocks:
        for slot in range(0, BS, 16):
            if consumed + 16 > dir_ind['size']:
                return False
            off = b * BS + slot
            if disk.rword(off) == 0:
                disk.wword(off, new_ino)
                disk.img[off + 2:off + 16] = nb + b'\0' * (14 - len(nb))
                return True
            consumed += 16
    return False


def patch(path):
    disk = V6Disk(path)
    if is_patched(disk):
        print(f'[skip] already patched: {path}')
        return False

    rk = disk.lookup('/rkunix')
    swapdev = read_swapdev(disk)

    # 1. hard-link /unix -> rkunix's inode
    root = disk.lookup('/')
    root_blk = disk.data_blocks(root)[0]
    unix_slot = next((s for s, _i, n in disk.readdir(root) if n == 'unix'), None)
    if unix_slot is None:
        raise RuntimeError('/unix entry not found in root directory')
    disk.wword(root_blk * BS + unix_slot, rk['ino'])     # repoint name -> kernel
    nlink_off = disk.inode_off(rk['ino']) + 2
    disk.img[nlink_off] += 1                              # bump kernel nlink

    # 2. create /dev/rk0 and /dev/swap as block-special (dev == swapdev)
    dev = disk.lookup('/dev')
    for name in ('rk0', 'swap'):
        ino = alloc_inode(disk)
        make_block_special(disk, ino, swapdev)
        if not add_dirent(disk, dev, ino, name):
            raise RuntimeError(f'no free /dev slot for {name}')

    disk.save()
    print(f'[ok]   patched: {path} '
          f'(/unix -> /rkunix inode {rk["ino"]}; '
          f'/dev/rk0,/dev/swap block dev={swapdev:#o})')
    return True


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    changed = False
    for path in argv[1:]:
        changed |= patch(path)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
