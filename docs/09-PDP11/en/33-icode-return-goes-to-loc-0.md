# 33. The First Process Is Eleven Words the Kernel Copies by Hand <a class="qr-link" href="../../../docs/09-PDP11/img/33-en-QR.png">QR</a>

Every UNIX process is made by `fork`. Without a parent there is no child.
Who makes the first process, then? In UNIX Version 6 the answer is in two comments in `sys/ken/main.c`.

> Icode is the octal bootstrap program executed in user mode to bring up the system.
>
> Return goes to loc. 0 of user init code just copied out.

The two comments make three claims.

| No. | What the comments say |
| --- | --- |
| 1 | The kernel copies a small program, written in octal, into user space |
| 2 | Returning from `main()` lands at location 0 of that program |
| 3 | The program runs in user mode and brings up the system |

This article boots the real Unix V6 on a PDP-11 written in Verilog and checks the three claims on waveforms, one by one.
The tool is the debug panel of [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).

---

## 1. The code

`icode` is an array of 11 words at the top of `main.c`.

```c
int     icode[]
{
        0104413,        /* sys exec; init; initp */
        0000014,
        0000010,
        0000777,        /* br . */
        0000014,        /* initp: init; 0 */
        0000000,
        0062457,        /* init: </etc/init\0> */
        0061564,
        0064457,
        0064556,
        0000164,
};
```

It is a C array, but its contents are machine code. Placed at address 0, the words mean this.

| Address (octal) | Word | Meaning |
| --- | --- | --- |
| 000 | 104413 | `sys exec`. The next two words are its arguments |
| 002 | 000014 | Address of the name of the file to execute (014) |
| 004 | 000010 | Address of the argument list (010) |
| 006 | 000777 | `br .`. If `exec` fails, the program spins here |
| 010 | 000014 | The argument list. Entry 0 is the address of the name (014) |
| 012 | 000000 | End of the list |
| 014–024 | 062457 … 000164 | The string `/etc/init` and its terminating 0 |

In C it would be the single line `execl("/etc/init", "/etc/init", 0);`.

The array is used at the end of `main()`.

```c
        if(newproc()) {
                expand(USIZE+1);
                estabur(0, 1, 0, 0);
                copyout(icode, 0, sizeof icode);
                /*
                 * Return goes to loc. 0 of user init
                 * code just copied out.
                 */
                return;
        }
        sched();
```

Up to this point `main()` has sized memory and built process 0 by hand.
`newproc()` copies process 0 to make process 1. It is the same function `fork` uses, and it returns 0 to the parent and 1 to the child.
The parent, process 0, goes on to `sched()` and never comes back. It becomes the process in charge of swapping.

The child, process 1, enters the `if`. `expand` and `estabur` give it just 64 bytes of user space, and `copyout` copies `icode` there.
Then it returns.

`main()` was called from `start` in `conf/m40.s`, which is written in assembler.

```asm
/ set up previous mode and call main
/ on return, enter user mode at 0R

        mov     $30000,PS
        jsr     pc,_main
        mov     $170000,-(sp)
        clr     -(sp)
        rtt
```

When `main` returns, the code pushes 170000, the value for the PS, and 0, the value for the PC, and executes `rtt`.
`rtt` is the instruction that returns from an interrupt. Here there was no interrupt to return from. The two words were built by hand.

## 2. Setting up the observation

`icode` runs only once, at boot. The trigger has to be armed before the kernel is loaded.

1. Open [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web).
2. Press **Reset** in the top bar. The terminal shows `@` and waits for input.
3. Press the button below.
4. Click the terminal, type `rkunix` and press Enter.

[▶ Apply these settings](?scenario=icode)

Right after the page loads, `rkunix` is typed automatically and the system goes on to `login:`. After Reset nothing is typed for you, so it stops at `@`.

The button does these three things. The order is the same when you set them by hand.

1. Open the **Logic Analyzer** panel.
2. In **Trigger**, pick the preset `V6 icode: first user instruction (sys exec)` and press **Set**.
3. Show only the LA signals `VA`, `PhysAddr`, `Data`, `WR`, `RD`, `PC`, `Mode`, `TRAP` and `SP`.

The preset fires on the tick that fetches the instruction word 104413 at address 0.
That is about 7.27 million ticks after the Enter of `rkunix`, a few seconds on screen. The simulation stops before anything is printed.

## 3. copyout: eleven words, one at a time

Once it has stopped, scroll the waveform to the left. Starting 525 ticks before the trigger, the same shape repeats 11 times.

![The copyout loop. Words read from kernel address 057114 are written to user addresses from 0 upward](docs/img/33-01-la-copyout.png)

The heart of `copyout` is a loop of three instructions.

| Address (octal) | Instruction | What it does |
| --- | --- | --- |
| 002372 | `mov (r0)+,-(sp)` | Read one word from kernel space and push it |
| 002374 | `mtpi (r1)+` | Write the word on the stack into user space |
| 002376 | `sob r2,…` | Decrement the word count and loop while it is not 0 |

