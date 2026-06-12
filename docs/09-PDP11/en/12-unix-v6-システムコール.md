# 12. Unix V6 System Calls Reference <a class="qr-link" href="../../../docs/09-PDP11/img/12-QR.png">QR</a>

A reference list of Unix V6 (1975) system calls. Use this when writing
low-level programs in `as` or C on this simulator, and when observing traps
(`sys` instruction = `trap`) in the Logic Analyzer.

The kernel-side definitions are in `/usr/sys/ken/sysent.c`; the user-side
macros are in `/usr/source/s4/*.s` (C library stubs).

## 1. How System Calls Work

System calls are issued with the assembler `sys` pseudo-instruction, which
assembles to the PDP-11 `trap` instruction.

```text
sys n   →   trap instruction (octal 104400 + n)
```

- `sys 1` = `104401` (`exit`)
- The trap number `n` is used as an index into `sysent[]`
- The kernel enters `trap()` (`/usr/sys/ken/trap.c`) via the trap vector and
  calls the handler at `sysent[n]`

### 1.1 Passing Arguments

V6 uses an **inline argument** convention. Arguments are placed in the memory
words immediately following the `sys` instruction, and the kernel reads them
from the user-space PC position.

```asm
| Example: write(fd, buf, count)
mov     $1, r0          | fd = 1 (stdout) in r0
sys     write; msg; 13. | buf=msg, count=13 (decimal) placed inline
```

- Some calls pass the first argument in **r0** (e.g., fd for `read` / `write`)
- Remaining arguments are placed inline after the `sys` instruction
- C library stubs hide this layout from the programmer

### 1.2 Return Values and Errors

- Return values are placed in **r0** (and r1 if needed)
- The **carry bit (C flag)** indicates errors
  - C=0 … success
  - C=1 … error; r0 contains the error number
- The C library checks C=1, stores the value in the global variable `errno`, and returns `-1`

### 1.3 Indirect Call (`indir`, sys 0)

`sys 0` (`indir`) indirectly executes a `sys` instruction at another address.
This is a trick for dynamically switching system call numbers at runtime.

```asm
sys     indir; callspot  | execute the sys instruction at callspot
```

## 2. System Call Table (by Number)

Corresponds to the definitions in `/usr/sys/ken/sysent.c`. "Args" is the
number of words the kernel reads from user space (excluding r0-passed args).

| # | Name | Args | Description |
|---|------|:----:|-------------|
| 0 | `indir` | – | Indirect system call |
| 1 | `exit` | 0 | Terminate process |
| 2 | `fork` | 0 | Create child process |
| 3 | `read` | 2 | Read (fd via r0) |
| 4 | `write` | 2 | Write (fd via r0) |
| 5 | `open` | 2 | Open a file |
| 6 | `close` | 1 | Close a file |
| 7 | `wait` | 0 | Wait for child process to exit |
| 8 | `creat` | 2 | Create a file (with mode) |
| 9 | `link` | 2 | Create a hard link |
| 10 | `unlink` | 1 | Remove a link (= delete file) |
| 11 | `exec` | 2 | Execute a program (replace image) |
| 12 | `chdir` | 1 | Change current directory |
| 13 | `time` | 0 | Get current time (seconds since 1970) |
| 14 | `mknod` | 3 | Create device / special file |
| 15 | `chmod` | 2 | Change file permissions |
| 16 | `chown` | 2 | Change file owner |
| 17 | `break` | 1 | Change end of data segment (= sbrk) |
| 18 | `stat` | 2 | Get inode info from pathname |
| 19 | `seek` | 2 | Change file position (= lseek) |
| 20 | `getpid` | 0 | Get process ID |
| 21 | `mount` | 3 | Mount a filesystem |
| 22 | `umount` | 1 | Unmount a filesystem |
| 23 | `setuid` | 0 | Set user ID (via r0) |
| 24 | `getuid` | 0 | Get user ID |
| 25 | `stime` | 0 | Set system time (via r0/r1) |
| 26 | `ptrace` | 4 | Process trace (for debuggers) |
| 27 | – | – | Unused |
| 28 | `fstat` | 1 | Get inode info from fd |
| 29 | – | – | Unused |
| 30 | `smdate` | 2 | Set modification time (inactive in V6) |
| 31 | `stty` | 2 | Set terminal parameters |
| 32 | `gtty` | 2 | Get terminal parameters |
| 33 | – | – | Unused |
| 34 | `nice` | 1 | Change process priority |
| 35 | `sleep` | 0 | Sleep for N seconds (via r0) |
| 36 | `sync` | 0 | Flush buffers to disk |
| 37 | `kill` | 2 | Send signal to process |
| 38 | `switch` | 0 | Read console switches (= getswit) |
| 41 | `dup` | 0 | Duplicate file descriptor (fd via r0) |
| 42 | `pipe` | 0 | Create pipe (two fds returned in r0/r1) |
| 43 | `times` | 1 | Get process timing statistics |
| 44 | `profil` | 4 | Set execution profiling |
| 46 | `setgid` | 0 | Set group ID (via r0) |
| 47 | `getgid` | 0 | Get group ID |
| 48 | `signal` | 2 | Set signal handler (= ssig) |

