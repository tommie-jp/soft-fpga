# Phase 3 詳細計画 — PDP-11 / Unix V6 rtlscope 統合 <a class="qr-link" href="../../../docs/09-PDP11/05-QR.png">QR</a>

## 1. ゴールと完了定義

### 1.1 具体的な成功状態

Unix V6 ブート中のバス波形・割り込みシーケンスをブラウザ上で観測できる。

```text
PC レーン:  bootrom → kernel init → scheduler ループ → user プロセス
Addr レーン: RK11 DMA バースト → ページフォルト → スタック操作
Mode レーン: Kernel（緑）→ User（青）→ Kernel（割り込み）の切り替え
INT レーン:  KW11 60 Hz ライン割り込みの定期的な発生
decode レーン: FETCH / MEM_RD / MEM_WR / IO / TRAP の色分け
```

### 1.2 完了条件チェックリスト

- [ ] ring buffer が RING_WORDS=5 に拡張されビルドが通る
- [ ] `rtlscope-la.js` が PDP-11 ページで動作する
- [ ] 信号トグルパネルで任意の信号を表示/非表示できる
- [ ] ズーム操作（マウスホイール / ボタン）が機能する
- [ ] カーソルにサンプル値が表示される
- [ ] PSW の N/Z/V/C・Mode・Priority がデコードされて表示される
- [ ] bus cycle decode レーン（FETCH/MEM_RD/MEM_WR/IO/TRAP）が表示される
- [ ] トリガー機能で指定 PC にヒットしたときシミュレーションが停止できる

---

## 2. 現状と差分

### 2.1 Phase 2 完了時点の状態

| 機能 | Phase 2 実装 | Phase 3 目標 |
| --- | --- | --- |
| ring buffer | RING_WORDS=4（PC/PSW/Addr/Data/Mode/RK） | RING_WORDS=5（＋Addr_v/RD/ByteOp/INT/IST） |
| Logic Analyzer | 独自の簡易 canvas 描画（3 レーン固定） | `rtlscope-la.js` 統合（全信号をトグル可能） |
| 信号数 | 7 種（PC/PSW/Addr/Data/WR/Mode/RK） | 17 種以上 |
| デコードレーン | なし | バスサイクルタイプ（FETCH/MEM_RD/MEM_WR/IO/TRAP） |
| トリガー | なし | PC 値 / バスアドレス / 信号値 |
| ズーム | なし | 0.25x〜64x |
| MMU パネル | なし | オプション（後述） |

### 2.2 再利用するライブラリ

| ファイル | 元 | 用途 |
| --- | --- | --- |
| `rtlscope-la.js` | `examples/06-8080/web/js/` | 汎用 Logic Analyzer（1688 行、設定注入型） |

`rtlscope-la.js` はシグナル定義とコンフィグを注入するだけで動く完全汎用実装。
8080 固有の処理（マシンサイクル、フラグ形式）はコールバックで分離されているため
PDP-11 用のコンフィグを書くだけで流用できる。

---

## 3. Step 1: ring buffer 拡張

### 3.1 追加する観測信号

`test_top_wasm.v` に以下の `obs_*` ワイヤを追加する。

```verilog
wire        obs_rd       /* verilator public_flat */;
wire        obs_byte_op  /* verilator public_flat */;
wire        obs_trapped  /* verilator public_flat */;
wire        obs_halted   /* verilator public_flat */;
wire        obs_waited   /* verilator public_flat */;
wire        obs_bus_int  /* verilator public_flat */;
wire [7:0]  obs_int_vec  /* verilator public_flat */;
wire [7:0]  obs_int_ipl  /* verilator public_flat */;
wire [15:0] obs_addr_v   /* verilator public_flat */;

assign obs_rd      = top.bus_rd;
assign obs_byte_op = top.bus_byte_op;
assign obs_trapped = top.trapped;
assign obs_halted  = top.halted;
assign obs_waited  = top.waited;
assign obs_bus_int = top.bus_int;
assign obs_int_vec = top.bus_int_vector;
assign obs_int_ipl = top.bus_int_ipl;
assign obs_addr_v  = top.bus_addr_v;
```

