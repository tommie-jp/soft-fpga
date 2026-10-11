# Effort Assessment for an Apple-II soft-FPGA Port

Using the Apple-I soft-FPGA implementation as a baseline, this document assesses the cost of
extending to the Apple-II.

## 1. Shared Components (Reusable)

| Component | Status |
|-----------|--------|
| 6502 RTL core | Reusable as-is |
| C++ harness / ring buffer | Core structure reusable |
| Emscripten / Wasm pipeline | Reusable as-is |
| xterm.js console | Continue using for text mode |

---

## 2. Categorizing the Incremental Costs

### Small (1–2× relative to Apple-I)

#### Memory Map Expansion

- RAM: 4 KB → 48 KB
- Addition of soft switches (`$C000–$C0FF`)
- Page switching and language card (16 KB bank)

#### Keyboard

- Apple-I uses a PIA (6821). Apple-II uses a dedicated encoder (AY-3-4600).
- In soft-FPGA, key injection from JS → Wasm abstracts this away, so the difference is minor.

#### Sound

- 1-bit speaker (toggled each time `$C030` is accessed)
- Generating a square wave with the Web Audio API is straightforward.

---

### Medium (3–5×)

#### Text Mode Rendering

- 40 columns × 24 rows, non-linear memory layout (row order jumps: `$0400, $0480, $0500…`)
- Implement the character ROM (2513 equivalent) as font data
- Character rendering routines to Canvas

#### Low-Resolution Graphics (Lo-Res)

- 40 × 48, 16 colors, `$0400–$07FF` (shared with the text page)
- Soft switches to toggle between Text / Lo-Res / Mixed modes

#### Applesoft BASIC / Integer BASIC ROM

- The ROM binaries themselves are publicly available, so embedding them is straightforward.
- Applesoft is 10 KB, which increases the debugging surface.

---

### Large (8–15×)

#### High-Resolution Graphics (Hi-Res)

- 280 × 192, 6 colors (NTSC artifact colors)
- Complex memory layout (`$2000` base, bit-interleaved with 40-byte rows jumping every 8 lines)
- NTSC color generation requires an approximate implementation in the browser Canvas.

#### Disk II (Woz Floppy Controller)

- Reproducing the self-synchronizing floppy controller in RTL is difficult.
- Requires loading DSK / NIB images and emulating the per-track bit stream.
- Without this, neither DOS 3.3 nor ProDOS will run.

---

## 3. Rough Effort Estimates

```text
Apple-I (complete)
  ████░░░░░░░░░░░░░░░░  1×

Apple-II — text + Lo-Res only
  ████████████░░░░░░░░  3–4× (prototype: 3–4 weeks)

Apple-II — including Hi-Res
  ████████████████░░░░  7–9×

Apple-II — including Disk II
  ████████████████████  15–20×
```

---

## 4. Priority Considerations

The Apple-II represents a **quantitative expansion** of components; it does not add **new facets**
to the core value demonstrated by the Apple-I — visualizing bus cycles and PIA handshakes.

On the project roadmap, a different architecture (4004 / Z80) may offer greater value as a
visualization showcase.

The clearest reasons to choose the Apple-II would be:

- Demonstrating the experience of Applesoft BASIC (`GR` / `HGR` graphics commands)
- NTSC color artifacts as a unique visualization subject
- Exhibiting the historical continuity from Apple-I to Apple-II

---

## References

- [02-Apple-I-歴史的価値.md](02-Apple-I-歴史的価値.md) — Apple-I design philosophy
- [01-実装計画.md](01-実装計画.md) — Apple-I RTL implementation details
