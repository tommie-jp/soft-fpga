# 12. CP/M Command Reference

A list of CP/M 2.2 commands included in this simulator.

## 1. CCP Built-in Commands

Built into the CCP (Console Command Processor). Always available without disk access.

| Command | Syntax | Description |
|---------|--------|-------------|
| `DIR` | `DIR [afn]` | List files. Wildcards supported, e.g., `DIR *.COM` |
| `ERA` | `ERA afn` | Delete files. `ERA *.BAK` deletes all matching files. `ERA *.*` prompts `ALL FILES (Y/N)?` |
| `REN` | `REN new=old` | Rename a file |
| `TYPE` | `TYPE file` | Display a text file to the console |
| `SAVE` | `SAVE n file` | Save n×256 bytes from the start of the TPA to a file |
| `USER` | `USER n` | Switch user area (0–15) |

## 2. Transient Commands

`.COM` files stored on disk. Loaded into the TPA and executed.

### 2.1 File Operations

| Command | Description | Example |
|---------|-------------|---------|
| `PIP` | File copy and concatenation. Peripheral Interchange Program | `PIP DST.TXT=SRC.TXT` |
| `STAT` | Show file sizes and attributes, check disk free space | `STAT *.*` / `STAT` |
| `COPY` | Copy files between drives | `COPY` |
| `SDIR` | Extended DIR. Also shows sizes and attributes | `SDIR` |
| `XDIR` | Extended directory listing | `XDIR` |
| `SURVEY` | Detailed disk usage report | `SURVEY` |

### 2.2 Development Tools

| Command | Description | Example |
|---------|-------------|---------|
| `ASM` | Intel 8080 assembler. `.ASM` → `.HEX` + `.PRN` (listing) | `ASM PROG` |
| `MAC` | Macro assembler (ASM superset). `.ASM` → `.HEX` + `.PRN` | `MAC PROG` |
| `LOAD` | Convert `.HEX` → `.COM` | `LOAD PROG` |
| `DDT` | Dynamic Debugging Tool. Machine-language debugger | `DDT PROG.COM` |
| `DUMP` | Hex dump of a binary file | `DUMP FILE.COM` |
| `MEMMAP` | Display memory map | `MEMMAP` |

### 2.3 Text Editing

| Command | Description | Example |
|---------|-------------|---------|
| `ED` | Line-oriented text editor (standard CP/M tool) | `ED FILE.TXT` |
| `WM` | WordMaster. Full-screen editor. Key reference: `TYPE WM.HLP` | `WM FILE.TXT` |
| `VIEW` | Scroll-browse a text file | `VIEW FILE.TXT` |

### 2.4 Batch Processing

| Command | Description | Example |
|---------|-------------|---------|
| `SUBMIT` | Execute a `.SUB` batch file. Arguments substituted via `$1`–`$n` (e.g., `$1=X`, `$2=PRN`) | `SUBMIT BUILD` / `SUBMIT ASMBL X PRN` |
| `XSUB` | Extended SUBMIT. Also allows batch stdin to programs | `XSUB` |

### 2.5 System Administration

| Command | Description | Example |
|---------|-------------|---------|
| `MOVCPM` | Relocate CP/M for a different memory size | `MOVCPM 62 *` |
| `SYSGEN` | Write CP/M image to system tracks | `SYSGEN` |
| `FORMAT` | Format a disk | `FORMAT` |
| `CLS` | Clear the screen | `CLS` |
| `BYE` | Shut down / log out | `BYE` |

## 3. Common Usage Patterns

```text
A>DIR *.COM              ← List only .COM files
A>STAT *.*               ← Show sizes of all files
A>STAT                   ← Show disk free space
A>TYPE FILE.TXT          ← Display text file
A>PIP B:=A:FILE.COM      ← Copy from A: to B:
A>ERA *.BAK              ← Delete all backup files
```

### Assemble → Run Workflow

```text
A>ASM PROG        ← PROG.ASM → PROG.HEX (+ PROG.PRN)
A>LOAD PROG       ← PROG.HEX → PROG.COM
A>PROG            ← Execute
```

### DDT (Debugger) Main Commands

