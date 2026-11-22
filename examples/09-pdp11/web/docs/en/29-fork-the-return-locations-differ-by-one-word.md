# 29. fork Tells Parent from Child by the Return Address <a class="qr-link" href="../../../docs/09-PDP11/img/29-en-QR.png">QR</a>

`fork` returns the child's process ID to the parent and 0 to the child. It is one of the first things anyone learns about UNIX.
The UNIX Version 7 manual page `fork(2)` says the same. Its section for assembler programmers adds one more sentence.

> The return locations in the old and new process differ by one word.

The C library source `fork.s` carries another comment.

> in child, parents id is in par_uid if needed

The child is supposed to receive 0, yet it knows its parent's process ID.
Put together, the two lines imply that the kernel's `fork` works like this.

| No. | What to check |
| --- | --- |
| 1 | The kernel advances only the parent's return address, by one word (2 bytes) |
| 2 | The value the kernel hands to the child is not 0 but the parent's process ID |
| 3 | The 0 comes from a `clr r0` in the C library |

This article runs the real Unix V6 on a PDP-11 written in Verilog and checks the three points on waveforms, one by one.
The tool is the debug panel of [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).
The V6 code behaves exactly as the V7 manual describes (chapter 7).

---

## 1. The code

The `fork()` a C program calls is `s4/fork.s` in the C library.

```asm
_fork:
        mov     r5,-(sp)
        mov     sp,r5
        sys     fork
                br 1f
        bec     2f
        jmp     cerror
1:
        mov     r0,_par_uid
        clr     r0
2:
        mov     (sp)+,r5
        rts     pc
```

`br 1f` comes right after `sys fork`, and `bec 2f` follows it.
If `sys fork` returns to `br 1f`, the code jumps to `1:`, saves R0 in `_par_uid` and clears R0.
If it returns to `bec 2f`, the code goes on to `2:` without touching R0.

On the kernel side, the code is `fork()` in `sys/ken/sys1.c`.

```c
fork()
{
        register struct proc *p1, *p2;

        p1 = u.u_procp;
        for(p2 = &proc[0]; p2 < &proc[NPROC]; p2++)
                if(p2->p_stat == NULL)
                        goto found;
        u.u_error = EAGAIN;
        goto out;

found:
        if(newproc()) {
                u.u_ar0[R0] = p1->p_pid;
                u.u_cstime[0] = 0;
                ...
                return;
        }
        u.u_ar0[R0] = p2->p_pid;

out:
        u.u_ar0[R7] =+ 2;
}
```

`u.u_ar0` points to the user registers saved on entry to the system call.
A value stored in `u.u_ar0[R0]` becomes R0 on return to user mode, and `u.u_ar0[R7]` becomes the return address.

`newproc()` makes a copy of the process and returns 0 to the parent and 1 to the child ([chapter 27](?doc=27-swtch-You-are-not-expected-to-understand-this.md), section 6).
The child enters the `if`, stores the parent's process ID `p1->p_pid` in R0 and returns. It does not touch the return address.
The parent skips the `if`, stores the child's process ID `p2->p_pid` in R0 and adds 2 to the return address.

No line in `fork()` stores a 0.

## 2. Setting up the observation

There is no need to write a program that calls `fork`. The shell forks every time it runs a command.
The `fork.s` code inside `/bin/sh` sits at these addresses.

| Address (octal) | Word | Instruction |
| --- | --- | --- |
| 007776 | 104402 | `sys fork` |
| 010000 | 000403 | `br 1f` (where the child returns) |
| 010002 | 103005 | `bec 2f` (where the parent returns) |
| 010004 | 000167 | `jmp cerror` |
| 010010 | 010067 | `1: mov r0,_par_uid` |
| 010014 | 005000 | `clr r0` |
| 010016 | 012605 | `2: mov (sp)+,r5` |
| 010020 | 000207 | `rts pc` |

Open [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) and log in as `root` at `login:`.
When the `#` prompt appears, press the button below. It applies all the settings and arms the trigger.

