// sft-counter-la-defs.js — 01-counter の Logic Analyzer 信号定義
//
// 素の <script src> で読み込む。js/rtlscope-la.js の前でも後でもよい（定義のみ）。
//
// ring buffer ビットレイアウト（1 サンプル = 1 word、examples/01-counter/cxx/harness.cpp）:
//   [ 7: 0] count   [ 8] rst
var COUNTER_RING_WORDS = 1;

var COUNTER_LA_SIGNALS = [
  { id:'count',     label:'count',  word:0, bit:0, type:'hex', width:8, color:'#0077cc', on:true,
    name:{ ja:'カウンタ出力 (16 進)', en:'Counter output (hex)' },
    tip:{ ja:'カウンタ出力（8 ビット、16 進表示）。クロックの立ち上がりごとに 1 ずつ増え、0xFF の次は 0x00 に戻ります。', en:'Counter output (8 bits, shown in hex). Increments by 1 on every rising clock edge and wraps from 0xFF back to 0x00.' } },
  { id:'count_dec', label:'count10', word:0, bit:0, type:'hex', width:8, color:'#0099aa', on:false, fmt:'dec',
    name:{ ja:'カウンタ出力 (10 進)', en:'Counter output (decimal)' },
    tip:{ ja:'カウンタ出力の 10 進表示。count と同じビット [7:0] を 10 進で見ます。', en:'Counter output in decimal. Shows the same bits [7:0] as count, in decimal.' } },
  { id:'rst',       label:'rst',    word:0, bit:8, type:'bit', width:1, color:'#cc3333', on:true,
    name:{ ja:'リセット入力', en:'Reset input' },
    tip:{ ja:'リセット入力。1 の間 count は 0 に固定されます（非同期リセット）。Reset ボタンで 2 クロック分だけ 1 になります。', en:'Reset input. While it is 1, count is held at 0 (asynchronous reset). The Reset button drives it to 1 for two clocks.' } },
  { id:'b7', label:'b7', word:0, bit:7, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 7', en:'count bit 7' },
    tip:{ ja:'count[7]（最上位ビット）。周期は 256 クロック。b0 の 1/128 の速さで変化します。', en:'count[7] (MSB). Period is 256 clocks. Toggles at 1/128 the rate of b0.' } },
  { id:'b6', label:'b6', word:0, bit:6, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 6', en:'count bit 6' },
    tip:{ ja:'count[6]。周期は 128 クロック。', en:'count[6]. Period is 128 clocks.' } },
  { id:'b5', label:'b5', word:0, bit:5, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 5', en:'count bit 5' },
    tip:{ ja:'count[5]。周期は 64 クロック。', en:'count[5]. Period is 64 clocks.' } },
  { id:'b4', label:'b4', word:0, bit:4, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 4', en:'count bit 4' },
    tip:{ ja:'count[4]。周期は 32 クロック。', en:'count[4]. Period is 32 clocks.' } },
  { id:'b3', label:'b3', word:0, bit:3, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 3', en:'count bit 3' },
    tip:{ ja:'count[3]。周期は 16 クロック。', en:'count[3]. Period is 16 clocks.' } },
  { id:'b2', label:'b2', word:0, bit:2, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 2', en:'count bit 2' },
    tip:{ ja:'count[2]。周期は 8 クロック。', en:'count[2]. Period is 8 clocks.' } },
  { id:'b1', label:'b1', word:0, bit:1, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 1', en:'count bit 1' },
    tip:{ ja:'count[1]。周期は 4 クロック。', en:'count[1]. Period is 4 clocks.' } },
  { id:'b0', label:'b0', word:0, bit:0, type:'bit', width:1, color:'#7722aa', on:true,
    name:{ ja:'count のビット 0', en:'count bit 0' },
    tip:{ ja:'count[0]（最下位ビット）。毎クロック反転します（周期 2 クロック）。', en:'count[0] (LSB). Toggles every clock (period is 2 clocks).' } },
];

var COUNTER_LA_GROUPS = [
  { label:'Count',   color:'#0066bb', ids:['count','count_dec'] },
  { label:'Control', color:'#bb3333', ids:['rst'] },
  { label:'Bits',    color:'#7722aa', ids:['b7','b6','b5','b4','b3','b2','b1','b0'] },
];

// RTLScopeLA コンストラクタに渡す設定。
var COUNTER_LA_CONFIG = {
  canvasId:       'la',
  togglesId:      'la-toggles',
  signals:        COUNTER_LA_SIGNALS,
  groups:         COUNTER_LA_GROUPS,
  ringWords:      COUNTER_RING_WORDS,
  ringSize:       4096,        // harness.cpp の RING_SIZE と一致させる（起動時に上書き）
  storagePrefix:  'counter_la_',
  width:          1200,
  labelWidth:     72,
  trackH:         26,
  numberedLabels: false,
  decodeLane:     null,        // マシンサイクル等のデコードは持たない
};
