# 10. Unix V6 Command Reference <a class="qr-link" href="../../../docs/09-PDP11/img/10-QR.png">QR</a>

A list of major commands included in the Unix V6 (1975) distribution bundled with this simulator.
Most commands reside in `/bin/` or `/usr/bin/` (games are in `/usr/games/`).
All listed commands have been verified against the actual V6 filesystem (`/bin`, `/usr/bin`, `/usr/games`);
only commands that exist in V6 are included.

## 1. Shell Built-ins

Built-in commands of the Thompson shell (`/bin/sh`).

| Command | Syntax | Description |
|---------|--------|-------------|
| `chdir` | `chdir dir` | Change current directory (V6 built-in) |
| `exit` | `exit` | Exit the shell (logout) |
| `wait` | `wait` | Wait for a child process to finish |

## 2. File Operations

| Command | Description | Example |
|---------|-------------|---------|
| `ls` | List files. `-l` for details, `-a` to include hidden files | `ls -l /usr` |
| `cat` | Print file contents to the console | `cat /etc/passwd` |
| `cp` | Copy a file | `cp src dst` |
| `mv` | Move or rename a file | `mv old new` |
| `rm` | Delete a file. `-r` for recursive directory removal | `rm file` |
| `mkdir` | Create a directory | `mkdir /tmp/work` |
| `rmdir` | Remove an empty directory | `rmdir /tmp/work` |
| `ln` | Create a hard link (V6 has no symbolic links) | `ln src lnk` |
| `chmod` | Change permissions (octal notation) | `chmod 755 prog` |
| `chown` | Change file owner | `chown root file` |

## 3. Text Processing

| Command | Description | Example |
|---------|-------------|---------|
| `ed` | Line-oriented text editor (V6 standard) | `ed file.txt` |
| `grep` | Regular expression search. `-v` to invert | `grep root /etc/passwd` |
| `sort` | Sort lines in lexicographic order | `sort /etc/passwd` |
| `wc` | Count lines, words, and bytes | `wc /usr/sys/ken/main.c` |
| `diff` | Show differences between two files | `diff a.c b.c` |
| `pr` | Format output with page numbers | `pr file.txt` |

## 4. System Information

| Command | Description | Example |
|---------|-------------|---------|
| `who` | List logged-in users | `who` |
| `ps` | List processes. `-ag` for all processes | `ps -ag` |
| `pwd` | Print the current directory path | `pwd` |
| `date` | Display the current date and time | `date` |
| `df` | Show free disk space | `df` |
| `du` | Show disk usage of a directory | `du /usr` |
| `size` | Show segment sizes of an executable | `size /bin/sh` |

## 5. Development Tools