CPU マイクロステート（`istate`）はオプション。`pdp11.v` 内部の `reg [4:0] istate` に
アクセスするには `test_top_wasm.v` にさらに深い階層参照が必要（後述 §3.4）。

### 3.2 ring buffer 新レイアウト（RING_WORDS = 5）

```text
Word0 [31: 0]:
  [17: 0] bus_addr_p   — Unibus 物理アドレス（18 ビット）
  [18]    bus_wr       — バス書き込みストローブ
  [19]    bus_rd       — バス読み出しストローブ
  [21:20] cpu_cm       — CPU モード (00=kernel, 11=user)
  [22]    bus_byte_op  — バイト操作フラグ
  [23]    trapped      — トラップ発生フラグ
  [24]    halted       — CPU ホルトフラグ
  [25]    bus_int      — 割り込みリクエスト中フラグ
  [30:26] rk_state     — RK11 ステート（5 ビット）
  [31]    (予備)

Word1 [31: 0]:
  [15: 0] bus_data     — バスデータ（読み書き共用）
  [31:16] PSW          — プロセッサステータスワード

Word2 [31: 0]:
  [15: 0] PC           — プログラムカウンタ（仮想）
  [31:16] bus_addr_v   — 仮想アドレス（16 ビット）

Word3 [31: 0]:
  [ 7: 0] int_vec      — 割り込みベクタ（8 ビット）
  [15: 8] int_ipl      — 割り込み優先レベル（8 ビット）
  [31:16] (予備)

Word4 [31: 0]:
  (予備: MMU PAR/PDR などの拡張用)
```

### 3.3 `harness.cpp` の更新

```cpp
#define RING_SIZE  4096
#define RING_WORDS 5     // 変更: 4 → 5

static inline void sample_ring() {
    uint32_t* p = &ring[(ring_head % RING_SIZE) * RING_WORDS];

    p[0] = ((uint32_t)OBS_ADDR_P   & 0x3FFFFu)
         | ((uint32_t)(OBS_WR      & 1u) << 18)
         | ((uint32_t)(OBS_RD      & 1u) << 19)
         | ((uint32_t)(OBS_CPU_CM  & 3u) << 20)
         | ((uint32_t)(OBS_BYTE_OP & 1u) << 22)
         | ((uint32_t)(OBS_TRAPPED & 1u) << 23)
         | ((uint32_t)(OBS_HALTED  & 1u) << 24)
         | ((uint32_t)(OBS_BUS_INT & 1u) << 25)
         | ((uint32_t)(OBS_RK_STATE& 0x1Fu) << 26);

    p[1] = ((uint32_t)(OBS_DATA) & 0xFFFFu)
         | ((uint32_t)(OBS_PSW)  << 16);

    p[2] = ((uint32_t)(OBS_PC)     & 0xFFFFu)
         | ((uint32_t)(OBS_ADDR_V) << 16);

    p[3] = ((uint32_t)(OBS_INT_VEC & 0xFFu))
         | ((uint32_t)(OBS_INT_IPL & 0xFFu) << 8);

    p[4] = 0;  // 予備
    ring_head++;
}
```

### 3.4 CPU マイクロステート（オプション）

`istate` は `pdp11.v` の `top` → `cpu` → `istate` の深い階層にある。
`test_top_wasm.v` でアクセスする場合:

```verilog
wire [4:0] obs_istate /* verilator public_flat */;
assign obs_istate = top.cpu.istate;
// top モジュール内で cpu は pdp11 のインスタンス名
```

マイクロステート定数（`pdp11.v` の `localparam` より）:

