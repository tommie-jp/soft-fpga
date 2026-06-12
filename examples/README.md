# Examples

Each example follows a common structure with `verilog/`, `cxx/`, and `web/` directories.
Build with `scripts/build-wasm-XX.sh`, then open `web/index.html` in a browser.

| Directory | Subject | Visualization |
| --- | --- | --- |
| [01-counter](01-counter/) | Binary counter | Canvas (minimal ring buffer → TypedArray pipeline) |
| [02-traffic-fsm](02-traffic-fsm/) | Traffic light FSM | State Diagram view |
| [03-uart](03-uart/) | UART transceiver | Logic Analyzer view |
| [04-6502](04-6502/) | 6502 + Apple-I | xterm.js (wozmon → Integer BASIC) |
