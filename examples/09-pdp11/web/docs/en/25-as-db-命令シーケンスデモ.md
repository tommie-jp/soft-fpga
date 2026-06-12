# 25. Demo: Viewing Instruction Sequence Diagrams with Unix V6 `as` / `db` <a class="qr-link" href="../../../docs/09-PDP11/img/25-en-QR.png">QR</a>

A demo that writes a small program using the Unix V6 native assembler `as` and debugger `db`,
then uses the soft-FPGA **Logic Analyzer (LA)** to freeze-capture the moment a specific instruction executes
and display the **instruction bus-cycle sequence diagram**.

> **`db` shows no prompt (important)** —
> Unix V6 `db` displays **no prompt at all** (no `>` or similar) when started.
> Running `db a.out` simply waits silently for input, which is easy to mistake for a hang.
> It is not hung. Just type a command such as `0,6?` and press Enter — it responds immediately.
> Type `%` to quit.
>
> **Why this demo works** —
> The LA `PC value match` trigger compares the **virtual address** during instruction fetch
> (`obs_addr_v`, 16-bit) against the entered value
> ([harness.cpp](../../examples/09-pdp11/cxx/harness.cpp) `TRIG_PC`).
> The addresses shown by `db` during disassembly are the same **virtual addresses**,
> so an address read from `db` can be entered directly into the LA trigger to freeze the waveform
> at that exact instruction.
> The key insight of this demo is that a software debugger (instruction level) and a hardware debugger
> (clock level) **meet in the same virtual address space**.

Related: [14 db Debugger Guide](?doc=14-db-デバッガー-使い方.md) /
[22 Instruction Timing Diagrams](?doc=22-全命令タイミング図.md) /
[24 Timing Diagram Case Explanations](?doc=24-全命令タイミング図-解説.md) /
[20 Debug Panel & Logic Analyzer](?doc=20-デバッグパネル-使い方.md)

---

## 1. Overall Flow

1. Boot Unix V6 to the shell prompt (`#`)
2. Use the `EDITOR` button to create the assembly source file `loop.s`
3. Assemble with `as loop.s` to produce `a.out`
4. Disassemble with `db a.out` to read the **virtual address** and **instruction word** of the target instruction
5. In the Web UI `Trigger` panel, set `PC + data match` (recommended) with the VA and instruction word, then press `Set`
6. Run `./a.out` — the LA freezes at that instruction (the `FROZEN` badge lights up)
7. Read the instruction sequence diagram (T-state, istate, Unibus bus cycles)

---

## 2. Sample Program (a short loop written in `as`)

A short loop that counts R0 down from an initial value to 0 while accumulating into R1.
The instruction sequence is simple, making the loop-body bus cycles easy to observe in the LA.

Press the `EDITOR` button (toolbar) and enter the following with the filename `loop.s`.
Do not paste directly into the command line — UART garbles characters; always use EDITOR
(see [Chapter 14, §9](?doc=14-db-デバッガー-使い方.md)).

```asm
| loop.s — count down R0, accumulate into R1
start:
        mov     $1000,r0        | R0 = 0o1000 (512 iterations; wide window for trigger)
        clr     r1              | R1 = 0 (accumulator)
loop:
        add     r0,r1           | R1 += R0
        sob     r0,loop         | R0--; branch to loop if non-zero
        sys     1               | exit syscall (assembles to trap 0o104401)
```

### 2.1 V6 `as` Syntax Notes

- Comments run from `|` to end of line. `/` is the division operator and cannot be used for comments.
- Labels are `name:`. Immediate values are `$n`.

#### Numeric Literal Radix

**The default radix is octal.** Appending a `.` (dot) switches to decimal.

| Notation | Radix | Actual value |
|----------|-------|-------------|
| `$10` | octal | 8 |
| `$10.` | decimal | 10 |
| `$1000` | octal | 512 |
| `$1000.` | decimal | 1000 |

For example, `mov $10., r1` loads 10 into r1, while `$10` (no dot) loads 8.
Hexadecimal uses the `0NNN` form rather than an `0x` prefix (e.g., `0x0A` = `012` in octal notation).

#### `.globl` and the Entry Point

```asm
.globl start
start:
```

`.globl start` sets `a_entry` (the execution start address) in the `a.out` header to the address of `start`.
Omitting it defaults `a_entry` to 0, which works fine as long as `start:` is at the top.
It is required when linking with `ld`.

#### System Calls