| 値 | 状態 | 意味 |
| --- | --- | --- |
| 0 (`i0`) | idle | バスアービタ待ち |
| 1 (`f1`) | fetch1 | 命令フェッチ |
| 2 (`f2`) | fetch2 | 2 ワード命令 2 バイト目 |
| 3 (`d1`) | decode1 | デコード・src オペランド読み |
| 4 (`d2`) | decode2 | src オペランド間接アドレス |
| 5 (`s1`) | src1 | src メモリ読み |
| ... | ... | ... |
| 16 (`e1`) | execute | 実行ユニット起動 |
| 17 (`w1`) | write1 | dst 書き込み |

---

## 4. Step 2: `sft-pdp11-la-defs.js` 作成

`examples/06-8080/web/js/sft-8080-la-defs.js` を参考に
PDP-11 用の信号定義ファイルを作成する。

### 4.1 信号定義（LA_SIGNALS_PDP11）

```javascript
// examples/09-pdp11/web/js/sft-pdp11-la-defs.js
'use strict';

// ring buffer ビットレイアウト（RING_WORDS = 5）
// Word0: [17:0]=addr_p [18]=wr [19]=rd [21:20]=cm [22]=byte [23]=trap [24]=halt [25]=int [30:26]=rk
// Word1: [15:0]=data [31:16]=psw
// Word2: [15:0]=pc [31:16]=addr_v
// Word3: [7:0]=int_vec [15:8]=int_ipl
// Word4: 予備

var RING_WORDS_PDP11 = 5;

var LA_SIGNALS_PDP11 = [
  // === バスアドレス ===
  { id:'addr_p', label:'PhysAddr', word:0, bit:0,  type:'hex', width:18, color:'#fa8',
    on:true, tip:'Unibus 物理アドレス（MMU 変換後）。18 ビット。I/O ページ = 0o760000–0o777777' },
  { id:'addr_v', label:'VA',       word:2, bit:16, type:'hex', width:16, color:'#fc6',
    on:false, tip:'仮想アドレス（MMU 変換前）。CPU が参照するアドレス' },

  // === バス制御 ===
  { id:'bus_wr',  label:'WR',     word:0, bit:18, type:'bit', width:1, color:'#f44',
    on:true, tip:'バス書き込みストローブ。メモリ・I/O への書き込みサイクルで High' },
  { id:'bus_rd',  label:'RD',     word:0, bit:19, type:'bit', width:1, color:'#4c4',
    on:true, tip:'バス読み出しストローブ。メモリ・I/O からの読み出しサイクルで High' },
  { id:'byte_op', label:'BYTE',   word:0, bit:22, type:'bit', width:1, color:'#88f',
    on:false, tip:'バイト操作フラグ。MOVB・CMPB 等のバイト命令で High' },
  { id:'bus_data',label:'Data',   word:1, bit:0,  type:'hex', width:16, color:'#0c8',
    on:true, tip:'バスデータ（RD なら読み値、WR なら書き値）' },

  // === CPU 状態 ===
  { id:'pc',   label:'PC',    word:2, bit:0,  type:'oct', width:16, color:'#4fc',
    on:true, tip:'プログラムカウンタ（8 進表示）。命令フェッチ直後の値' },
  { id:'psw',  label:'PSW',   word:1, bit:16, type:'hex', width:16, color:'#8af',
    on:false, fmt:'psw11', tip:'プロセッサステータスワード。フォーマット: CM.PM.P.T.NZVC' },
  { id:'cm',   label:'Mode',  word:0, bit:20, type:'hex', width:2,  color:'#6f6',
    on:true, fmt:'mode11', tip:'CPU 現在モード (00=Kernel, 11=User)' },
  { id:'pri',  label:'Pri',   word:1, bit:21, type:'dec', width:3,  color:'#fb6',
    on:false, tip:'割り込み優先レベル（PSW[7:5]）。0〜7。KW11=6, RK11=5' },

  // === トラップ・ホルト ===
  { id:'trapped', label:'TRAP', word:0, bit:23, type:'bit', width:1, color:'#f80',
    on:true, tip:'トラップ発生フラグ。バストラップ・奇数アドレス・未定義命令で High' },
  { id:'halted',  label:'HALT', word:0, bit:24, type:'bit', width:1, color:'#f00',
    on:true, tip:'CPU ホルトフラグ。HALT 命令実行でアサート' },

  // === 割り込み ===
  { id:'bus_int', label:'INT',     word:0, bit:25, type:'bit', width:1, color:'#ff0',
    on:true, tip:'割り込みリクエスト中フラグ（KW11/RK11 等から）' },
  { id:'int_vec', label:'Vec',     word:3, bit:0,  type:'oct', width:8, color:'#ffa',
    on:false, tip:'割り込みベクタ（8 進表示）。KW11=0o100, RK11=0o220, TTY RX=0o60, TX=0o64' },
  { id:'int_ipl', label:'IPL',     word:3, bit:8,  type:'dec', width:8, color:'#ff8',
    on:false, tip:'割り込み優先レベル' },

  // === RK11 ディスク ===
  { id:'rk_state', label:'RK',  word:0, bit:26, type:'hex', width:5, color:'#f0f',
    on:true, tip:'RK11 ステートマシン状態（0=Idle）。非 0 でディスク転送中' },
];

// PSW フォーマッター: "K P6 NZVC"
function fmtPSW11(val) {
  var cm  = (val >> 14) & 3;
  var pm  = (val >> 12) & 3;
  var pri = (val >>  5) & 7;
  var t   = (val >>  7) & 1;
  var n   = (val >>  3) & 1;
  var z   = (val >>  2) & 1;
  var v   = (val >>  1) & 1;
  var c   = (val      ) & 1;
  var modes = ['K','S','?','U'];
  return modes[cm] + modes[pm] + ' P' + pri
       + (t ? 'T' : '.') + (n ? 'N' : '.') + (z ? 'Z' : '.') + (v ? 'V' : '.') + (c ? 'C' : '.');
}

// モード表示
function fmtMode11(val) {
  return val === 0 ? 'Kernel' : val === 3 ? 'User' : 'Sup';
}

// バスサイクルデコードレーン
// Word0[19:18] = rd/wr、Word0[17:0] = addr_p、Word1[15:0] = data、Word2[15:0] = PC
function decodeBusCycle(w0, w1, w2, w3) {
  var rd  = (w0 >> 19) & 1;
  var wr  = (w0 >> 18) & 1;
  var ap  = w0 & 0x3FFFF;
  var av  = (w2 >> 16) & 0xFFFF;
  var pc  = w2 & 0xFFFF;
  var trap = (w0 >> 23) & 1;

  if (trap)  return { label:'TRAP',   color:'rgba(255,80,0,0.7)'   };
  if (!rd && !wr) return null;

  // I/O ページ: 0o760000–0o777777 = 0x1F000–0x1FFFF (18-bit)
  var io = (ap & 0x1F000) === 0x1F000;

  if (rd && av === pc)
    return { label:'FETCH',  color:'rgba(40,100,220,0.6)'  };  // 命令フェッチ
  if (rd && io)
    return { label:'IO_RD',  color:'rgba(0,180,120,0.6)'   };  // I/O 読み
  if (wr && io)
    return { label:'IO_WR',  color:'rgba(220,100,0,0.6)'   };  // I/O 書き
  if (rd)
    return { label:'MEM_RD', color:'rgba(30,160,30,0.6)'   };  // メモリ読み
  if (wr)
    return { label:'MEM_WR', color:'rgba(180,40,0,0.6)'    };  // メモリ書き
  return null;
}

// KW11 ラインクロック割り込み（ベクタ 0o100 = 0x40）の識別
function isLineClk(w3) {
  return (w3 & 0xFF) === 0x40;
}

// RTLScopeLA コンストラクタに渡す config の雛形
var PDP11_LA_CONFIG = {
  signals:    LA_SIGNALS_PDP11,
  ringWords:  RING_WORDS_PDP11,
  ringSize:   4096,
  width:      900,
  labelWidth: 64,
  trackH:     24,
  storagePrefix: 'pdp11_la_',

  formatters: {
    psw11:  fmtPSW11,
    mode11: fmtMode11,
    oct:    function(v, w) { return (v >>> 0).toString(8).padStart(Math.ceil(w * 3 / 8) + 1, '0'); }
  },

  decodeLane: {
    label: 'Cycle',
    render: function(ctx, params) {
      // params: { x, y, w, h, w0, w1, w2, w3 }
      var d = decodeBusCycle(params.w0, params.w1, params.w2, params.w3);
      if (!d) return;
      ctx.fillStyle = d.color;
      ctx.fillRect(params.x, params.y, params.w, params.h);
      if (params.w > 36) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(d.label, params.x + 2, params.y + params.h - 3);
      }
    }
  },

  signalBackground: function(sig, val) {
    if (sig.id === 'cm') {
      if (val === 0) return 'rgba(0,120,0,0.12)';   // kernel: 薄緑
      if (val === 3) return 'rgba(0,0,180,0.12)';   // user:   薄青
    }
    return null;
  }
};
```

