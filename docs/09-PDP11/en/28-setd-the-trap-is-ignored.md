# 28. The First Instruction of Every C Program Is a Trap the Kernel Ignores <a class="qr-link" href="../../../docs/09-PDP11/img/28-en-QR.png">QR</a>

The UNIX Version 6 kernel contains a short comment that concerns every program written in C.
It sits in `sys/ken/trap.c`, where the kernel handles the illegal-instruction trap.

> If illegal instructions are not being caught and the offending instruction is a SETD, the trap is ignored.
> This is because C produces a SETD at the beginning of every program which will trap on CPUs without 11/45 FPU.

The comment makes three claims.

| No. | What the comment says |
| --- | --- |
| 1 | C produces a SETD at the beginning of every program |
| 2 | On a CPU without an FPU, the SETD traps |
| 3 | If illegal instructions are not being caught, the kernel ignores that trap |

This article runs the real Unix V6 on a PDP-11 written in Verilog and checks the three claims one by one in waveforms.
The tool is the debug panel of [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).
This CPU core has no FPU, so it is one of the CPUs the comment says will trap.

---

## 1. The code

SETD is an instruction of the FP11 floating-point processor. Its word is 170011, and it tells the FP11 to work in double precision from then on.
C does its floating-point arithmetic in double precision, so a C program makes this setting before anything else runs.

The SETD comes from `crt0.s`, the entry code of a C program. `cc` links it at the front of every program.

```asm
start:
        setd
        mov     sp,r0
        mov     (r0),-(sp)
        tst     (r0)+
        mov     r0,2(sp)
        jsr     pc,_main
```

The `setd` lands at address 0. It is the first instruction executed, whether or not `main` uses floating point.

The receiving end is `trap()` in the kernel.

```c
#define SETD    0170011         /* SETD instruction */
        ...
        case 1+USER: /* illegal instruction */
                if(fuiword(pc-2) == SETD && u.u_signal[SIGINS] == 0)
                        goto out;
                i = SIGINS;
                break;
        ...
        psignal(u.u_procp, i);

out:
        if(issig())
                psig();
        setpri(u.u_procp);
}
```

`pc` is the return address the hardware pushed when the trap happened. It points just past the offending instruction.
`fuiword(pc-2)` reads the word before it from user space, that is, the offending instruction itself.
If that word is a SETD and the process is not catching SIGINS, the illegal-instruction signal, `goto out` skips `psignal`.
No signal is sent, so the process carries on from the next instruction as if nothing had happened.

## 2. Counting the first words

Claim 1 can be checked against the commands on the disk.
A V6 executable starts with a 16-byte header, and the word right after it is the instruction at address 0.

```text
# od /bin/ls
0000000 000410 010400 001050 002366 000000 000000 000000 000001
0000020 170011 010600 011046 005720 010066 000002 004767 000010
```

The 170011 at the start of the second line is the SETD. The 112 executables in `/bin`, `/usr/bin` and `/etc` fall into three groups by their first instruction.

| First instruction | Count | Examples | Entry code |
| --- | --- | --- | --- |
| `setd` (170011) | 79 | `ls`, `sh`, `date`, `cc`, `ed` | `crt0.s` |
| `sys signal; 4; fptrap`, then `setd` | 6 | `units`, `cdb`, `prof`, `sa`, `typo`, `ac` | `fcrt0.s` (chapter 6) |
| Anything else | 27 | `cat`, `as`, `mkdir`, `nroff` | commands written in assembler |

Every command written in C is in the first or second row. The commands in the second row have their SETD three words later, at address 6.
The commands in the third row come from assembler sources such as `cat.s` and do not link `crt0.s`.
The comment's "every program" means every program written in C.

## 3. Setting up the observation

Open [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) and log in as `root` at `login:`.
When the `#` prompt appears, press the button below. It applies all the settings and arms the trigger.

[▶ Apply these settings](?scenario=setd-crt0)

Then run `ls` in the terminal.

The button does these three things. The order is the same when you set them by hand.

1. Open the **Logic Analyzer** panel.
2. In **Trigger**, pick the preset `V6 crt0: SETD at user 0 (trap ignored)` and press **Set**.
3. Show only the LA signals `VA`, `Data`, `WR`, `RD`, `PC`, `Mode`, `TRAP` and `SP`.