| Command | Description | Example |
|---------|-------------|---------|
| `cc` | C compiler (Dennis Ritchie's version) | `cc hello.c` |
| `as` | PDP-11 assembler | `as prog.s` |
| `ld` | Linker | `ld /lib/crt0.o prog.o -lc` |
| `ar` | Archive manager (library creation) | `ar tv /lib/libc.a` |
| `nm` | Display symbol table | `nm a.out` |
| `od` | Octal dump of binary files | `od -c a.out` |
| `db` | Static debugger (disassembly / core dump analysis) → [Chapter 14](?doc=14-db-デバッガー-使い方.md) | `db a.out` |
| `cdb` | C-language debugger | `cdb a.out` |

### Basic Usage of cc

```text
# Compile only
cc -c hello.c       ← generates hello.o

# Compile + link (standard)
cc hello.c          ← generates a.out

# Run
./a.out
```

## 6. Calculator / Arithmetic

### dc — Reverse Polish Calculator

> **⚠️ The `dc` binary in this disk image is corrupted and cannot be executed**
>
> `/bin/dc` exists on disk (10254 B, mode 0110775), but `file /bin/dc` reports `data`.
> The a.out magic number is invalid, so the kernel's `exec()` fails with ENOEXEC
> and the shell displays `dc: not found`.
> Under investigation. As a workaround, use `expr` for integer arithmetic (e.g., `expr 355 / 113`).

`dc`, written by Thompson, is one of the iconic utilities of Unix V6.

```text
dc
  2 3 + p       ← 5
  10 k          ← set decimal precision to 10 digits
  355 113 / p   ← 3.1415929203 (approximation of π)
  q             ← quit
```

| Command | Description |
|---------|-------------|
| `p` | Print the top of the stack |
| `q` | Quit |
| `+` `-` `*` `/` | Arithmetic operations (operate on top two stack values) |
| `nk` | Set decimal precision to n digits |
| `v` | Square root |
| `^` | Exponentiation |

### bc — High-Level Calculator (front-end for dc)

> **⚠️ `/usr/bin/bc` also fails to exec (`bc: not found`) — under investigation**
>
> Independently of `dc`, `/usr/bin/bc` itself cannot be executed (exec error).

```text
bc
  scale=5
  sqrt(2)     ← 1.41421
  ^D          ← EOF to quit
```

## 7. Games (`/usr/games/`)

> **⚠️ Some games fail to exec and cannot be launched — under investigation**

| Command | Description | Status |
|---------|-------------|--------|
| `/usr/games/bj` | Blackjack | ✓ Confirmed working |
| `/usr/games/moo` | Number guessing game (Bulls and Cows) | ✓ Confirmed working |
| `/usr/games/cubic` | 3D tic-tac-toe | ✓ Confirmed working |
| `/usr/games/wump` | Wumpus (prototype text adventure) | ✗ exec fails |
| `/usr/games/ttt` | Tic-tac-toe | ✗ exec fails |
| `/usr/games/chess` | Chess | ✗ exec fails |

Games must be launched with their absolute path under `/usr/games/` (not included in root's PATH).

## 8. ed — Line-Oriented Text Editor

The V6 standard `ed` edits files through a line buffer.

### Starting ed

```text
# root@unix # ed
a
Hello, Unix V6!
.
p
q
```

### Main Commands

| Command | Description |
|---------|-------------|
| `a` | Append mode after the current line (end with a line containing only `.`) |
| `i` | Insert mode before the current line (end with a line containing only `.`) |
| `p` | Print the current line |
| `l` | Print with control characters visible |
| `d` | Delete the current line |
| `s/old/new/` | Replace the first occurrence of `old` with `new` on the current line. `g` for global replace |
| `w file` | Save to file |
| `q` | Quit (press `q` twice to force quit without saving) |
| `1,$p` | Print all lines |
| `/pattern/` | Forward search using a regular expression |

## 9. TTY Settings (stty)

### TTY Special Characters

Special characters interpreted by the Unix V6 TTY driver in cooked mode (the default).

| Character | Code | Name | Change via | Description |
|-----------|------|------|------------|-------------|
| `@` | 0x40 | kill-line | `stty kill X` | Discard the entire input line |
| DEL | 0x7F | erase | `stty erase X` | Delete the previous character |
| `^D` | 0x04 | CEOT (EOF) | not changeable | Makes `read()` return 0 (EOF) |
| `^C` | 0x03 | CINTR | not changeable | Send SIGINT to the foreground process |
| `^\` | 0x1C | CQUIT | not changeable | SIGQUIT + core dump |

Only `kill` and `erase` can be changed via `stty`. The remaining three are hardcoded in the kernel.

### stty Examples

```text
stty               ← display current TTY settings
stty kill @        ← restore kill-line to @ (default)
stty erase ^?      ← restore erase to DEL (0x7F)
```

To temporarily disable kill/erase, assign an unused control character (e.g., `^A` = 0x01).

### File Transfer via the EDITOR Button

The EDITOR button in this simulator **bypasses the TTY entirely** and writes directly
to the V6 FS disk image, avoiding garbling caused by `@` kill-line or erase characters.

Files are written to `/tmp/<filename>`. A confirmation message is displayed on the terminal after writing.

#### Usage Example

```text
# Write loop.s in the EDITOR and send → written to /tmp/loop.s
# Terminal shows "[Editor] /tmp/loop.s saved"
# Then run as
as /tmp/loop.s
a.out
```

#### Technical Limitations

- Maximum file size: 4 KB (8 blocks)
- Write destination: `/tmp/` only
- Filename: ASCII printable characters only, 14 characters or fewer
- Existing files with the same name are overwritten

## 10. Simulator-Specific Behavior

| Item | Details |
|------|---------|
| Boot | Type `rkunix` to start the Unix V6 kernel |
| Login | `login: root` (no password) |
| Shell | `/bin/sh` (Thompson shell) |
| Prompt | `#` (root shell) |
| Ctrl+\\ | Stop simulation (use the Pause button in the browser version) |
| Ctrl+C | Send SIGINT to Unix (interrupt a command) |

## 10. References

- [52 Memory Map](?doc=52-メモリマップ.md) — Unibus device address list
- [06 Demo Commands](?doc=06-unix-v6-demo-commands.md) — Demo scenario
- [Unix V6 Manual Pages (TUHS)](https://www.tuhs.org/cgi-bin/utree.pl?act=get&file=V6/usr/man)