---

## 5. Step 3: `index.html` + `rtlscope-la.js` 統合

### 5.1 ファイル構成

```text
examples/09-pdp11/web/
├── index.html              ← Phase 2 を全面更新
├── sim-worker.js           ← 変更なし（ring buffer サイズのみ更新）
├── js/
│   ├── rtlscope-la.js      ← 06-8080 からコピー（変更なし）
│   └── sft-pdp11-la-defs.js ← 新規作成（上記 §4.1）
├── sim.js                  ← Emscripten 生成（ビルド後）
├── sim.wasm                ← Emscripten 生成（ビルド後）
└── disk/                   ← .gitignore
    └── unix_v6_rk05.dsk
```

### 5.2 `index.html` のレイアウト変更

```html
<div class="layout">
  <!-- 左: ターミナル -->
  <div class="col-left">
    <div class="toolbar">...</div>
    <div id="terminal"></div>
    <div class="ctrl-bar"><!-- Ctrl-C / ESC / Tab など --></div>
  </div>

  <!-- 右: レジスタ + Logic Analyzer -->
  <div class="col-right">
    <div id="regs-panel">
      <!-- PC / PSW / Mode / Addr / RK11 -->
    </div>
    <!-- rtlscope-la.js の表示領域 -->
    <div id="la-toggles"></div>   <!-- 信号トグル -->
    <canvas id="la"></canvas>     <!-- Logic Analyzer -->
    <div id="la-zoom-bar">...</div>
  </div>
</div>
```

