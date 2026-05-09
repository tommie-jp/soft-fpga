# verilog/

Verilog ソース（レトロ CPU コア・デモ回路）。

## 設計方針

- Verilator 互換で記述する（`\$display` / `initial` ブロックはシミュレーション用途のみ）。
- 観測したい内部信号は `/* verilator public */` または最上位ラッパに引き出す。
  `--public-flat-rw` は使わない。
- VCD ダンプ用のコードは書かない。ring buffer パターンで JS 側に渡す。
- 1 モジュール 1 ファイルを原則とする。
