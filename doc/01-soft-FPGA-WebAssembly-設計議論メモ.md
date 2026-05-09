# soft-FPGA × WebAssembly 設計議論メモ

Pico2/RP2350 のソフトFPGA計画（vm80a/8080, 6502, CP/M 2.2 を Verilator 経由で動かす）を起点に、ブラウザ実行への展開、可視化ライブラリ化、フラグシップ題材選定までを検討した記録。

---

## 2. soft-FPGA CP/M を WebAssembly で動かす方法

Verilator → C++ → Emscripten → Wasm の経路がそのまま通る。Pico2 版のハーネスから I/O 層だけ差し替える形。

### ビルドパイプライン

```bash
verilator --cc --exe sim_main.cpp top.v
em++ -O3 obj_dir/V*.cpp obj_dir/verilated.cpp sim_main.cpp \
     -I$(VERILATOR_ROOT)/include \
     -s ALLOW_MEMORY_GROWTH=1 \
     -s EXPORTED_RUNTIME_METHODS=ccall,cwrap \
     -o cpm.html
```

`--threads` 付きは Wasm 側で pthread + SharedArrayBuffer（COOP/COEP 必須）が要る。最初はシングルスレッド版が楽。

### CP/M 成立に必要な要素

- **CCP+BDOS+BIOS** — 本物の CP/M 2.2 バイナリを使用、BIOS は I/O ポートを叩いて結果を持ち帰る薄い層
- **ディスク I/O** — FDC を真面目に実装せず「セクタ単位でメモリブロック転送する魔法のポート」を1つ用意して JS に任せる
- **コンソール I/O** — UART コアより専用ポート直結のほうが軽い、ブラウザは xterm.js
- **ハーネス** — メモリは `uint8_t[65536]`、I/O は `EM_JS`/`EM_ASM` 経由で JS と橋渡し

### ブラウザ側

- シミュレーションは Web Worker 上で必須（メインスレッド実行は UI が固まる）
- Worker↔メイン間：postMessage で開始、性能要なら SharedArrayBuffer + Atomics リングバッファ
- ディスクイメージ：初回 `fetch()`、変更分は **IndexedDB** に永続化（localStorage は 5MB 制限で不足）

### 性能見積もり

8080 程度なら最近のブラウザ Wasm で実効 1〜4MHz 相当は十分。CP/M 2.2 体感では問題なし。**VCD ダンプは絶対無効化**（Wasm 内 FS が即詰まる）。

### 推奨実装順序

1. ネイティブ Linux 上で CP/M 起動を確認
2. ハーネスの I/O 層をコールバック越しに抽象化
3. Emscripten ビルドして Node.js で動作確認（xterm 依存なし）
4. ブラウザ + xterm.js 接続
5. Web Worker 化
6. IndexedDB 永続化

---

## 3. C++ 命令エミュ vs soft-FPGA Wasm の比較

| 項目 | C++命令エミュ | soft-FPGA (Verilator+Wasm) |
| --- | --- | --- |
| Wasm バイナリサイズ | 30〜80KB | 100〜300KB（vm80a 級） |
| 実行速度 | 数十MHz相当 | 1〜4MHz相当 |
| サイクル精度 | 命令単位 | T-state 完全 |
| 未定義命令・フラグ | 実装者次第 | RTL 準拠（vm80a は実ダイ由来） |
| 割り込みタイミング | 命令境界近似 | 実機通り |
| ペリフェラル統合 | C++ 関数で手書き | Verilog モジュールをバス接続 |
| 8228/8224/8255 等 | 機能を再実装 | 既存 RTL を並べるだけ |
| 実 FPGA 移植 | 別実装が必要 | 同じ RTL がそのまま |
| マルチ CPU SoC | 個別協調コード | バス共有のみ |
| 内部状態可視化 | レジスタ程度 | 全信号 |
| デバッグ | ソースレベル | 信号観測 |
| 開発イテレーション | コード変更即反映 | Verilator 再実行が挟まる |
| テストベンチ資産 | C++ テストのみ | iverilog/Verilator/実機共通 |

### soft-FPGA の「速度以外」の価値

1. **シリコン等価性 (bug-for-bug)** — vm80a は NEC D8080AFC のデキャップ起こし、未定義挙動・タイミング・割り込み応答が実機と一致
2. **RTL 資産そのもの** — ブラウザ・Pico2・将来の実 FPGA で同じ RTL が走り、3系統の不一致デバッグが消える
3. **ペリフェラル素性** — 8255/8251/8253/8259/8228 等の Verilog 実装が揃っており、バスに並べるだけで動く
4. **教育・可視化** — T-state、マイクロシーケンサ、フラグ生成の組合せ回路を信号として観測可能
5. **自作 CPU・派生コア基盤** — vm80a に独自命令追加、6502 と 8080 を同バスに、など RTL 改造が選択肢に

