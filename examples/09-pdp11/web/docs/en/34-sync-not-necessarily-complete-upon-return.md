# 34. sync Returns Before the Writing Is Complete <a class="qr-link" href="../../../docs/09-PDP11/img/34-en-QR.png">QR</a>

Type `sync` before you halt UNIX, the old advice goes. Some say to type it three times.
The reason usually quoted is the BUGS section of the UNIX Version 7 manual page `sync(2)`.

> The writing, although scheduled, is not necessarily complete upon return from sync.

It reads as if the disk may still be writing after `sync` has given the prompt back.
This article checks how far the `sync` of V6 actually waits.

| No. | What to check |
| --- | --- |
| 1 | The first half of `sync` waits for each write to finish, one at a time |
| 2 | The second half only issues its writes and returns to user mode before they finish |
| 3 | Whether any writing is still pending when the prompt comes back |

It runs the real Unix V6 on a PDP-11 written in Verilog and checks the three points on waveforms.
The tool is the debug panel of [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).
The answer to the third point is not what the folklore says.

---

## 1. The code

The `sync` command only makes the `sync` system call. In the kernel that is `update()` in `sys/ken/alloc.c`.

```c
update()
{
        ...
        for(mp = &mount[0]; mp < &mount[NMOUNT]; mp++)
                if(mp->m_bufp != NULL) {
                        ...
                        bcopy(ip, bp->b_addr, 256);
                        bwrite(bp);
                }
        for(ip = &inode[0]; ip < &inode[NINODE]; ip++)
                if((ip->i_flag&ILOCK) == 0) {
                        ip->i_flag =| ILOCK;
                        iupdat(ip, time);
                        prele(ip);
                }
        updlock = 0;
        bflush(NODEV);
}
```

It has three jobs: write the super-blocks, write the inodes that changed, and finally call `bflush()`.
The first two use `bwrite()`. `iupdat()` calls `bwrite()` inside as well.

`bwrite()` is in `sys/dmr/bio.c`.

```c
bwrite(bp)
struct buf *bp;
{
        ...
        flag = rbp->b_flags;
        rbp->b_flags =& ~(B_READ | B_DONE | B_ERROR | B_DELWRI);
        rbp->b_wcount = -256;
        (*bdevsw[rbp->b_dev.d_major].d_strategy)(rbp);
        if ((flag&B_ASYNC) == 0) {
                iowait(rbp);
                brelse(rbp);
        } else if ((flag&B_DELWRI)==0)
                geterror(rbp);
}
```

`d_strategy` hands the write to the disk driver. What follows is the fork in the road.
If `B_ASYNC` is clear, `iowait()` waits for the write to finish. If it is set, `bwrite()` returns without waiting.

`B_ASYNC` is set by `bflush()`, in the same file.

```c
bflush(dev)
{
        register struct buf *bp;

loop:
        spl6();
        for (bp = bfreelist.av_forw; bp != &bfreelist; bp = bp->av_forw) {
                if (bp->b_flags&B_DELWRI && (dev == NODEV||dev==bp->b_dev)) {
                        bp->b_flags =| B_ASYNC;
                        notavail(bp);
                        bwrite(bp);
                        goto loop;
                }
        }
        spl0();
}
```

`B_DELWRI` marks a buffer whose write has been put off. Partial blocks written to a file and directory blocks get it.
`bflush()` looks for such buffers, sets `B_ASYNC` and then calls `bwrite()`. These are the only writes nobody waits for.

## 2. Setting up the observation

Open [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) and log in as `root` at `login:`.
When the `#` prompt appears, press the button below. It applies all the settings and arms the trigger.

[▶ Apply these settings](?scenario=sync-bflush)

Then run this line in the terminal.

```text
# date >y; sync
```

The button does these four things. The order is the same when you set them by hand.

1. Open the **Logic Analyzer** panel.
2. Set **RK seek** in the LA to `4K clk (1.2 ms)`.
3. In **Trigger**, pick the preset `V6 bflush: B_ASYNC set (write not awaited)` and press **Set**.
4. Show only the LA signals `PC`, `Mode`, `RK`, `INT`, `Vec`, `VA`, `Data` and `WR`.

