# PDP-11 / Unix V6 WASM 実装計画 <a class="qr-link" href="../../../docs/09-PDP11/02-QR.png">QR</a>

ブラウザ上で Unix V6 がブートする様子を PDP-11 バス信号レベルで観測できる WASM デモを作る。
Verilator → C++ → Emscripten/WASM パイプラインは 6502/Apple-I（`examples/04-6502`）・8080/CP-M（`examples/06-8080`）と共通。

---

## 1. ゴール

| 項目 | 内容 |
| --- | --- |
| **動作** | Unix V6 が PDP-11 RTL シミュレーション上でブート、コンソールから sh が操作できる |
| **可視化** | Logic Analyzer ビューで PC・PSW・バスアドレス/データ・MMU 状態をリアルタイム観測 |
| **コア** | Brad Parker `cpus-pdp11`（Verilog、PDP-11/34 + 11/44 風 MMU） |
| **配布形態** | 静的 HTML + `.wasm` — `examples/09-pdp11/` に配置 |

---

## 2. 実装フェーズ

### 2.1 Phase 1: Verilator ネイティブ動作確認

#### ゴール

Ubuntu ホスト上で Verilator 5.x を使って RTL がコンパイルされ、Unix V6 がブートするところまで確認する。

#### 作業内容

1. `cpus-pdp11` をリポジトリに取り込む（`vendor/cpus-pdp11/` または git submodule）
2. Verilator 5.x 互換パッチを当てる

   既知の非互換点:

   ```cpp
   // 旧 Brad 式 — Verilator 4.0+ では通らない
   top->v__DOT__top__DOT__reset = 1;

   // 修正後: トップレベル信号として公開するか rootp API を使う
   top->reset = 1;  // top.v で verilator public 宣言が必要
   ```

3. `verif/verilator.sh` を参考に `scripts/build-host-09.sh` を作成
4. Unix V6 ディスクイメージ（約 2.5 MB の RK05 イメージ）を `examples/09-pdp11/disk/` に配置
5. `ide.cpp`（IDE ディスク DMA モデル）が RK11 ディスクコントローラ (`rk_regs.v`) と連動して Unix V6 をブートすることを確認

#### 完了条件

- `./scripts/build-host-09.sh && ./build/pdp11_sim` でコンソールに Unix V6 ログインプロンプトが表示される
- Verilator の lint エラーがゼロ（`-Wall` 通過）

#### 難所

- Brad のコードは VPI（`cver`）ベースで Unix ブートを確認した記録があるが、**Verilator 単独では確認されていない**。`ide.cpp` の PLI/VPI 依存を C++ モデルに置き換える必要がある可能性がある。
- `test17` は Makefile でコメントアウト済みのテストがあり、一部命令に既知バグが残っている可能性がある。

---

### 2.2 Phase 2: WASM 化

#### ゴール

Emscripten でビルドし、ブラウザ上でシミュレーションが起動する。コンソール I/O が xterm.js に接続される。

#### 作業内容

1. **`ide.cpp` の I/O 層差し替え**

   ホスト版の `fopen` 系を Emscripten MEMFS 経由に置き換える。

   ```cpp
   // WASM ビルド時は Emscripten の MEMFS を使う
   // JS 側で preInit/preRun で disk image を MEMFS に書き込む
   // Module.FS.writeFile('/disk0.rk', new Uint8Array(arrayBuffer));
   ```

   または `fetch()` で `ArrayBuffer` を受け取り `Module.HEAPU8` に直接書く方法でもよい。

2. **ブロッキングループの解体**

   6502 ハーネスと同様に、`while(!Verilated::gotFinish())` を JS 側タイマー駆動の `step_n(N)` 呼び出しに置き換える。

   ```cpp
   EMSCRIPTEN_KEEPALIVE void step_n(int n) {
       for (int i = 0; i < n; i++) {
           tick();
           sample_ring();
       }
   }
   ```

