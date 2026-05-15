# Examples

各サンプルは `verilog/`・`cxx/`・`web/` を持つ共通構成。
`scripts/build-wasm-XX.sh` でビルド、`web/index.html` をブラウザで開いて動作確認する。

| ディレクトリ | 題材 | 可視化 |
| --- | --- | --- |
| [01-counter](01-counter/) | 二進カウンタ | Canvas（ring buffer → TypedArray の最小構成） |
| [02-traffic-fsm](02-traffic-fsm/) | 信号機 FSM | State Diagram ビュー |
| [03-uart](03-uart/) | UART 送受信機 | Logic Analyzer ビュー |
| [04-6502](04-6502/) | 6502 + Apple-I | xterm.js（wozmon → Integer BASIC） |
