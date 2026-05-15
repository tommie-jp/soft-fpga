# soft-FPGA × WebAssembly

[English](README.md) | [日本語](README.ja.md)

Simulate Verilog-written retro CPUs and digital circuits via Verilator + Emscripten,
and run them in the browser. The core value is not speed but **real-time visualization
of internal signals** — T-states, microsequencers, bus waveforms — things no
instruction-level emulator can show.

## Visualization library: rtlscope

A library for declaratively observing RTL internal signals in the browser.

| Layer | Role |
| --- | --- |
| Verilog | Declare observation points with the `` `OBSERVE `` macro |
| C++ harness | Sample every clock cycle into a ring buffer |
| JS rendering | Zero-copy read via TypedArray view, 60 Hz canvas rendering |

## Architecture

```text
Verilog (RTL)
  └─ Verilator ──▶ C++ harness (ring buffer)
                     └─ Emscripten ──▶ .wasm
                                        └─ Web Worker
                                             ├─ xterm.js (console I/O)
                                             └─ Canvas (Logic Analyzer / State Diagram / Memory Heatmap)
```

## Roadmap

| Phase | Subject | Goal | Status |
| --- | --- | --- | --- |
| Basic 1 | Binary counter | Minimal ring buffer → TypedArray → Canvas pipeline | ✅ Done |
| Basic 2 | Traffic light FSM | State Diagram view debut | ✅ Done |
| Basic 3 | UART transceiver | Logic Analyzer view in action | ✅ Done |
| CPU #1 | 6502 / Apple-I | Interactive experience (wozmon → Integer BASIC) | ✅ Done |
| Basic 4–10 | LFSR / sequence detector / PWM / FIFO / SPI / I2C | Curriculum coverage | 🔲 Planned |
| Game | Pong / Breakout | Discrete-logic visualization showcase | 🔲 Planned |
| CPU #2 | 4004 / Busicom | Definitive proof of visualization beyond instruction emulators | 🔲 Planned |
| CPU #3 | 8080+CP/M or Z80 | Sync with Pico 2 roadmap | 🔲 Planned |

## Getting started

```bash
git clone https://github.com/tommie-jp/soft-fpga.git
cd soft-fpga
git submodule update --init
```

## Build

```bash
# Start the Docker dev environment
docker compose -f docker/compose.yml run --rm dev

# Native Linux simulation
scripts/build-host.sh

# WebAssembly build (e.g. example 04-6502)
scripts/build-wasm-04.sh    # → examples/04-6502/web/sim.js, sim.wasm
```

## Directory layout

| Path | Role |
| --- | --- |
| [`examples/`](examples/) | Circuit samples (each has verilog / cxx / web / verif) |
| [`cxx/`](cxx/) | Shared C++ harness headers (libRTLScope) |
| [`verif/`](verif/) | Library-level verification (cocotb / Dormann / wozmon) |
| [`scripts/`](scripts/) | Build, test, and flash helper scripts |
| [`docker/`](docker/) | Dev environment (Ubuntu 24.04 + Verilator + Emscripten + cocotb) |
| [`firmware/`](firmware/) | Pico SDK firmware (future Pico 2 target) |
| [`docs/`](docs/) | Design documents (Japanese) |

## License

MIT