Disassembly output uses **Intel 8080 mnemonics** (`MOV`/`LXI`/`JMP` style), which differ from Z80 mnemonics (`LD`/`JP`).

```text
-L100             ← Disassemble from address 0100H (List)
-D100             ← Hex dump from address 0100H (Display)
-G100             ← Execute from address 0100H (Go)
-T                ← Single-step trace (Trace)
-X                ← Show/modify registers (eXamine)
-R PROG.COM       ← Load file into memory (Read)
-A100             ← Inline assemble from address 0100H (Assemble)
-F100,1FF,0       ← Zero-fill 100H–1FFH (Fill)
-M100,1FF,200     ← Move memory block (Move)
-S100             ← Set memory value at address 0100H (Set)
Ctrl+C            ← Exit DDT (warm-boot back to A>)
```

No space is allowed between the command letter and address (`-L100` is correct; `-L 100` gives a `?` error).
There is no `-Q` command; the only way to exit DDT is `Ctrl+C`.

**Exiting the simulator**: `Ctrl+\` (Ctrl+backslash).
`Ctrl+C` is passed into the emulator, so it acts as a DDT → CP/M warm boot.

### ED (Line-Oriented Text Editor) Usage

ED edits files through a memory buffer. Text is loaded into the buffer, edited, then written back to disk.

#### Starting ED

```text
A>ED FILE.TXT          ← Edit an existing file (creates a new one if it does not exist)
```

After startup, a `*` prompt appears waiting for commands.

#### Main Commands

| Command | Description |
|---------|-------------|
| `I` | Start insert mode. Type text and press `Ctrl+Z` to end |
| `nT` | Display n lines from the CP (default 1). `0T` = to end of line. `#T` = all lines |
| `±nL` | Advance n lines (default 1). `-nL` moves backward. `0L` moves to start of line |
| `±nC` | Advance n characters (default 1). `-nC` moves backward |
| `B` | Move to start of buffer. `-B` moves to end of buffer |
| `nA` | Read n lines from disk. `0A` = until buffer is 50%+ full. `#A` = all |
| `E` | Save and exit (creates a `.BAK` file) |
| `Q` | Exit without saving |
| `nK` | Delete n lines (default 1). `-nK` deletes backward |
| `nD` | Delete n characters (default 1). `-nD` deletes backward |
| `Fstr<cr>` | Forward-search for string `str` (confirm with Enter) |
| `Sold^Znew<cr>` | Replace `old` with `new` (one occurrence). `^Z` separates the two strings; Enter confirms |
| `nSold^Znew<cr>` | Replace n occurrences. `#S` replaces all |
| `U` | Enable lowercase-to-uppercase translation |
| `-U` | Disable lowercase-to-uppercase translation (official default; this disk defaults to U enabled) |

`^Z` means `Ctrl+Z`. `<cr>` means the Enter key. Commands can be chained on one line (e.g., `BFhello^Z` = search for "hello" from the start of the buffer). Using `^Z` instead of `<cr>` as a string terminator lets you chain further commands on the same line.

#### Typical Usage Examples

```text
* I                    ← Start insert mode
Hello, CP/M!
^Z                     ← End insert
* #T                   ← Display all lines
      1: Hello, CP/M!
* B                    ← Return to start
* SHello^ZGoodbye      ← Replace with exact case match (confirm with Enter)
* #T
      1: Goodbye, CP/M!
* E                    ← Save and exit

; To replace using lowercase, first disable translation with -U:
* -U                   ← Disable lowercase-to-uppercase translation
* B
* SGoodbye^Zhello      ← Replace with lowercase (stored as-is after -U, confirm with Enter)
* #T
      1: hello, CP/M!
* E
```

#### Notes

- Search and replace are **case-sensitive**
- **ED has a U/-U mode.** The `U` command enables lowercase-to-uppercase translation; `-U` disables it
- The ED on this disk image has **U mode enabled by default**, so lowercase input is stored as uppercase in the buffer
  (e.g., entering `SLINE^Zlinexx^Z` is processed as `SLINE^ZLINEXX^Z`)