The preset fires on the tick that fetches the instruction word 170011 at address 0.
It compares both the address and the word, so it stops only at the first instruction of a program that starts with a SETD.
It keeps sampling for 1600 samples after firing, so one capture holds the trap from start to finish.

Running `cat /etc/ttys` instead of `ls` does not stop. The first instruction of `cat` is `mov (sp)+,r5` (012605).

## 4. Entering the trap

Run `ls`, and the simulation stops before the listing appears. Set the LA zoom to `1/2x` to see the whole capture.

![The whole SETD trap. Mode stays Kernel for 1477 ticks after the trigger](docs/img/28-01-la-overview.png)

The red dotted line is the trigger. To its left, `exec` is loading the program and returning to user mode.
`TRAP` rises right after the trigger and `Mode` goes straight back to Kernel. It does not become User again until tick +1477, near the right edge.
`ls` has executed one instruction and spent 1477 ticks inside the kernel.

Set the zoom to `16x` and press **⊙Trig** to go back to the trigger. The entry sequence becomes readable.

![Trap entry. The CPU reads vector 010 and pushes the old PS and PC on the kernel stack](docs/img/28-02-la-trap-entry.png)

Listed by ticks from the trigger. The values come from a run of `tests/setd`.

| Tick | Address | Mode | What happens |
| --- | --- | --- | --- |
| 0 | 000000 | User | fetches the instruction word 170011 (trigger) |
| +8 | 000010 | Kernel | reads the first vector word, 000320, the new PC |
| +11 | 000012 | Kernel | reads the second vector word, 000341, the new PS |
| +14 | 141776 | Kernel | pushes the old PS, 170004, on the kernel stack |
| +17 | 141774 | Kernel | pushes the old PC, 000002, on the kernel stack |
| +20 | 000320 | Kernel | fetches the first instruction of `trap` |

The CPU could not decode 170011 and took the reserved-instruction trap, as claim 2 says.
The vector is at address 010. The kernel's `low.s` defines it like this:

```asm
/ trap vectors
        trap; br7+0.            / bus error
        trap; br7+1.            / illegal instruction
        trap; br7+2.            / bpt-trace trap
```

The second line is the vector at 010. Its first word, `trap`, is the entry address 000320, and its second word, `br7+1.`, is 000341.
`br7` is the PS for interrupt priority 7 (000340), and the 1 added to its low bits is the kind of trap.
The assembly entry code extracts those low five bits and passes them to `trap()` as the argument `dev`. That is the 1 in `case 1+USER`.

The pushed PC is 000002. SETD is a one-word instruction, so the return address points just past it.

## 5. Checking for SETD, and returning

The C function `trap()` is entered at tick +248. Until then, the assembly entry code is saving registers.
Set the zoom to `8x` and move to around tick +700. The `if` line from chapter 1 is in the waveform.

![fuiword reads user address 0, the kernel compares it with 170011 and checks u.u_signal](docs/img/28-03-la-setd-check.png)

| Tick | Address | Mode | What happens |
| --- | --- | --- | --- |
| +638 | 000000 | User | `fuiword(pc-2)` reads 170011 |
| +713 | 022000 | Kernel | fetches `cmp r0,$170011`; it matches SETD |
| +738 | 140352 | Kernel | reads `u.u_signal[SIGINS]`; the value is 000000 |
| +743 | 022012 | Kernel | fetches `beq`; it branches to `out` |
| +749 | 021734 | Kernel | calls `issig()` at `out:` |

At tick +638, `Mode` shows User for a moment.
`fuiword` comes down to the instruction `mfpi (r1)`, which stays in kernel mode but reads from the address space of the mode that was interrupted.
It reads the same word at address 0 that was fetched on the trigger tick.

`u.u_signal[SIGINS]` was 0. `ls` is not catching SIGINS, so both conditions hold.
`psignal` is not called. The kernel goes through `issig()` and `setpri()` and returns to the assembly entry code.

![rtt pops the PC and PS from the kernel stack and the CPU fetches the instruction at address 2](docs/img/28-04-la-return.png)

