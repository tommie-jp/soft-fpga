# Phase 2 詳細計画 — PDP-11 / Unix V6 WebAssembly 化 <a class="qr-link" href="../../../docs/09-PDP11/04-QR.png">QR</a>

## 1. ゴールと完了定義

### 1.1 具体的な成功状態

```bash
cd examples/09-pdp11/web
python3 -m http.server 8080
# → ブラウザで http://localhost:8080 を開く
# → xterm.js に Unix V6 のブートログが流れ、login: が出る
# → キーボードから "root" と入力してログイン
# → "# ls /" でファイル一覧が返る
# → Logic Analyzer に PC・PSW・bus_addr の波形が描画される
```

### 1.2 完了条件チェックリスト

- [ ] `scripts/build-wasm-09.sh` が通る
- [ ] `examples/09-pdp11/web/sim.js` + `sim.wasm` が生成される
- [ ] ブラウザで xterm.js に Unix V6 ブートログが流れる
- [ ] キーボード入力が Unix V6 シェルに届く
- [ ] `ls /` でファイル一覧が返る
- [ ] Logic Analyzer に PC・bus_addr の波形が表示される

---

## 2. アーキテクチャ方針

### 2.1 Phase 1 との差分

| 要素 | Phase 1 (ネイティブ) | Phase 2 (WASM) |
| --- | --- | --- |
| メインループ | `while(!gotFinish())` in `main_linux.cpp` | JS 側タイマーが `step_n(N)` を呼ぶ |
| TTY 出力 | `$display("tto_data %o")` → stderr | `dpi_tty_putc(ch)` → C++ キュー → JS |
| TTY 入力 | `fake_uart.v`（ハードコード文字列） | `dpi_tty_getc()` → JS キーボードイベント |
| ディスクイメージ | ホスト `fopen` | Emscripten MEMFS + `preRun` フック |
| RAM | `dpi_ram()` C++ 配列（変更なし） | 同左（Emscripten 対応、変更なし） |
| ビルド | `g++` + Verilator | `em++` + Verilator |

### 2.2 ファイル構成

```text
examples/09-pdp11/
├── verilog/
│   └── wasm_uart.v        ← 新規: DPI ベースの WASM 用 UART
├── cxx/
│   ├── main_linux.cpp     ← 既存（変更なし）
│   ├── harness.cpp        ← 新規: WASM ハーネス（step_n・ring buffer・TTY キュー）
│   ├── ide_v5.cpp         ← 既存（MEMFS 対応のため変更最小）
│   └── ram_v5.cpp         ← 既存（変更なし）
├── web/
│   ├── index.html         ← 新規
│   ├── sim-worker.js      ← 新規: Web Worker（06-8080 から流用）
│   ├── sim.js             ← Emscripten 生成
│   └── sim.wasm           ← Emscripten 生成
└── disk/                  ← .gitignore 済み
    └── unix_v6_rk05.dsk   ← Phase 1 で取得済み
scripts/
└── build-wasm-09.sh       ← 新規
```

---

## 3. Step 1: WASM 用 UART Verilog モジュール作成

### 3.1 TTY 出力（PDP-11 → ブラウザ）

`vendor/cpus-pdp11/rtl/tt_regs.v` の `tto_data_wr` が立つ瞬間に文字が確定する。
DPI コールバックを追加するのが最も確実。

**変更方針**: `tt_regs.v` 本体への修正は最小限にし、
`debug_tt_out` の `$display` 直後に DPI 呼び出しを追加する。

