// sft-td4-la-defs.js — 10-td4 の Logic Analyzer 信号定義と、TD4 の命令表 (逆アセンブル・アセンブル)
//
// 素の <script src> で読み込む。js/rtlscope-la.js の前でも後でもよい（定義のみ）。
//
// ring buffer ビットレイアウト（1 サンプル = 2 word、examples/10-td4/cxx/harness.cpp）:
//   word0 [3:0] pc  [7:4] out  [11:8] a  [15:12] b  [23:16] op  [24] c  [25] rst  [29:26] in
//   word1 [1:0] sel  [2] load_a  [3] load_b  [4] load_out  [5] load_pc  [9:6] alu_out  [10] alu_carry
// 1 サンプルは「クロックの後の状態」と「その状態で次のクロックが何をするか」(sel・load・alu) を表す。
var TD4_RING_WORDS = 2;

// TD4 の 12 命令。上 4 ビット (オペコード) → 書き方。%I は即値 (4 ビットの 2 進)
var TD4_OPS = {
  0x0: 'ADD A,%I', 0x1: 'MOV A,B',  0x2: 'IN A',     0x3: 'MOV A,%I',
  0x4: 'MOV B,A',  0x5: 'ADD B,%I', 0x6: 'IN B',     0x7: 'MOV B,%I',
  0x9: 'OUT B',    0xB: 'OUT %I',   0xE: 'JNC %I',   0xF: 'JMP %I'
};

function td4Bin4(v) { return ('000' + (v & 15).toString(2)).slice(-4); }

// 1 バイトの命令を書き方に直す。即値を使わない命令で即値が 0 でなければ "+即値" を添える
function td4Disasm(code) {
  var op = (code >> 4) & 15, im = code & 15;
  var f = TD4_OPS[op];
  if (!f) return '?? ' + ('0' + (code & 255).toString(16).toUpperCase()).slice(-2);
  if (f.indexOf('%I') >= 0) return f.replace('%I', td4Bin4(im));
  return im ? f + ' +' + td4Bin4(im) : f;
}

var TD4_SEL_NAMES = ['A', 'B', 'IN', '0'];