- `sys 1` is the `exit` system call; `as` expands it to a `trap` instruction (`0o104401`).
  - Writing `sys exit` is equivalent (`exit` is a symbol `as` already knows as 1).
  - V6 `exit` takes no status argument.

#### `sob` Loop

- `sob r0,loop` is the PDP-11/40+ "Subtract One and Branch" instruction — one instruction drives the entire loop.
  - On simpler environments that lack `sob`, `dec r0` + `bne loop` is equivalent
    (it synthesizes the timings of cases 04 and 34 in [Chapter 24](?doc=24-全命令タイミング図-解説.md)).

#### Testing with Direct Execution

- Because the program has no external references it is self-contained, and `a.out` produced by `as` is directly executable (no `ld` needed).
- **V6 `db` is a static file debugger with no step execution or breakpoints**
  (it is useful for disassembly and core-dump analysis — used for disassembly in §3.2).
  Test the program by running `a.out` directly; returning to the prompt indicates normal exit.

```text
# a.out
#      ← no output, prompt returned = normal exit
```

---

## 3. Assembling and Disassembling

### 3.1 Assembling

```text
# as loop.s
# ls -l a.out
```

`as loop.s` writes output to `a.out`. No output is printed if there are no errors.

### 3.2 Disassembling with `db` to Read Addresses

```text
# db a.out
0,6?
```

> **No prompt is shown.** After running `db a.out` nothing is displayed, but it is not hung.
> Just type `0,6?` and press Enter (see the note at the beginning of this chapter).

`0,6?` disassembles 6 instructions starting from virtual address 0.
`?` is the inspection command that disassembles the machine instruction at the given address,
and `,6` is the count specifier that runs it 6 times (see [Chapter 14](?doc=14-db-デバッガー-使い方.md)).
V6 `a.out` loads the text segment at virtual address 0, and the entry point is also address 0,
so the first instruction appears at address 0.

Expected output (**example** — always verify the actual values from `db` output):

```text
0:      mov     $1000,r0
4:      clr     r1
6:      add     r0,r1
10:     sob     r0,6
12:     sys     1
```

| Virtual address (octal) | Instruction word (octal) | Instruction |
|-------------------------|--------------------------|-------------|
| `0` | `012700` `001000` | `mov $1000,r0` (2 words = 4 bytes) |
| `4` | `005001` | `clr r1` (1 word) |
| `6` | `060001` | `add r0,r1` ← **capture target** |
| `10` | `077002` | `sob r0,loop` |
| `12` | `104401` | `sys 1` (exit) |

The target here is **the loop-body `add r0,r1` (virtual address `0o6`, instruction word `060001`)**.
The opcode `060001` can also be verified from the PDP-11 instruction format
(ADD `06` + src=R0 `00` + dst=R1 `01`). Exit `db` with `%`.

```text
%
```

> **Tip:** For label addresses only, `nm a.out` also works (output like `0000006 T loop` in octal).
> To view the binary directly, use `od -o a.out` (the first 16 bytes are the header).

---

## 4. Setting the Logic Analyzer Trigger

Configure the trigger in the `Trigger` panel on the right side of the Web UI.
There are three trigger types.

### 4.1 `PC + data match` (recommended — reliable)

This type matches both the virtual address (VA) and the **bus data (instruction word = opcode)**.
Because the VA and opcode are fixed values specific to `a.out`, the probability that another process
has the **same opcode at the same VA** is negligible, allowing reliable capture of your own program
even in a Unix V6 multi-process environment.

1. Set `Type` to **`PC + data match`**.
2. Enter the target instruction's virtual address in **octal** in `PC(8)` (in this example: `6`).
3. Enter the **instruction word** of that instruction in **octal** in `DATA(8)` (in this example: `060001` for `add r0,r1`).
   Verify the instruction word from the `db` disassembly in §3.2 (or the table in [Chapter 22](?doc=22-全命令タイミング図.md)).
4. Press `Set`.

> Internally, the VA is packed into the lower 16 bits and the opcode into the upper 16 bits,
> then passed to `sim_set_trigger`
> ([harness.cpp](../../examples/09-pdp11/cxx/harness.cpp) `TRIG_PC_DATA`).
> The trigger fires when both `obs_addr_v == VA` and `obs_data == opcode` are satisfied during fetch.

### 4.2 `PC value match` (simple)

The classic type that matches on VA alone. It works fine on an idle system,
but in a multi-process environment another process stepping on the same VA can cause false positives
(see §6). Use it for quick tests or when you are certain only one process is running.