要約：C++ エミュは「8080 仕様を満たすブラックボックス」、soft-FPGA は「8080 という回路を動かしている」。

---

## 4. ブラウザでの内部信号取り出し

### 結論：できる

Verilator の設計上の機能。`/*verilator public*/` 注釈または `--public-flat-rw` で内部信号が
`V<top>` クラスのメンバ変数になる。アクセスは関数呼び出しでなく**構造体フィールド読み取り**なので
Wasm でもネイティブ同等速度。

```cpp
top->eval();
uint16_t pc = top->cpu__DOT__regs__DOT__pc;
uint8_t  ts = top->cpu__DOT__tstate;
uint16_t ab = top->A;
uint8_t  db = top->DB;
```

### 設計の本体は JS への渡し方

- **NG**：毎サイクル `EM_ASM`/`EM_JS` でコールバック → Wasm↔JS 境界の往復で破綻
- **OK**：Wasm メモリ上のリングバッファに書き、JS は TypedArray ビュー越しに**ゼロコピー読取**

```cpp
struct Sample { uint16_t pc, ab; uint8_t db, ts, flags; };
Sample* ring;
uint32_t head = 0;

// 毎サイクル：ただのメモリ書き込み
ring[head & MASK] = { pc, ab, db, ts, flags };
head++;
```

JS 側は `new Uint8Array(Module.HEAP8.buffer, ringPtr, ringSize)` でビューを作り、
`requestAnimationFrame` で 60Hz 描画。Web Worker + SharedArrayBuffer に発展可能（COOP/COEP 必要）。

### 描けるもの

- レジスタ・PC・SP のライブ表示（60Hz）
- T-state 状態遷移ハイライト
- ロジアナ風波形（`/M1`, `/WR`, `/RD`, `INTA` 等）
- アドレス／データバスのスコープ
- メモリアクセスヒートマップ
- マイクロコードステップ表示

### C++ エミュとの決定的な差

C++ 命令エミュには「露出すべき内部信号がそもそも**存在しない**」。T-state、マイクロシーケンサ、組合せ論理の伝播、レジスタ書込みイネーブル信号は、見せようがないのではなく**存在しない**。可視化ペイロードが本質的に異なる。

### 留意点

- VCD ダンプは Wasm で現実的でない、カスタムリングバッファに振る
- `--public-flat-rw` は階層名が長く合成可能性も失う、本気の合成も視野なら**観測モジュールを別 Verilog で**分離
- 信号の階層名は Verilator バージョン依存、ハーネス側で集約しておく

---

## 5. 6502/Apple-I を題材にする場合

### Apple-I がこの方式と相性が良い理由

最小構成（6502 + 6820 PIA + 4KB RAM + 256B ROM + シフトレジスタ表示）。soft-FPGA の重さが相対的に薄まり、**実機速度（1MHz）を Wasm で達成可能**。CP/M ほど速度劣化が体感に出ない。

### 構成要素

- **6502 コア**：arlet, T65, perfect6502
- **6820 PIA**：$D010〜$D013
- **wozmon ROM**：$FF00〜$FFFF（256B）
- **Integer BASIC ROM**：$E000〜$EFFF（4KB、Woz 自作）
- **RAM**：4〜8KB
- **表示**：40×24 文字、Canvas で再現

### ブラウザ側マッピング

- 表示：Apple-I 風 7×9 ドットフォント、大文字のみ、`@` カーソル
- キーボード：`keydown` → ASCII → KBD レジスタ書込み + KBDCR bit7 セット
- カセット相当：ファイルアップロードまたは**ペースト**（wozmon の `0:A2 00 BD 0F 02` 形式そのまま）

### 可視化が光る場面

- **wozmon ポーリングループ** — PC ヒートマップで $FF1B 付近が赤熱、「ポーリング」概念が一目で伝わる
- **DSP シフトレジスタ遅延** — 16ms 待ちが信号レベルで見える（C++ エミュは大抵省略）
- **BASIC インタプリタの内部歩行** — トークナイザの命令フェッチ軌跡
- **PIA レジスタアクセス** — キー入力毎のバスサイクル列

---

## 6. RTL 教育向けライブラリ構想

「リングバッファ → JS → Canvas ロジアナ」のパターンをライブラリ化。仮称 `rtlscope` 等。

### 3 層構成

#### Verilog 側（観測ポイント宣言）

```verilog
`OBSERVE(pc, 16, "PC", HEX);
`OBSERVE(state, 4, "T-state", ENUM, {"T1","T2","T3","T4","TW"});
`OBSERVE_BUS(cpu_bus, addr[15:0], data[7:0], rd, wr, m1);
```

#### C++ ハーネス層

```cpp
RTLScope scope(/*ring_size=*/65536);
scope.bind("pc",     &top->cpu__DOT__pc, 16, Format::HEX);
scope.bind("state",  &top->cpu__DOT__state, 4, Format::ENUM, state_names);
scope.bind_bus("bus", { /* ... */ });
scope.export_to_js();

