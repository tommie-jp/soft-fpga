# YoWASP / DigitalJS 調査メモ

ブラウザ内で Verilog をコンパイル・シミュレーションする代替手段の調査記録。
「ユーザーが任意の Verilog を入力して即試せるサンドボックス機能」を検討する際の参考にする。

---

## 1. YoWASP とは

**Yosys WebAssembly Packages** の略。

Yosys（オープンソース RTL 合成ツール）を WASI/WASM 化した npm パッケージ群。

```bash
npm install yowasp-yosys
```

- ブラウザ内で Verilog を受け取り、Yosys コマンドを実行できる
- `sim` コマンドで VCD を出力可能
- `nextpnr` など他のツールもパッケージ化されている
- synthesizable Verilog サブセットのみ対応（behavioral 記述は非対応）

### パイプライン

```text
Verilog
  → yowasp-yosys: read_verilog + prep + sim -vcd out.vcd
  → VCD ファイル（仮想 FS 上）
  → JS の VCD パーサー（npm: vcd-parser 等）
  → Logic Analyzer / 波形表示
```

### 信号名の注意点

合成（synthesis）の最適化パスで信号名が消える場合がある。
`synth -noabc` などで最適化を抑制するか、`keep` 属性を付けると元の名前が残りやすい。

---

## 2. DigitalJS とは

Yosys（YoWASP 経由）で変換した JSON ネットリストを JS 上でゲートレベルシミュレーションし、
回路図（JointJS ベース SVG）と波形をブラウザに表示するツール。

```text
Verilog
  → Yosys (YoWASP)  → JSON ネットリスト
  → DigitalJS       → ゲートをJSオブジェクトとして逐次評価
  → 回路図 + 信号を SVG/Canvas でリアルタイム表示
```

- 小規模回路（カウンタ・FSM・UART）の教育用途に向く
- ゲート間のワイヤが色付きで可視化される
- 入力信号・クロックを GUI で手動操作できる

---

## 3. Verilator との比較

| 観点 | Verilator（現行） | YoWASP + DigitalJS |
|---|---|---|
| シミュレーション方式 | コンパイル型（C++ → WASM） | ネットリスト解釈型（JS 上で逐次評価） |
| 速度 | 高速（CPUコアでも実用速度） | 低速（数千ゲート規模まで） |
| 内部信号アクセス | `/* verilator public */` で元の信号名 | 合成後ワイヤ（名前変わる場合あり） |
| ring buffer パターン | 完全対応（現行実装） | 非対応（VCD バッチ出力のみ） |
| リアルタイム観測 | 可能（ストリーミング） | 不可（全クロック分を一括後に表示） |
| ブラウザ内コンパイル | 不可（事前ビルド必要） | **可能**（動的 Verilog 入力に対応） |
| 対応 Verilog | synthesizable + behavioral | synthesizable のみ |
| 回路図の自動生成 | なし | **あり**（DigitalJS が自動生成） |

---

## 4. 規模別の実用限界（YoWASP）

| 回路 | クロック数の目安 | VCD サイズ目安 | 実用性 |
|---|---|---|---|
| カウンタ（01-counter） | 100 | 数 KB | 可 |
| FSM（02-traffic-fsm） | 1,000 | 数十 KB | 可 |
| UART（03-uart） | 10,000 | 数 MB | ギリギリ |
| 6502 / 8080 / PDP-11 | 数百万〜 | 数 GB〜 | **不可** |

---

## 5. このプロジェクトへの適用方針

### CPUコアの可視化には Verilator が唯一の選択肢

T-state・マイクロシーケンサ・バスサイクルのリアルタイム観測は
ring buffer パターン（Verilator）にしか実現できない。
YoWASP への移行は不要。

### YoWASP が有効なケース

- 小規模回路（カウンタ・FSM・UART）の**インタラクティブなサンドボックス**を追加する場合
- ブラウザ上で任意の Verilog を入力 → 即シミュレーションしたい場合
- 回路図を自動生成して教育コンテンツに添えたい場合

### 将来の構想（ハイブリッド案）

```text
軽量デモ（01〜03）: YoWASP + DigitalJS でブラウザ内サンドボックス
重い CPU デモ（04〜09）: Verilator ビルド済み WASM を配信（現行）
```

---

## 6. 参考リンク

- [YoWASP 公式](https://yowasp.org/)
- [DigitalJS GitHub](https://github.com/tilk/digitaljs)
- [Yosys 公式](https://yosyshq.net/yosys/)
