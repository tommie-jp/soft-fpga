# 57. PDP-11 Registers and istate (CPU Microsequencer) <a class="qr-link" href="../../../docs/09-PDP11/img/57-en-QR.png">QR</a>

A reference for the registers of the PDP-11 (`cpus-pdp11` core) and the project-specific observation
signal `istate` (CPU internal state machine). Background material for understanding what the register
panel and Logic Analyzer are showing.

---

## 1. Architectural Registers

The PDP-11 has **eight 16-bit registers**, all uniformly accessible from instructions as `R0`–`R7`.

| Register | Alias | Role |
|---------|-------|------|
| R0–R5 | — | General purpose (operands, addresses, indices). C/V6 conventions use R5 as a frame pointer, etc. |
| **R6** | **SP** | Hardware stack pointer. Automatically incremented/decremented by JSR/RTS/traps/interrupts |
| **R7** | **PC** | Program counter. Used for PC-relative, immediate, and absolute addressing |

### 1.1 The Elegance of PDP-11: PC and SP Are Just R7/R6

Because PC and SP are part of the general-purpose register file, **all addressing modes apply uniformly**.

- Immediate `#n` = `(R7)+` (mode 2 on R7)
- Absolute `@#A` = `@(R7)+` (mode 3 on R7)
- Stack push/pop = `-(R6)` / `(R6)+`

### 1.2 Per-Mode SP Banks (Real Hardware)

Real PDP-11 hardware provides **a separate SP for each mode** (kernel KSP, user USP, [supervisor SSP]).
This isolation prevents a runaway user stack from corrupting the kernel stack.
The core exposes the effective SP for the current mode as `cpu.sp` (`wire [15:0]`).

### 1.3 PSW (Processor Status Word)

```text
bit: 15 14 | 13 12 | 11 |  7  6  5 | 4 | 3 2 1 0
     CM      PM      GR    IPL       T   N Z V C
```

| Field | Bits | Meaning |
|-------|------|---------|
| CM | 15:14 | Current mode (00=kernel / 01=super / 10=undef / 11=user) |
| PM | 13:12 | Previous mode (selects the "previous space" for mfpi/mtpi → [[56-MMU-unix-v6-での使われ方]]) |
| GR | 11 | Register set (11/45+ only; not used by this core) |
| IPL | 7:5 | Processor priority (0–7). Interrupts at this level or below are masked |
| T | 4 | Trace trap (single-instruction debugging). Used by the debugger |
| N Z V C | 3:0 | Condition codes (negative, zero, overflow, carry) |

> Mode constants (`pdp11.v`): `mode_kernel=00` / `mode_super=01` / `mode_undef=10` / `mode_user=11`.

---

## 2. Registers Exposed by This Project

The GPR snapshot `gpr_snap[8]` in the harness
([`harness.cpp`](../../examples/09-pdp11/cxx/harness.cpp)) is laid out as follows:

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|-------|---|---|---|---|---|---|---|---|
| contents | R0 | R1 | R2 | R3 | R4 | R5 | **SP** | **istate** |

- **PC** is obtained separately via `get_pc()`.
- **PSW, istate, mode, and bus cycle** are also recorded in the ring buffer (Logic Analyzer) every sample.
- The value shown in the 8th slot of the register panel is therefore the CPU's **microsequencer state `istate`**,
  whose values are explained below.

---

## 3. Meaning of istate (CPU Microsequencer) Values

`istate` is a `reg [4:0]` (5-bit) **CPU internal state machine**. A single instruction executes by
advancing through multiple istate values (an observation point unique to RTL visualization — not present
in instruction-level emulators).
Definitions are in the `parameter` block of [`pdp11.v`](../../vendor/cpus-pdp11/rtl/pdp11.v).

### 3.1 Value Table