```verilog
// tt_regs.v の既存コード (行 155-160 付近)
always @(posedge clk) begin
  if (tto_data_wr) begin
    tto_data <= reg_in;
`ifdef debug_tt_out
    $display("tto_data %o %c", reg_in, reg_in[7:0] & 8'h7f);
`endif
`ifdef wasm_io           // ← 追加: WASM ビルド時のみ有効
    dpi_tty_putc(reg_in[7:0]);
`endif
  end
end
```

ただし `tt_regs.v` はベンダファイルなので、パッチ方式で管理する。

### 3.2 TTY 入力（キーボード → PDP-11）: `wasm_uart.v`

`fake_uart.v` と同一インターフェースを持ち、DPI で文字を受け取る新モジュール。

```verilog
// examples/09-pdp11/verilog/wasm_uart.v
module fake_uart(clk, reset,
                 txclk, ld_tx_req, ld_tx_ack, tx_data, tx_enable, tx_out, tx_empty,
                 rxclk, uld_rx_req, uld_rx_ack, rx_data, rx_enable, rx_in, rx_empty);
  // ... (fake_uart と同一ポート宣言)

  import "DPI-C" function int dpi_tty_getc();    // -1: なし、0-127: 文字
  import "DPI-C" function void dpi_tty_putc(input integer ch);

  // TX: ld_tx_req/ld_tx_ack ハンドシェイク + dpi_tty_putc 呼び出し
  // RX: dpi_tty_getc() ポーリングで rx_data / rx_empty を制御
  ...
endmodule
```

### 3.3 WASM 用トップレベル `test_top_wasm.v`

`vendor/cpus-pdp11/verif/test_top.v` をコピーして以下の差分を適用:

```diff
- `define fake_uart          ← fake_uart.v を使う
+ // fake_uart は wasm_uart.v で上書き
  ...
- `ifdef fake_uart
-   `include "../rtl/fake_uart.v"
- `else
-   `include "../rtl/uart.v"
- `endif
+ `include "../../examples/09-pdp11/verilog/wasm_uart.v"

- `define sim_time           ← FPGA シム時間フラグ（WASM 不要）
+ // sim_time は wasm_uart 側で不要
```

**ファイル配置**: `examples/09-pdp11/verilog/test_top_wasm.v`

---

## 4. Step 2: WASM ハーネス `harness.cpp` 作成

### 4.1 基本構造（`06-8080/cxx/harness.cpp` から流用）

```cpp
// examples/09-pdp11/cxx/harness.cpp

#include "Vtest_top_wasm.h"
#include "verilated.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

static Vtest_top_wasm* top;
static uint64_t sim_time = 0;

// ring buffer: 4 uint32_t / サンプル
// Word0: bus_addr[17:0] | bus_wr | bus_byte | cpu_mode[1:0]
// Word1: bus_data[15:0] | PSW[15:0]
// Word2: PC[15:0] | rk_busy | irq[2:0]
// Word3: 予備
#define RING_SIZE  4096
#define RING_WORDS 4
static uint32_t ring[RING_SIZE * RING_WORDS];
static uint32_t ring_head = 0;

// コンソールキュー
static uint8_t  con_out_buf[4096];
static int      con_out_head = 0, con_out_tail = 0;
static uint8_t  con_in_buf[256];
static int      con_in_head = 0, con_in_tail = 0;
```

### 4.2 DPI 実装

```cpp
// DPI: WASM TTY 出力（tt_regs.v から呼ばれる）
extern "C" void dpi_tty_putc(int ch) {
    int next = (con_out_tail + 1) % sizeof(con_out_buf);
    if (next != con_out_head) {
        con_out_buf[con_out_tail] = (uint8_t)ch;
        con_out_tail = next;
    }
}

// DPI: WASM TTY 入力（wasm_uart.v から呼ばれる）
extern "C" int dpi_tty_getc() {
    if (con_in_head == con_in_tail) return -1;
    int ch = con_in_buf[con_in_head];
    con_in_head = (con_in_head + 1) % sizeof(con_in_buf);
    return ch;
}
```

### 4.3 クロック・ring buffer・エクスポート関数

```cpp
static void tick() {
    top->rootp->test_top_wasm__DOT__sysclk = 1; top->eval();
    top->rootp->test_top_wasm__DOT__sysclk = 0; top->eval();
    sim_time++;
}

static void sample_ring() {
    uint32_t* p = &ring[(ring_head % RING_SIZE) * RING_WORDS];
    // Word0
    p[0] = (top->rootp->test_top_wasm__DOT__top__DOT__bus_addr_p & 0x3FFFF)
         | (top->rootp->test_top_wasm__DOT__top__DOT__bus_wr << 18)
         | (top->rootp->test_top_wasm__DOT__top__DOT__bus_byte_op << 19);
    // Word1
    p[1] = (top->rootp->test_top_wasm__DOT__top__DOT__bus_data_in & 0xFFFF)
         | ((uint32_t)top->rootp->test_top_wasm__DOT__top__DOT__psw << 16);
    // Word2
    p[2] = (top->rootp->test_top_wasm__DOT__top__DOT__pc & 0xFFFF);
    // Word3: 予備
    p[3] = 0;
    ring_head++;
}

EMSCRIPTEN_KEEPALIVE void step_n(int n) {
    for (int i = 0; i < n; i++) {
        tick();
        if (sim_time % 4 == 0) sample_ring();  // 4 クロックに 1 サンプル
    }
}

EMSCRIPTEN_KEEPALIVE void send_key(int ch) {
    int next = (con_in_tail + 1) % sizeof(con_in_buf);
    if (next != con_in_head) {
        con_in_buf[con_in_tail] = (uint8_t)ch;
        con_in_tail = next;
    }
}

EMSCRIPTEN_KEEPALIVE int get_display_char() {
    if (con_out_head == con_out_tail) return -1;
    int ch = con_out_buf[con_out_head];
    con_out_head = (con_out_head + 1) % sizeof(con_out_buf);
    return ch;
}

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()  { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_head() { return ring_head; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_size() { return RING_SIZE; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_ring_words(){ return RING_WORDS; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_pc() {
    return top->rootp->test_top_wasm__DOT__top__DOT__pc;
}
```

### 4.4 `sim_init()` — リセットとディスクイメージ設定

```cpp
EMSCRIPTEN_KEEPALIVE void sim_init() {
    // IDEIMAGE 環境変数でディスクパスを指定（MEMFS: "/disk0.rk"）
    setenv("IDEIMAGE", "/disk0.rk", 0);

    VerilatedContext* ctx = new VerilatedContext;
    top = new Vtest_top_wasm(ctx);

    // リセット（reset_btn.v 経由: button[3] アサート）
    top->rootp->test_top_wasm__DOT__button = 0;
    top->rootp->test_top_wasm__DOT__sysclk = 0;
    top->eval();
    top->rootp->test_top_wasm__DOT__button = (1 << 3);
    for (int i = 0; i < 64; i++) tick();
    top->rootp->test_top_wasm__DOT__button = 0;
    for (int i = 0; i < 64; i++) tick();
}
```

---

## 5. Step 3: ビルドスクリプト `scripts/build-wasm-09.sh`

### 5.1 Verilator フェーズ

```bash
verilator --cc \
    --no-timing \
    --top-module test_top_wasm \
    -Wno-DECLFILENAME -Wno-MULTITOP -Wno-UNUSEDSIGNAL \
    -Wno-UNOPTFLAT -Wno-WIDTHEXPAND -Wno-WIDTHTRUNC \
    -Wno-STMTDLY -Wno-TIMESCALEMOD -Wno-CASEX -Wno-CASEINCOMPLETE \
    +define+wasm_io \
    "$EXAMPLE/verilog/test_top_wasm.v" \
    +incdir+"$VENDOR/rtl" \
    +incdir+"$EXAMPLE/verilog" \
    --Mdir "$OBJ_DIR"
```

### 5.2 Emscripten フェーズ

```bash
COMMON_FLAGS="-O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH \
  -I$VERILATOR_ROOT/include -I$VERILATOR_ROOT/include/vltstd -I$OBJ_DIR"

# verilated.cpp だけ先にコンパイル
em++ $COMMON_FLAGS -include "$ROOT/cxx/wasm_compat.h" \
    -c "$VERILATOR_ROOT/include/verilated.cpp" \
    -o "$OBJ_DIR/verilated.wasm.o"

V_SRCS=$(ls "$OBJ_DIR"/V*.cpp | grep -v '__Dpi\.cpp')

em++ $COMMON_FLAGS \
    $V_SRCS \
    "$OBJ_DIR/verilated.wasm.o" \
    "$EXAMPLE/cxx/harness.cpp" \
    "$EXAMPLE/cxx/ide_v5.cpp" \
    "$EXAMPLE/cxx/ram_v5.cpp" \
    -s EXPORTED_FUNCTIONS='["_sim_init","_step_n","_send_key","_get_display_char",
                            "_get_ring_ptr","_get_ring_head","_get_ring_size","_get_ring_words",
                            "_get_pc","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU32","HEAPU8","FS"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=67108864 \
    -s EXIT_RUNTIME=0 \
    -o "$EXAMPLE/web/sim.js"
```

**注意点**:

- `Vtest_top_wasm__Dpi.cpp` は DPI 関数プロトタイプを含むが、
  実装は `harness.cpp` にあるため、`-v '__Dpi.cpp'` 除外は **しない**。
  ただし svdpi.h の `uint8_t` 問題が出た場合は `--sv` フラグを Verilator に追加する。

---

## 6. Step 4: ディスクイメージの MEMFS 配信

### 6.1 JS 側での preRun ロード

```javascript
// sim-worker.js 内
var Module = {
  preRun: [function() {
    // fetch or ArrayBuffer from postMessage
    var data = new Uint8Array(diskImageBuffer);
    Module.FS.writeFile('/disk0.rk', data);
  }],
  onRuntimeInitialized: function() {
    Module._sim_init();
    startStepLoop();
  }
};
```

### 6.2 ディスクサイズと転送

Unix V6 RK05 イメージは 2.4 MB。gzip 圧縮で約 800 KB。

```javascript
// index.html
fetch('disk/unix_v6_rk05.dsk.gz')
  .then(r => r.arrayBuffer())
  .then(buf => {
    // DecompressionStream (Brotli/gzip) でデコード
    worker.postMessage({ type: 'disk', data: buf }, [buf]);
  });
```

**注意**: `disk/` ディレクトリは `.gitignore` 済みのため、
ユーザが自前でイメージを配置するか、ビルド時に自動ダウンロードするスクリプトを別途用意する。

---

## 7. Step 5: JS 層（Web Worker + UI）

### 7.1 `sim-worker.js`（06-8080 版から移植）

```javascript
// 主なメッセージハンドラ
self.onmessage = (e) => {
  switch (e.data.type) {
    case 'init':    initSim(e.data.disk); break;
    case 'key':     Module._send_key(e.data.ch); break;
    case 'step':    doStep(); break;
  }
};

function doStep() {
  Module._step_n(100000);  // 100K クロック / フレーム

  // TTY 出力をメインスレッドへ転送
  let ch;
  const chars = [];
  while ((ch = Module._get_display_char()) !== -1) chars.push(ch);
  if (chars.length) self.postMessage({ type: 'tty', chars });

  // ring buffer スナップショット
  const head = Module._get_ring_head();
  const ptr  = Module._get_ring_ptr() >> 2;  // uint32_t* → HEAPU32 オフセット
  self.postMessage({ type: 'ring', head, ringBuf: Module.HEAPU32.buffer }, [Module.HEAPU32.buffer.slice(0)]);
}
```

### 7.2 `index.html` レイアウト

```html
<!-- 06-8080/web/index.html を参考に -->
<div id="layout">
  <!-- 左: xterm.js コンソール -->
  <div id="terminal"></div>

  <!-- 右上: レジスタパネル -->
  <div id="regs">
    <span id="reg-pc">PC: 0000</span>
    <span id="reg-psw">PSW: 0000</span>
  </div>

  <!-- 下: Logic Analyzer (03-uart のコードを流用) -->
  <canvas id="la-canvas"></canvas>
</div>
```

### 7.3 ring buffer 信号レイアウト

```text
Word0 [31: 0]:
  [17: 0] bus_addr_p  — Unibus 物理アドレス（18 ビット）
  [18]    bus_wr      — バス書き込みストローブ
  [19]    bus_byte_op — バイト操作フラグ
  [21:20] cpu_cm      — CPU モード (00=kernel, 11=user)
  [31:22] (予備)

Word1 [31: 0]:
  [15: 0] bus_data    — バスデータ（読み書き共用）
  [31:16] PSW         — プロセッサステータスワード

Word2 [31: 0]:
  [15: 0] PC          — プログラムカウンタ（仮想）
  [16]    rk_busy     — RK11 転送中フラグ
  [19:17] (予備)
  [31:20] (予備)

Word3 [31: 0]:
  (予備: MMU PAR/PDR などの拡張用)
```

---

## 8. Step 6: 動作確認シーケンス

### 8.1 ローカルサーバで確認

```bash
# ビルド
bash scripts/build-wasm-09.sh

# ディスクイメージを web/ へコピー（またはシンボリックリンク）
cp examples/09-pdp11/disk/unix_v6_rk05.dsk examples/09-pdp11/web/disk/

# サーブ
cd examples/09-pdp11/web
python3 -m http.server 8080
# → http://localhost:8080
```

### 8.2 期待する動作

1. ページロード → ディスクイメージ fetch → MEMFS 書き込み → `sim_init()` → シム起動
2. xterm.js に `@` プロンプト表示（bootrom の出力）
3. ユーザが `rkunix` + Enter → ディスク読み込み → Unix V6 ブートログ流れる
4. `login:` → `root` + Enter → `#` プロンプト
5. `ls /` → `bin dev etc lib mnt rkunix rpunix tmp unix usr`
6. Logic Analyzer にブート中の PC・bus_addr 波形が流れる

### 8.3 ブート速度の見込み

| 環境 | 周波数 | login: まで |
| --- | --- | --- |
| ネイティブ (Phase 1) | ~3 M cycles/sec | ~4 秒 |
| WASM (Emscripten -O2) | ~1-2 M cycles/sec | ~6-12 秒 |
| WASM (-O3 + SIMD) | ~2-3 M cycles/sec | ~4-6 秒 |

Unix V6 は login: まで約 11-12 M クロック。WASM での 10 秒以内は現実的。

---

## 9. リスクと対処

### 9.1 DPI と Emscripten の相性

**リスク**: `svdpi.h` が Emscripten の wasm ターゲットで `uint8_t` エラーを出す。

**対処**:

- `cxx/wasm_compat.h`（06-8080 で使用済み）で `uint8_t` を redefine する
- または `--sv` を Verilator に渡してクリーンな DPI ヘッダを生成する

### 9.2 `tt_regs.v` のパッチ管理

**リスク**: ベンダファイル変更が submodule update で上書きされる。

**対処**:

- `wasm_io` define に guard された数行追加のみ（最小パッチ）
- `docs/09-PDP11/patches/` に diff ファイルとして保存
- `build-wasm-09.sh` でパッチを自動適用するか、patchfile を用意する

```bash
# build-wasm-09.sh 内でパッチを当てる
patch -p1 -d "$VENDOR" < "$EXAMPLE/../patches/tt_regs_wasm_io.patch"
```

### 9.3 ring buffer 信号のアクセスパス

**リスク**: `top->rootp->test_top_wasm__DOT__top__DOT__bus_addr_p` 等の
階層パスが Verilator 5.x で生成されない場合がある。

**対処**:

- 必要な信号を `test_top_wasm.v` のトップレベルポートとして引き出す
- またはパブリック宣言 `/* verilator public_flat_rw */` を使う

```verilog
// test_top_wasm.v に追加
wire [17:0] obs_bus_addr;  /* verilator public_flat */
wire [15:0] obs_bus_data;  /* verilator public_flat */
wire [15:0] obs_pc;        /* verilator public_flat */
wire [15:0] obs_psw;       /* verilator public_flat */
assign obs_bus_addr = top_inst.bus_addr_p[17:0];
assign obs_pc       = top_inst.pc;
```

### 9.4 ディスクイメージのライセンス

**リスク**: Unix V6 イメージを Web で配信することのライセンス適合性。

**対処**:

- TUHS ライセンス（Caldera 2002年解放）を確認し `examples/09-pdp11/web/LICENSE.txt` に記載
- `disk/` は git 管理外のまま、ユーザ自身が取得する構成を基本とする
- デモとして公開する場合は Brad Parker にも連絡する（§5.2 参照）

---

## 10. 所要時間見積もり

| ステップ | 楽観 | 悲観 | 主リスク |
| --- | --- | --- | --- |
| Step 1: wasm_uart.v + tt_regs.v パッチ | 2 時間 | 6 時間 | DPI ハンドシェイク実装 |
| Step 2: harness.cpp 作成 | 3 時間 | 8 時間 | ring buffer 信号パス確認 |
| Step 3: build-wasm-09.sh | 1 時間 | 4 時間 | リンクエラー解消 |
| Step 4: MEMFS ディスク配信 | 1 時間 | 3 時間 | preRun タイミング |
| Step 5: JS 層（Worker + UI） | 4 時間 | 10 時間 | xterm.js + Logic Analyzer 統合 |
| Step 6: 動作確認 | 1 時間 | 5 時間 | ブートしない場合のデバッグ |

楽観合計: **12 時間**（集中して 2 日）  
悲観合計: **36 時間**（DPI + 信号パス + JS デバッグが重なった場合）

---

## 11. 先行調査事項（実装前に確認する項目）

1. **`dpi_tty_putc` / `dpi_tty_getc` の DPI シグネチャ確認**

   ```bash
   # Verilator が生成する DPI ヘッダを確認
   grep 'dpi_tty' obj_dir_09_wasm/Vtest_top_wasm__Dpi.h
   ```

2. **ring buffer 信号の公開パス確認**

   ```bash
   # public_flat でアクセスできるか確認
   grep 'bus_addr_p\|psw\|pc' obj_dir_09_wasm/Vtest_top_wasm___024root.h | head -20
   ```

3. **WASM ビルドで svdpi.h エラーが出るか確認**

   ```bash
   em++ -O2 -std=c++17 -DVL_IGNORE_UNKNOWN_ARCH \
     -I$(verilator --getenv VERILATOR_ROOT)/include \
     -c obj_dir_09_wasm/Vtest_top_wasm__Dpi.cpp
   ```

4. **ブート速度の実測**

   ```bash
   time (echo "" | IDEIMAGE=examples/09-pdp11/disk/unix_v6_rk05.dsk \
     examples/09-pdp11/build/pdp11_sim 2>&1 | grep -m1 'login:')
   ```

---

## 参考

- [Phase 1 詳細計画](./03-phase1-詳細計画.md)
- [WASM 実装計画概要](./02-wasm実装計画.md)
- `examples/06-8080/cxx/harness.cpp` — CP/M WASM ハーネスの参考実装
- `scripts/build-wasm-06.sh` — 8080 WASM ビルドスクリプトの参考実装
- `vendor/cpus-pdp11/rtl/tt_regs.v` — TTY レジスタ（tto_data_wr のタイミング）
- `vendor/cpus-pdp11/rtl/fake_uart.v` — 置き換え対象
