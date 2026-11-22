# 32. A Signal Is Delivered by the Process to Itself <a class="qr-link" href="../../../docs/09-PDP11/img/32-en-QR.png">QR</a>

The UNIX Version 6 kernel sums up the signal mechanism in one sentence.
The comment sits in `sys/ken/sig.c`, just above `issig()`.

> A signal does not do anything directly to a process; it sets a flag that asks the process to do something to itself.

Press a key and the program stops, so a signal looks like something done to a process from outside. The comment says it is not.
There are four things to check.

| No. | What to check |
| --- | --- |
| 1 | The key interrupt only sets one flag and returns |
| 2 | The process itself does the delivery, on its way out of the kernel |
| 3 | For the delivery, the kernel pushes two words on the user stack, laid out like an interrupt frame |
| 4 | The handler returns by popping those two words with an `rtt` in user mode |

This article runs the real Unix V6 on a PDP-11 written in Verilog and checks the four points on waveforms, one by one.
The tool is the debug panel of [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).

---

## 1. The code

The interrupt key of V6 is DEL (octal 177). `ttyinput()` in `dmr/tty.c`, which receives terminal input, watches for it.

```c
        if ((t_flags&RAW)==0 && (c==CQUIT || c==CINTR)) {
                signal(tp, c==CINTR? SIGINT:SIGQIT);
                flushtty(tp);
                return;
        }
```

`signal()` calls `psignal()` for every process that uses the terminal. What `psignal()` does is close to one line.

```c
psignal(p, sig)
int *p;
{
        register *rp;

        if(sig >= NSIG)
                return;
        rp = p;
        if(rp->p_sig != SIGKIL)
                rp->p_sig = sig;
        if(rp->p_stat > PUSER)
                rp->p_stat = PUSER;
        if(rp->p_stat == SWAIT)
                setrun(rp);
}
```

It writes the signal number to `p_sig` in the process table and wakes the process if it is asleep. This is the flag the comment talks about.

The process itself looks at the flag. The exit path of system calls and traps has these two lines.

```c
out:
        if(issig())
                psig();
        setpri(u.u_procp);
```

`issig()` checks `p_sig` and returns the number if there is something to deliver. `psig()` delivers it.

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

`u.u_signal[n]` is the handler address the process registered with `signal()`.
`psig()` lowers the user stack pointer by 4 and writes the PS and the PC there. Then it replaces the return address with the handler.
The two words, PS and PC, are laid out exactly as the PDP-11 pushes them on an interrupt or a trap.

The handler side is `s5/signal.s` in the C library. It has `tvect`, a table with one entry per signal, and a common tail.

```asm
tvect:
        mov r0,-(sp); mov dvect+[NSIG*2],r0; br 1f; NSIG=NSIG+1
        ...
1:
        mov     r1,-(sp)
        mov     r2,-(sp)
        mov     r3,-(sp)
        mov     r4,-(sp)
        jsr     pc,(r0)
        mov     (sp)+,r4
        mov     (sp)+,r3
        mov     (sp)+,r2
        mov     (sp)+,r1
        mov     (sp)+,r0
        rtt
```

What the C call `signal(2, h)` registers with the kernel is not the address of `h`. It is entry number 2 of `tvect`.
The entry saves the registers, calls `h`, restores the registers when `h` returns and executes `rtt`.
`rtt` is the instruction that returns from an interrupt. It pops a PC and a PS from the stack, and here they are the two words `psig()` pushed.

## 2. Setting up the observation

Open [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) and log in as `root` at `login:`.

### 2.1 A program that catches a signal

Existing commands such as `ed` never return from their handler to where they were. To see the `rtt`, write a small program.

```text
# cat >sig.c
int n;
h(){ n++; }
main(){ char c; signal(2, h); read(0, &c, 1); printf("n=%d\n", n); }
^D
# cc sig.c
```

`^D` is Ctrl+D. `cc` takes about 10 seconds.
The program registers `h` for signal 2 (SIGINT), then tries to read one character from the terminal and waits.

### 2.2 The key that sends DEL

In this terminal the **Delete** key sends DEL (177).
The **Backspace** key sends `#`, because `#` is the erase character of V6. It cannot be used as the interrupt key.

### 2.3 Three stops

One press of the Delete key sets off four events in a row. This article stops three times to look at them.

| Chapter | Where it stops | Button |
| --- | --- | --- |
| 3 | Entry of `psignal()` | First |
| 4 | Entry of `psig()` | Second |
| 5 | First instruction of the handler | Third |

Pressing a button closes the document view. To press the next button, open chapter 32 again and scroll back.

## 3. The Delete key: only a flag is set

Run `a.out` in the terminal. The program waits for input. Now press the button below.