1. Set `Type` to **`PC value match`**.
2. Enter the virtual address in **octal** in `PC(8)`.
3. Press `Set`.

### 4.3 `Expression` (flexible — compound conditions)

This type lets you describe conditions as a JavaScript expression combining multiple signals.
Use it when `PC value match` or `PC + data match` cannot express the desired condition.

#### Setup

1. Set `Type` to **`Expr`**.
2. Enter the condition in the expression input field (CodeMirror editor). Use Ctrl+Space for signal name and value completion.
3. Press `Set`.

#### Example Expressions for loop.s

| Purpose | Expression |
|---------|-----------|
| Capture `add r0,r1` (VA=6) in user mode | `VA == 06 && Mode == "USER"` |
| Capture rising fetch in a user process | `RD.rising && istate == "F1" && Mode == "USER"` |
| Capture all loop-body instructions (VA 4–10) | `VA >= 04 && VA <= 012 && Mode == "USER"` |
| Capture the kernel `login` wait address | `VA == 015670` |

> **`VA` vs `PC`**: The `PC` signal in expression triggers holds the PC register value
> after it has already been incremented by +2 post-fetch
> (the hardware PC trigger also uses `obs_addr_v` internally).
> Always use **`VA`** when specifying a particular instruction address.
>
> Adding `Mode == "USER"` prevents false positives when the kernel accesses the same virtual address
> (case-insensitive).

#### Expression Syntax

```text
Comparison operators:  ==  !=  <  >  <=  >=
Logical operators:     &&  ||  !  ()
Edge detection:        signal.rising   (0→1 rising edge)
                       signal.falling  (1→0 falling edge)
                       signal.edge     (either edge)
Numeric literals:      06 / 0o6 (octal),  0x1ff (hex),  10 (decimal)
String literals:       "USER"  "F1"  "FETCH"
```

Common signal names: `PC`, `VA`, `RD`, `WR`, `Mode`, `istate`, `ISN`, `Cycle`

### 4.4 Zoom

Set the LA zoom to about **`8x`** using the magnification selector in the `Logic Analyzer` header —
this makes the bus cycles of a single instruction fit comfortably on screen
(same as zoom=8 used in [Chapter 24](?doc=24-全命令タイミング図-解説.md)).

---

## 5. Running and Capturing

Execute the program from the shell.

```text
# ./a.out
```

The moment the PC reaches the loop body (virtual address `0o6`), the LA stops writing to the ring buffer,
the `FROZEN` badge lights up, and `⏸ Triggered!` is displayed.
The LA canvas at that point is the **instruction sequence diagram for the `add r0,r1` instruction**.

### 5.1 Reading the Waveform

Same reading method as [Chapter 24, case 21 (ADD R0, R1)](?doc=24-全命令タイミング図-解説.md):

- `istate`: Micro-sequencer state. Transitions `f1` (fetch) → `s1`/`s4` → execute.
- Unibus waveform: One bus cycle for the opcode FETCH (no memory reference since this is a register-to-register operation).
- Verify that the bus data word is **`060001`** (the opcode for `add r0,r1`).
  If it matches, you have definitely captured your own program's instruction.

To include the surrounding instructions (`clr r1` / `sob r0,loop`) in the waveform,
either reduce the zoom (`1x`–`2x`) or change the trigger to `sob` (virtual address `0o10`) and re-capture.

---

## 6. Tips for Reliably Capturing Your Own Program

### 6.1 Use `PC + data match` First (Primary Method)

Using the `PC + data match` from §4.1 also checks the opcode in addition to the VA,
so even if another process steps on the same VA, **it will not fire unless the opcode also matches**.
This is the primary means of practically eliminating false positives in a multi-process environment.

- The `PC(8)` and `DATA(8)` pair are fixed values specific to `a.out`, so **no recalculation is needed between runs**.
  Once set, every execution of `./a.out` will reliably stop at the same instruction.
- The `DATA` you enter must be the **instruction word at that VA**
  (entering the instruction word of a different VA may occasionally react to residual bus data during fetch transitions).

### 6.2 Supplementary Techniques When Using `PC value match` (Simple)

When using VA-only `PC value match`, reduce false positives as follows.

- **Run in an idle state**: Press `Set` at the shell prompt with nothing else running, then immediately run `./a.out`.
  The idle shell is blocked in `read()` inside the kernel and is not executing user instructions.
- **Use a larger loop count**: Increasing the count, as in `mov $1000,r0` (0o1000 = 512 iterations), means your loop
  hits the target address many times within the capture window, making a hit more likely.
