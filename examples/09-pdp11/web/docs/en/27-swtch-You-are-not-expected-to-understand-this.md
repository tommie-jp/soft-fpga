# 27. Watching "You are not expected to understand this" on a Logic Analyzer

UNIX Version 6 (1975) contains the most famous comment in programming history:
`You are not expected to understand this.`, in `swtch()` in `sys/ken/slp.c`.

The comment is usually introduced like this:

> The routine restored an earlier stack frame so that a return could resume execution in a different function.
> It relied on the way the PDP-11 C compiler saved registers.
> Dennis Ritchie later admitted that the mechanism was fundamentally broken and had to be redesigned
> when UNIX was ported to another architecture.

This article runs the real Unix V6 on a PDP-11 written in Verilog and checks those three sentences one by one,
with waveforms and stack dumps.
The tool is the debug panel of [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).

---

## 1. The code

The comment sits at the end of `swtch()`, the function that switches processes.

```c
        /*
         * Switch to stack of the new process and set up
         * his segmentation registers.
         */
        retu(rp->p_addr);
        sureg();
        /*
         * If the new process paused because it was
         * swapped out, set the stack level to the last call
         * to savu(u_ssav).  This means that the return
         * which is executed immediately after the call to aretu
         * actually returns from the last routine which did
         * the savu.
         *
         * You are not expected to understand this.
         */
        if(rp->p_flag&SSWAP) {
                rp->p_flag =& ~SSWAP;
                aretu(u.u_ssav);
        }
        /*
         * The value returned here has many subtle implications.
         * See the newproc comments.
         */
        return(1);
```

`savu`, `retu` and `aretu` are short assembly routines in `conf/m40.s`.

```asm
_savu:
        bis     $340,PS
        mov     (sp)+,r1
        mov     (sp),r0
        mov     sp,(r0)+
        mov     r5,(r0)+
        bic     $340,PS
        jmp     (r1)

_aretu:
        bis     $340,PS
        mov     (sp)+,r1
        mov     (sp),r0
        br      1f

_retu:
        bis     $340,PS
        mov     (sp)+,r1
        mov     (sp),KISA6
        mov     $_u,r0
1:
        mov     (r0)+,sp
        mov     (r0)+,r5
        bic     $340,PS
        jmp     (r1)
```

What the three routines do:

| Routine | What it does |
| --- | --- |
| `savu(a)` | Stores the current SP and R5 in the two words at `a` |
| `retu(p)` | Writes `p` to KISA6 to switch the u area, then loads SP and R5 from `u.u_rsav` |
| `aretu(a)` | Keeps the u area and loads SP and R5 from the two words at `a` |

Only SP and R5 are saved. R5 is the C frame pointer. Neither the PC nor R2–R4 is saved.
That becomes the problem later.

The u area is a 1 KB region that holds a process's kernel stack and its `user` structure.
It appears at kernel virtual address 140000, and KISA6 (kernel page address register 6) selects whose u area is mapped there.
`u.u_rsav` is at 140000 and `u.u_ssav` is at 140336.

## 2. Why `u_ssav` exists

One place that sets SSWAP is `newproc()`, the body of `fork`, when memory runs out.

```c
        savu(u.u_rsav);
        ...
        a2 = malloc(coremap, n);
        /*
         * If there is not enough core for the
         * new process, swap out the current process to generate the
         * copy.
         */
        if(a2 == NULL) {
                rip->p_stat = SIDL;
                rpp->p_addr = a1;
                savu(u.u_ssav);
                xswap(rpp, 0, 0);
                rpp->p_flag =| SSWAP;
                rip->p_stat = SRUN;
        }
```

There is no room for the child, so the parent writes its own memory to the swap area and that copy becomes the child's image.
The write goes like this:

1. `newproc` calls `savu(u.u_rsav)` and `savu(u.u_ssav)`. Both receive the SP and R5 of `newproc`'s frame.
2. `xswap` → `swap` asks the disk to write and calls `sleep` to wait for it.
3. `sleep` calls `swtch`. The `savu(u.u_rsav)` at the top of `swtch` overwrites the parent's `u.u_rsav` with the values of **`swtch`'s frame**.
4. The disk reads the parent's memory and writes it out.

The order of steps 3 and 4 matters. Disks are slow, so step 3 finishes first.
The `u.u_rsav` in the child's image on disk then points into `swtch ← sleep ← swap ← xswap`, the frames the parent pushed in order to wait.
If the child started from there, it would wait for a disk transfer that finished long ago.

So the same values are also kept in `u.u_ssav`, which nothing overwrites, and the child's `p_flag` is marked with SSWAP.
The first time the child runs, `swtch` sees the mark and calls `aretu(u.u_ssav)` to put SP and R5 back into `newproc`'s frame.

## 3. Setting up the observation

Open [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) and log in as `root` at `login:`.

### 3.1 A program that runs out of memory

The machine has 128 KB of RAM. Eight processes, each grown by 16000 bytes, do not fit.

```text
# cat >swp.c
main(){ int i; sbrk(16000); for(i=0;i<3;i++) fork(); sleep(4); }
^D
# cc swp.c
```