| Tick | Address | Mode | What happens |
| --- | --- | --- | --- |
| +1467 | 000522 | Kernel | fetches `rtt` |
| +1472 | 141774 | Kernel | pops the PC, 000002 |
| +1475 | 141776 | Kernel | pops the PS, 170004 |
| +1478 | 000002 | User | fetches `mov sp,r0` (010600) |

The two words pushed at ticks +14 and +17 come back unchanged. The user SP is still 177766, and nothing was pushed on the user stack.
From the process's point of view, SETD was an instruction that did nothing and took one step. That is claim 3.

In the meantime the kernel executed 131 instructions. The next instruction, `mov sp,r0`, takes 8 ticks.
One tick of this simulator is about 0.3 µs, so 1477 ticks is about 0.4 ms.
Every command written in C spends that much on its first instruction, each time it runs.

## 6. A program that catches the signal is not ignored

Claim 3 carries a condition: "if illegal instructions are not being caught". The reason for it is in the other entry code, `fcrt0.s`.

```asm
/ C runtime startoff
/ with floating point interpreter

start:
        sys     signal; 4; fptrap
        setd
        mov     sp,r0
```

Compiling with `cc -f` links this entry code instead of `crt0.s`.
`fptrap` is a simulator that executes FP11 instructions one at a time in software (`s3/fp1.s`).
The first line, `sys signal; 4; fptrap`, registers it as the SIGINS handler, so it is called every time an FP11 instruction traps.
That is how a program that uses floating point runs on a machine without an FPU.

If the kernel ignored the SETD here, `fptrap` would run without ever learning that double precision was selected.
So for a process that is catching SIGINS, the kernel delivers the SETD trap like any other.

`units`, the unit conversion program, uses this entry code. Press the button below, then run `units` in the terminal.
Pressing the button in chapter 3 closed this article. Reopen chapter 28 from the document list at the top and come back here.
The stopped `ls` resumes when you press the button.

[▶ Apply these settings](?scenario=setd-fcrt0)

The button also opens the **Stack / Memory** panel and arms the preset `V6 units: fptrap entry (SIGINS caught)`.
It stops on the tick that fetches the first instruction of `fptrap`, `dec reenter` at address 007100.

![Stack / Memory panel, stopped at the entry of fptrap. The top two words at SP are a return address and a PS](docs/img/28-05-stack-fptrap.png)

The right column is the user stack. SP is 177760, and the top two words are 000010 and 170004.
Before the SETD trap the SP was 177764. Two words have been added below it.
The call chain on the left follows R5, which is 0 at this point, so it means nothing here.

The two words were pushed by `psig()` in the kernel.

```c
        if((p=u.u_signal[n]) != 0) {
                u.u_error = 0;
                if(n != SIGINS && n != SIGTRC)
                        u.u_signal[n] = 0;
                n = u.u_ar0[R6] - 4;
                grow(n);
                suword(n+2, u.u_ar0[RPS]);
                suword(n, u.u_ar0[R7]);
                u.u_ar0[R6] = n;
                u.u_ar0[RPS] =& ~TBIT;
                u.u_ar0[R7] = p;
                return;
        }
```

It lowers the user SP by 4, writes the old PS and PC to the user stack with `suword`, and replaces the return PC with the handler's address.
The kernel builds, on the user stack, the same two words the hardware pushes for an interrupt.
In the waveform, the following is left before the trigger. The values are from a run with no interrupt in between.

| Tick | Address | Mode | What happens |
| --- | --- | --- | --- |
| -3008 | 000006 | User | fetches the instruction word 170011 |
| -2370 | 000006 | User | `fuiword(pc-2)` reads 170011 |
| -2270 | 140352 | Kernel | reads `u.u_signal[SIGINS]`; the value is 007100 |
| -2203 | 022644 | Kernel | enters `psignal(u.u_procp, SIGINS)` |
| -1636 | 023144 | Kernel | enters `psig()` |
| -989 | 177762 | User | writes the old PS, 170004, to the user stack |
| -743 | 177760 | User | writes the old PC, 000010, to the user stack |
| -596 | 141774 | Kernel | replaces the return PC on the kernel stack with 007100 |
| -11 | 000522 | Kernel | fetches `rtt` |
| 0 | 007100 | User | fetches `dec reenter` in `fptrap` (trigger) |