- **If you get a false positive, press `Resume`**: If the LA stopped on another process, press `Resume` to re-arm.
  Your loop is still running many iterations, so it will hit your instruction again right after re-arming.
- **Verify the bus data word**: After freezing, always confirm that the bus data in the waveform matches your
  instruction word (e.g., `060001`). If it does not match, press `Resume` and try again.

---

## 7. Extensions

- **Observe memory-reference instructions**: Change `add r0,r1` to `add (r2),r1` etc. and one additional
  memory READ bus cycle appears (same as [Chapter 24, Phase F](?doc=24-全命令タイミング図-解説.md)).
- **EIS multi-cycle wait**: Insert `mul r1,r0` to see the ~16-clock `mul1616` wait as a flat period in istate
  ([Chapter 24, Phase N](?doc=24-全命令タイミング図-解説.md)).
  Verify whether V6 `as` accepts `mul` and whether the target kernel requires EIS support.
- **MMU behavior**: During loop execution the MMU continuously maps User I-space,
  so observing it alongside the GPR and MMU panels is educationally effective
  ([20 Debug Panel & Logic Analyzer](?doc=20-デバッグパネル-使い方.md)).

---

## 8. Checking Virtual and Physical Addresses of Your Program

Commands for looking up virtual addresses to enter into the LA trigger and for examining physical memory layout.

### 8.1 Checking Virtual Addresses

The virtual address of a user process always starts at **address 0**.

#### `size` — Segment Sizes

```text
# size a.out
text   data   bss
  26      0     0
```

Displays text / data / bss sizes in decimal bytes.
The virtual layout starts at 0 for text, with data and bss immediately following.

#### `nm` — Symbol Table (octal virtual addresses)

```text
# nm a.out
0000006 T loop
0000000 T start
```

Shows the virtual address of each label in octal. `T` denotes a text-segment symbol.
The values match what `db` disassembly showed in §3.2.

#### `od` — Direct `a.out` Header Read

```text
# od -o a.out
0000000  000407  000032  000000  000000  000000  000000  000001  000000
...
```

The first word on the first line (address `0000000`) is the magic number (`000407` = non-split I/D).
Subsequent words are sizes in octal bytes.

| Word position | Contents |
|---------------|---------|
| 1 | Text size (bytes) |
| 2 | Data size (bytes) |
| 3 | BSS size (bytes) |
| 5 | Entry point (usually 0) |

### 8.2 Checking Physical Addresses (via MMU PAR)

The physical start address of a user process is **PAR0 × 64 bytes**.
While the program is running (either as `./a.out &` in the background, or while the LA is frozen),
read the **User APR0** value in the Web UI `MMU — Page Address Registers` panel.

```text
Physical start address = PAR0 (octal) × 0100 = PAR0 × 64 bytes
```

User APR0–7 shows the physical mapping of all 8 pages (up to 8 KB × 8 = 64 KB).
You can see which physical pages text, data, and the stack are mapped to.

### 8.3 One-liner in C to Display Segment Boundaries

The linker-defined symbols `etext`, `edata`, and `end` can be used to display segment boundaries.

```c
/* showmap.c */
extern int etext, edata, end;
main() {
    printf("text end : %o\n", &etext);
    printf("data end : %o\n", &edata);
    printf("bss  end : %o\n", &end);
}
```

```text
# cc showmap.c && ./a.out
text end : 232
data end : 17560
bss  end : 17560
```

Values are in octal. `&end` is the end address of the data+BSS segment, matching the initial value of `sbrk(0)`.
Physical addresses are confirmed via the MMU panel in §8.2 (the MMU performs the virtual-to-physical translation).

---

## 9. Role of This Demo

| Tool | What it observes | Granularity | Role in this demo |
|------|-----------------|-------------|-------------------|
| V6 `as` | Source → machine code | Instruction level | Creates the sample program |
| V6 `db` | Process memory, registers, disassembly | Instruction level | Reads the target virtual address and instruction word |
| LA (PC trigger) | Unibus signals, bus cycles | Clock level | Captures and displays the instruction sequence diagram |

Whereas the 61 cases in [Chapter 24](?doc=24-全命令タイミング図-解説.md) are **reference waveforms generated on bare metal**,
this demo observes **a user program running on live Unix V6** using the same waveform view.
It provides the experience of "descending all the way to hardware bus cycles to observe a single instruction
of a program running on an OS."
