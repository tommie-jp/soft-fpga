# Historical Significance of the Apple-I

## 1. Origins

In 1976, Steve Wozniak (Woz) brought a circuit board he had designed entirely on his own to the
Homebrew Computer Club. At the time, hobbyists took it for granted that they would enter machine
code directly using paper tape or toggle switches, but what Woz demonstrated was different.
**Type characters on a keyboard and they appear on the screen** — that alone astonished everyone
in the room.

This was the Apple-I. It sold for $666.66, and roughly 200 hand-assembled boards were shipped.

---

## 2. Technical Innovations

### 2.1 The Elegance of the Chip Choice

Woz chose the MOS Technology **6502** ($25).
It was an order of magnitude cheaper than the dominant chips of the day — the Intel 8080 ($179)
and Motorola 6800 ($175).
This was not simply a cost-cutting measure; Woz was convinced that the 6502's architecture was
more elegant and allowed programs to be written with fewer instructions.

| CPU | Price | Addressing Modes | Notable Systems |
|-----|-------|-----------------|-----------------|
| Intel 8080 | $179 | 5 | Altair 8800 |
| Motorola 6800 | $175 | 7 | SWTPC 6800 |
| MOS 6502 | $25 | 13 | Apple-I / II, Commodore 64, Famicom |

### 2.2 The Beauty of Minimalism

The Apple-I used only three main chip types:

```text
6502         ← CPU
6821 PIA     ← Keyboard / Display I/O
2513 ROM     ← Character generator
(+ SRAM, video circuitry)
```

The Woz Monitor (256 bytes) alone handled hex dump, write, and execute — everything complete.
The minimalism of both software and hardware was absolute.

### 2.3 The Design Philosophy of the Woz Monitor

The monitor program fit in 256 bytes at `$FF00–$FFFF` and provided "raw dialogue with the
computer" through direct byte-level manipulation.

```text
FF00: D8        ← Inspect memory contents
0300: A9 55 4C 00 03   ← Write machine code
0300R           ← Execute
```

No GUI, no OS. Complete control with nothing but addresses and data.

---

## 3. The Birth of Apple Computer

Steve Jobs, Woz's close friend, saw commercial potential in the board.
On April 1, 1976, **Apple Computer** was incorporated.

- First order: 50 units from the Byte Shop (a computer specialty store)
- Revenue from sales covered component costs and funded the development of the Apple II
- The Apple II (1977) became a massive hit, launching the personal computer industry

What Woz had built simply to "show friends" accidentally became the starting point for the world's
largest technology company.

---

## 4. The Significance of Integer BASIC

Integer BASIC, distributed on cassette tape ($E000–$EFFF, 4 KB), was an interpreter Woz wrote
entirely by himself.

- **No floating-point** (integers only, -32768 to 32767)
- **Fits completely within 4 KB**
- Direct predecessor to the Apple II Integer BASIC

Typing `PRINT 2+2` and getting `4` back was a revolutionary experience in 1976.

---

## 5. Rarity Today

Very few original Apple-I boards survive (estimated 60–70 units).

| Year | Auction Sale Price |
|------|--------------------|
| 2012 | $374,500 |
| 2014 | $905,000 |
| 2022 | $400,000 |

Working units are even rarer, preserved by museums and private collectors.

---

## 6. The Significance of Simulating with soft-FPGA

Instruction emulators (e.g., MAME) can run the Apple-I.
However, software emulators have **things they cannot show**.

| Observable Information | Emulator | soft-FPGA (Verilator) |
|------------------------|----------|-----------------------|
| Registers (A, X, Y, SP, PC, P) | ✓ | ✓ |
| Memory contents | ✓ | ✓ |
| Bus cycles (AB / DB / WE) | ✗ | **✓** |
| T-states (signal transitions at cycle granularity) | ✗ | **✓** |
| PIA handshake (CA1 / CB1 strobes) | ✗ | **✓** |
| Page-cross +1 cycle penalty | ✗ | **✓** |
| RMW instruction dummy write cycles | ✗ | **✓** |

RTL simulation is the only means by which you can actually *see* "the circuit running."
The Apple-I's simple structure (4 KB RAM / 4.25 KB ROM / 1 PIA) made it an ideal first target
for this visualization platform.

---

## References

- [01-実装計画.md](01-実装計画.md) — RTL implementation details
- [50-wozmon-使い方.md](50-wozmon-使い方.md) — How to use the Woz Monitor
- [52-メモリマップ.md](52-メモリマップ.md) — Apple-I memory map
- [53-機械語入門.md](53-機械語入門.md) — 6502 machine-code primer (Wozmon exercises)
- *Hackers: Heroes of the Computer Revolution* — Steven Levy (1984)
- *iWoz* — Steve Wozniak (2006)