### 3.2 Debug panel settings

1. Open the **Logic Analyzer** and **Stack / Memory** panels.
2. Set **RK seek** in the LA bar to `4K clk (1.2 ms)` (chapter 7 explains why).
3. In **Trigger**, pick the preset `V6 swtch: SSWAP path (aretu u_ssav)` and press **Set**.
4. Show the LA signals `VA`, `Data`, `RD`, `PC`, `SP`, `R5` and `KISA6`.
5. Run `a.out` in the terminal.

The preset stops at the fetch of the instruction at 016000, `bicb $10,1(r2)` (`rp->p_flag =& ~SSWAP`).
That instruction runs only when SSWAP is set. The trigger also compares the instruction word (142762), so the same address in a user process does not stop it.

The addresses are those of `/rkunix` on the distribution disk.

| Address (octal) | Instruction | C line |
| --- | --- | --- |
| 015770 | `bitb $10,1(r2)` | `if(rp->p_flag&SSWAP)` |
| 016000 | `bicb $10,1(r2)` | `rp->p_flag =& ~SSWAP;` |
| 016006 | `mov $140336,(sp)` | pushes the argument `u.u_ssav` |
| 016012 | `jsr pc,*$_aretu` | `aretu(u.u_ssav);` |
| 016016 | `mov $1,r0` | `return(1);` |
| 016022 | `jmp cret` | function epilogue |

## 4. The stack at the moment it stops

Running `a.out` stops the simulation almost at once. The Stack / Memory panel looks like this.

![Stack / Memory panel, stopped just before aretu](docs/img/27-01-stack-before-aretu.png)

The call chain follows the R5 links.
V6 C puts the caller's R5 at `(R5)` and the return address at `2(R5)` on function entry.

| R5 | Return address | Whose frame |
| --- | --- | --- |
| 141606 | 014442 `sleep+170` | `swtch` (called by `sleep`) |
| 141622 | 045716 `swap+212` | `sleep` (called by `swap`) |
| 141640 | 020510 `xswap+126` | `swap` (called by `xswap`) |
| 141662 | 016420 `newproc+372` | `xswap` (called by `newproc`) |
| 141712 | 035004 `fork+46` | `newproc` (called by `fork`) |
| 141726 | 022534 `trap1+26` | `fork` (called by the system call entry) |

The running process is the newborn child. It never called `sleep` or `swap`.
The first four rows are frames **the parent** pushed while it waited for the disk, copied to the child along with the rest of memory.
The order of steps 3 and 4 in chapter 2 is preserved in the stack.

`retu` loaded this image's `u.u_rsav` (141576 and 141606), so SP and R5 point into the parent's `swtch` frame.
A `return` from here would go to `sleep+170`, and the child would keep waiting for a finished transfer.

## 5. Before and after `aretu`

Press **▶ Step** once to run 300 ticks. The waveform now covers `aretu` through the return.