### 5.3 `rtlscope-la.js` の初期化

```javascript
// index.html の <script> 内
var la = new RTLScopeLA({
  ...PDP11_LA_CONFIG,
  canvasId:  'la',
  togglesId: 'la-toggles',
});
la.buildToggles();

// Worker からの ring データを LA に渡す
worker.onmessage = function(e) {
  if (e.data.type === 'ring') {
    var u32 = new Uint32Array(e.data.snap);
    la.update(Module.HEAPU32, e.data.head);  // または snap を使う
  }
};
```

`rtlscope-la.js` は `HEAPU32` を直接参照するか、
スナップショット転送のどちらにも対応している（`update` メソッド参照）。

---

## 6. Step 4: トリガー・一時停止機能

### 6.1 PC トリガー

Unix V6 の既知のアドレスで停止できると可視化に便利。

```javascript
// 例: カーネル printf("mem=") の PC でトリガー
la.setTriggerPC(0o4014);  // mem= の printf
```

WASM 側では `harness.cpp` にトリガー判定ロジックを追加:

```cpp
EMSCRIPTEN_KEEPALIVE void sim_set_pc_trigger(uint32_t pc) {
    g_trigger_pc = pc;
    g_triggered  = false;
}

EMSCRIPTEN_KEEPALIVE int sim_trigger_hit() { return g_triggered ? 1 : 0; }

// step_n の中でチェック
if (g_trigger_pc && OBS_PC == g_trigger_pc) {
    g_triggered = true;
    return;  // シミュレーションを停止
}
```

