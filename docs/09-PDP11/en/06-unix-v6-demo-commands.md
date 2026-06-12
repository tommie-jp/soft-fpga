# 06. Unix V6 Demo Command Reference <a class="qr-link" href="../../../docs/09-PDP11/img/06-QR.png">QR</a>

## Right After Boot (Standard Checks)

```text
who
pwd
ls -l
cat /etc/passwd
```

`/etc/passwd` stores passwords in plain text — a fun historical footnote from 1975.

## System Exploration (Works Well with Visualization)

```text
ps -ag          # Process list — living proof of fork/exec
ls -l /dev      # Device list
/etc/mount      # Mount information
```

The MMU PAR/PDR changes actively while `ps` runs, making it a great match with the Logic Analyzer view.

## dc — Thompson's Reverse Polish Calculator (Straight from the 1970s)

> **Warning: `dc` in this disk image is a corrupted binary and cannot be executed**
>
> `/bin/dc` exists, but `file /bin/dc` returns `data` (invalid a.out magic number).
> `exec()` fails with ENOEXEC, resulting in `dc: not found`. Under investigation.
> Use `expr` for integer arithmetic as a substitute (e.g., `expr 355 / 113`).

```text
dc
  2 3 + p
  10 k
  355 113 / p
  q
```

- `2 3 + p` → 5
- `10 k` enables 10-decimal-digit precision mode
- `355 113 / p` → π ≈ 3.1415929203

## ed — The Earliest Line Editor

```text
ed
  a
  Hello from 1975!
  .
  p
  q
```

## C Compilation (The Main Attraction)

```text
cat > hello.c
main() {
    printf("Hello, Unix V6!\n");
}
^D

cc hello.c
./a.out
```

While compiling, r0–r5, SP, and the MMU PAR change dramatically.
Combining this with the Logic Analyzer view makes for the perfect demo climax.

## Games (Closing Act)

```text
/usr/games/wump     # Wumpus — the first text adventure in history
/usr/games/ttt      # Tic-tac-toe
/usr/games/chess    # Chess
```

## Shutdown Procedure

Unix V6 has no `halt` or `shutdown` command.

```text
# sync
# sync
```

Run `sync` twice to flush writes to disk, then type **`~.`** at the beginning of a line (immediately after pressing Enter) to exit the simulator (the same convention used by ssh/tip/cu).

- `~.` — exit the simulator
- `~~` — send a literal `~` character (escape)
- Ctrl-C — interrupt the Unix V6 process (does not exit the simulator)

---

## Recommended Demo Scenario

1. Boot → `login: root` → `ls -l /` (feel the OS come alive)
2. `ps -ag` (observe live processes)
3. `dc` for arithmetic (interrupt waveforms appear in the Logic Analyzer)
4. `cc hello.c && ./a.out` (MMU and GPRs change dramatically during compilation — the showpiece of the visualization)
5. `/usr/games/wump` to close out
