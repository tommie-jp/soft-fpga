"""v6disk.py — read/write helper for a Unix V6 filesystem image.

Shared by the offline disk patches (patch-v6-disk-ps.py,
patch-v6-disk-freelist.py). The whole image is held in memory; nothing is
written until save() is called.
"""
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
