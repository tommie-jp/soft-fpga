#!/usr/bin/env python3
"""patch-v6-disk-freelist.py — rebuild the free list of a Unix V6 RK05 image.

The stock RK05 demo image carries a stale superblock: its free list does not
match the inodes.
  1. The same block number sits on the free list several times, so alloc()
     hands one block out twice and a freshly written file overwrites itself
     (a multi-block a.out from cc dies with "Illegal instruction").
  2. Blocks that belong to existing files are also on the free list, so
     creating a file overwrites someone else's data (the first block handed
     out is part of /bin/db).
  3. Blocks that belong to nobody are missing from the list.

This script fixes the list OFFLINE, the way `icheck -s` does: it walks every
allocated inode, collects the blocks in use, and writes a new free list made
of all the other blocks. alloc() then hands blocks out in ascending order.

It does NOT repair files that were already overwritten before the image was
taken (/bin/dc and /usr/fort/fc1 have a clobbered indirect block). Those are
reported and left alone. Blocks they still point to stay off the free list.

It is IDEMPOTENT: an image whose free list already matches is left untouched.

Usage:
  python3 scripts/patch-v6-disk-freelist.py [--check] <disk.dsk> [<disk2.dsk> ...]

  --check  report only, write nothing; exit status 1 if a rebuild is needed
"""
import collections
import struct
import sys

from v6disk import BS, IALLOC, IFBLK, IFCHR, IFMT, ILARG, V6Disk

# superblock field offsets (within block 1)
SB_BASE    = 1 * BS
SB_S_ISIZE = 0
SB_S_FSIZE = 2
SB_S_NFREE = 4
SB_S_FREE  = 6
SB_S_FLOCK = 408
SB_S_ILOCK = 409
SB_S_FMOD  = 410

NICFREE       = 100      # free block numbers held per superblock / chain block
INODES_PER_BLK = BS // 32
WORDS_PER_BLK = BS // 2
FIRST_INODE_BLK = 2


class FsLayout(collections.namedtuple('FsLayout', 'isize fsize')):
    """Sizes read from the superblock."""

    @property
    def first_data(self) -> int:
        return FIRST_INODE_BLK + self.isize

    def is_data_block(self, bno: int) -> bool:
        return self.first_data <= bno < self.fsize

    def data_blocks(self) -> range:
        return range(self.first_data, self.fsize)


def read_layout(disk: V6Disk) -> FsLayout:
    layout = FsLayout(isize=disk.rword(SB_BASE + SB_S_ISIZE),
                      fsize=disk.rword(SB_BASE + SB_S_FSIZE))
    total = len(disk.img) // BS
    if layout.isize == 0 or not layout.first_data < layout.fsize <= total:
        raise ValueError(f'not a V6 filesystem (isize={layout.isize}, '
                         f'fsize={layout.fsize}, image blocks={total})')
    return layout


def block_words(disk: V6Disk, bno: int) -> tuple[int, ...]:
    return struct.unpack_from(f'<{WORDS_PER_BLK}H', disk.img, bno * BS)


def inode_block_refs(disk: V6Disk, layout: FsLayout,
                     ind: dict) -> tuple[list[int], int]:
    """Return (blocks, bad): block numbers an inode points to, and the count
    of pointers that fall outside the data area (a clobbered indirect block)."""
    refs = []
    bad = 0

    def take(bno: int) -> bool:
        nonlocal bad
        if bno == 0:
            return False
        if not layout.is_data_block(bno):
            bad += 1
            return False
        refs.append(bno)
        return True

    addr = ind['addr']
    if not ind['mode'] & ILARG:
        for a in addr:
            take(a)
        return refs, bad
    for a in addr[:7]:
        if take(a):
            for b in block_words(disk, a):
                take(b)
    if take(addr[7]):                       # double indirect
        for a in block_words(disk, addr[7]):
            if take(a):
                for b in block_words(disk, a):
                    take(b)
    return refs, bad


def scan_used(disk: V6Disk, layout: FsLayout
              ) -> tuple[set[int], dict[int, int], dict[int, list[int]]]:
    """Walk every allocated inode. Returns (used, bad_inodes, shared):
    used        — set of data blocks referenced by some inode
    bad_inodes  — {ino: count of out-of-range pointers}
    shared      — {block: [ino, ...]} for blocks referenced more than once
    """
    owners = collections.defaultdict(list)
    bad_inodes = {}
    for ino in range(1, layout.isize * INODES_PER_BLK + 1):
        ind = disk.inode(ino)
        if not ind['mode'] & IALLOC:
            continue
        if ind['mode'] & IFMT in (IFCHR, IFBLK):
            continue                        # i_addr[0] is a device number
        refs, bad = inode_block_refs(disk, layout, ind)
        if bad:
            bad_inodes[ino] = bad
        for bno in refs:
            owners[bno].append(ino)
    shared = {b: inos for b, inos in owners.items() if len(inos) > 1}
    return set(owners), bad_inodes, shared