The preset fires on the kernel instruction `bis $400,(r4)` at 046012. It is `bp->b_flags =| B_ASYNC;` in `bflush()`.
The instruction is executed only when at least one delayed-write buffer is left.

`date >y` is there to create a new file. That changes a directory block, which stays behind as a delayed-write buffer.
Repeating it with the same name does not change the directory, so use another name such as `y2` or `y3` when you try again.

RK seek is the time the disk waits before it starts a transfer. With the default, Off, the disk is too fast to show the order of events.
The setting survives a Reset. Set it back to Off when you are done.

The sample interval becomes 4 ticks, so that one capture covers 16,000 ticks after the trigger.

V6 runs a resident program, `/etc/update`, that makes the same `sync` call every 30 seconds.
If the simulation stops before you type `date >y; sync`, that program stopped it. The waveform has the same shape, so read it as it is.

## 3. bflush: issue the write and return without waiting

Once it has stopped, set the LA zoom to `1/4x`. The whole capture fits on one screen.

![16,000 ticks after B_ASYNC is set. RK starts and stops again while Mode stays almost entirely Kernel](docs/img/34-01-la-bflush-overview.png)

The numbers on the horizontal axis are sample numbers, and one sample is 4 ticks. The `RK` row is the state of the RK11 controller.

| Sample | Tick | RK | Event |
| --- | --- | --- | --- |
| 0 | 0 | 00 | `B_ASYNC` is set (the trigger). The RK11 is idle |
| +477 | 1,908 | 17 | `bwrite()` issues the write to the RK11. The seek delay starts |
| +1,501 | 6,004 | transferring | The 4,096-tick delay ends and the transfer of 256 words begins |
| +2,517 | 10,068 | transferring | `sync` returns to user mode |
| +3,682 | 14,728 | 00 | The transfer ends and the RK11 interrupts (vector 220) |

Zoom in at `1x` on the place where `Mode` becomes User.

![While the RK row keeps moving, Mode changes from Kernel to User](docs/img/34-02-la-bflush-return.png)

The `RK` row keeps toggling during the transfer. In the middle of it, at sample +2,517, `Mode` changes to User.
The PC at that point is 000052, the instruction after `sys sync` in `/bin/sync`. The system call is over.
The write finishes and the RK11 interrupts 4,660 ticks later.

This is what the sentence in the manual says. On return from `sync`, the writing is not yet complete.

## 4. The first half waits for each write

The first half of the same `sync` does not fit in the capture. It starts more than 200,000 ticks before `bflush()`.
The following comes from a tick-by-tick log instead. During the `sync` of `date >y; sync`, the RK11 did this.

```text
S W i W i R i W i R i W i W i R i W i B A W U i
```

| Symbol | Event |
| --- | --- |
| S | Enter `sync()` in the kernel |
| W | Issue a write to the RK11 (store 000103 in RKCS) |
| R | Issue a read to the RK11 (store 000105 in RKCS) |
| i | RK11 interrupt. A transfer has finished |
| B | Enter `bflush()` |
| A | Set `B_ASYNC` |
| U | Return to user mode |

From S to B, every W or R is followed by an i. The kernel issues one transfer and waits for it, again and again.
`iowait()` in `bwrite()` puts the process to sleep. There were 6 writes and 3 reads.
The reads fetch the block that holds an inode before that inode is written.

Only after B does the order change. The W is followed by U, not by i. This is the write of chapter 3 that nobody waits for.

## 5. The prompt still comes after the writing

The log continues after the return from `sync`. Up to the `#` prompt it looks like this.

```text
B A W U X i W i P
```

X is the entry of `exit()` in the kernel, and P is the `#` sent to the terminal.
There is one more write between U and P. It is issued by `exit()`.

```c
        a = malloc(swapmap, 1);
        if(a == NULL)
                panic("out of swap");
        p = getblk(swapdev, a);
        bcopy(&u, p->b_addr, 256);
        bwrite(p);
```