![Waveform around aretu. R5 and SP move to newproc's frame](docs/img/27-03-la-aretu.png)

Listed by ticks from the trigger. The values come from a run of `tests/swtch`.

| Tick | Address | What happens | SP | R5 |
| --- | --- | --- | --- | --- |
| 0 | 016000 | Fetch `bicb $10,1(r2)` (trigger) | 141576 | 141606 |
| +33 | 016012 | Fetch `jsr pc,*$_aretu` | 141576 | 141606 |
| +40 | 141574 | Push the return address 016016 | 141574 | 141606 |
| +81 | 141576 | Read the argument 140336 (`&u.u_ssav`) into R0 | 141576 | 141606 |
| +98 | 140336 | Read `u.u_ssav[0]` = 141672 | **141672** | 141606 |
| +109 | 140340 | Read `u.u_ssav[1]` = 141712 | 141672 | **141712** |
| +140 | 016016 | Back in `swtch`, fetch `mov $1,r0` | 141672 | 141712 |

Two reads move SP from 141576 to 141672 and R5 from 141606 to 141712.
`aretu` returns with `jmp (r1)` to the rest of `swtch`, so the PC stays inside `swtch`.
The function is still `swtch`. Only the stack frame has been replaced by `newproc`'s.

After the Step, the four frames the parent pushed are gone from the call chain.

![Stack / Memory panel after stepping through aretu and the return](docs/img/27-02-stack-after-step.png)

`aretu` ends by enabling interrupts again. A pending clock interrupt may come in at that point, and the PC then shows `call` (the interrupt entry).
Press Step a few more times to get back into `swtch`.

## 6. `return(1)` returns to `fork`

The `return(1)` that follows compiles to `jmp cret`. `cret` is the epilogue shared by every function.

```asm
csv:
        mov     r5,r0
        mov     sp,r5
        mov     r4,-(sp)
        mov     r3,-(sp)
        mov     r2,-(sp)
        jsr     pc,(r0)

cret:
        mov     r5,r1
        mov     -(r1),r4
        mov     -(r1),r3
        mov     -(r1),r2
        mov     r5,sp
        mov     (sp)+,r5
        rts     pc
```

`cret` finds the registers and the return address **relative to R5**. On the waveform:

| Tick | Address read | Value | Goes to |
| --- | --- | --- | --- |
| +175 | 141710 | 063154 | R4 |
| +186 | 141706 | 063230 | R3 |
| +197 | 141704 | 057722 | R2 |
| +216 | 141712 | 141726 | R5 (`fork`'s frame) |
| +227 | 141714 | 035004 | PC (`fork+46`) |

At +230 ticks the CPU fetches the instruction at 035004, right after the call to `newproc()` inside `fork`. R0 is 1.
`fork` did not call `swtch`. Even so, the `return(1)` in `swtch` took the form of `newproc` returning 1 to `fork`.
This is how the comment on `newproc`, "It returns 1 in the new process", is carried out.
The parent returns to `fork` in the ordinary way, through the `return(0)` at the end of `newproc`.

It works because of two rules of the V6 C compiler:

- Every function calls the same `csv` on entry, which pushes R2–R4 just below R5, in the same order.
- Every function leaves through the same `cret`, which needs nothing but R5 to find the registers and the return address.

Point R5 at another function's frame, execute `return`, and it passes for a `return` from that function.
This is what the second sentence at the top, "It relied on the way the PDP-11 C compiler saved registers", refers to.

## 7. With a fast disk, nothing happens

Set **RK seek** back to `Off` and repeat. This time `aretu` changes nothing.

| RK seek | Just before `aretu` (SP / R5) | Just after `aretu` (SP / R5) |
| --- | --- | --- |
| `4K clk` | 141576 / 141606 | 141672 / 141712 |
| `Off` | 141672 / 141712 | 141672 / 141712 |

With `Off`, the simulated RK11 starts the transfer right after it is asked to write.
The parent's `swtch` overwrites `u.u_rsav` about 560 ticks after the transfer starts.
`u.u_rsav` is the first two words of the u area, and the transfer moves one word about every 28 ticks.
The words go to disk, still holding `newproc`'s values, before the overwrite.
Steps 3 and 4 of chapter 2 swap places, `u_rsav` equals `u_ssav`, and `aretu` has nothing to change.

A real RK05 needs 50 ms on average to move the heads and another 20 ms on average for the sector to come around.
One tick of this simulator is about 0.3 µs, so even a 4096-clock delay is only 1.2 ms.
That is still enough to put the two steps in the same order as on the real machine, and `aretu` does its job.

`aretu(u.u_ssav)` is a line that only means something on the assumption that the disk is far slower than the CPU.
With a fast disk it never has work to do, and the system runs without it. We learned this by running it.

## 8. What Ritchie meant by "broken"

Dennis Ritchie wrote about the comment later, in [Odd Comments and Strange Doings in Unix](https://9p.io/who/dmr/odd.html). The main points:

- The comment was meant in the spirit of "This won't be on the exam", not as a challenge.
- The real problem was that the authors did not understand what was going on either.
- The `savu` / `retu` mechanism was "fundamentally broken", because it depended on switching to a previous stack frame
  and executing function return code in a different procedure from the one that saved the earlier state.
- It worked on the PDP-11 because the compiler always saved registers the same way. With the Interdata compiler,
  the return code differed depending on which registers were saved.
- When he and Steve Johnson moved the kernel to a new machine, this code "was indeed on the exam".
  After about a week they agreed that changing the compiler would not help, and redid the control-passing primitives.

As chapter 6 showed, the `return` in `swtch` tears down `newproc`'s frame with `swtch`'s `cret`.
With a compiler that saves different registers for different functions, the frame layout and the epilogue no longer match,
and even the position of the return address shifts.
The third sentence at the top is about this.

In Version 7, `savu` / `retu` / `aretu` were replaced by `save` / `resume`.
`save` stores R2–R5 and SP together with the return address, and `resume` returns into the function that saved them, the same shape as C's `setjmp` / `longjmp`.
Nothing depends on another function's `return` any more, so the comment was no longer needed.

## 9. Summary

| Sentence | What we checked |
| --- | --- |
| It restored an earlier stack frame so that a return resumed in a different function | `aretu` moved SP and R5 into `newproc`'s frame, and the `return(1)` in `swtch` went to `fork+46` |
| It relied on the way the C compiler saved registers | `cret` finds R2–R4 and the return address from R5 alone, so it can tear down another function's frame |
| It was fundamentally broken and was redesigned | It fails with a compiler whose frames differ per function. V7 uses `save` / `resume` |

Running it showed one more thing.
The line only does something when the disk is slow enough for `u_rsav` to be overwritten.
V6 boots on an instruction emulator too, but lining up the moment SP and R5 move with the stack before and after it
takes a machine whose internal signals can be taken out.

## 10. Related documents

- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md) — Stack / Memory panel, Post and RK seek
- [56-MMU-unix-v6-での使われ方.md](?doc=56-MMU-unix-v6-での使われ方.md) — KISA6 and the u area
- [57-レジスタとistate.md](?doc=57-レジスタとistate.md) — registers and the CPU's internal state
- [53-参考資料.md](?doc=53-参考資料.md) — Unix V6 sources and commentaries
