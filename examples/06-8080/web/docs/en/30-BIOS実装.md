# 30. Custom BIOS Implementation

## 1. Overview

The CP/M 2.2 BIOS (Basic I/O System) is the layer that mediates between the OS and hardware.
On real hardware it is burned into ROM; in this project a **custom BIOS that communicates
with the C++ harness via IN/OUT ports** is implemented in z80asm and placed at the top of
the 64 KB RAM.

| Item | Details |
|------|---------|
| Source | `examples/06-8080/sw/cpm/bios/bios.asm` |
| Assembler | z80asm v1.8 (8080-compatible instructions only) |
| Load address | `$F200–$FFFF` (up to 3.5 KB) |
| Communication | 8080 IN / OUT instructions → processed by the C++ harness |

---

## 2. Memory Layout

```text
$0000–$00FF  Page 0 (restart vectors, BDOS entry)
$0100–$DBFF  TPA (Transient Program Area)
$DC00–$E3FF  CCP (Console Command Processor, 2 KB)
$E400–$F1FF  BDOS (Basic Disk OS, 3.5 KB)
$F200–$FFFF  BIOS <- this file
  $F200      Jump table (17 entries x 3 B = 51 B)
  $F200+51   Variables (CUR_DRV / CUR_TRK / CUR_SEC / DMA_LO / DMA_HI)
  ...        BOOT / WBOOT / CONST / CONIN / CONOUT / ...
  end        DIR_BUF / CSV / ALV buffers
```

---

## 3. Jump Table

The first 51 bytes of the BIOS form a jump table. BDOS calls the BIOS through this table.

| Offset | Entry | Function |
|--------|-------|----------|
| +0 | BOOT | Cold boot |
| +3 | WBOOT | Warm boot |
| +6 | CONST | Console status |
| +9 | CONIN | Console input |
| +12 | CONOUT | Console output |
| +15 | LIST | Printer output (falls back to CONOUT) |
| +18 | PUNCH | Paper tape punch (no-op) |
| +21 | READER | Paper tape reader (returns EOF) |
| +24 | HOME | Seek to track 0 |
| +27 | SELDSK | Select disk |
| +30 | SETTRK | Set track number |
| +33 | SETSEC | Set sector number |
| +36 | SETDMA | Set DMA address |
| +39 | READ | Read sector |
| +42 | WRITE | Write sector |
| +45 | LISTST | Printer status (always ready) |
| +48 | SECTRAN | Sector translation (skew table lookup) |

---

## 4. Key Routines

### 4.1 BOOT (Cold Boot)

1. Set stack pointer to `$F200 - 2`
2. Write jump vectors to Page 0:
   - `$0000`: `JMP WBOOT`
   - `$0005`: `JMP BDOS+6`
3. Output sign-on message via CONOUT
4. Select drive A: (`SELDSK(0)`)
5. `JP CCP_BASE` (`$DC00`) for cold entry

```text
64K CP/M VERS 2.2 for vm80a soft-FPGA WASM
BIOS (C) 2026 tommie.jp
```

### 4.2 WBOOT (Warm Boot)

1. Re-initialize stack pointer and Page 0 vectors the same way as cold boot
2. `OUT (PORT_WBOOT), A` — request the harness to reload CCP+BDOS
3. Carry over the drive number saved in `$0004` and call `SELDSK`
4. `JP CCP_BASE + 3` (warm entry)

> Warm boot does not display the sign-on message — this is standard CP/M behaviour.

### 4.3 CONST / CONIN / CONOUT

| Routine | Port | Operation |
|---------|------|-----------|
| CONST | `$02 IN` | 0=no input / 1=input available → A=0x00 / 0xFF |
| CONIN | Poll `$02 IN`, then `$00 IN` | Return byte masked to 7 bits |
| CONOUT | `$01 OUT` | Output 1 character from register C |

### 4.4 SELDSK (Select Disk)

```text
Argument : C = drive number (0=A, 1=B, 2=C, 3=D)
Return   : HL = DPH address (HL=0 on error)
```