3. **コンソール I/O 接続**

   `tt_regs.v`（DL11 TTY）の出力を ring buffer 経由または直接コールバックで JS に渡す。
   6502 版の `disp_queue` / `kbd_queue` パターンを流用する。

4. **ビルドスクリプト** `scripts/build-wasm-09.sh` を作成

   ```bash
   emcc -O2 -s WASM=1 -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","FS"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s INITIAL_MEMORY=67108864 \  # 64 MB
        ...
   ```

5. **ディスクイメージの配信**

   Unix V6 イメージ約 2.5 MB は gzip 圧縮すれば 1 MB 以下になる見込み。
   `index.html` の `<script>` で fetch → MEMFS ロードするコードを書く。

#### 完了条件

- `examples/09-pdp11/web/index.html` をブラウザで開くと xterm.js に Unix V6 ブートログが流れる
- コンソールからコマンド入力（`ls`、`cat` 程度）が通る

#### 難所

- `ide.cpp` は DMA チャンネル・割り込みタイミングを細かくエミュレートしているため、MEMFS 置き換え後に割り込みタイミングがずれてブートしない可能性がある。
- Emscripten の MEMFS は非同期 fetch との組み合わせで初期化順序に注意が必要。`preRun` フックで確実に書き込む。
- ブート時間がブラウザで 1〜3 分になる可能性がある（Phase 4 で速度チューニング）。

---

### 2.3 Phase 3: rtlscope 統合

#### ゴール

ring buffer を整備し、Logic Analyzer ビューで PDP-11 の内部信号が可視化できる。

#### 作業内容

1. **観測信号の公開**

   `rtl/pdp11.v`・`rtl/execute.v` 等に `/* verilator public */` プラグマを追加するか、
   `rtl/top.v` のラッパ出力ポートとして引き出す。

   観測対象信号:

   | 信号 | ビット幅 | 意味 |
   | --- | --- | --- |
   | `PC` | 16 | プログラムカウンタ |
   | `PSW` | 16 | プロセッサステータスワード（N/Z/V/C・優先度・カーネル/ユーザ） |
   | `bus_addr` | 18 | Unibus アドレス（MMU 変換後） |
   | `bus_data` | 16 | バスデータ |
   | `bus_wr` | 1 | バス書き込みストローブ |
   | `bus_byte` | 1 | バイト転送フラグ |
   | `mmu_mode` | 2 | 現在モード（カーネル/スーパバイザ/ユーザ） |
   | `mmu_hit` | 1 | MMU 変換有効フラグ |
   | `state` | 4〜5 | CPU マイクロステート |
   | `rk_busy` | 1 | RK11 ディスク転送中フラグ |
   | `irq_pending` | 3 | 割り込み要求ベクタ（優先度ビット） |

2. **ring buffer 設計**

   6502 版（`uint32_t ring[RING_SIZE * 2]`、1 サンプル 8 バイト）を参考に、
   PDP-11 用は 1 サンプル 16 バイト（`uint32_t ring[RING_SIZE * 4]`）に拡張する。

   ```cpp
   // Word0: bus_addr[17:0] | bus_wr | bus_byte | mmu_mode[1:0]
   // Word1: bus_data[15:0] | PSW[15:0]（上位は PSW、下位は data）
   // Word2: PC[15:0] | state[4:0] | rk_busy | irq_pending[2:0]
   // Word3: 予備（MMU PAR/PDR などの拡張用）
   ```

3. **JS 側 Logic Analyzer ビューの接続**

   `examples/03-uart` または `examples/06-8080` の Logic Analyzer 描画コードを流用する。

#### 完了条件

- ブート中に Logic Analyzer が PC の動き・割り込みベクタ遷移・ディスク DMA を可視化できる
- MMU モード切り替え（カーネル → ユーザプロセス）が信号レベルで確認できる

---

### 2.4 Phase 4: UI / デモ完成

#### ゴール

教育コンテンツとして完成度を上げ、`examples/` の他デモと一貫したレイアウトにする。

#### 作業内容

