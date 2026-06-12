# 14. cpm Command Reference

`examples/06-8080/build/cpm` — Intel 8080 / CP/M 2.2 soft-FPGA simulator.

## 1. Syntax

```text
cpm [mode-flag] [file-option]
```

If no mode flag is given, the simulator launches as an **interactive CP/M** session.

## 2. Mode Flags

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Display help and exit |
| `--test` | Harness built-in smoke test (`MVI+OUT+HLT`) |
| `--boot-test` | CP/M boot test (pass/fail determined by detecting `A>` prompt) |
| `--run-test <file>` | Load and run a bare-metal binary; determine pass/fail |
| `--bare-test <file>` | Run a bare-metal binary with a long timeout |
| `--exec <cmd>` | Boot CP/M, run a command, and print its output to stdout |

### `--test`

Minimal test that verifies vm80a operates standalone without CP/M.

```bash
cpm --test
# → [test] sim_test: 2 bytes out (Hi)   exit 0 = PASS
```

### `--boot-test`

Validates the BIOS → CCP+BDOS boot sequence. Exits 0 if the `A>` prompt appears.

```bash
cpm --boot-test
# → A>
# → --- CP/M boot: OK (A> found) ---   exit 0 = PASS
```

### `--run-test \<file\>

Loads a bare-metal binary (no CP/M required) at `0x0000` and runs it.
Pass/fail is determined by counting `P` (PASS) and `F` (FAIL) characters.
Runs for up to 2 million cycles.

```bash
cpm --run-test test/test_all.bin
# → PPPPPPPPPPPPPPPPPPPP
# → --- 20 group(s) tested: ALL PASS ---   exit 0 = PASS
```

### `--bare-test \<file\>

Long-running variant of `--run-test`. Runs up to 20 billion cycles with a
no-output timeout of 200 million cycles. Exits normally if "Tests complete"
or "Press a key" appears.

```bash
cpm --bare-test prog.bin
```

### `--exec \<cmd\>

Boots CP/M, waits for the prompt, sends the command, and displays the output.
Exits 0 if "Tests complete" appears; exits 1 on timeout.

```bash
cpm --exec 8080EX1   # Run the CPU exerciser
cpm --exec DIR       # Display DIR output (for output verification)
```

## 3. File Options

When omitted, paths are resolved automatically relative to the binary location
(works regardless of which directory you run from).

| Option | Default (relative to binary) | Description |
|--------|------------------------------|-------------|
| `--bios <path>` | `../sw/cpm/bios/bios.bin` | BIOS binary |
| `--cpm <path>` | `../rom/cpm22.bin` | CCP+BDOS binary |
| `--disk <path>` | `../sw/cpm/disks/cpm22.dsk` | DSK image |

## 4. Examples

```bash
# Interactive CP/M (exit with Ctrl+C)
cpm

# Run tests in sequence
cpm --test
cpm --boot-test
cpm --run-test test/test_all.bin
cpm --exec 8080EX1

# Launch with a different disk image
cpm --disk /path/to/other.dsk

# Works from any directory
/path/to/build/cpm --boot-test
```

## 5. Exit Codes

| Exit code | Meaning |
|-----------|---------|
| `0` | PASS / normal exit |
| `1` | FAIL / error / timeout |

## 6. References

- [13-テスト手順.md](13-テスト手順.md) — Expected output for each test mode
- [10-テスト仕様書.md](10-テスト仕様書.md) — Test design details