[▶ Apply the settings that stop at the parent's return](?scenario=fork-parent)

Then run `date` in the terminal.

The button does these three things. The order is the same when you set them by hand.

1. Open the **Logic Analyzer** panel.
2. In **Trigger**, pick the preset `V6 sh: fork returns in parent (bec 2f)` and press **Set**.
3. Show only the LA signals `VA`, `Data`, `WR`, `RD`, `PC`, `Mode`, `R0` and `SP`.

The preset fires on the tick that fetches the instruction word 103005 at address 010002.
It compares both the address and the word, so it does not stop at the same address in the kernel or in another command.

This article stops three times during a single `date`: where the parent returns (chapter 3), where the kernel writes the child's R0 (chapter 4) and where the child returns (chapter 5).
Pressing a button closes the document view. To press the next button, open chapter 29 again and scroll back.

## 3. The parent: the return address moves by 2

Running `date` stops before the date is printed. The process that stopped is the parent shell.
Scroll the waveform to the left. About 1000 ticks before the trigger are the last two lines of `fork()`.

![The last two lines of fork(). The kernel writes the child's process ID to the saved R0 and 010002 to the saved PC](docs/img/29-01-la-parent-kernel.png)

| Tick | Address written | Value | C line |
| --- | --- | --- | --- |
| -1013 | 141772 | 000007 | `u.u_ar0[R0] = p2->p_pid;` |
| -972 | 141774 | 010002 | `u.u_ar0[R7] =+ 2;` |

Addresses 141772 and 141774 are near the bottom of the kernel stack. The system call entry saved the user's R0 and return address there.
`sys fork` is at 007776, so the saved return address was the next instruction, 010000. The kernel adds 2 and makes it 010002.
000007 is the child's process ID. It is 7 for the first command after login and grows by 1 with every command.

If a clock interrupt arrives in between, these two ticks move about 600 ticks to the left.

The rest is just before the trigger. Set the zoom to `16x` and look around the red dotted line.

![The parent's return. rtt pops 010002 and execution goes from bec to 2:. R0 stays 7](docs/img/29-02-la-parent-return.png)

| Tick | Address | Value read | What happens |
| --- | --- | --- | --- |
| -18 | 141772 | 000007 | `mov (sp)+,r0` restores R0 |
| -12 | 000522 | 000006 | Fetch `rtt` |
| -7 | 141774 | 010002 | Pop the PC |
| -4 | 141776 | 170010 | Pop the PS. Mode changes to User |
| 0 | 010002 | 103005 | Fetch `bec 2f` |
| +6 | 010016 | 012605 | `2: mov (sp)+,r5` |
| +17 | 010020 | 000207 | `rts pc` |

The parent never executes `br 1f`. `bec 2f` branches when the error flag (the C bit) is clear.
R0 is still 000007, and it goes back as the return value to the C function that called `fork()`.

## 4. The child, kernel side: the parent's process ID goes into R0

Leave the parent stopped, open chapter 29 again and press the next button. The stopped shell resumes.

[▶ Apply the settings that stop on the child's side of fork()](?scenario=fork-child-kernel)

Type nothing in the terminal. The simulation stops as soon as the child of the same `fork` starts to run.
The preset is `V6 fork: child gets parent pid (fork+52)`. It fires on the kernel instruction `mov 12(r4),*u_ar0` at 035010.
That is the line only the child executes in `fork()`: `u.u_ar0[R0] = p1->p_pid;`.

![fork() on the child's side. The kernel reads 6 from p1->p_pid and writes it to the saved R0 at 141772](docs/img/29-03-la-child-kernel.png)

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| 0 | 035010 | 016477 | Fetch `mov 12(r4),*u_ar0`. R0 is 1 |
| +10 | 062734 | 000006 | Read `p_pid` from the parent's `proc` entry |
| +14 | 140426 | 141772 | Read `u.u_ar0` |
| +20 | 141772 | 000006 | Write the parent's process ID to the saved R0 |

The 01 in the R0 row is the return value of `newproc()`. This is the child's side, so it is 1.
000006 is the shell's process ID. In this setup the login shell is process 6.
Six `clr` instructions follow and reset the time counters. Nothing is written to 141774, so the return address stays 010000.

## 5. The child: R0 becomes 0 only at `clr r0`

Open chapter 29 once more and press the next button.

[▶ Apply the settings that stop at the child's return](?scenario=fork-child)

The preset is `V6 sh: fork returns in child (br 1f)`. It fires on the tick that fetches `br 1f` at address 010000.

![The child's return. rtt pops 010000 and execution jumps from br to 1:. R0 changes from 6 to 0](docs/img/29-04-la-child-return.png)

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| -7 | 141774 | 010000 | `rtt` pops the PC, the word right after `sys fork` |
| -4 | 141776 | 170010 | Pop the PS. Mode changes to User |
| 0 | 010000 | 000403 | Fetch `br 1f`. R0 is 000006 |
| +6 | 010010 | 010067 | `1: mov r0,_par_uid` |
| +17 | 024300 | 000006 | Write the parent's process ID to `_par_uid` |
| +19 | 010014 | 005000 | `clr r0` |
| +26 | 010016 | 012605 | `2: mov (sp)+,r5`. R0 is 000000 |
| +37 | 010020 | 000207 | `rts pc` |

When the child returns to user mode, R0 is 6, not 0.
R0 becomes 0 after 26 ticks. The instruction that clears it, `clr r0`, belongs to the C library, not to the kernel.
From `2:` on, the child runs the same instructions as the parent. Only the value in R0 differs.

Press **Resume** in the top bar. The child goes on to run `date`, and the date is printed.

## 6. How parent and child are spaced in time

The three captures are different moments of one `fork`. Counted from the tick that fetches `sys fork`, they line up like this.

| Tick | Process | Event |
| --- | --- | --- |
| 0 | Parent | Fetch `sys fork` at 007776 |
| 1,097 | Parent | Enter `fork()` in the kernel |
| 123,847 | Parent | `newproc()` returns 0 |
| 123,879 | Parent | Write the child's process ID to the saved R0 |
| 123,920 | Parent | Make the saved PC 010002 |
| 124,893 | Parent | Return to 010002 (chapter 3) |
| 142,132 | Child | Gets the CPU for the first time |
| 143,586 | Child | `newproc()` returns 1 |
| 143,618 | Child | Write the parent's process ID to the saved R0 (chapter 4) |
| 149,518 | Child | Return to 010000 (chapter 5) |

Most of the time in `fork()` is spent in `newproc()`. Copying the process image takes about 120,000 ticks.
The parent returns to user mode first and goes to sleep waiting for the child to finish. The child starts after that and returns 24,625 ticks later than the parent.
Between the write in chapter 4 and the return in chapter 5 the child gives up the CPU once. That is why chapters 4 and 5 stop separately.

## 7. Why the return address

`newproc()` copies the parent process as a whole. The saved registers and the return address in the child are the same as in the parent.
Right after the copy the two processes are identical. The kernel then adds just two differences: the value of R0 and the parent's return address.

A program written in assembler can use the return address directly. It puts a branch to the child's code in the word after `sys fork`.
No instruction has to test R0. The C library's `fork.s` builds the promise "0 in the child" on top of the same mechanism.

V7 kept this design. The kernel's `fork()` ends like this.

```c
        if(newproc()) {
                u.u_r.r_val1 = p1->p_pid;
                ...
                return;
        }
        u.u_r.r_val1 = p2->p_pid;

out:
        u.u_ar0[R7] += NBPW;
```

`NBPW` is the number of bytes in a word, 2. The C library's `fork.s` has the same `br 1f`, `bec 2f` and `clr r0` as in V6.
The sentence from the manual quoted at the top describes these two pieces of code.

## 8. What was confirmed

| What to check | What was observed |
| --- | --- |
| The kernel advances only the parent's return address by one word | In the parent it wrote 010002 to 141774 and returned to `bec 2f`. In the child it wrote nothing there and returned to `br 1f` at 010000 |
| The value handed to the child is the parent's process ID | `fork()` on the child's side wrote 000006 to 141772. R0 was 000006 when the child returned to user mode |
| The 0 comes from a `clr r0` in the C library | The child went `br 1f` → `mov r0,_par_uid` → `clr r0`, and R0 became 0 26 ticks after the return |

Parent and child take different paths for only two instructions after the return and meet again at `2:`.
The C `if` that tests whether `fork()` returned 0 runs after that.

## 9. Related documents

- [27-swtch-You-are-not-expected-to-understand-this.md](?doc=27-swtch-You-are-not-expected-to-understand-this.md) — how `newproc()` returns 1 to the child
- [28-setd-the-trap-is-ignored.md](?doc=28-setd-the-trap-is-ignored.md) — the first instruction the child runs after `exec`
- [12-unix-v6-システムコール.md](?doc=12-unix-v6-システムコール.md) — the entry of the `sys` instruction and the layout of the saved registers
- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md) — Trigger, Post and scenarios
- [53-参考資料.md](?doc=53-参考資料.md) — Unix V6 sources and commentaries
