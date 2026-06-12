# 07. Historical Significance of Unix V6 / PDP-11 <a class="qr-link" href="../../../docs/09-PDP11/img/07-en-QR.png">QR</a>

## 1. What is Unix V6?

Unix Version 6 is the sixth edition of UNIX (1975), developed by Ken Thompson, Dennis Ritchie, and others at Bell Labs. It was one of the earliest practical operating systems written in C, and through the Lions' Commentary (1977) it spread to universities around the world, becoming the direct archetype of modern OS design.

## 2. Historical Context

```text
1969  UNIX Edition 1 (PDP-7)     ← Assembly implementation
1970  PDP-11 released (DEC)
1973  UNIX Edition 4             ← C language port completed
1975  UNIX V6                    ← examples/09-pdp11 (this directory)
1977  Lions' Commentary distributed
1979  UNIX V7                    ← Official successor to V6
1983  4.2BSD                     ← Sockets and TCP/IP standardized
```

## 3. Technical Significance

| Item | Details |
|------|---------|
| Kernel size | Approximately 9,000 lines of C code (`usr/sys/`) |
| Process management | fork/exec model (identical to modern Linux) |
| File system | inode-based UFS prototype (ancestor of modern ext4) |
| Memory management | Segment-based MMU PAR/PDR (8 pages × 8 KB) |
| Device drivers | RK11 disk, DL11 serial, KW11 line clock |
| Interrupt model | Vectored interrupts (prototype of modern IRQ structure) |

## 4. Technical Characteristics of the PDP-11

| Item | Details |
|------|---------|
| Address width | Virtual 16-bit (64 KB) / Physical 18-bit (256 KB = Unibus) |
| Registers | R0–R5 (general-purpose), SP (R6), PC (R7), PSW |
| Instruction set | Orthogonal instruction set (src/dst symmetric) |
| Addressing modes | 8 modes (register / indirect / auto-increment / auto-decrement / immediate / absolute / relative / dispatch) |
| Word size | 16-bit. All numeric values use octal notation by convention |

## 5. Value of the cpus-pdp11 RTL Core

The `cpus-pdp11` (by Brad Parker) used in this project is an RTL implementation of the PDP-11/40 microarchitecture in Verilog.

Rather than reproducing "PDP-11 behavior per the specification," it reproduces "the behavior of the actual chip's microsequencer," making it possible to observe cycle-by-cycle via the Logic Analyzer:

- Stage boundaries of instruction fetch, decode, and execute
- MMU translation timing
- Bus cycles for traps and interrupts

## 6. Why Simulate with soft-FPGA?

| Comparison | Instruction emulator (SIMH, etc.) | soft-FPGA (this project) |
|-----------|-----------------------------------|--------------------------|
| Kernel / user mode boundary | Black box | Traceable via PSW[CM] waveform |
| MMU translation timing | Not visible | Real-time display in PAR/PDR panel |
| Interrupt acceptance clock | Not visible | Verifiable via INT signal waveform |
| RK11 disk DMA | Not visible | Observable cycle-by-cycle on bus |
| Trap cause | Depends on OS log | Detected instantly via TRAP signal |

## 7. References

- [cpus-pdp11 repository](https://github.com/bholt/cpus-pdp11) (Brad Parker)
- [Lions' Commentary on UNIX 6th Edition (Archive.org)](https://archive.org/details/lionscommentaryo00lion)
- [The Unix Heritage Society](https://www.tuhs.org/)