def read_free_list(disk: V6Disk, layout: FsLayout) -> list[int] | None:
    """Return the free list as alloc() would hand it out, or None if the
    chain itself is unreadable."""
    nfree = disk.rword(SB_BASE + SB_S_NFREE)
    if nfree > NICFREE:
        return None
    cur = [disk.rword(SB_BASE + SB_S_FREE + 2 * i) for i in range(nfree)]
    out = []
    seen_links = set()
    while cur:
        out += reversed(cur[1:])
        link = cur[0]
        if link == 0:
            return out
        if not layout.is_data_block(link) or link in seen_links:
            return None
        seen_links.add(link)
        out.append(link)
        words = block_words(disk, link)
        if words[0] > NICFREE:
            return None
        cur = list(words[1:1 + words[0]])
    return out


def write_free_list(disk: V6Disk, free_blocks: set[int]) -> None:
    """Write a free list holding exactly free_blocks (V6 free(), mkfs order).

    Blocks are pushed from the highest down, so alloc() pops the lowest first.
    """
    cache = [0]                             # the 0 sentinel ends the chain
    for bno in sorted(free_blocks, reverse=True):
        if len(cache) == NICFREE:
            base = bno * BS
            disk.img[base:base + BS] = bytes(BS)
            disk.wword(base, len(cache))
            for i, entry in enumerate(cache):
                disk.wword(base + 2 + 2 * i, entry)
            cache = []
        cache.append(bno)
    disk.wword(SB_BASE + SB_S_NFREE, len(cache))
    for i in range(NICFREE):
        disk.wword(SB_BASE + SB_S_FREE + 2 * i, cache[i] if i < len(cache) else 0)
    for off in (SB_S_FLOCK, SB_S_ILOCK, SB_S_FMOD):
        disk.img[SB_BASE + off] = 0


def analyse(disk: V6Disk) -> dict:
    """Compare the free list with the inodes. Returns a dict of findings."""
    layout = read_layout(disk)
    used, bad_inodes, shared = scan_used(disk, layout)
    want_free = set(layout.data_blocks()) - used
    listed = read_free_list(disk, layout)
    counts = collections.Counter(listed or [])
    return dict(
        layout=layout,
        want_free=want_free,
        chain_ok=listed is not None,
        duplicated={b: n for b, n in counts.items() if n > 1},
        free_and_used=sorted(set(counts) & used),
        missing=sorted(want_free - set(counts)),
        bad_inodes=bad_inodes,
        shared=shared,
        clean=listed is not None and len(listed) == len(counts)
              and set(counts) == want_free,
    )


def describe(path: str, report: dict) -> None:
    layout = report['layout']
    print(f'       {path}: isize={layout.isize} fsize={layout.fsize} '
          f'free blocks={len(report["want_free"])}')
    if not report['chain_ok']:
        print('       free list chain is unreadable')
    print(f'       on the list twice or more: {len(report["duplicated"])}, '
          f'on the list but in use: {len(report["free_and_used"])}, '
          f'free but not on the list: {len(report["missing"])}')
    if report['bad_inodes']:
        inos = ', '.join(str(i) for i in sorted(report['bad_inodes']))
        print(f'       WARNING: inodes with out-of-range block pointers '
              f'(already damaged, not repaired): {inos}')
    if report['shared']:
        print(f'       WARNING: {len(report["shared"])} blocks are referenced '
              f'more than once by inodes (not repaired)')


def patch(path: str, check_only: bool = False) -> bool:
    """Rebuild the free list of one image. Returns True if it needed a rebuild."""
    disk = V6Disk(path)
    report = analyse(disk)
    if report['clean']:
        print(f'[skip] free list already consistent: {path}')
        return False
    if check_only:
        print(f'[need] free list is inconsistent: {path}')
        describe(path, report)
        return True
    write_free_list(disk, report['want_free'])
    disk.save()
    print(f'[ok]   free list rebuilt: {path}')
    describe(path, report)
    return True


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if a != '--check']
    check_only = len(args) != len(argv) - 1
    if not args:
        print(__doc__)
        return 2
    status = 0
    for path in args:
        try:
            needed = patch(path, check_only)
        except (OSError, ValueError) as exc:
            print(f'[fail] {path}: {exc}', file=sys.stderr)
            status = 2
            continue
        if needed and check_only:
            status = max(status, 1)
    return status


if __name__ == '__main__':
    sys.exit(main(sys.argv))