[▶ Apply the settings that stop in psignal](?scenario=sig-psignal)

Click the terminal, then press the Delete key once. The simulation stops at once.

The button does these three things.

1. Open the **Logic Analyzer** panel.
2. In **Trigger**, pick the preset `V6 psignal: signal number written to p_sig` and press **Set**.
3. Show only the LA signals `VA`, `Data`, `WR`, `RD`, `BYTE`, `PC`, `Mode`, `INT` and `Vec`.

The preset fires on the first instruction of `psignal()`, at kernel address 022644.
It keeps sampling for 1000 samples after firing, which is enough to hold both calls of `psignal()`.

To the left of the trigger is the path from the key interrupt to this point.

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| -853 | 000060 | 000254 | Receiver interrupt. The CPU reads the entry address from vector 060 |
| -705 | 052432 | — | Enter `klrint()` |
| -574 | 177562 | 000177 | Read the key, DEL, from the receiver buffer |
| -501 | 050110 | — | Enter `ttyinput()` |
| -252 | 022572 | — | Enter `signal()` |
| 0 | 022644 | 004567 | Enter `psignal()` (the trigger) |

When the interrupt arrived, `a.out` was not running. It was asleep waiting for input, and the CPU was in the idle loop.
Not one instruction of `a.out` has been executed, let alone the handler `h`.

The body of `psignal()` is 146 ticks after the trigger.

![Inside psignal. There is a single write with BYTE set, storing 2 at address 062725](docs/img/32-01-la-psignal-write.png)

| Tick | Address written | Value | Target |
| --- | --- | --- | --- |
| +146 | 062725 | 002 | `p_sig` of the shell (process 6) |
| +809 | 062753 | 002 | `p_sig` of `a.out` |

The write with the `BYTE` line high is `rp->p_sig = sig;`. It stores 2 (SIGINT) in one byte.
`psignal()` is called twice, because two processes use this terminal: the shell and `a.out`. The shell ignores SIGINT, so nothing happens there even though its flag is set.

This capture contains no write to the user stack, and `psig()` is not called.
All that happened inside the interrupt was two bytes changed in the process table and a `setrun()` to wake the sleeping process.

## 4. psig: two words go on the user stack

Leave the simulation stopped, open chapter 32 again and press the next button. The simulation resumes and stops again right away.

[▶ Apply the settings that stop in psig](?scenario=sig-psig)

The preset is `V6 psig: frame pushed on user stack`. It fires on the first instruction of `psig()` at 023144.
That is about 15,000 ticks after the key interrupt. In between, the woken `a.out` has been given the CPU.

The left side of the trigger shows who called `psig()`.

| Tick | Function | What happens |
| --- | --- | --- |
| -887 | `issig` | The woken `a.out` checks the flag inside `sleep()` |
| -597 | `aretu` | The flag is set, so it abandons the `read` and goes back to `trap()` |
| -277 | `issig` | It checks the flag again at the exit of `trap()` |
| 0 | `psig` | It delivers the signal (the trigger) |

`a.out` itself checked the flag and called `psig()`. This call is what the comment means by "do something to itself".

Inside `psig()`, `suword` is called twice.

![The second suword in psig. It writes the interrupted address 001226 to 177730](docs/img/32-02-la-psig-push-pc.png)

| Tick | Address written | Value | C line |
| --- | --- | --- | --- |
| +692 | 177732 | 170001 | `suword(n+2, u.u_ar0[RPS]);` |
| +938 | 177730 | 001226 | `suword(n, u.u_ar0[R7]);` |
| +1085 | 141774 | 001410 | `u.u_ar0[R7] = p;` |

The stack pointer of `a.out` was 177734. The PS and the PC go into the two words below it.
`Mode` shows User only for the moment of the write, because `suword` writes into user space with the `mtpi` instruction.

001226 is the address of the instruction after `sys read` inside the C library's `read`. The interrupted system call was going to return there.
170001 is the PS at that time. The final 1 is the C bit, which says that `read` failed.
The third row replaces the return address. Address 141774 holds the saved PC, which was 001226. The kernel writes 001410 there, the SIGINT entry of `tvect`.

If a clock interrupt arrives in between, the three ticks move about 600 ticks to the right.

## 5. The handler: back with an rtt in user mode

Open chapter 32 once more and press the next button.

[▶ Apply the settings that stop at the handler entry](?scenario=sig-handler)

The preset is `V6 sig.c: SIGINT handler entry (tvect+20)`. It fires on the user instruction `mov r0,-(sp)` at 001410.
The address belongs to the `a.out` built from the source in 2.1. It changes if you change the source.