One round takes 34 ticks. In the waveform the writes line up like this.

| Tick | Read from (kernel) | Written to (user) | Word |
| --- | --- | --- | --- |
| -525 | 057114 | 000000 | 104413 |
| -491 | 057116 | 000002 | 000014 |
| -457 | 057120 | 000004 | 000010 |
| -423 | 057122 | 000006 | 000777 |
| … | … | … | … |
| -185 | 057140 | 000024 | 000164 |

`mtpi` writes into the space of the "previous mode". `start` loaded 30000 into the PS, so the previous mode is User.
The `Mode` line changes to User only for the moment of the write. `VA` is 000000 and `PhysAddr` is 125300.
Kernel address 0 is physical address 0, but user address 0 is somewhere else, where `estabur` put it.

## 4. rtt: returning to a place never visited

Set the zoom to `16x` and look around the red dotted line.

![Back from main, start pushes 170000 and 0 and enters user address 0 with rtt. The sys exec traps right away](docs/img/33-02-la-first-user.png)

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| -33 | 003504 | 012746 | Fetch `mov $170000,-(sp)` |
| -23 | 141776 | 170000 | Push the value for the PS |
| -20 | 003510 | 005046 | `clr -(sp)` |
| -14 | 141774 | 000000 | Push the value for the PC |
| -11 | 003512 | 000006 | `rtt` |
| -6 | 141774 | 000000 | Pop the PC |
| -3 | 141776 | 170000 | Pop the PS. Mode changes to User |
| 0 | 000000 | 104413 | Fetch `sys exec` at user address 0 (the trigger) |

Here the `Mode` line becomes User for the first time. For the 7.27 million ticks since the Enter of `rkunix`, this CPU has executed nothing but kernel-mode instructions.
The first instruction it runs in user mode is the 104413 the kernel copied. SP is 0. There is no stack yet.

Process 1 never called `fork`. Still, `newproc()` returned 1 to it, and `rtt` "returned" it to user mode.
Push the two words by hand, and you can return to a place you have never been.
The same trick delivers signals ([chapter 32](?doc=32-signal-asks-the-process-to-do-something-to-itself.md)).

## 5. The first system call

User mode lasts only 5 ticks. 104413 is `sys exec`, so it traps immediately.

| Tick | Address | Value | What happens |
| --- | --- | --- | --- |
| +5 | — | — | The `TRAP` line goes high |
| +10 | 000034 | 000320 | Read the new PC from vector 034 |
| +13 | 000036 | 000346 | Read the new PS |
| +16 | 141776 | 170000 | Push the old PS on the kernel stack |
| +19 | 141774 | 000002 | Push the return address |
| +22 | 000320 | — | Enter `trap` in the kernel |
| +671 | 000000 | 104413 | `trap()` rereads user address 0 and takes call number 11 (`exec`) from the low 6 bits |

This time the two words are real ones, pushed by the hardware. They sit at the same addresses, in the same order, as the two words `start` pushed by hand in chapter 4.

`exec` loads `/etc/init` from disk and replaces the user space. The 11 words of `icode` are gone at this point.
About 540,000 ticks later the CPU fetches an instruction at user address 0 once more. This time the word is 170011.
`/etc/init` is written in C, so its first instruction is a SETD ([chapter 28](?doc=28-setd-the-trap-is-ignored.md)).

Press **Resume** in the top bar and `login:` appears.
The `getty` that prints `login:` is a process `init` made with `fork`. From here on, every process has a parent.

## 6. What was confirmed

| What the comments say | What was observed |
| --- | --- |
| A small program written in octal is copied into user space | `copyout` wrote one word every 34 ticks, 11 words in all, to user addresses 0–024 (physical 125300 and up) |
| Returning from `main()` lands at its location 0 | `start` pushed 170000 and 0 and executed `rtt`. Eleven ticks later the CPU fetched 104413 at address 0 |
| It runs in user mode and brings up the system | Mode became User for the first time 7.27 million ticks after the Enter of `rkunix`. The first instruction was `sys exec`, and 540,000 ticks later the first instruction of `/etc/init` ran |

`icode` ran in user mode for a single instruction, 5 ticks.
Of the work of making process 1, the kernel did the `fork` part by hand. Only the `exec` ran as an ordinary system call.

## 7. Related documents

- [21-バスサイクル実例.md](?doc=21-バスサイクル実例.md) — bus cycles during boot, and the first system call
- [27-swtch-You-are-not-expected-to-understand-this.md](?doc=27-swtch-You-are-not-expected-to-understand-this.md) — how `newproc()` returns 1 to the child
- [28-setd-the-trap-is-ignored.md](?doc=28-setd-the-trap-is-ignored.md) — SETD, the first instruction of `/etc/init`
- [32-signal-asks-the-process-to-do-something-to-itself.md](?doc=32-signal-asks-the-process-to-do-something-to-itself.md) — another `rtt` to two words pushed by hand
- [56-MMU-unix-v6-での使われ方.md](?doc=56-MMU-unix-v6-での使われ方.md) — where user address 0 is in physical memory
