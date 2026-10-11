# Integer BASIC Boot Failure — Investigation Results

## Symptom (Before Fix)

```text
$ ./doAppleI-basic.sh
\
E000R

E000: 4C
```

`doAppleI-basic.sh` runs `${SIM} "E000R"`.
`E000: 4C` is the Woz Monitor's **examine output** (showing that the value at address `$E000`
is `0x4C`).
If BASIC had started, the `>` prompt should appear — but it does not.

## Related Files

| File | Role |
| --- | --- |
| `examples/04-6502/cxx/harness.cpp` | Memory map, PIA emulation, embedded BASIC/WOZMON ROMs |
| `examples/04-6502/cxx/main_linux.cpp` | Feeds `boot_cmd` → `send_key()` with `"E000R\r"` |
| `examples/04-6502/verilog/apple1_top.v` | CPU wrapper (memory lives on the harness side) |

## Memory Map (harness.cpp)

| Address | Contents |
| --- | --- |
| `$0000-$CFFF` | RAM (zero-initialized) |
| `$D010-$D01F` | PIA (KBD/KBDCR/DSP/DSPCR) |
| `$E000-$EFFF` | Integer BASIC ROM (4096 bytes) |
| `$FF00-$FFFF` | Woz Monitor ROM (256 bytes) |

Reset vector `$FFFC-$FFFD` = `$00 $FF` → CPU boots from `$FF00` (wozmon).

---

## Root Cause

**The BASIC ROM binary embedded in `harness.cpp` was incorrect.**

- Comparing against the correct binary (from whscullin/apple1js), 3726 bytes differed from
  offset `$0138` (`$E138`) to the end.
- In the incorrect ROM, `$E2B0` was not the BASIC cold-start entry point but was instead in the
  middle of a different subroutine (a sort comparison function), causing it to return immediately
  via `DEX` → `RTS`.
- The wozmon was correctly JMPing to `$E000` (hypothesis A was wrong).

### Behavior Near `$E2B0` in the Incorrect ROM

```asm
$E2B0: 95 50  STA $50,X   ; X=0 → writes to $50
$E2B1: D5 78  CMP $78,X   ; compare
...
$E2B4: CA     DEX         ; X=0 → X=0xFF
$E2B5: 10 xx  BPL ...     ; negative, so branch skipped
$E2B6: 18     CLC
$E2B7: 60     RTS         ; returns to wozmon stack → runaway
```

### Behavior Near `$E2B0` in the Correct ROM

```asm
$E2B0: 20 D3 EF  JSR $EFD3  ; BASIC initialization routine
$E2B3: 20 CD E3  JSR $E3CD  ; text pointer initialization
...
→ eventually reaches the > prompt output at $E3CD
```

---

## Investigation Phase Results

### Phase 1 — Confirm Whether PC Reaches the BASIC Region

`BASIC PC=E001` was printed → wozmon was correctly JMPing to `$E000`.
Hypothesis A (wozmon not jumping) was disproven.

### Phase 2 — Identify the BASIC Boot Sequence

Bus-cycle tracing confirmed that after reaching `$E2B0`, an `RTS` was executed immediately.
The incorrect ROM binary was identified as the cause.

### Phase 3 — Verify PIA / Display Path

Writes to DSP were correctly propagating all the way to `get_display_char()`.
The display path had no issues. Display-interrupt timing also worked correctly in wozmon.

---

## Fix Applied

The `BASIC[4096]` array in `harness.cpp` was replaced with the canonical ROM from
whscullin/apple1js.

- Source: [https://github.com/whscullin/apple1js/blob/main/js/roms/basic.ts](https://github.com/whscullin/apple1js/blob/main/js/roms/basic.ts)
- First 12 bytes (identical): `4C B0 E2 AD 11 D0 10 FB AD 10 D0 60`
- `$E2B0`: `20 D3 EF` (JSR $EFD3) → correctly branches to BASIC initialization

## Behavior After Fix

```text
$ ./doAppleI-basic.sh
\
E000R

E000: 4C
>
```

The `>` prompt appears and Integer BASIC starts up correctly.
