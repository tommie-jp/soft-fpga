# 02. Historical Value of CP/M

## 1. What is CP/M?

CP/M (Control Program for Microcomputers) is an OS for the 8080 developed by
Gary Kildall (Digital Research) in 1974. From 1977 to 1981 it spread as the
de-facto standard OS for microcomputers, laying the foundation for the
commercial software industry.

## 2. Historical Context

```text
1971  Intel 4004          ← examples/04 (planned)
1974  Intel 8080          ← examples/06-8080 (this directory)
1975  Altair 8800         ← 8080-based; the stage for CP/M
1976  CP/M 1.3 released
1977  CP/M 2.2 (final release)
1981  IBM PC / MS-DOS     ← emerged as CP/M's successor
```

## 3. Technical Value

| Item | Details |
|------|---------|
| Instruction set | 78 instructions (roughly twice that of the 6502), rich registers (B/C/D/E/H/L/A/F) |
| Memory model | 64 KB flat (no segmentation) |
| I/O model | Separated via IN/OUT port instructions rather than memory-mapped I/O |
| OS design | Three-layer structure: BIOS/BDOS/CCP (the prototype of modern OS design) |
| Software heritage | WordStar, dBASE II, Turbo Pascal, and many others were born on CP/M |

## 4. Why Simulate with soft-FPGA?

| Comparison point | Instruction emulator | soft-FPGA (this project) |
|-----------------|---------------------|--------------------------|
| IN/OUT ports | Black box | Observable at clock granularity |
| Bus cycles | Invisible | Waveform display via Logic Analyzer |
| BIOS calls | Executed directly | Handshake signals are visible |
| Decap compatibility | None | Bug-compatible and timing-compatible |

## 5. The Value of vm80a

vm80a is a Verilog RTL whose logic was derived from a decap image of the
NEC D8080AFC (NEC second-source of the Intel 8080A). It reproduces
"the same behavior as the real chip" rather than "8080 operation per the spec sheet."

Because it matches undefined instructions, undefined flag bits, and subtle
timing differences, **silicon-equivalence verification** using the CPU Exerciser
by Klaus Dormann and Ian Bartholomew is possible.

## 6. References

- [Digital Research CP/M 2.2 source](http://www.cpm.z80.de/source.html)
- [vm80a repository](https://github.com/1801BM1/vm80a)
- [The Unofficial CP/M Web site](http://www.cpm.z80.de/)
