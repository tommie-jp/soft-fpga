# verif/

検証コード。RTL をネイティブシミュレーションと cocotb の 2 系統でテストする。

## tb_cocotb/

Python (cocotb) からシミュレータ越しに DUT を制御するユニットテスト。

- 実行: `make SIM=verilator`

## tb_unit/

Verilator ネイティブ C++ テストベンチ。コンパイル速度が速く CI 向き。

## golden/

リファレンス実装。Verilog の挙動が golden と異なれば Verilog を直す。
