# 09. Unix V6 Filesystem Layout <a class="qr-link" href="../../../docs/09-PDP11/img/09-QR.png">QR</a>

## 1. Directory Hierarchy

```text
/
├── bin/        Core commands (ls, cat, sh, cc, as, ld, ed ...)
├── dev/        Device files (rk0, tty, mem, kmem ...)
├── etc/        Administrative files (passwd, group, rc, motd, fstab)
├── lib/        Compiler passes and libraries (c0, c1, c2, libc.a ...)
├── tmp/        Temporary files (cleared on reboot)
├── unix        Bootable kernel binary
├── usr/
│   ├── bin/    Additional commands (dc, od, grep, diff, nm, size ...)
│   ├── games/  Games (wump, chess, ttt, maze ...)
│   ├── include/Header files (stdio.h, ctype.h, sys/ ...)
│   ├── lib/    Libraries and manual data
│   ├── man/    Manual pages (man1/ man2/ man3/ ...)
│   ├── source/ Command sources (cmd/)
│   └── sys/    Kernel sources (conf/ ken/ dmr/ dev/ h/)
└── (others)
```

## 2. Important Files

| Path | Contents |
|------|----------|
| `/unix` | Boot kernel binary (bootrom loads as `rkunix`) |
| `/etc/passwd` | User accounts (passwords stored in plaintext) |
| `/etc/group` | Group definitions |
| `/etc/rc` | Shell script executed at boot time |
| `/etc/motd` | Login message |
| `/dev/rk0` | RK05 disk raw device |
| `/dev/tty` | Console terminal |
| `/dev/mem` | Physical memory (used by `ps` and others) |

## 3. Device Files (`/dev`)

```text
# ls -l /dev
crw-rw-rw-  1 root    0,  0  rk0    ← RK05 disk (block 0=)
crw-rw-rw-  1 root    1,  0  mem    ← physical memory
crw-rw-rw-  1 root    1,  1  kmem   ← kernel memory
crw-rw-rw-  1 root    3,  0  tty    ← console terminal
```

- `c` = character device, `b` = block device
- The leading major number identifies the driver

## 4. RK05 Disk Layout (2.4 MB)

| Region | Purpose |
|--------|---------|
| Blocks 0–1 | Boot block (loaded by bootrom) |
| Blocks 2–5 | Superblock (i-node count, free list) |
| Blocks 6–… | i-node table |
| Remainder | Data blocks (1 block = 512 bytes) |

## 5. Common File Operations

```text
# ls -la /usr/sys/ken      ← list kernel C sources
# cat /etc/passwd          ← list users (root password is empty)
# ls /usr/games            ← list available games
# od -c /bin/ls            ← octal dump of a binary
# size /bin/sh             ← show text+data+bss sizes
```

## 6. Disk Image Layout

This simulator uses `unix_v6_rk05.dsk` (2,494,464 bytes).
RK05 specification: 203 cylinders × 2 heads × 12 sectors × 512 bytes = 2,496,768 bytes.

After power-on, the bootrom reads block 0 of the RK05 disk and waits at the
`@` prompt for the kernel name (`rkunix`) to be entered.

## 7. References

- [10 Unix V6 Command Reference](?doc=10-unix-v6-コマンドリファレンス.md) — Command reference
- [52 Memory Map](?doc=52-メモリマップ.md) — Device register addresses
- [07 Unix V6 / PDP-11 History](?doc=07-unix-v6-歴史的価値.md) — System overview
