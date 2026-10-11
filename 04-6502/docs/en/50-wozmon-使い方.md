# Woz Monitor (wozmon) Usage Guide

A small monitor program (256 bytes, $FF00–$FFFF) written by Steve Wozniak for the Apple-1.

## 1. Starting Up

The monitor starts automatically when you open the simulator, displaying the prompt `\`.

```text
\
```

## 2. Basic Commands

### 2.1 Memory Examine (Single Address)

```text
XXXX
```

Example:

```text
\ FF00
FF00: D8
```

### 2.2 Memory Range Dump

```text
XXXX.YYYY
```

Example:

```text
\ FF00.FF0F
FF00: D8 58 A0 7F 8C 12 D0 A9
FF08: A7 8D 11 D0 8D 13 D0 C9
```

### 2.3 Memory Write

```text
XXXX: DD DD DD ...
```

Example (write LDA #$55 / JMP $0300 to $0300):

```text
\ 0300: A9 55 4C 00 03
```

- Enter a colon (`:`) immediately after the address, followed by the values
- Multiple bytes can be written in sequence, separated by spaces
- Press Enter to confirm

### 2.4 Program Execution

```text
XXXXR
```

Example:

```text
\ 0300R
```

- Executes from the specified address, equivalent to `JMP $XXXX`
- `RTS` cannot be used inside the program (no return address on the stack)
- Use `BRK` to return to the monitor

## 3. Practical Examples

### 3.1 Entering and Running a Small Program

```text
\ 0300: A9 55 85 00 A9 AA 85 01 00
\ 0300.0308
0300: A9
0301: 55
0302: 85
0303: 00
0304: A9
0305: AA
0306: 85
0307: 01
0308: 00
\ 0300R
```

This program stores A=$55 to address $00, A=$AA to address $01, then returns via BRK.

### 3.2 Zero Page Inspection

```text
\ 0000.00FF
```

## 4. Character Encoding

- The Apple-1 uses "high-bit ASCII" with bit 7 set to 1
- Keyboard input is automatically converted from lowercase to uppercase (handled by the simulator)
- Display range is `$20`–`$7E` (bit 7 is ignored)

## 5. Notes

| Item | Description |
| --- | --- |
| Address notation | Uppercase hex, 4 digits (e.g. `0300`) |
| Number notation | Hexadecimal only (no `0x` prefix needed) |
| Enter | Newline and command confirmation |
| Backspace | `_` (underscore) key |
| Escape | Cancels the current input line and returns to `\` |

## 6. ROM Layout (Reference)

| Address | Contents |
| --- | --- |
| `$FF00` | RESET entry / NOTCR loop |
| `$FF1A` | `\` prompt output + GETLINE |
| `$FF29` | GETCHAR (waits for KBD strobe) |
| `$FF3A` | SETSTOR (`:` write mode) |
| `$FF4A` | SETADR (address parsing) |
| `$FFDC` | PRBYTE (display one byte as 2 hex digits) |
| `$FFE5` | PRHEX (display one nibble as 1 hex digit) |
| `$FFEF` | ECHO (output one character to DSP) |
| `$FFFC` | Reset vector = `$00 $FF` → `$FF00` |
| `$FFFE` | IRQ vector = `$00 $00` → `$0000` |

---

For test specifications (automated tests, functional verification programs, and Klaus Dormann test),
see [10-テスト仕様書.md](10-テスト仕様書.md).
