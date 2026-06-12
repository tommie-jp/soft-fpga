# 55. MMU ON/OFF and Instruction Timing — Real Hardware vs. This Project's RTL <a class="qr-link" href="../../../docs/09-PDP11/img/55-en-QR.png">QR</a>

An investigation into whether **enabling or disabling the MMU (memory management) on the PDP-11
affects instruction timing (clock count and bus-cycle waveforms)**.
The conclusion depends on the specific model; this document also clarifies which real-hardware
behavior the RTL in this project corresponds to.

---

## 1. Summary (Quick Reference)

| Target | Does MMU ON/OFF change instruction timing? | Notes |
|--------|--------------------------------------------|-------|
| This project's RTL (`cpus-pdp11`) | **No** (only the address value differs) | Combinational translation, no wait states |
| Real **PDP-11/40** (KT11-D) | **No** | Board-installed adds ~100 ns fixed overhead to all references; no difference between ON and OFF |
| Real **PDP-11/45** (KT11-C) | **Yes** | When operating, **+0.09 µs** per memory reference |

This project models the 11/40 family, so the behavior of "timing unchanged by ON/OFF" is
**consistent with the 11/40's characteristic of no performance difference
between mapped and unmapped references**.

---

## 2. Basis for This Project's RTL

MMU translation is purely combinational logic; it generates no wait or stall signals that halt the CPU.

- [`mmu.v`](../../vendor/cpus-pdp11/rtl/mmu.v) — `cpu_pa = map_address ? mapped_pa_22 : unmapped_pa_22`
  is an `assign` statement (resolved within the same clock). There is no signal from the MMU
  that stops the CPU; only `signal_abort` and `signal_trap` exist. → No extra clocks are inserted for translation.
- [`pdp11.v`](../../vendor/cpus-pdp11/rtl/pdp11.v) — Instruction waiting is `waiting = bus_req && !bus_ack`.
  `mmu_abort` / `mmu_trap` feed only into `assert_trap_abort` (trap conditions) and
  do not participate in the normal state transitions (`istate`).
- [`bus.v`](../../vendor/cpus-pdp11/rtl/bus.v) — `waiting = ram_access && ~ram_done`.
  Whether the physical address is "translated" or "passed through" does not change the cycle count.

### 2.1 What Changes / What Does Not Change

| Aspect | With MMU ON vs. OFF | Notes |
|--------|---------------------|-------|
| Clock count, T-state, waveform shape | Does not change | Translation is combinational (transparent) |
| Value appearing on the address bus | Changes | Virtual 16-bit pass-through vs. physical 18/22-bit mapped. Timing is the same; the numeric value differs. |
| When a page fault occurs | Changes | MMU abort → branches to trap sequence (vector 0o250). This is an exception, not normal timing. |

Implication: When generating the "all-instruction timing diagram," **waveforms captured with MMU off
are valid for MMU on as well** (except for the address values displayed). There is no need to
maintain separate cases for MMU on and off.

---

## 3. Real-Hardware Behavior (from DEC Handbooks)

### 3.1 PDP-11/40 (KT11-D) — No Change Between ON and OFF

- **There is no performance difference due to mapped vs. unmapped references**
  ("no performance hit because of mapped or unmapped references as such on the 11/40").
- However, **whether the MMU board is physically installed** causes all memory references to
  become uniformly slower. Approximately **100 ns** is added for virtual-to-physical address
  generation. This is a fixed delay caused by signals passing through extra logic,
  not by whether mapping is active.
- Installing the KT11-D requires **adding timing-delay capacitors to the CPU** to adjust timing
  (i.e., timing changes when the board is installed, but subsequent ON/OFF switching does not change it further).

### 3.2 PDP-11/45 (KT11-C) — Slower When ON

- When the **KT11-C is installed and operating (enabled), each memory reference adds +0.09 µs (90 ns)**
  to instruction time. → On the 11/45, MMU ON is actually slower than OFF.
- Relocation is performed by adding a fixed constant to every processor address,
  and the delay of this adder is reflected in the timing.

---

## 4. Implications for This Project

- The RTL's "timing unchanged by ON/OFF" is a **correct approximation of 11/40 behavior**.
- If **strict 11/45 emulation** were required, +0.09 µs per memory reference would need to be
  added while operating, but this RTL does not reproduce that at cycle accuracy
  (11/40 approximation is sufficient).

---

## 5. References

- [PDP-11/40 — Computer History Wiki](https://gunkies.org/wiki/PDP-11/40)
- [KT11-D Memory Management Unit — Computer History Wiki](https://gunkies.org/wiki/KT11-D_Memory_Management_Unit)
- [Performance discussion — pidp-11 group](https://groups.google.com/g/pidp-11/c/tKPO2VjzxCE)
- [PDP-11/45 Memory Management Reference Manual (DEC-11-HGKTCB-D)](https://www.bitsavers.org/www.computer.museum.uq.edu.au/pdf/DEC-11-HGKTCB-D%20PDP-1145%20Memory%20Management%20Reference%20Manual.pdf)
- [KT11-C Memory Management Unit — Computer History Wiki](http://gunkies.org/wiki/KT11-C_Memory_Management_Unit)
- Related: [40-cpu-テスト計画.md](?doc=40-cpu-テスト計画.md) / [21-バスサイクル実例.md](?doc=21-バスサイクル実例.md)