A V6 process that exits writes its record (exit status and times used) to one block of the swap area. The parent's `wait` reads it.
This `bwrite()` has `B_ASYNC` clear. It waits until the write is done.
And the driver writes in the order it was asked. The write from `exit()` queues up behind the writes `bflush()` issued.

The `sync` command is a program that calls `sync` and exits at once.
So the `exit()` of the `sync` command cannot proceed until every write from `bflush()` has finished. The prompt appears after that.

The table shows measurements with different RK seek settings, counting ticks from the entry of `bflush()`.

| RK seek | Return to user | Write from `bflush()` done | Write from `exit()` done | Prompt |
| --- | --- | --- | --- | --- |
| Off | 10,694 | 11,363 | 34,009 | 105,442 |
| 4K clk | 10,343 | 14,980 | 37,511 | 104,634 |
| 64K clk | 9,914 | 76,532 | 152,351 | 218,234 |
| 256K clk | 9,929 | 272,581 | 544,924 | 610,904 |

With every setting, the return to user mode comes before the write is done, just as the manual says.
And with every setting, the prompt comes after the last write is done. No RK11 interrupt arrived after the prompt.
The block `exit()` wrote to swap was number 4014, outside the file system.

## 6. What typing it three times does

After writing a file with `cp /bin/ls x`, `sync` was typed three times in a row. RK seek was Off.

| Run | Writes inside `sync` | Write from `exit()` |
| --- | --- | --- |
| First | 7 | 1 |
| Second | 4 | 1 |
| Third | 4 | 1 |

The number of writes does not drop to 0 on the second and third run.
What gets written are blocks that hold inodes. Their numbers match the inodes of the terminal (`/dev/tty8`) and the shell (`/bin/sh`), among others.
Running a command changes the times of the files it uses. Typing `sync` creates the next thing to write.

In V6, by the time the first prompt appears, the writes of the first `sync` are done.
All that typing it three times achieves is that time passes while you type.

## 7. What changed in V7

`update()` and `bflush()` are built the same way in V7. `bflush()` sets `B_ASYNC` and calls `bwrite()`.
What changed is `exit()`.

```c
        p->p_stat = SZOMB;
        ((struct xproc *)p)->xp_xstat = rv;
        ((struct xproc *)p)->xp_utime = u.u_cutime + u.u_utime;
        ((struct xproc *)p)->xp_stime = u.u_cstime + u.u_stime;
```

V7 keeps the record of an exited process inside the process table. It does not write to swap.
`exit()` no longer waits for the disk, so the `sync` command can end with the writes from `bflush()` still pending.
The BUGS sentence quoted at the top is from the manual of that V7. In V7 the prompt can come back before the writing.

## 8. What was confirmed

| What to check | What was observed |
| --- | --- |
| The first half waits for each write to finish | For all 6 writes and 3 reads of super-block and inodes, the interrupt came before the next transfer was issued |
| The second half returns before its writes finish | The write `bflush()` issued with `B_ASYNC` set finished 4,660 ticks after the return to user mode (RK seek = 4K clk) |
| Is any writing pending when the prompt comes back | No. `exit()` writes one block to swap and waits for it, so the prompt came after the last write even with RK seek at 256K clk |

For the system call, the sentence in the manual holds in V6 too.
The `sync` command, in V6, does not give the prompt back until the writing is done. That follows from the V6 design in which `exit()` writes to disk.

## 9. Related documents

- [09-unix-v6-ファイルシステム.md](?doc=09-unix-v6-ファイルシステム.md) — super-block and inodes
- [27-swtch-You-are-not-expected-to-understand-this.md](?doc=27-swtch-You-are-not-expected-to-understand-this.md) — slowing down RK seek to see code that relies on waiting for the disk
- [29-fork-the-return-locations-differ-by-one-word.md](?doc=29-fork-the-return-locations-differ-by-one-word.md) — the `fork` the shell makes to run a command
- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md) — Trigger, Post, RK seek and scenarios
- [53-参考資料.md](?doc=53-参考資料.md) — Unix V6 sources and commentaries