// 毎サイクル
if (top->clk_posedge) scope.sample();
```

トリガ・スロットリング・変化検出を C++ 側で済ませると JS データ量が劇的に減る。

#### JS 描画層（宣言的 API）

```javascript
const scope = await RTLScope.attachToModule(wasmModule);
new LogicAnalyzer(scope, { canvas: '#la',
  signals: ['bus.addr', 'bus.data', 'bus.rd', 'bus.wr'],
  windowCycles: 1024 });
new StateDiagram(scope, { canvas: '#sd', signal: 'state' });
new MemoryHeatmap(scope, { canvas: '#mh', addr: 'bus.addr', size: 65536 });
```

### ビュータイプ

- Logic Analyzer（波形・HEX バー）
- State Diagram（現在状態ハイライト）
- Register Panel（名前付き値）
- Memory Heatmap（アクセス頻度）
- Bus Cursor（任意時点の全信号値）
- Trigger Capture（条件成立前後 N サイクル）

### 既存ツールとの位置取り

- **GTKWave / Surfer**：VCD ビューワ、ポストモーテム、ブラウザ非対応
- **WaveDrom**：静的タイミング図、シミュレーションと繋がっていない
- **digitaljs**：独自シミュレータ完結、Verilator/RTL 資産非対応
- → 「**実時間で動く RTL シミュレーションに宣言的観測ビューを後付け**」という空きポジション

### 設計上のハマりポイント

- Verilator 階層名の不安定さ → Verilog ラッパーモジュールでトップ直下に引き出す
- `--public-flat-rw` の罠 → 観測対象だけに絞る
- `ALLOW_MEMORY_GROWTH=1` で TypedArray 無効化 → `growMemory` イベント監視＆ビュー再生成
- Worker 前提か否か → 最初はメインスレッド版、Worker 版は別エクスポート
- 時刻単位 → Verilog の `#1` でなく「クロックエッジ番号」基準が直感的

### 射程（CPU 以外）

- 基本デジタル（ゲート、フリップフロップ、カウンタ）
- 状態機械の設計演習
- 通信プロトコル（UART, SPI, I2C, PS/2）
- DSP（FIR, CIC）
- キャッシュ・パイプライン

### プロジェクト構造案

```text
rtlscope/
├── verilog/
├── cxx/            # libRTLScope
├── js/             # @rtlscope/core, @rtlscope/views (npm)
├── examples/
│   ├── 01-counter/
│   ├── 02-uart/
│   ├── 03-pipeline-cpu/
│   └── 04-apple1/
└── templates/      # CMake/Makefile 雛形 + Emscripten フラグ
```

---

## 7. CPU フラグシップ候補比較

| 項目 | 4004/Busicom | 6502/Apple-I | 6800/SWTPC | 8080/CP/M | Z80/要target |
|---|---|---|---|---|---|
| 元クロック | 740kHz | 1MHz | 1〜1.8MHz | 2MHz | 4MHz+ |
| Wasm 到達性 | 余裕 | 余裕 | 余裕 | 等速ぎりぎり | 厳しい |
| 周辺チップ | 4001/2/3 多 | 6820 PIA 1個 | 6850 ACIA 1個 | 8224+8228+UART+Disk | 構成次第 |
| バス特性 | 4bit時分割 **特殊** | 普通 8bit | 普通 8bit | T-state+status word | M1+refresh |
| Verilog 資産 | ホビー実装 | 豊富 | 薄い | vm80a 決定版 | T80, tv80 豊富 |
| 実装工数 | 中 | **低** | 低 | 高 | 中〜高 |
| 即時体験 | 電卓 | wozmon→BASIC | MIKBUG | CP/M+Zork等 | 機種次第 |
| ソフト資産 | 極小 | 限定的 | 中 | **膨大** | **膨大** |
| 文化的認知 | 高 | 高 | 中 | 高 | 非常に高 |
| 可視化映え | **抜群** | 高 | 中 | 高 | 高（複雑） |
| 第一弾適性 | ★★★★ | **★★★★★** | ★★ | ★★★ | ★★★ |

### 評価まとめ

- **6800**：6502 と構造が似すぎ、後出し理由が薄い → **明示的に外す**
- **Z80**：強力だが target（Spectrum/MSX/Game Boy/CP/M+）選定でスコープが発散、第一弾には重い
- **8080+CP/M**：BIOS/BDOS/CCP/ディスク I/F で工数大、Pico2 版成熟後の第二弾向き
- **4004**：命令エミュには真似できない領域（多重化バス、bit-serial 加算器、専用 LSI 群）、ショーケース性最強だが即時体験は電卓止まり
- **6502/Apple-I**：工数最小、対話的体験、文化認知、Verilog 資産すべて揃う