### 6.2 既知のアドレス表（ブートシーケンスの可視化に使う）

| 仮想アドレス（8 進） | イベント |
| --- | --- |
| `0o0` | カーネル起動 (`m40.s` エントリ) |
| `0o4014` | `printf("mem=")` (`main.c`) |
| `0o3512` | RTT 命令（user プロセス切り替え） |
| `0o15xxx` | getty/login の入力待ちループ |
| `0o173000` | bootrom エントリ |
| `0o100` | KW11 ラインクロック割り込みベクタ |
| `0o220` | RK11 割り込みベクタ |

---

## 7. Step 5: MMU 可視化パネル（オプション / Phase 4 可）

### 7.1 PAR/PDR の読み取り

MMU の Page Address Registers (PAR) と Page Descriptor Registers (PDR) を
WASM 側で読み出して表示する。

```cpp
// mmu.v 内部の pdr_h[]/pdr_l[] と par_h[]/par_l[] にアクセス
// harness.cpp に sim_read_mmu_par/pdr 関数を追加
EMSCRIPTEN_KEEPALIVE uint32_t sim_read_mmu_par(int mode, int page) {
    // top->rootp->test_top_wasm__DOT__top__DOT__mmu1__DOT__... でアクセス
    // (Verilator の public flat を mmu.v の配列に追加する必要がある)
    return 0;
}
```

`mmu.v` の `reg [7:0] pdr_h[63:0]` 等への Verilator public_flat アクセスは
配列の場合に制約があるため、個別にポートとして引き出す方が確実。

### 7.2 MMU パネル UI

```text
Kernel I-space:     User I-space:
 APR0: 000000 RW    APR0: 002000 RD
 APR1: 000800 RW    APR1: 002400 RD
 ...                ...
```

---

## 8. 所要時間見積もり

| ステップ | 楽観 | 悲観 | 主なリスク |
| --- | --- | --- | --- |
| Step 1: ring buffer 拡張 + ビルド | 1 時間 | 3 時間 | 信号パス名確認 |
| Step 2: sft-pdp11-la-defs.js | 2 時間 | 4 時間 | PSW/decode 実装 |
| Step 3: index.html + LA 統合 | 2 時間 | 5 時間 | rtlscope-la の初期化 |
| Step 4: トリガー機能 | 1 時間 | 3 時間 | WASM ↔ JS メッセージ設計 |
| Step 5: MMU パネル（オプション） | 3 時間 | 8 時間 | mmu.v 内部信号アクセス |

楽観合計: **9 時間**（1〜2 日）  
悲観合計: **23 時間**（MMU パネルを含む場合）

---

## 9. 実装の優先順位

Phase 3 のコアは **Step 1〜4**。MMU パネル（Step 5）は Phase 4 に先送り可能。

### ファスト・パス（最小工数で価値最大化）

1. ring buffer を RING_WORDS=5 に拡張 → `harness.cpp` 更新 → ビルド確認
2. `sft-pdp11-la-defs.js` でバスアドレス・PC・モード・RK11 を定義
3. `rtlscope-la.js` を index.html に組み込んで信号トグルとズームを有効化
4. decode レーンで FETCH/MEM_RD/MEM_WR/IO/TRAP を色分け

ここまでで **Phase 3 の主要価値**（教育的な可視化）は達成できる。

---

## 10. 参考

- [Phase 2 詳細計画](./04-phase2-wasm詳細計画.md)
- `examples/06-8080/web/js/rtlscope-la.js` — 流用する LA ライブラリ
- `examples/06-8080/web/js/sft-8080-la-defs.js` — 信号定義の参考
- `vendor/cpus-pdp11/rtl/pdp11.v` — CPU マイクロステート定数
- `vendor/cpus-pdp11/rtl/mmu.v` — MMU PAR/PDR レジスタ
- [PDP-11 Architecture Handbook](https://bitsavers.org/pdf/dec/pdp11/handbooks/PDP11_Architecture_Handbook_1983.pdf)