> Numbers 27 / 29 / 33 / 39 / 40 / 45 are `nosys` (unassigned) in the kernel.
> `ioctl` / `chroot` / `ftime` and others were added in V7 and later.

## 3. Signal Numbers (for `signal` / `kill`)

V6 signals are numbered 1–15, corresponding to `/usr/include/signal.h`.

| # | Name | Meaning |
|---|------|---------|
| 1 | `SIGHUP` | Hangup |
| 2 | `SIGINT` | Interrupt (DEL / Rubout key) |
| 3 | `SIGQIT` | Quit (FS, `^\`) → core dump |
| 4 | `SIGINS` | Illegal instruction |
| 5 | `SIGTRC` | Trace trap (T bit) |
| 6 | `SIGIOT` | IOT instruction |
| 7 | `SIGEMT` | EMT instruction |
| 8 | `SIGFPT` | Floating-point exception |
| 9 | `SIGKIL` | Kill (cannot be caught or ignored) |
| 10 | `SIGBUS` | Bus error |
| 11 | `SIGSEG` | Segmentation violation |
| 12 | `SIGSYS` | Bad system call argument |
| 13 | `SIGPIPE` | Write to pipe with no reader |
| 14 | `SIGALRM` | Alarm clock (not fully implemented in V6) |

## 4. Minimal Assembly Example

A V6 assembly program that writes "hello" to stdout and exits. Assemble with
`as` (comment character is `|`; numbers are octal by default; append `.` for
decimal).

```asm
| hello.s — write(1, msg, 6) then exit(0)
.globl  start
start:
        mov     $1, r0          | fd = 1 (stdout)
        sys     write; msg; 6   | write(1, msg, 6)
        sys     exit            | exit()
msg:
        <hello\n>               | string (6 bytes including \n)
```

```text
as hello.s          | produces a.out
a.out               | prints "hello"
```

> In this simulator, `db` does not display a prompt, so verify behavior by
> running `a.out` directly (see
> [25 as/db Instruction Sequence Demo](?doc=25-as-db-命令シーケンスデモ.md) for details).

### 4.1 Disassembly (Machine Code Dump)

The text segment produced by assembling `hello.s` above (assuming load at
virtual address 0). All values are octal. Note how `sys n` becomes the `trap`
instruction `104400+n`.

```text
Address  Machine  Disassembly            Notes
000000   012700   mov   $1, r0          | MOV: 01 src=27(immediate) dst=00(r0)
000002   000001                          |  └ immediate value 1
000004   104404   sys   write           | trap = 104400 + 4 (write)
000006   000014        msg              |  └ inline arg: buf = msg(=000014)
000010   000006        6.               |  └ inline arg: count = 6
000012   104401   sys   exit            | trap = 104400 + 1 (exit)
000014   062550   msg:  <he>            | 'e'(0145)<<8 | 'h'(0150)
000016   066154         <ll>            | 'l'(0154)<<8 | 'l'(0154)
000020   005157         <o\n>           | '\n'(012)<<8 | 'o'(0157)
```

- Text size = `000022` (octal) = 18 bytes (12 bytes code + 6 bytes string)
- The string is stored in PDP-11 little-endian order, **low byte first**. When
  read as words, characters appear in pairs swapped: `<he> <ll> <o\n>`
- The first argument fd of `write` is passed in r0, so only two inline words
  (`buf` and `count`) follow (see §1.1)

Commands for verification on real hardware or SIMH (`od` produces an octal
word dump):

```text
od a.out            | full dump of a.out (prepended by 8-word a.out header)
od -o a.out         | same, explicit octal words
nm a.out            | symbol table (check addresses of start / msg)
```

> The first 8 words of `od a.out` are the a.out header (magic `0407` = normal
> executable, text size, data size, bss size, symbol table size, entry point,
> etc.). The text shown above starts at the **word after** the header.

## 5. Observing in the Logic Analyzer

Because `sys` instructions assemble to `trap`, they can be captured with the
**TRAP trigger** in the debug panel.

- Select trigger type `TRIG_TRAP` to fire on every system call trap entry
- The flow from the trap vector into the kernel's `trap()` function
  (PSW save → vector fetch → kernel mode transition) can be observed
  T-state by T-state
- The fetch of trap number `104400+n` is visible, making it possible to
  identify which system call was invoked

For details, see [20 Debug Panel & Logic Analyzer](?doc=20-デバッグパネル-使い方.md) and
[21 LA Bus Cycle Examples](?doc=21-バスサイクル実例.md).

## 6. References

- `/usr/sys/ken/sysent.c` — system call dispatch table
- `/usr/sys/ken/trap.c` — trap handler implementation
- Unix V6 Manual, Part II (System Calls)
- Lions' Commentary on UNIX 6th Edition — explanation of the trap mechanism
- [53 References](?doc=53-参考資料.md)