### 推奨ロードマップ

1. **第一弾：6502/Apple-I** — 最短で動く、対話的、ライブラリ最小機能セットを駆動するに十分
2. **第二弾：4004/Busicom** — 「ライブラリ固有価値の決定的な証明」、命令エミュには作れない可視化を見せる
3. **第三弾以降：8080+CP/M または Z80+特定機種** — Pico2 側のロードマップと同期

---

## 8. 教科書的デジタル回路の選定

CPU 以前の基礎題材として何を作るか。

### 選定基準

- Verilog 200 行以内
- 入出力がブラウザ UI に自然にマップ
- 内部状態が動いて意味がある（純組合せ回路は除外傾向）
- 4 ビュー（LA / State Diagram / Heatmap / Register Panel）のどれかが際立つ
- 「これを理解せずに次へ進めない」基礎要素

### Tier 1（必須・第一陣）

| # | 題材 | 推しビュー | soft-FPGA 固有利点 |
|---|---|---|---|
| 1 | 二進カウンタ（パラメタ化幅、BCD/Gray/Ring/Johnson 比較） | Logic Analyzer | 薄（動作確認用） |
| 2 | 信号機 FSM（歩行者ボタン付き） | State Diagram + Register | 中 |
| 3 | UART 送信機/受信機 | Logic Analyzer | **強**（波形こそ本質） |
| 4 | シーケンス検出器（Mealy/Moore 並列展示） | State Diagram × 2 | **強**（構造概念） |
| 5 | LFSR | LA + Memory Heatmap（状態空間踏破） | 高 |

### Tier 2（応用）

| # | 題材 | 推しビュー | soft-FPGA 固有利点 |
|---|---|---|---|
| 6 | PWM 生成器（デューティ可変） | LA + アナログ表示 | 中 |
| 7 | 自販機 FSM（硬貨/釣銭/在庫） | State Diagram + Register | 中 |
| 8 | 逐次乗算器（add-and-shift） | LA + Register Panel | 高 |
| 9 | 同期 FIFO | Memory Heatmap + Register | 中 |
| 10 | SPI / I2C マスタ | Logic Analyzer | 強 |

### Tier 3（後回し）

CRC 生成器、CORDIC、デバウンス、7 セグデコーダ、VGA 同期信号、FIR フィルタ。

### 意図的に外すもの

- **ALU 単体・MUX 単体・デコーダ単体** — 純組合せでは「動いている感」が出ない、CPU/応用に従属させる
- **フリップフロップ単体** — WaveDrom で十分

### 推奨履修順

```text
カウンタ           → HDL 基本動作と LA ビュー
LFSR              → シフトレジスタ + 状態空間
信号機 FSM         → State Diagram ビュー
シーケンス検出器    → Mealy/Moore 対比
UART 送信機        → 通信プロトコル第一歩
UART 受信機        → 双方向理解
PWM               → デジタル↔アナログ境界
自販機 FSM         → 実践 FSM
逐次乗算器         → データパス入口
SPI / I2C         → 同期通信
[CPU 編]
6502/Apple-I      → 簡易 CPU システム
```

### 第一弾推奨

**カウンタ**を最初に作るのを強く推す。保守的に見えるが、ライブラリ最小機能セット（リングバッファ → TypedArray → Canvas）の正しさを最短検証でき、入門教材冒頭にあるためライブラリドキュメントの最初のサンプルとして誰でも読める。

```text
カウンタ → 信号機 FSM（State Diagram お披露目）→ UART（LA の威力）
```

の3点が揃った時点で、ライブラリは「使える」と認知される。CPU は基礎10題の最終章として置くのが、技術的にも物語的にも自然。

---

## 全体まとめ

- **soft-FPGA Wasm の価値の本質は速度ではなく可視化**。命令エミュには存在しない内部信号（T-state、マイクロシーケンサ、組合せ伝播）をブラウザで観測できることが固有の優位。
- **観測層をライブラリ化**（リングバッファ + 宣言的ビュー API）すると、CPU から基本回路まで広く適用可能。既存ツール（GTKWave / WaveDrom / digitaljs）のいずれにも該当しないポジションが空いている。
- **ロードマップ**：基礎10題（カウンタ → … → SPI/I2C）→ 6502/Apple-I → 4004/Busicom → 8080/Z80。
- **Pico2 ソフト FPGA プロジェクトとの整合**：ブラウザ・Pico2・将来の実 FPGA で同じ RTL が走る連続性が、この設計選択の戦略的意味。