| Value (binary) | Decimal | Symbol | Phase | Description |
|---------------|---------|--------|-------|-------------|
| 00000 | 0 | **h1** | halt | Halted (HALT instruction) |
| 00001 | 1 | **f1** | fetch | Instruction fetch. `isn ← M[PC]`, `PC++` |
| 00010 | 2 | **c1** | decode | Instruction decode |
| 00011 | 3 | **s1** | source | Source operand effective-address calculation stage 1 (`ss_data`) |
| 00100 | 4 | **s2** | source | Same, stage 2 |
| 00101 | 5 | **s3** | source | Same, stage 3 |
| 00110 | 6 | **s4** | source | Source operand value finalized |
| 00111 | 7 | **d1** | dest | Destination effective-address calculation stage 1 (`dd_data`) |
| 01000 | 8 | **d2** | dest | Same, stage 2 |
| 01001 | 9 | **d3** | dest | Same, stage 3 |
| 01010 | 10 | **d4** | dest | Destination operand value finalized |
| 01011 | 11 | **e1** | execute | ALU execution. Result `e1_result`, `PC`/`SP` updated |
| 01100 | 12 | **w1** | writeback | Write result back to memory or register |
| 01101 | 13 | **o1** | pop | RTI/RTT: pop PC from stack (`SP++`) |
| 01110 | 14 | **o2** | pop | Pop PSW (`SP++`) |
| 01111 | 15 | **o3** | pop | Pop register (`SP++`) |
| 10001 | 17 | **p1** | push | Push to stack (mem write, `SP--`) |
| 10010 | 18 | **t0** | trap | Trap/interrupt start: save old-PC and old-PSW |
| 10011 | 19 | **t1** | trap | Read new PC from vector (mem read) |
| 10100 | 20 | **t2** | trap | Read new PSW from vector+2 (mem read) |
| 10101 | 21 | **t3** | trap | Push old-PSW (mem write, `SP--`) |
| 10110 | 22 | **t4** | trap | Push old-PC (mem write, `SP--`) |
| 10111 | 23 | **i1** | interrupt | Waiting for interrupt (WAIT instruction) |

> Some codes such as 16 (10000) are unused (gaps in the 5-bit space).

### 3.2 Execution Flow for One Instruction

```text
Normal instruction:  f1 → c1 → [s1..s4] → [d1..d4] → e1 → [w1]
RTI/RTT:             f1 → c1 → o1 → o2 (→ o3)
Trap:                … → t0 → t1 → t2 → t3 → t4 → f1 (to handler)
HALT:                … → h1
WAIT:                … → i1 (exits on interrupt)
```

- **Minimum 3 states** (e.g., register-to-register instruction in mode 0: `f1→c1→e1`); **maximum 12 states** (per `pdp11.v` comments).
- **The number of stages used in s1..s4 / d1..d4 depends on the addressing mode**:

| Mode | Notation | Stages used (dest example) |
|------|----------|---------------------------|
| 0 | `R` | d1 only (`dd_data = R`) |
| 1 | `(R)` | d1 → d4 |
| 2 | `(R)+` | d1 (`R++`) → d4 |
| 3 | `@(R)+` | c1/d1 → d4 |
| 4 | `-(R)` | d1 (`R--`) → d4 |
| 5 | `@-(R)` | d1 → d2 → d4 |
| 6 | `X(R)` | d1 (`ea=PC`) → d2 (`+R`) → d4 |
| 7 | `@X(R)` | d1 → d2 → d3 → d4 |

### 3.3 Trap Sequence and MMU Abort

`t0..t4` handle the vector processing for traps and interrupts. An MMU abort (page violation,
vector 0o250) also rides this sequence, reading the new PC/PSW from the vector and pushing
old-PC/old-PSW onto the kernel stack (directly related to the expand-down stack / `grow()` in
[[56-MMU-unix-v6-での使われ方]]).

---

## 4. Observation Points (Visualization Guide)

| Signal | Location | Purpose |
|--------|---------|---------|
| R0–R5 / SP | register panel (`gpr_snap[0..6]`) | Register changes before and after each instruction |
| **istate** | register panel (last slot, `gpr_snap[7]`) + ring `[4:0]` | **Track which micro-state the CPU is in at each step** |
| PC | `get_pc()` | Execution address and triggering |
| PSW (CM/PM/IPL/T/NZVC) | ring buffer | Mode transitions, priority, flags |
| Bus cycle (DATI/DATO) | ring / LA | Memory accesses at f1/d4/w1/t1–t4 |

Plotting `istate` in the Logic Analyzer makes the internal progress of instructions visible as waveforms:
"advancing `f1→c1→d1→d4→e1`," "branching into `t0..t4` on a trap," "mode changing from user to kernel."
This is a value unique to this project that no instruction-level emulator can offer.

---

## 5. References

- [`vendor/cpus-pdp11/rtl/pdp11.v`](../../vendor/cpus-pdp11/rtl/pdp11.v) — istate definitions (`parameter` block) and state-transition comments
- [`examples/09-pdp11/cxx/harness.cpp`](../../examples/09-pdp11/cxx/harness.cpp) — `gpr_snap` / ring signal layout
- Related: [52-メモリマップ.md](?doc=52-メモリマップ.md) / [56-MMU-unix-v6-での使われ方.md](?doc=56-MMU-unix-v6-での使われ方.md) / [21-バスサイクル実例.md](?doc=21-バスサイクル実例.md)
