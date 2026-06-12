# 56. How Unix V6 Uses the MMU <a class="qr-link" href="../../../docs/09-PDP11/img/56-en-QR.png">QR</a>

An overview of how Unix V6 uses the PDP-11 memory management unit (KT11 / MMU).
Background material for understanding what the MMU panel in this project's visualizer shows.
Covers the **PDP-11/40 family (18-bit physical, no I/D separation)**. Follows Lions' Commentary on UNIX 6th Edition.

---

## 1. Hardware Basics (Recap)

The PDP-11 MMU provides **8 segments per mode (APR: Active Page Register)**.

- Modes: **Kernel** / Supervisor / **User** (V6 uses only Kernel and User).
- Each APR = **PAR** (Page Address Register, physical base) + **PDR** (Page Descriptor Register, length, direction, protection).
- Maximum 8 KB per segment (= 128 blocks × 64 bytes). 8 segments × 8 KB = **64 KB virtual per mode**.
- Physical address space is 18-bit = **256 KB**. Each V6 process can use at most 64 KB (text + data + stack).

V6 uses the MMU's flexibility in only a very limited, fixed way.

---

## 2. Kernel Space Mapping (KISA0–7)

| Segment | Purpose | Virtual Address | Notes |
|---------|---------|----------------|-------|
| KISA0–5 | **Kernel image (instructions + data)** | 0 – 0o137777 | Fixed to low physical memory |
| **KISA6** | **u-area + kernel stack of the running process** | 0o140000– | **Reloaded on every context switch** (see below) |
| **KISA7** | **I/O page** (device registers) | 0o160000–0o177777 | Mapped to physical 0o760000–0o777777 |

### 2.1 KISA7 = I/O Page (Gateway to Devices)

The kernel accesses the UNIBUS I/O page (top 8 KB) through KISA7.
RK disk, KL11 console, clock, and other device registers all live here.
**This is the "kernel seg7 PAR" visible in this project's MMU panel and signal tests**
(the "MMU kernel seg7 PAR>0" assertion in
[`boot-signals.test.mjs`](../../examples/09-pdp11/tests/signals/boot-signals.test.mjs)).

### 2.2 KISA6 = The "Always the Same Virtual Address" Trick for the u-area

The most significant MMU technique in V6. Each process's **per-process data (`user` struct `u.` + kernel stack)**
lives at a different physical location for each process, but by **switching KISA6 the kernel always sees it
at the same virtual address 0o140000**.

- On a context switch (`swtch`), `retu(p->p_addr)` / `aretu` (in `m40.s`) reloads KISA6
  to point at the swap address of the incoming process.
- This lets kernel code refer to "the current process's `u.`" through a fixed address
  (no per-process code patching required).

---

## 3. User Space Mapping (UISA0–7)

A process's address space is divided into **text / data / stack** (11/40 has no I/D separation, so one 64 KB space).

| Region | Segment | Protection | Notes |
|--------|---------|-----------|-------|
| text (pure code) | UISA0– | Read-only, sharable | `text.c` manages shared text (physically shared among multiple processes) |
| data (initialized + BSS + heap) | immediately after text | R/W | Extends upward via `sbrk` |
| **stack** | **UISA7 (topmost)** | R/W | **Expand-down** |

### 3.1 Expand-Down Stack (ED Bit in PDR)

The stack segment sets the **ED (Expand Down) bit** in its PDR, and the page length field (PLF) defines
the valid range "downward from the top." Growing the stack means lowering the bottom boundary.

- Stepping past the bottom triggers a **segmentation fault (page-length abort, vector 0o250)**.
- `trap.c` catches this, calls `grow()` to extend the stack downward, then re-executes the instruction.
- → This "expand-down stack extension" was also key in the cc bug investigation for this project
  (see [41-cc-コンパイル-バグ調査.md](?doc=41-cc-コンパイル-バグ調査.md)).

---

## 4. How Segment Registers Are Configured (estabur → sureg)

| Function | Role |
|---------|------|
| `estabur(nt, nd, ns, sep)` | Computes **prototype** PAR/PDR values from text/data/stack sizes and stores them in `u.u_uisa[]` / `u.u_uisd[]` (Lions ~1650) |
| `sureg()` | **Loads** `u.u_uisa[]` / `u.u_uisd[]` **into the hardware UISA/UISD registers** (Lions ~1739). Called after a context switch, `exec`, or `grow` |

Recalculated on `exec` (new program load), `fork`, stack/data expansion, and swap-in.

---

## 5. Copying Data Between Kernel and User Space (mfpi/mtpi)

When the kernel reads or writes user-space data it uses **mfpi / mtpi**
(move from/to previous instruction space).

- The **previous mode** field of the PSW selects which APR set to use.
- These instructions underlie `fubyte`/`subyte` (fetch/store user byte) and `copyin`/`copyout`.

---

## 6. Swapping

V6 swaps **entire processes** at once. Because the physical location changes on swap-in,
`estabur`/`sureg` recomputes and reloads the segment registers.

---

## 7. Observation Points in This Project (Visualization Guide)

| Visible Signal | Meaning in V6 |
|---------------|---------------|
| **kernel seg7 PAR** (KISA7) | I/O page. Fixed value from the moment of boot |
| **kernel seg6 PAR** (KISA6) | u-area of the running process. **Changes on every process switch** ← the key thing to watch |
| **user seg PAR/PDR** (UISA/UISD) | text/data/stack layout of the running user process. Changes on `exec`/`fork`/stack expansion |
| **cpu mode (kernel/user)** | Mode transitions caused by mfpi/mtpi, traps, and rti |
| **abort (vector 0o250)** | Stack expand-down fault → `grow()` |

