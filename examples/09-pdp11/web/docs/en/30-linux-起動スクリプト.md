# 30. Linux Boot Script (doPDP11-unix-v6.sh) <a class="qr-link" href="../../../docs/09-PDP11/img/30-en-QR.png">QR</a>

## 1. Overview

`./doPDP11-unix-v6.sh` launches a Linux-native simulator for PDP-11 / Unix V6.
Unlike the Wasm version, it lets you interact with Unix V6 directly in a terminal.

```bash
$ ./doPDP11-unix-v6.sh
@rkunix

login: root
# ls /
bin  dev  etc  hpunix  lib  mnt  rkunix  rpunix  tmp  unix  usr
# ~.    ← exit
```

## 2. How It Works

### 2.1 Architecture

```text
doPDP11-unix-v6.sh
  └─ examples/09-pdp11/build/pdp11_sim
       ├─ Vtest_top_wasm (Verilator-generated C++)
       ├─ wasm_uart.v (DPI-based UART)
       ├─ ide_v5.cpp (RK05 disk DPI)
       └─ main_linux.cpp (terminal I/O + boot sequence)
```

### 2.2 TTY I/O

Uses the same `wasm_uart.v` (DPI) as the Wasm version.

| Direction | Function | Implementation |
|-----------|----------|----------------|
| PDP-11 → terminal | `dpi_tty_putc(ch)` | `write(g_tty_fd, &c, 1)` |
| terminal → PDP-11 | `dpi_tty_getc()` | `read(STDIN_FILENO, ...)` non-blocking |

`g_tty_fd` is obtained at startup via `dup(STDOUT_FILENO)`.  
Verilator `$display` output (e.g. `BUSERR`) is redirected to stderr with `dup2(STDERR, STDOUT)` and can be suppressed on the script side with `2>/dev/null`.

### 2.3 Automatic Boot Sequence

Handled inside `dpi_tty_getc()`.

1. Wait 8,000,000 clocks (same value as `fake_init_delay` in `fake_uart.v`)
2. Send `"rkunix\r"` one character at a time with 3,000-clock intervals
3. Afterwards, switch to interactive input (stdin polling)

## 3. Exiting: the `~.` Escape

### 3.1 Design Background

Uses the same "tilde-at-start-of-line" convention as ssh / tip / cu.

| Tool | Escape key | Detection method |
|------|------------|-----------------|
| ssh | `~.` | State machine: newline then `~` |
| tip / cu | `~.` | Same |
| SIMH | `Ctrl-E` | Single-character intercept |
| QEMU | `Ctrl-A x` | Prefix method |

`^\` (SIGQUIT method) is not generated because `cfmakeraw()` disables `ISIG`.

### 3.2 State Machine (main_linux.cpp)

```text
On startup → ST_AFTER_NL (treated as start of line)

ST_NORMAL   ─ \r/\n ─→ ST_AFTER_NL
ST_AFTER_NL ─  ~   ─→ ST_AFTER_TILDE (hold ~)
            ─ other ─→ ST_NORMAL
ST_AFTER_TILDE ─ . ─→ g_stop = 1 (exit)
               ─ ~ ─→ ST_AFTER_NL, send one ~ character (~~ → ~)
               ─ X ─→ send ~, hold X in tty_pending
```

### 3.3 Key Bindings

| Input | Action |
|-------|--------|
| `~.` (start of line) | Exit simulator |
| `~~` (start of line) | Send one `~` character to PDP-11 |
| `~X` (start of line) | Send `~X` as-is to PDP-11 |
| `Ctrl-C` | Interrupt Unix V6 process (host does not exit) |

## 4. Build

```bash
bash scripts/build-host-09.sh
```

- Verilator generates C++ from `test_top_wasm.v`
- Links with `g++ -O2` (`verilated.cpp`, `verilated_threads.cpp`, `ide_v5.cpp`, `ram_v5.cpp`, `main_linux.cpp`)
- Output: `examples/09-pdp11/build/pdp11_sim`

## 5. Related Files

| File | Role |
|------|------|
| `doPDP11-unix-v6.sh` | Boot script |
| `examples/09-pdp11/cxx/main_linux.cpp` | Terminal I/O, boot sequence, `~.` escape |
| `examples/09-pdp11/cxx/ide_v5.cpp` | RK05 disk DPI implementation |
| `examples/09-pdp11/verilog/wasm_uart.v` | DPI-based UART (shared by Wasm and Linux) |
| `scripts/build-host-09.sh` | Linux native build script |
| `examples/09-pdp11/disk/unix_v6_rk05.dsk` | Unix V6 RK05 disk image |