The difference from chapter 5 is at tick -2270. `u.u_signal[SIGINS]` holds 007100, the address of `fptrap`, so the second half of the condition fails.
The PC that `rtt` pops is the 007100 written at tick -596. The return goes to the handler, not to the instruction after the SETD.

Press **▶ Step** twice to run 600 ticks. The waveform now covers `fptrap` to its end.

![Exit of fptrap. rti pops the PC and PS from the user stack and returns to address 10](docs/img/28-06-la-fptrap-rti.png)

| Tick | Address | What happens |
| --- | --- | --- |
| +26 | 177760 | pops the return address, 000010, and saves it |
| +176 | 000006 | reads the trapped instruction, 170011, from the word before the return address |
| +327 | 007502 | fetches `bis $m.ext,fpsr` at `i.setd`; it sets the double-precision flag |
| +509 | 007636 | fetches `rti` |
| +514 | 177760 | pops the PC, 000010 |
| +517 | 177762 | pops the PS, 170004 |
| +520 | 000010 | fetches `mov sp,r0` (010600) |

`fptrap` finds the trapped instruction the same way the kernel does. It reads the word before the return address and dispatches on the low bits of the instruction word.
Handling SETD takes one instruction, which sets the double-precision flag in `fpsr`, the simulator's own status word.
The final `rti` runs in user mode, pops the two words `psig()` pushed, and returns to address 10.

`fptrap` ran 47 instructions in 520 ticks. Counted from the fetch of the SETD, the whole thing took 3528 ticks.
`psig()` keeps the handler registered after calling it for SIGINS only (`n != SIGINS` in the code above).
Every FP11 instruction `units` executes takes this path.

## 7. Version 7 did not change it

`trap.c` in Version 7 still has the same comment and the same test ([trap.c](https://github.com/dspinellis/unix-history-repo/blob/Research-V7/usr/sys/sys/trap.c)).

```c
        case 1+USER: /* illegal instruction */
                if(fuiword((caddr_t)(pc-1)) == SETD && u.u_signal[SIGINS] == 0)
                        goto out;
                i = SIGINS;
                break;
```

The V7 `crt0.s` still starts with `setd`, and `fcrt0.s` still puts `setd` after `sys signal; 4; fptrap` ([csu](https://github.com/dspinellis/unix-history-repo/tree/Research-V7/usr/src/libc/csu)).
`swtch()` from chapter 27 was redesigned in V7. This part was left alone.

With this design, the same `ls` runs unchanged on a machine with an FPU and on one without.
In exchange, a machine without an FPU goes through one trap, only to ignore it, every time it runs a C command.

## 8. Summary

| What the comment says | What was confirmed |
| --- | --- |
| C produces a SETD at the beginning of every program | Of 112 executables, the 85 written in C have a SETD in their entry code: 79 at address 0 and 6 at address 6. The 27 written in assembler do not start with one |
| On a CPU without an FPU, the SETD traps | 8 ticks after fetching 170011 the CPU read vector 010 and entered `trap` |
| If not being caught, the trap is ignored | In `ls`, `u.u_signal[SIGINS]` was 0 and the kernel returned to address 2 without calling `psignal`: 1477 ticks, 131 instructions |
| If being caught, it is not ignored | In `units`, `psig()` pushed two words on the user stack, `fptrap` handled the SETD and returned to address 10 with `rti` |

An illegal instruction that is not a SETD meets neither condition and becomes SIGINS. If the process is not catching it, the process ends and leaves a core file.
[Chapter 63](?doc=63-mknod-Illegal-instruction-調査.md) (in Japanese) has an example.

## 9. Related documents

- [27-swtch-You-are-not-expected-to-understand-this.md](?doc=27-swtch-You-are-not-expected-to-understand-this.md) — the `swtch()` comment, checked the same way
- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md) — Trigger, Post, Step and the Stack / Memory panel
- [12-unix-v6-システムコール.md](?doc=12-unix-v6-システムコール.md) — the system call entry, which goes through the same `trap()`
- [56-MMU-unix-v6-での使われ方.md](?doc=56-MMU-unix-v6-での使われ方.md) — how `mfpi` reads user space
- [53-参考資料.md](?doc=53-参考資料.md) — Unix V6 sources and commentaries