- To use lowercase, run `* -U` before editing
- When `#S` (replace all) exhausts all matches, it prints `BREAK "#" AT X` and stops — this is normal behavior
- Exiting with `E` saves the original file as `.BAK` and writes the edited content under the original filename
- Exiting with `Q` discards all changes (no `.BAK` is created)

## 4. Simulator-Specific Commands

| Command | Description |
|---------|-------------|
| `8080EX1` | Exerciser for all 20 groups of the 8080 instruction set (custom implementation) |
| `R <filename>` | Transfer a file from the host PC to the CP/M disk |
| `W <filename>` | Transfer a file from the CP/M disk to the host PC |
| `!command` | Run a Linux command and display its output (native `cpm` command only) |

### ! — Linux Shell Escape (native `cpm` command only)

While running the native `cpm` command, typing `!` as the first character at the CP/M prompt executes a Linux command.

```text
A>!ls                ← List files in the current directory
A>!date              ← Display the current date and time
A>!pwd               ← Display the current directory path
A>!cat hello.c       ← Display the contents of a host file
A>!ls *.c            ← List C source files on the host
```

- **Only valid at the start of the line**: shell escape is triggered when `!` is the first character after the `A>` prompt. Characters typed mid-line are sent to CP/M as normal input
- Everything after `!` is executed as a Linux command (`2>&1` redirection is appended automatically)
- The command runs in the shell environment (current directory, environment variables, etc.) that launched `cpm`
- After the command completes, the CP/M prompt (`A>`) is redisplayed
- **Limitation**: interactive commands such as `bash` or `vim` do not work correctly due to raw-mode terminal handling. Only one-shot commands that return output are supported
- **Not available in the WASM build**: this feature does not exist in the browser-based simulator

### R / W — Host File Transfer Commands

Custom utilities (v1.0) included on the disk image. Not part of standard CP/M.

```text
A>R HELLO.ASM       ← Write HELLO.ASM from the host PC to the CP/M disk
A>W RESULT.TXT      ← Write RESULT.TXT from the CP/M disk to the host PC
```

- Files are referenced from the directory where `cpm` was launched
- Filenames must be CP/M-compatible (uppercase letters, digits, symbols; no underscores; max 8+3 characters)
  - Not OK: `test_host.txt` (underscore causes the CCP to truncate at 4 characters)
  - OK: `HELLO.ASM`, `RESULT.TXT`, `PROG.COM`
- Wildcards are not supported
- Internally uses I/O port `$A1h` (implemented in `harness.cpp` as `handle_io` / `read_io`)

### 8080EX1 — Passing Output Example

```text
A>8080ex1
8080 instruction exerciser
ld r,n (MVI)....................OK
ld r,r (MOV)....................OK
lxi/push/pop....................OK
ex/xthl/pchl/sphl...............OK
add a,r.........................OK
adc a,r.........................OK
sub r...........................OK
sbc a,r.........................OK
and r...........................OK
or/xor r........................OK
cp r............................OK
inc r...........................OK
dec r...........................OK
inx/dcx/dad.....................OK
sta/lda/stax/ldax/shld/lhld.....OK
rlca/rrca/rla/rra/scf/ccf/cpl...OK
jp cond (all 8).................OK
call cond (all 8)...............OK
ret cond (all 8)................OK
rst 1/7.........................OK
Tests complete
```

All 20 groups showing `OK` followed by `Tests complete` indicates a pass.

## 5. References

- [10-テスト仕様書.md](10-テスト仕様書.md) — Test procedures using these commands
- [52-メモリマップ.md](52-メモリマップ.md) — CP/M memory layout
- [CP/M Operating System Manual — Archive.org](https://archive.org/details/CPM_Operating_System_Manual) — Official manual for DIR/ERA/REN/DDT/ASM/PIP/STAT and more
- [CPM ED (A Context Editor) User's Manual — Archive.org](https://archive.org/details/CPM_ED_A_Context_Editor_Users_Manual) — Official ED command manual
- [CPM ED full text — Archive.org](https://archive.org/stream/CPM_ED_A_Context_Editor_Users_Manual/CPM_ED_A_Context_Editor_Users_Manual_djvu.txt) — Plain-text version (easier to search)