Placing these side by side in the MMU panel makes the V6 memory management behavior directly visible:
"KISA6 is reloaded on process switch," "user segments are rearranged on exec,"
"abort followed by re-execution on stack expansion."

---

## 8. Worked Example: MMU Activity During a Hello, World! Program

Tracing a small C program through `cc` compilation and execution from the MMU's perspective.
Small programs are ideal teaching material because the "relocation at load time" and "syscall boundary" stand out clearly.

```c
main() {
    printf("Hello, World!\n");
}
```

Assuming `# cc hello.c` → `# a.out`. The a.out is in the standard V6 **0407 format**
(text + data combined, writable; stack separate), and the program is less than 8 KB.

### 8.1 Segment Layout Immediately After Load (`exec` → `estabur` → `sureg`)

Since the program is under 8 KB, only two user segments are effectively used:

| APR | Virtual Address | PAR (physical base) | PDR | Contents |
|-----|----------------|---------------------|-----|----------|
| **UISA0** | 0o000000– | physical location of a.out | upward, R/W, length = block count of program | code + `"Hello, World!\n"` + data |
| UISA1–6 | — | — | **not resident (access=0)** | any access causes abort |
| **UISA7** | 0o160000–0o177777 | physical location of stack | **expand-down**, R/W | stack (growing downward from 0o177776) |

> **First thing to watch**: At the moment `a.out` starts executing, the user segments are all rewritten at once
> (from sh's layout to hello's layout). Because `cc` internally runs c0/c1/c2/as/ld in sequence via `exec`,
> the user segments **switch repeatedly with each pass** during compilation.

Throughout this time on the kernel side: **KISA7** = I/O page (fixed), **KISA6** = u-area of the running process (reloaded on switch).

### 8.2 MMU Activity During Execution

Hello World is small and its stack does not grow, so **the memory map is essentially static** during execution.
The moments the MMU acts are few, which makes them easy to see.

#### (a) Instruction Fetch and String Reference (user mode)

- PC fetch → translated through **UISA0**. `"Hello, World!\n"` is also in UISA0 (data region), same segment.
- CPU mode = **user**.

#### (b) `printf` → `write(1, …)` System Call (★ Kernel/User Boundary)

`printf` calls `write` after formatting. `trap` transfers control to the kernel:

1. **CPU mode transitions from user → kernel** (PSW previous mode = user).
2. The tty output handler retrieves **one byte at a time from the user's buffer**, using
   **`mfpi` (move from previous instruction space)** with previous mode = user, so
   the kernel reads the character **through the user's UISA0 map** (`fubyte`/`cpass`).
3. The character is written to the KL11 console → device register write **via KISA7 (I/O page)**.

> **Second thing to watch**: A single `write` call lets you observe simultaneously:
> "**user→kernel mode transition**," "**previous-mode access via mfpi**," and "**I/O via KISA7**."
> All three roles of the MMU (protection, mode isolation, I/O reachability) are packed into one event.

#### (c) Stack (Quiet This Time)

- Arguments and return addresses are pushed onto UISA7 (expand-down), but Hello World does not **grow** it.
- Deep recursion or large local arrays that breach the lower bound → **abort (vector 0o250)** →
  `trap.c`'s `grow()` extends the stack downward and re-executes the instruction (the UISD7 length value changes visibly).

### 8.3 Exit → Back to Shell

- `main` returns → `exit` → process destroyed, u-area freed.
- The scheduler calls `swtch` to return to sh, **reloading KISA6 with sh's u-area** → next `#` prompt.

### 8.4 MMU-View Timeline Summary

| Time | Event | MMU Activity (visible change in panel) |
|------|-------|----------------------------------------|
| `cc hello.c` | sh fork→exec(cc) | KISA6 reloaded, user segs → cc. **Repeatedly relocated** for each of c0/c1/c2/as/ld |
| `a.out` | sh fork→exec(a.out) | **User segments all updated at once** (UISA0=hello, UISA7=stack, UISA1–6=not resident) |
| Running | Instruction/string fetch | Translated via UISA0 (mode=user, map is static) |
| `printf`→`write` | System call | **mode user→kernel**, **user buffer read via mfpi**, **I/O via KISA7** |
| return→`exit` | Process exit | u-area freed, swtch reloads **KISA6 → sh** |

### 8.5 Key Takeaways as a Teaching Example

- **Smaller programs make the MMU's essence easier to see** — no dynamic-growth noise; mode isolation,
  protection, mfpi, and the I/O page all stand out.
- Placing **KISA6 / KISA7 / UISA0 / UISA7 and CPU mode side by side** in the MMU panel lets you
  follow this entire sequence as waveforms and numeric values — an observation point unique to RTL
  visualization that no instruction-level emulator can provide.
- Related: cc execution regression test [`cc-hello.v6`](../../examples/09-pdp11/tests/v6-scripts/cc-hello.v6).

---

## 9. References

- [UNIX V6 kernel memory layout — Computer History Wiki](https://gunkies.org/wiki/UNIX_V6_kernel_memory_layout)
- [UNIX V6 memory layout — Computer History Wiki](https://gunkies.org/wiki/UNIX_V6_memory_layout)
- [UNIX V6 internals — Computer History Wiki](https://gunkies.org/wiki/UNIX_V6_internals)
- Lions' Commentary on UNIX 6th Edition — `estabur`/`sureg` (main.c), `swtch`/`retu` (slp.c, m40.s), `grow` (trap.c)
- Related: [52-メモリマップ.md](?doc=52-メモリマップ.md) / [55-MMU-タイミングと実機比較.md](?doc=55-MMU-タイミングと実機比較.md) / [41-cc-コンパイル-バグ調査.md](?doc=41-cc-コンパイル-バグ調査.md)
