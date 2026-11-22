"""patch-v6-disk-freelist.py の単体テスト。

小さな V6 ファイルシステムのイメージを作り、空きリストをわざと壊してから
作り直しを確かめる。実行: .venv/bin/python -m pytest verif/scripts
"""
import importlib.util
import struct
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / 'scripts'
sys.path.insert(0, str(SCRIPTS))

_spec = importlib.util.spec_from_file_location(
    'patch_v6_disk_freelist', SCRIPTS / 'patch-v6-disk-freelist.py')
freelist = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(freelist)

BS = 512
ISIZE = 1                    # inode blocks -> 16 inodes, data starts at block 3
FSIZE = 400
TOTAL = 420                  # blocks past FSIZE stand in for the swap area
IALLOC, ILARG, IFCHR = 0o100000, 0o010000, 0o020000

SMALL_BLOCKS = [10, 11]
INDIRECT_BLOCK = 20
LARGE_DATA_BLOCKS = [21, 22, 23]
USED = set(SMALL_BLOCKS) | {INDIRECT_BLOCK} | set(LARGE_DATA_BLOCKS)
ALL_DATA = set(range(2 + ISIZE, FSIZE))


def put_inode(img, ino, mode, addr):
    off = 2 * BS + (ino - 1) * 32
    struct.pack_into('<H', img, off, mode)
    img[off + 2] = 1
    struct.pack_into('<8H', img, off + 8, *(list(addr) + [0] * 8)[:8])


def put_free(img, entries):
    struct.pack_into('<H', img, BS + 4, len(entries))
    for i, bno in enumerate(entries):
        struct.pack_into('<H', img, BS + 6 + 2 * i, bno)


def make_image(tmp_path, free_entries):
    """One small file, one large file and a device node; free list as given."""
    img = bytearray(TOTAL * BS)
    struct.pack_into('<HH', img, BS, ISIZE, FSIZE)
    put_inode(img, 1, IALLOC, SMALL_BLOCKS)
    put_inode(img, 2, IALLOC | ILARG, [INDIRECT_BLOCK])
    struct.pack_into('<3H', img, INDIRECT_BLOCK * BS, *LARGE_DATA_BLOCKS)
    put_inode(img, 3, IALLOC | IFCHR, [0o4001])     # device number, not a block
    put_free(img, free_entries)
    path = tmp_path / 'v6.dsk'
    path.write_bytes(img)
    return path


def load_report(path):
    return freelist.analyse(freelist.V6Disk(str(path)))


def test_reports_duplicates_in_use_and_missing_blocks(tmp_path):
    # Arrange: 30 is listed twice, 10 belongs to a file, the rest is missing
    path = make_image(tmp_path, [0, 30, 30, 10, 31])

    # Act
    report = load_report(path)

    # Assert
    assert report['clean'] is False
    assert report['duplicated'] == {30: 2}
    assert report['free_and_used'] == [10]
    assert 32 in report['missing']
    assert report['want_free'] == ALL_DATA - USED


def test_rebuilt_list_holds_every_unused_block_exactly_once(tmp_path):
    path = make_image(tmp_path, [0, 30, 30, 10, 31])

    changed = freelist.patch(str(path))

    disk = freelist.V6Disk(str(path))
    listed = freelist.read_free_list(disk, freelist.read_layout(disk))
    assert changed is True
    assert len(listed) == len(set(listed))
    assert set(listed) == ALL_DATA - USED
    assert load_report(path)['clean'] is True


def test_rebuilt_list_hands_blocks_out_in_ascending_order(tmp_path):
    path = make_image(tmp_path, [0, 30, 30, 10, 31])

    freelist.patch(str(path))

    disk = freelist.V6Disk(str(path))
    listed = freelist.read_free_list(disk, freelist.read_layout(disk))
    assert listed == sorted(listed)


def test_second_run_is_a_no_op(tmp_path):
    path = make_image(tmp_path, [0, 30, 30, 10, 31])
    freelist.patch(str(path))
    before = path.read_bytes()

    changed = freelist.patch(str(path))

    assert changed is False
    assert path.read_bytes() == before


def test_check_mode_writes_nothing(tmp_path):
    path = make_image(tmp_path, [0, 30, 30, 10, 31])
    before = path.read_bytes()

    needed = freelist.patch(str(path), check_only=True)

    assert needed is True
    assert path.read_bytes() == before


def test_file_blocks_and_swap_area_are_left_untouched(tmp_path):
    path = make_image(tmp_path, [0, 30, 30, 10, 31])
    img = bytearray(path.read_bytes())
    for bno in list(USED - {INDIRECT_BLOCK}) + [FSIZE, TOTAL - 1]:
        img[bno * BS:(bno + 1) * BS] = bytes([bno & 0xFF]) * BS
    path.write_bytes(img)

    freelist.patch(str(path))

    after = path.read_bytes()
    for bno in list(USED - {INDIRECT_BLOCK}) + [FSIZE, TOTAL - 1]:
        assert after[bno * BS:(bno + 1) * BS] == bytes([bno & 0xFF]) * BS


def test_out_of_range_pointers_are_reported_and_not_freed(tmp_path):
    # Arrange: the indirect block of inode 2 now holds text instead of blocks
    path = make_image(tmp_path, [0, 30])
    img = bytearray(path.read_bytes())
    struct.pack_into('<3H', img, INDIRECT_BLOCK * BS, 12876, 40, 2)
    path.write_bytes(img)

    report = load_report(path)

    assert report['bad_inodes'] == {2: 2}
    assert 40 not in report['want_free']        # in range: kept off the list
    assert INDIRECT_BLOCK not in report['want_free']


def test_unreadable_chain_is_rebuilt(tmp_path):
    # Arrange: the chain link points outside the filesystem
    path = make_image(tmp_path, [5000, 30])

    report = load_report(path)
    freelist.patch(str(path))

    assert report['chain_ok'] is False
    assert load_report(path)['clean'] is True


def test_image_without_a_filesystem_is_rejected(tmp_path):
    path = tmp_path / 'blank.dsk'
    path.write_bytes(bytes(TOTAL * BS))

    with pytest.raises(ValueError, match='not a V6 filesystem'):
        freelist.patch(str(path))


def test_main_returns_1_in_check_mode_when_a_rebuild_is_needed(tmp_path):
    path = make_image(tmp_path, [0, 30, 30])

    assert freelist.main(['prog', '--check', str(path)]) == 1
    assert freelist.main(['prog', str(path)]) == 0
    assert freelist.main(['prog', '--check', str(path)]) == 0
    assert freelist.main(['prog']) == 2
    assert freelist.main(['prog', str(tmp_path / 'none.dsk')]) == 2
