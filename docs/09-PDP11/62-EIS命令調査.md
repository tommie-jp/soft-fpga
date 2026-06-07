# 62. EIS 命令（MUL/DIV/ASH/ASHC）調査

2026-06-06 調査。残作業 #5（EIS タイミング図）の前提調査。

---

## 1. 結論

**Verilog 改造は不要。MUL/DIV/ASH/ASHC は cpus-pdp11 に完全実装済みかつ WASM 有効化済み。**

作業が必要なのはタイミング図の撮影・ドキュメント化のみ。

---

## 2. Verilog 実装状況

### 2.1 ハードウェアモジュール

| モジュール | ファイル | 内容 |
|-----------|---------|------|
| `mul1616` | `rtl/mul1616.v` | 16×16 符号付き乗算器（逐次、約 16 サイクル） |
| `div3216` | `rtl/div3216.v` | 32÷16 符号付き除算器（逐次、約 32 サイクル） |
| `shift32` | `rtl/shift32.v` | 32 ビット可変シフター（可変サイクル） |

### 2.2 execute.v での命令処理

| 命令 | Opcode | 行 | ハードウェア |
|------|--------|-----|------------|
| MUL  | `7o070` | 753–767 | `mul1616_box` |
| DIV  | `7o071` | 769–817 | `div3216_box` |
| ASH  | `7o072` | 820–837 | `shift32_box` |
| ASHC | `7o073` | 840–855 | `shift32_box` |

パイプライン進行制御（`e1_advance`）は MUL/DIV の `done` 信号、シフトの `done` 信号を待つ設計になっており、複数サイクルのストールが発生する。

```verilog
assign e1_advance = is_isn_muldiv ? (mul_done || div_done || div_abort) :
    is_ashx ? (shift_done) : 1'b1;
```

### 2.3 pdp11.v でのデコード（関連箇所）

```verilog
// デスティネーション指定あり（src レジスタ使用命令）
(isn_15_9 >= 7'o070 && isn_15_9 <= 7'o074) ||    // mul-xor

// 32 ビット結果保存フラグ
assign store_result32 =
    (isn_15_9 == 7'o070) ||    // mul → R, R+1
    (isn_15_9 == 7'o071) ||    // div → R=商, R+1=余数
    (isn_15_9 == 7'o073);      // ashc → R/R+1

// ソースレジスタ使用フラグ
assign is_isn_rss =
    (isn_15_9 == 7'o070) ||    // mul
    (isn_15_9 == 7'o071) ||    // div
    (isn_15_9 == 7'o072) ||    // ash
    (isn_15_9 == 7'o073);      // ashc
```

### 2.4 WASM ビルドへの組み込み

`examples/09-pdp11/verilog/test_top_wasm.v` が以下を無条件 include しており、有効/無効フラグは存在しない。

```verilog
`include "execute.v"
`include "mul1616.v"
`include "div3216.v"
`include "shift32.v"
```

`vendor/cpus-pdp11/rtl/pdp11.v` および `execute.v` に `HAVE_EIS` 等のコンパイル時フラグは存在しない。

---

## 3. 未実装命令

| 命令 | Opcode | 状態 | 備考 |
|------|--------|------|------|
| XOR  | `7o074` | ✅ 実装済み | execute.v 857–864 |
| FIS  | `7o075` | スタブのみ | 浮動小数演算スタック、ハードウェア未設計 |
| CIS  | `7o076` | スタブのみ | 文字列操作、ハードウェア未設計 |

FIS / CIS は このプロジェクトのスコープ外。

---

## 4. 残作業: EIS タイミング図（残作業 #5）

### 4.1 追加するテストケース

`verif/web/test_timing_ss_pdp11.py` に Category N として追加する。

| ケース | 命令例 | 特記事項 |
|--------|--------|---------|
| `mul_r_r` | `MUL R1, R0` | 結果 32 ビット（R0/R1）、約 16+ サイクル |
| `div_r_r` | `DIV R0/R1, R2` | 商 R0・余数 R1、約 32+ サイクル |
| `div_ovf` | DIV ゼロ除算 | V フラグ立つ、`div_abort` で短縮 |
| `ash_pos` | `ASH #3, R0` | 左シフト 3 |
| `ash_neg` | `ASH #-2, R0` | 右シフト（算術） |
| `ashc_r`  | `ASHC #1, R0` | 32 ビット拡張シフト |

MUL/DIV はサイクル数が既存命令より多いため、`step_n()` の上限を 50〜80 クロックに設定する。assert 値は初回実測後に固定する。

### 4.2 ドキュメント追記

`docs/09-PDP11/22-全命令タイミング図.md` に Category N 節を追加し、istate 遷移・実クロック数・フラグ変化を解説する。

### 4.3 工数見積もり

| 作業 | 規模 |
|------|------|
| `test_timing_ss_pdp11.py` に 6 ケース追加 | 50〜80 行 |
| スクリーンショット生成・assert 調整 | ビルド + テスト実行 1〜2 回 |
| `22-全命令タイミング図.md` 追記 | 30〜50 行 |
| Verilog 修正 | **0 行**（不要） |

---

## 5. 参考

- [22-全命令タイミング図.md](22-全命令タイミング図.md) — 既存 A〜K カテゴリのタイミング図一覧
- [61-残作業リスト.md](61-残作業リスト.md) — 残作業 #5 の詳細
- `vendor/cpus-pdp11/verif/test_mul.v` — mul1616 単体テスト
- `vendor/cpus-pdp11/verif/test_div.v` — div3216 単体テスト
- `vendor/cpus-pdp11/verif/test_shift.v` — shift32 単体テスト
