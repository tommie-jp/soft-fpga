// sft-fsm-la-defs.js — 02-traffic-fsm の Logic Analyzer 信号定義
//
// ring buffer ビットレイアウト（1 サンプル = 1 word、examples/02-traffic-fsm/cxx/harness.cpp）:
//   [1:0] state  [2] green  [3] yellow  [4] red  [5] walk  [6] btn_req  [7] rst  [9] btn  [25:16] timer
var FSM_RING_WORDS = 1;
var FSM_STATE_NAMES = ['GREEN', 'YELLOW', 'RED', 'WALK'];

var FSM_LA_SIGNALS = [
  { id:'state',   label:'state',   word:0, bit:0,  type:'hex', width:2,  color:'#7744cc', on:true,  fmt:'state',
    name:{ ja:'FSM の状態', en:'FSM state' },
    tip:{ ja:'FSM の状態（0=GREEN 1=YELLOW 2=RED 3=WALK）。timer が 0 になるクロックで遷移します。', en:'FSM state (0=GREEN 1=YELLOW 2=RED 3=WALK). Transitions on the clock where timer reaches 0.' } },
  { id:'timer',   label:'timer',   word:0, bit:16, type:'hex', width:10, color:'#0088aa', on:true,  fmt:'dec',
    name:{ ja:'状態の残りクロック', en:'State timer (clocks left)' },
    tip:{ ja:'状態ごとの残りクロック数（10 ビット）。各状態の開始時に設定値 - 1 から 0 まで減ります。', en:'Clocks remaining in the current state (10 bits). At the start of each state it counts down from (configured value - 1) to 0.' } },
  { id:'green',   label:'green',   word:0, bit:2,  type:'bit', width:1,  color:'#00a844', on:true,
    name:{ ja:'青信号ランプ', en:'Green lamp' },
    tip:{ ja:'青信号ランプ。GREEN 状態の間 1 です。', en:'Green lamp. Is 1 while in the GREEN state.' } },
  { id:'yellow',  label:'yellow',  word:0, bit:3,  type:'bit', width:1,  color:'#b89600', on:true,
    name:{ ja:'黄信号ランプ', en:'Yellow lamp' },
    tip:{ ja:'黄信号ランプ。YELLOW 状態の間 1 です。', en:'Yellow lamp. Is 1 while in the YELLOW state.' } },
  { id:'red',     label:'red',     word:0, bit:4,  type:'bit', width:1,  color:'#d32f2f', on:true,
    name:{ ja:'赤信号ランプ', en:'Red lamp' },
    tip:{ ja:'赤信号ランプ。RED と WALK 状態の間 1 です。', en:'Red lamp. Is 1 while in the RED and WALK states.' } },
  { id:'walk',    label:'walk',    word:0, bit:5,  type:'bit', width:1,  color:'#0288d1', on:true,
    name:{ ja:'歩行者用ランプ', en:'Walk lamp' },
    tip:{ ja:'歩行者用ランプ。WALK 状態の間 1 です。', en:'Walk lamp. Is 1 while in the WALK state.' } },
  { id:'btn',     label:'btn',     word:0, bit:9,  type:'bit', width:1,  color:'#5566cc', on:true,
    name:{ ja:'歩行者ボタン入力', en:'Pedestrian button' },
    tip:{ ja:'歩行者ボタン入力。ボタンを押した 1 クロックだけ 1 になります。', en:'Pedestrian button input. Is 1 for one clock only when the button is pressed.' } },
  { id:'btn_req', label:'btn_req', word:0, bit:6,  type:'bit', width:1,  color:'#cc7700', on:true,
    name:{ ja:'歩行者ボタンの要求', en:'Pedestrian request latch' },
    tip:{ ja:'歩行者ボタンの要求ラッチ。btn で 1 になり、YELLOW から WALK へ進んだあとクリアされます。', en:'Pedestrian request latch. Set to 1 by btn and cleared after the FSM advances from YELLOW to WALK.' } },
  { id:'rst',     label:'rst',     word:0, bit:7,  type:'bit', width:1,  color:'#cc3333', on:false,
    name:{ ja:'リセット入力', en:'Reset input' },
    tip:{ ja:'リセット入力。Reset ボタンで 2 クロック分だけ 1 になります。', en:'Reset input. The Reset button drives it to 1 for two clocks.' } },
];

var FSM_LA_GROUPS = [
  { label:'FSM',    color:'#7744cc', ids:['state','timer'] },
  { label:'Lamps',  color:'#00a844', ids:['green','yellow','red','walk'] },
  { label:'Input',  color:'#cc7700', ids:['btn','btn_req','rst'] },
];

var FSM_LA_CONFIG = {
  canvasId:       'la',
  togglesId:      'la-toggles',
  signals:        FSM_LA_SIGNALS,
  groups:         FSM_LA_GROUPS,
  ringWords:      FSM_RING_WORDS,
  ringSize:       4096,
  storagePrefix:  'fsm_la_',
  width:          1200,
  labelWidth:     72,
  trackH:         26,
  numberedLabels: false,
  decodeLane:     null,
  formatters: {
    state: function (v) { return FSM_STATE_NAMES[v & 3] || String(v); }
  },
  // 状態ごとにレーン背景を薄く色分けし、遷移が一目でわかるようにする
  signalBackground: function (sig, val) {
    if (sig.id !== 'state') return null;
    return ['rgba(0,200,83,0.15)', 'rgba(255,214,0,0.20)', 'rgba(255,23,68,0.13)', 'rgba(0,176,255,0.15)'][val & 3];
  }
};
