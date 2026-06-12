# 17. How to Use MBASIC

Microsoft BASIC (MBASIC 5.21) — an interpreter-style BASIC that runs on CP/M 2.2.

## 1. Starting and Exiting

```text
A>MBASIC              ← launch in interactive mode
A>MBASIC HAMURABI.BAS ← launch with a BAS file pre-loaded
```

**How to return to CP/M (important):**

```text
Ok
SYSTEM
```

Typing the `SYSTEM` command exits MBASIC and returns you to the CP/M prompt.
`QUIT` and `EXIT` are not recognized.

## 2. Basic Operations

### Running a Program

```text
Ok
LOAD "HAMURABI.BAS"  ← load from disk
RUN                  ← run
```

When a filename is specified at launch, it is loaded automatically (but RUN must still be typed manually).

### Commonly Used Commands

| Command | Action |
|---------|--------|
| `RUN` | Run the program from the beginning |
| `LIST` | Display the program on screen |
| `LIST 10,50` | Display lines 10 through 50 |
| `NEW` | Clear the program from memory |
| `LOAD "FILE.BAS"` | Load a file |
| `SAVE "FILE.BAS"` | Save to a file |
| `SYSTEM` | **Exit MBASIC and return to CP/M** |

### Interrupting Execution

```text
Ctrl+C   ← interrupt execution (program is kept in memory)
```

After interrupting, type `CONT` to resume or `RUN` to restart from the beginning.

## 3. BASIC Games Included on This Disk

| File | Game description |
|------|-----------------|
| `HAMURABI.BAS` | Agricultural and population management simulation for an ancient city |
| `BLACKJCK.BAS` | Blackjack |
| `CHECKERS.BAS` | Checkers (Draughts) |
| `AWARI.BAS` | Traditional African board game (Mancala family) |

Launch example:

```text
A>MBASIC HAMURABI.BAS
```

To exit and return to CP/M after finishing (or after interrupting with Ctrl+C):

```text
Ok
SYSTEM
```

## 4. Running Statements Directly (Using MBASIC as a Calculator)

Statements entered without a line number are executed immediately.

```text
Ok
PRINT 2^16
 65536
Ok
PRINT SQR(2)
 1.41421
Ok
```

## 5. References

- [12-CP_M-コマンドリファレンス.md](12-CP_M-コマンドリファレンス.md) — CP/M command reference
- [16-CP_M-ソフトウェア入手先.md](16-CP_M-ソフトウェア入手先.md) — where to obtain MBASIC