1. Save to `CUR_DRV`; notify harness via `OUT (PORT_DDRV)`
2. If number >= N_DRIVES (4), return HL=0 (error)
3. Return pointer to corresponding DPH from `DPH_TABLE`

### 4.5 READ / WRITE

```asm
READ:
    ld  a, 0
    out (PORT_DCMD), a   ; send command (0=READ)
    in  a, (PORT_DCMD)   ; get result (0=OK, 1=error)
    ret

WRITE:
    ld  a, 1
    out (PORT_DCMD), a   ; send command (1=WRITE)
    in  a, (PORT_DCMD)
    ret
```

SETTRK / SETSEC / SETDMA have already OUT'd the track, sector, and transfer address
to their respective ports. The OUT to `PORT_DCMD` acts as the "commit and execute" trigger.

---

## 5. I/O Port Summary

| Port | Dir | Symbol | Purpose |
|------|-----|--------|---------|
| `$00` | IN | CONIN | Read 1 byte from console |
| `$01` | OUT | CONOUT | Write 1 byte to console |
| `$02` | IN | CONST | Console status (0=none, 1=available) |
| `$10` | OUT | DCMD | Disk command (0=READ, 1=WRITE) |
| `$10` | IN | DSTS | Disk result (0=OK) |
| `$11` | OUT | DTRK | Track number |
| `$12` | OUT | DSEC | Sector number (after SECTRAN translation) |
| `$13` | OUT | DDMA_L | DMA address low byte |
| `$14` | OUT | DDMA_H | DMA address high byte |
| `$15` | OUT | DDRV | Drive number (0=A, 1=B, 2=C, 3=D) |
| `$20` | OUT | WBOOT | Reload CCP+BDOS request (warm boot only) |

---

## 6. Disk Parameter Structures

### 6.1 DPH (Disk Parameter Header)

Each of the four drives (A–D) has its own DPH.

```asm
DPH_A:
  defw SKEW_TABLE   ; XLT  pointer to skew table
  defw 0            ; scratch 1
  defw 0            ; scratch 2
  defw 0            ; scratch 3
  defw DIR_BUF      ; DIRBUF  shared by all drives (no concurrent access)
  defw DPB_A        ; DPB     shared by all drives (same format)
  defw CSV_A        ; CSV     checksum vector (A only)
  defw ALV_A        ; ALV     allocation vector (A only)
```

### 6.2 DPB (Disk Parameter Block) — Standard 8-inch SSSD

| Field | Value | Meaning |
|-------|-------|---------|
| SPT | 26 | Sectors per track |
| BSH | 3 | Block size shift (1 KB blocks) |
| BLM | 7 | Block mask |
| EXM | 0 | Extent mask |
| DSM | 242 | Maximum block number |
| DRM | 63 | Maximum directory entry number |
| AL0 | 0xC0 | Directory-occupied blocks |
| AL1 | 0x00 | |
| CKS | 16 | Checksum size |
| OFF | 2 | Reserved track count |

### 6.3 SECTRAN — IBM 3740 Skew Table

Skew factor 6, SPT=26, 0-indexed skew table.
Converts logical sector to physical sector to minimize head-seek wait time.

```text
Logical:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25
Physical: 0  6 12 18 24  4 10 16 22  2  8 14 20  1  7 13 19 25  5 11 17 23  3  9 15 21
```

---

## 7. Harness Interaction Flow

```text
CP/M application
  | BDOS call ($0005)
BDOS
  | BIOS jump table call
BIOS (bios.asm)
  | OUT instruction writes to port
C++ harness (harness.cpp) port_out() / port_in()
  | Console: displayed in browser via xterm.js
  | Disk: sector read/write on DSK image
```

---

## 8. See Also

- [`bios.asm`](../../examples/06-8080/sw/cpm/bios/bios.asm) — BIOS source
- [01-実装計画.md](01-実装計画.md) — Overall architecture
- [52-メモリマップ.md](52-メモリマップ.md) — I/O port map details and disk parameters
- [13-テスト手順.md](13-テスト手順.md) — BIOS verification procedure