![Handler entry. The kernel's rtt pops 001410, and SP points to 177730](docs/img/32-03-la-handler-entry.png)

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| -5 | 141774 | 001410 | The kernel's `rtt` pops the PC |
| -2 | 141776 | 170001 | Pop the PS. Mode changes to User |
| 0 | 001410 | 010046 | `mov r0,-(sp)`. SP is 177730 |
| +10 | 001412 | 016700 | `mov dvect+4,r0`. R0 gets 000030, the address of `h` |
| +70 | 001640 | 004710 | `jsr pc,(r0)` calls `h` |
| +156 | 000034 | 005267 | `inc _n` inside `h` |

The kernel returned to 001410, not to 001226 where `read` was called.
Seen from `a.out`, a routine it never called started running in the middle of `read`. That is how a hardware interrupt looks.
The top two words of the stack are laid out as after an interrupt too: the return address at 177730 and the PS at 177732.

The end of the handler is 305 ticks after the trigger.

![Handler exit. The rtt in user mode pops 001226 from 177730 and 170001 from 177732](docs/img/32-04-la-handler-rtt.png)

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| +305 | 001654 | 000006 | Fetch `rtt` |
| +310 | 177730 | 001226 | Pop the PC |
| +313 | 177732 | 170001 | Pop the PS |
| +316 | 001226 | 103002 | Fetch `bec`. SP is back at 177734 |
| +322 | 001230 | 000167 | `jmp cerror` |

The `Mode` line stays at User all the way from the trigger. Returning from the handler does not involve the kernel.
`rtt` popped the two words that `psig()` pushed. It cannot tell them from a frame pushed by a real interrupt.

The PS comes back as well, so the state before the interruption continues. `inc _n` in `h` changed the condition codes, but the PS after `rtt` is 170001.
The C bit is still set, so `bec` does not branch and `read` returns -1 through `cerror`.
Press **Resume** in the top bar and the terminal prints `n=1`.

## 6. A computing process gets its signal once a second

The program used so far was waiting inside a system call. Its chance to check the flag came quickly.
A process that keeps computing without system calls has no such chance. Change `main` in `sig.c` like this to see it.

```c
main(){ signal(2, h); while(n == 0); printf("n=%d\n", n); }
```

Press the Delete key on this program and `psig()` is called from `clock()` in `ken/clock.c`.

```c
        if(++lbolt >= HZ) {
                ...
                if((ps&UMODE) == UMODE) {
                        u.u_ar0 = &r0;
                        if(issig())
                                psig();
                        setpri(u.u_procp);
                }
        }
```

`HZ` is 60. The kernel checks the flag of a user-mode process once every 60 clock interrupts, that is, once a second.
In this setup the clock interrupts every 10,000 ticks, so a second is 600,000 ticks.
Four measurements from the Delete key to `psig()` gave 318,400 to 620,600 ticks. Depending on when the key is pressed, the wait is up to a second.

The PC pushed in this case is the address of one of the three loop instructions, `tst _n`, `bne` or `br`.
After the handler sets `n` to 1 and returns with `rtt`, the loop ends at the next `tst _n`.

`clock()` also asks for a reschedule once every 4 seconds. When the two coincide, a process switch follows right after `psig()`.

## 7. What was confirmed

| What to check | What was observed |
| --- | --- |
| The key interrupt only sets one flag and returns | 853 ticks after the receiver interrupt the kernel entered `psignal()` and wrote one byte, 2, to `p_sig`. It did not touch the user stack |
| The process itself does the delivery | The woken `a.out` called `issig()` in `sleep()` and at the exit of `trap()`, then called `psig()` itself |
| Two words like an interrupt frame go on the user stack | The kernel wrote the PS 170001 to 177732 and the PC 001226 to 177730, then replaced the return address with 001410 |
| The handler returns with an `rtt` in user mode | The `rtt` at 001654 popped the two words and returned to 001226, 316 ticks after the entry, without entering the kernel |

From the Delete key to the first instruction of the handler took about 30,000 ticks.
In that time an interrupt, a process switch, an abandoned system call and `psig()` happened in turn.

## 8. Related documents

- [28-setd-the-trap-is-ignored.md](?doc=28-setd-the-trap-is-ignored.md) — the same `psig()` delivering the illegal-instruction signal to `fptrap`
- [29-fork-the-return-locations-differ-by-one-word.md](?doc=29-fork-the-return-locations-differ-by-one-word.md) — another case where the kernel rewrites the saved PC
- [12-unix-v6-システムコール.md](?doc=12-unix-v6-システムコール.md) — the entry and exit of `trap()`
- [21-バスサイクル実例.md](?doc=21-バスサイクル実例.md) — bus cycles of the clock interrupt
- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md) — Trigger, Post and scenarios
