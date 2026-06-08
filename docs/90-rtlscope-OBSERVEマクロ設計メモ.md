# rtlscope `\`OBSERVE` マクロ設計メモ

doc/01 の構想段階マクロを、Verilator の動作と照合しながら実装選択肢を整理したメモ。

---

## マクロのシグネチャ

```verilog
`OBSERVE(pc, 16, "PC", HEX);
`OBSERVE(state, 4, "T-state", ENUM, {"T1","T2","T3","T4","TW"});
`OBSERVE_BUS(cpu_bus, addr[15:0], data[7:0], rd, wr, m1);
```

| 引数 | 意味 |
| --- | --- |
| `pc` | 観測したい Verilog の信号名 |
| `16` | ビット幅 |
| `"PC"` | JS 側での表示ラベル |
| `HEX` | 表示フォーマット（HEX / DEC / BIN / ENUM） |

目標は「Verilog 側で宣言するだけで C++ ハーネスと JS 描画層が自動的に信号を拾う」仕組み。

---

## Verilator の制約

Verilator は Verilog を C++ クラスに変換するが、マクロが生成したメタデータ（`"PC"` や `HEX`）を
C++ に自動で渡す仕組みは**ない**。そのためマクロの実装方針は 3 択になる。

---

## 選択肢 A：`/* verilator public */` ＋ C++ 手動バインド

```verilog
`define OBSERVE(sig, width, name, fmt) \
  wire [width-1:0] _obs_``sig /* verilator public */; \
  assign _obs_``sig = sig;
```

```cpp
// C++ ハーネス側（手書き）
scope.bind("PC", &top->_obs_pc, 16, Format::HEX);
```

- Verilator が `_obs_pc` をクラスメンバとして公開する
- 宣言は Verilog に集約されるが、C++ の `bind()` は別途手書き
- 最も確実、Verilator バージョンに依存しない
- **フェーズ 1 はこれ**

---

## 選択肢 B：ラッパモジュールでトップ直下に引き出す

```verilog
module obs_port #(parameter W=1, NAME="", FMT="HEX") (
  input [W-1:0] sig
);
  wire [W-1:0] out /* verilator public */ = sig;
endmodule

// 使用例
obs_port #(.W(16), .NAME("PC"), .FMT("HEX")) obs_pc (.sig(cpu.pc));
```

- パラメータとして名前・フォーマットを持てる
- ただし Verilator はパラメータ文字列を C++ に露出しないため、
  名前解決は別途コード生成が必要

---

## 選択肢 C：コード生成（最も自動化できる）

Verilog のマクロ展開結果を `scripts/gen_observe.py` などで走査して
C++ の `bind()` 呼び出しを自動生成する。

```text
rtl/ → scripts/gen_observe.py → host/generated/scope_bindings.cpp
```

「Verilog に書くだけ」が成立する。ただしコード生成ツールの実装コストがかかる。

---

## 推奨実装順序

1. **選択肢 A** で動かす（マクロなし、手書き `bind()`）
2. ring buffer → TypedArray → Canvas の動作が確認できたら
3. `\`OBSERVE` マクロ ＋ 選択肢 C（コード生成）に昇格

`\`OBSERVE` はインターフェース目標であり、最初から完全実装すると
可視化動作確認（本筋）が遅れる。