var TD4_LA_SIGNALS = [
  { id:'pc',   label:'PC',   word:0, bit:0,  type:'hex', width:4, color:'#aa5500', on:true,
    name:{ ja:'プログラムカウンタ', en:'Program counter' },
    tip:{ ja:'プログラムカウンタ。次に実行する命令の番地です。ふつうはクロックごとに 1 増え、JMP と JNC で跳びます。', en:'Program counter: the address of the next instruction. It normally adds 1 each clock; JMP and JNC jump.' } },
  { id:'op',   label:'op',   word:0, bit:16, type:'hex', width:8, color:'#aa5500', on:true, fmt:'op',
    name:{ ja:'いまの命令', en:'Current instruction' },
    tip:{ ja:'ROM[PC] の命令。次のクロックで実行されます。', en:'The instruction at ROM[PC]. It executes on the next clock.' } },
  { id:'a',    label:'A',    word:0, bit:8,  type:'hex', width:4, color:'#228833', on:true,
    name:{ ja:'レジスタ A', en:'Register A' },
    tip:{ ja:'レジスタ A (4 ビット)。', en:'Register A (4 bits).' } },
  { id:'b',    label:'B',    word:0, bit:12, type:'hex', width:4, color:'#228833', on:true,
    name:{ ja:'レジスタ B', en:'Register B' },
    tip:{ ja:'レジスタ B (4 ビット)。', en:'Register B (4 bits).' } },
  { id:'out',  label:'OUT',  word:0, bit:4,  type:'hex', width:4, color:'#228833', on:true,
    name:{ ja:'出力ポート', en:'Output port' },
    tip:{ ja:'出力ポート (4 ビット)。画面の LED に出ます。', en:'Output port (4 bits), shown on the LEDs.' } },
  { id:'c',    label:'C',    word:0, bit:24, type:'bit', width:1, color:'#cc3333', on:true,
    name:{ ja:'キャリーフラグ', en:'Carry flag' },
    tip:{ ja:'キャリーフラグ (1 で桁上げあり)。毎クロック、加算器の桁上げで書き直されます。JNC はこれが 0 のときだけ跳びます。', en:'Carry flag (1 = carry). Rewritten from the adder carry every clock. JNC jumps only when it is 0.' } },
  { id:'in',   label:'IN',   word:0, bit:26, type:'hex', width:4, color:'#5566cc', on:true,
    name:{ ja:'入力ポート', en:'Input port' },
    tip:{ ja:'入力ポート (4 ビット)。画面のスイッチで替えられます。', en:'Input port (4 bits), set with the switches on the page.' } },
  { id:'sel',  label:'sel',  word:1, bit:0,  type:'hex', width:2, color:'#7744cc', on:true, fmt:'sel',
    name:{ ja:'セレクタの選択', en:'Selector input' },
    tip:{ ja:'データセレクタが加算器へ通す入力 (A・B・IN・0)。命令の上位ビットで決まります。', en:'The input the data selector passes to the adder (A, B, IN or 0), decided by the opcode.' } },
  { id:'alu',  label:'alu',  word:1, bit:6,  type:'hex', width:4, color:'#7744cc', on:true,
    name:{ ja:'加算器の出口', en:'Adder output' },
    tip:{ ja:'加算器の出口 (選んだ入力 + 即値)。次のクロックで、load が 1 のレジスタに書かれます。', en:'The adder output (selected input + immediate). On the next clock it is written to the register whose load is 1.' } },
  { id:'alu_c', label:'alu_c', word:1, bit:10, type:'bit', width:1, color:'#7744cc', on:false,
    name:{ ja:'加算器の桁上げ', en:'Adder carry' },
    tip:{ ja:'加算器の桁上げ。次のクロックでキャリーフラグ C になります。', en:'The adder carry. It becomes the carry flag C on the next clock.' } },
  { id:'ld_a',   label:'ld_a',   word:1, bit:2, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'A に書く', en:'Load A' },
    tip:{ ja:'1 なら次のクロックで A に加算器の出口を書きます。', en:'When 1, the next clock writes the adder output to A.' } },
  { id:'ld_b',   label:'ld_b',   word:1, bit:3, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'B に書く', en:'Load B' },
    tip:{ ja:'1 なら次のクロックで B に加算器の出口を書きます。', en:'When 1, the next clock writes the adder output to B.' } },
  { id:'ld_out', label:'ld_out', word:1, bit:4, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'OUT に書く', en:'Load OUT' },
    tip:{ ja:'1 なら次のクロックで OUT に加算器の出口を書きます。', en:'When 1, the next clock writes the adder output to OUT.' } },
  { id:'ld_pc',  label:'ld_pc',  word:1, bit:5, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'PC に書く (跳ぶ)', en:'Load PC (jump)' },
    tip:{ ja:'1 なら次のクロックで PC に加算器の出口を書きます (跳ぶ)。JMP は必ず、JNC は C が 0 のときだけ 1 です。', en:'When 1, the next clock writes the adder output to PC (a jump). Always 1 for JMP; for JNC only when C is 0.' } },
  { id:'rst',  label:'rst',  word:0, bit:25, type:'bit', width:1, color:'#cc3333', on:false,
    name:{ ja:'リセット入力', en:'Reset input' },
    tip:{ ja:'リセット入力。Reset ボタンで 2 クロック分だけ 1 になります。', en:'Reset input. The Reset button drives it to 1 for two clocks.' } },
];

var TD4_LA_GROUPS = [
  { label:'CPU',     color:'#aa5500', ids:['pc','op','a','b','out','c','in'] },
  { label:'Datapath', color:'#7744cc', ids:['sel','alu','alu_c'] },
  { label:'Load',    color:'#0077cc', ids:['ld_a','ld_b','ld_out','ld_pc'] },
  { label:'Control', color:'#cc3333', ids:['rst'] },
];

var TD4_LA_CONFIG = {
  canvasId:       'la',
  togglesId:      'la-toggles',
  signals:        TD4_LA_SIGNALS,
  groups:         TD4_LA_GROUPS,
  ringWords:      TD4_RING_WORDS,
  ringSize:       4096,
  storagePrefix:  'td4_la_',
  width:          1200,
  labelWidth:     72,
  trackH:         26,
  numberedLabels: false,
  decodeLane:     null,
  formatters: {
    op:  function (v) { return td4Disasm(v & 255); },
    sel: function (v) { return TD4_SEL_NAMES[v & 3]; }
  }
};