1. **UI レイアウト**

   6502 版 `index.html` を参考に:
   - 左: xterm.js コンソール（Unix V6 シェル）
   - 右上: レジスタパネル（PC、PSW、R0-R5、SP、mode）
   - 右下: MMU 状態パネル（仮想→物理アドレス変換テーブル）
   - 下段: Logic Analyzer（bus_addr / bus_data / PC / mmu_mode / rk_busy）

2. **デモボタン**

   6502 版の「Demo」ボタンに相当するもの:
   - `Boot Unix V6` ボタン: ディスクイメージをロードしてリセット
   - `Run RT-11` ボタン: 軽量な RT-11 ディスクイメージで高速確認

3. **ブート進行表示**

   Unix V6 は起動まで 1〜3 分かかる見込みなので、進行インジケータを表示する。
   ring buffer の PC 値が既知のブートシーケンスアドレスを通過したタイミングで段階表示。

4. **ディスクイメージ法的整備**

   - Unix V6 はカリフォルニア大学バークレー校の
     [TUHS アーカイブ](https://www.tuhs.org/Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/)
     から取得可能。再配布は歴史的 Unix のライセンス条件を確認。
   - デモには XXDP 診断を含めない。

5. **速度最適化**

   - Emscripten `-O3` + `-s SIMD128=1`
   - ring buffer サンプリングを 4〜8 クロックに 1 回に間引く
   - `step_n` の 1 回の呼び出し量を調整し、UI のフレームレートを維持しつつシム速度を最大化

#### 完了条件

- `examples/09-pdp11/web/index.html` を gh-pages にデプロイして公開できる
- ブート完了後に `ls /` が返る様子が Logic Analyzer で確認できる
- README と CLAUDE.md ロードマップに追記済み

---

## 3. 技術的ポイント

### 3.1 `ide.cpp` の WASM 化

Brad の `ide.cpp` はホストの `fopen`/`fread`/`fseek` で RK05 ディスクイメージを読む。
WASM では Emscripten MEMFS を使い、JS の `preRun` フックでイメージを事前書き込みする。

```javascript
var Module = {
  preRun: [function() {
    var data = new Uint8Array(diskImageArrayBuffer);
    Module.FS.writeFile('/disk0.rk', data);
  }]
};
```

`ide.cpp` 内の `fopen("/disk0.rk", "rb")` はそのままコンパイルできる。
ただし DMA コールバックのタイミングが PLI 版と異なる可能性があるため、
RK11 の IRQ 信号 (`rk_regs.v` → `bus.v` → `pdp11.v`) の動作を
ネイティブビルドで先に検証してから WASM 化する。

### 3.2 コンソール I/O

`tt_regs.v` は DL11 互換 TTY。RTL レベルでは CSR/データレジスタへの Unibus アクセスで動く。
C++ ハーネス側で Unibus アドレス `0177560`–`0177566` をインターセプトし、
6502 版の `kbd_queue` / `disp_queue` パターンに接続する。

```cpp
// tt_regs.v ではなく C++ 側でエミュレートする場合
if (bus_addr == 0177560u) return kbd_csr;
if (bus_addr == 0177562u) return kbd_data_reg;
// ...
```

あるいは `tt_regs.v` を RTL のまま残し、
出力ポートを `harness.cpp` で監視する方法も選択できる。

### 3.3 メインループ

```cpp
// ブロッキングループを廃止し、JS 側タイマーから step_n を呼ぶ
EMSCRIPTEN_KEEPALIVE void step_n(int n) {
    for (int i = 0; i < n; i++) {
        top->clk = 1; top->eval();
        top->clk = 0; top->eval();
        handle_bus();   // メモリ・IO デコード
        sample_ring();  // ring buffer へサンプル記録
    }
}
```

JS 側は `requestAnimationFrame` または `setInterval` で `step_n` を呼ぶ。
Unix V6 ブート中は 1 フレームあたり 50,000〜200,000 クロック進める。

---

## 4. 観測すべき信号

| 信号 | 観測価値 |
| --- | --- |
| PC | ブートローダー → カーネル init → sh の実行流が追える |
| PSW（優先度ビット） | カーネル割り込みハンドラへの遷移が見える |
| PSW（モードビット） | カーネル/ユーザ空間の切り替えが可視化できる |
| bus_addr | RK11 DMA 転送中のメモリ書き込みパターン |
| bus_data | バス上のデータ値（命令フェッチ vs データアクセス） |
| mmu_mode | プロセスコンテキストスイッチのタイミング |
| rk_busy | ディスクアクセスと CPU 動作の相関 |
| irq_pending | KW11 ラインクロック・RK11 DMA 完了割り込みの発生タイミング |

---

## 5. リスクと対策

### 5.1 Verilator 5.x 互換性

**リスク**: `pdp11.v`・`execute.v` の一部記法が Verilator 5.x で通らない。

**対策**:

- `verilator --lint-only -Wall rtl/top.v` で警告を全列挙してから着手する
- `/* verilator lint_off */` プラグマはすでに埋め込み済みの箇所があるため、追加パッチは限定的なはず
- 信号アクセスの名前マングリングは `--public-flat-rw` を使わず、トップレベルポートとして引き出す

### 5.2 ライセンス

**リスク**: `cpus-pdp11` に LICENSE ファイルがなく、WASM 変換物の再配布権が不明確。

**対策**:

- Phase 1 着手前に Brad Parker（heeltoe.com 掲載のメールアドレス）に MIT または BSD-2-Clause での公開許可を確認するメールを送る
- 返信があるまでは `vendor/cpus-pdp11` をプライベートのまま開発を進め、GitHub への公開は保留
- XXDP 診断（DEC 著作物）は同梱しない。Unix V6 イメージは TUHS ライセンスを確認する

### 5.3 ブート時間

**リスク**: WASM でのブートが 3〜10 分になり UX が壊滅する。

**対策**:

- Phase 2 で計測し、3 分以内を目標とする
- 超えた場合は Emscripten `-O3`・SIMD・step_n の量を調整
- どうしても遅い場合は「ブートスナップショット」方式（ブート完了状態のメモリダンプを preload）を検討

### 5.4 MMU/TLB の検証漏れ

**リスク**: Verilator 単独で Unix V6 が動いた場合でも、MMU の一部ケースが再現できておらずユーザ空間プロセスがクラッシュする。

**対策**:

- Phase 1 で DEC 公式 MMU 診断 `FKTHB0` を Verilator 上で通す（または通過状況をログで確認する）
- sh から複数コマンドを実行して安定性を確認してから WASM 化に進む

### 5.5 Brad の Verilator ブランチは「ユニットテストレベル」の可能性

**リスク**: `verilator/` ディレクトリは後付けで、OS ブートは cver + VPI での確認。
Verilator で Unix V6 ブートを通そうとすると `ide.cpp` の PLI 依存部分で詰まる。

**対策**:

- Phase 1 の最初に `ide.cpp` の VPI/PLI 呼び出しを洗い出し、純粋な C++ に書き直せるか確認する
- 書き直しが大規模になる場合は、`cver`（GPL ライセンス）もビルドして先に OS ブートを確認し、
  C++ ハーネスの正しい動作の参照実装として使う

---

## 6. 参考リンク

- [Brad Parker cpus-pdp11 README](https://www.heeltoe.com/download/pdp11/README.html)
- [GitHub: lisper/cpus-pdp11](https://github.com/lisper/cpus-pdp11)
- [wfjm/w11（VHDL 参考実装）](https://github.com/wfjm/w11)
- [DEC FPGA 実装まとめ](https://www.avanthar.com/healyzh/decemulation/pdp_fpga.html)
- [TUHS Unix V6 アーカイブ](https://www.tuhs.org/Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/)
- [Lions' Commentary on Unix 6th Edition](https://en.wikipedia.org/wiki/Lions%27_Commentary_on_Unix_6th_Edition,_with_Source_Code) — ブートシーケンス理解に有用
- 調査メモ: [`01-PDP11-verilogコア調査.md`](?doc=01-PDP11-verilogコア調査.md)
