// sft-pong-la-defs.js — 91-pong の Logic Analyzer 信号定義
//
// 素の <script src> で読み込む。js/rtlscope-la.js の前でも後でもよい（定義のみ）。
//
// ring buffer ビットレイアウト（1 サンプル = 3 word、examples/91-pong/cxx/harness.cpp）:
//   word 0: [7:0] bx  [14:8] by  [21:15] pl  [28:22] pr  [29] left  [30] up  [31] fast
//   word 1: [3:0] sl  [7:4] sr  [8] hit_l [9] hit_r [10] out_l [11] out_r
//           [12] up_l [13] dn_l [14] up_r [15] dn_r [16] auto_l [17] auto_r [18] frame_end [19] line_end
//           [20] sound  [22:21] snd_kind (0 無音・1 ヒット・2 壁と点)
//   word 2: [7:0] h  [14:8] v  [15] pixel
var PONG_RING_WORDS = 3;

// トリガーのプリセット (Trigger の「プリセット」から選ぶと、下の欄に入る。Set は自分で押す)
//   la: そのプリセットが意味を持つ記録のしかた (1 = 1 画面ごと、0 = 1 クロックごと)。選ぶとページがそれに切り替える
var PONG_TRIGGER_PRESETS = [
  { label: 'ヒット (ラケットで返した音)', sig: 'snd_kind', mode: 'eq', value: '1', post: 3, la: 1,
    tip: 'snd_kind == 1。球がラケットに当たった次の画面で止まる。' },
  { label: '壁・点の音', sig: 'snd_kind', mode: 'eq', value: '2', post: 3, la: 1,
    tip: 'snd_kind == 2。上下の壁で返したか、点が入った次の画面で止まる (この 2 つは同じ音)。' },
  { label: '左のラケットで返した', sig: 'hit_l', mode: 'rise', post: 3, la: 1,
    tip: 'hit_l の立ち上がり。' },
  { label: '右が点を取った (球が左の端を越えた)', sig: 'out_l', mode: 'rise', post: 5, la: 1,
    tip: 'out_l の立ち上がり。打ち直しの動きまで記録する。' },
  { label: '左の点が 9 になった', sig: 'sl', mode: 'eq', value: '9', post: 0, la: 1,
    tip: 'sl == 9。左の点が 9 になった画面で止まる。' },
  { label: '音の矩形波 (1 クロックごと)', sig: 'sound', mode: 'rise', post: 2000, la: 0,
    tip: 'sound の立ち上がり。記録を 1 クロックごとに切り替え、矩形波そのものを見る。' },
  { label: '画面の最初 (1 クロックごと)', sig: 'frame_end', mode: 'rise', post: 2000, la: 0,
    tip: 'frame_end の立ち上がり。画面の最後の画素から、次の画面の最初の行を見る。' },
];

var PONG_LA_SIGNALS = [
  // ---- 球 ----
  { id:'bx', label:'bx', word:0, bit:0, type:'hex', width:8, color:'#cc5500', on:true, fmt:'dec',
    name:{ ja:'球の横位置 (左端)', en:'Ball X (left edge)' },
    tip:'球の左端の横位置 (0〜159)。1 画面に 2 画素ずつ動く。左右の壁 (ラケット) で向きが替わる。' },
  { id:'by', label:'by', word:0, bit:8, type:'hex', width:7, color:'#cc5500', on:true, fmt:'dec',
    name:{ ja:'球の縦位置 (上端)', en:'Ball Y (top edge)' },
    tip:'球の上端の縦位置 (0〜119)。1 画面に 1 か 2 画素 (fast のとき 2) ずつ動き、上下の壁 (2 と 115) で向きが替わる。' },
  { id:'left', label:'left', word:0, bit:29, type:'bit', width:1, color:'#cc5500', on:true,
    name:{ ja:'球は左へ向かう', en:'Ball moving left' },
    tip:'球は左へ動いている (1)・右へ (0)。ラケットに当たると反転する。' },
  { id:'up', label:'up', word:0, bit:30, type:'bit', width:1, color:'#cc5500', on:false,
    name:{ ja:'球は上へ向かう', en:'Ball moving up' },
    tip:'球は上へ動いている (1)・下へ (0)。上下の壁に当たると反転する。' },
  { id:'fast', label:'fast', word:0, bit:31, type:'bit', width:1, color:'#cc5500', on:false,
    name:{ ja:'球の縦が速い', en:'Ball fast vertical' },
    tip:'球が縦に 2 画素ずつ動く (1)。ラケットの端の 4 画素で返したときに 1 になる。' },
  // ---- ラケット ----
  { id:'pl', label:'pl', word:0, bit:15, type:'hex', width:7, color:'#2e8b3e', on:true, fmt:'dec',
    name:{ ja:'左ラケットの上端', en:'Left paddle top' },
    tip:'左のラケットの上端 (縦位置)。長さ 16 画素。ボタンを押している間 1 画面に 2 画素、AUTO では 1 画素ずつ動く。' },
  { id:'pr', label:'pr', word:0, bit:22, type:'hex', width:7, color:'#2e8b3e', on:true, fmt:'dec',
    name:{ ja:'右ラケットの上端', en:'Right paddle top' },
    tip:'右のラケットの上端 (縦位置)。' },
  // ---- 点 ----
  { id:'sl', label:'sl', word:1, bit:0, type:'hex', width:4, color:'#b89600', on:true, fmt:'dec',
    name:{ ja:'左の点', en:'Left score' },
    tip:'左の点 (0〜9)。球が右の端を越えたときに 1 増える。9 の次は 0。' },
  { id:'sr', label:'sr', word:1, bit:4, type:'hex', width:4, color:'#b89600', on:true, fmt:'dec',
    name:{ ja:'右の点', en:'Right score' },
    tip:'右の点 (0〜9)。球が左の端を越えたときに 1 増える。' },
  // ---- 出来事 ----
  { id:'hit_l', label:'hit_l', word:1, bit:8, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'左ラケットで返した', en:'Left paddle hit' },
    tip:'球が左のラケットに当たった。この画面の最後で球の向きが右へ替わる。' },
  { id:'hit_r', label:'hit_r', word:1, bit:9, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'右ラケットで返した', en:'Right paddle hit' },
    tip:'球が右のラケットに当たった。' },
  { id:'out_l', label:'out_l', word:1, bit:10, type:'bit', width:1, color:'#cc3333', on:true,
    name:{ ja:'球が左の端を越えた', en:'Ball out on left' },
    tip:'球が左の端を越えた。右の点 (sr) が 1 増え、球は真ん中から打ち直される。' },
  { id:'out_r', label:'out_r', word:1, bit:11, type:'bit', width:1, color:'#cc3333', on:true,
    name:{ ja:'球が右の端を越えた', en:'Ball out on right' },
    tip:'球が右の端を越えた。左の点 (sl) が 1 増える。' },
  // ---- 音 ----
  { id:'snd_kind', label:'snd_kind', word:1, bit:21, type:'hex', width:2, color:'#aa3377', on:true, fmt:'dec',
    name:{ ja:'鳴らす音の種類', en:'Sound kind' },
    tip:'いま鳴らす音 (次の画面から鳴る)。0 = 無音、1 = ヒット (v[3]、450 Hz)、2 = 壁で返した・点が入った (v[4]、225 Hz)。ヒットと壁は 1 画面、点は 16 画面。' },
  { id:'sound', label:'sound', word:1, bit:20, type:'bit', width:1, color:'#aa3377', on:false,
    name:{ ja:'スピーカー出力 (矩形波)', en:'Speaker output (square wave)' },
    tip:'スピーカーへ出る矩形波。鳴らす間だけ、垂直カウンタの 1 ビット (ヒットは v[3]、壁と点は v[4]) がそのまま出る。1 クロックごとのモードで見える。' },
  // ---- 入力 ----
  { id:'up_l', label:'up_l', word:1, bit:12, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'左ラケット 上ボタン', en:'Left paddle up button' },
    tip:'左のラケットを上へ (W キー)。押している間 1。' },
  { id:'dn_l', label:'dn_l', word:1, bit:13, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'左ラケット 下ボタン', en:'Left paddle down button' },
    tip:'左のラケットを下へ (S キー)。' },
  { id:'up_r', label:'up_r', word:1, bit:14, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'右ラケット 上ボタン', en:'Right paddle up button' },
    tip:'右のラケットを上へ (↑ キー)。' },
  { id:'dn_r', label:'dn_r', word:1, bit:15, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'右ラケット 下ボタン', en:'Right paddle down button' },
    tip:'右のラケットを下へ (↓ キー)。' },
  { id:'auto_l', label:'auto_l', word:1, bit:16, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'左ラケット AUTO', en:'Left paddle AUTO' },
    tip:'左のラケットが球を追う (AUTO)。' },
  { id:'auto_r', label:'auto_r', word:1, bit:17, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'右ラケット AUTO', en:'Right paddle AUTO' },
    tip:'右のラケットが球を追う (AUTO)。' },
  // ---- 走査 (1 クロックごとのモードで見る) ----
  { id:'h', label:'h', word:2, bit:0, type:'hex', width:8, color:'#7744cc', on:false, fmt:'dec',
    name:{ ja:'画素の横位置', en:'Pixel X (horizontal count)' },
    tip:'いま出している画素の横 (0〜159)。1 クロックに 1 ずつ増え、159 の次は 0 に戻る。' },
  { id:'v', label:'v', word:2, bit:8, type:'hex', width:7, color:'#7744cc', on:false, fmt:'dec',
    name:{ ja:'画素の縦位置', en:'Pixel Y (vertical count)' },
    tip:'いま出している画素の縦 (0〜119)。h が 159 から 0 に戻るときに 1 増える。' },
  { id:'pixel', label:'pixel', word:2, bit:15, type:'bit', width:1, color:'#222222', on:false,
    name:{ ja:'画素 (白=1)', en:'Pixel (white = 1)' },
    tip:'この画素が白 (1)。壁・ネット・ラケット・球・点のどれかの形に (h, v) が入ったとき 1。' },
  { id:'line_end', label:'line_end', word:1, bit:19, type:'bit', width:1, color:'#7744cc', on:false,
    name:{ ja:'行の最後の画素', en:'End of line' },
    tip:'行の最後の画素 (h = 159) で 1。' },
  { id:'frame_end', label:'frame_end', word:1, bit:18, type:'bit', width:1, color:'#7744cc', on:false,
    name:{ ja:'画面の最後の画素', en:'End of frame' },
    tip:'画面の最後の画素 (h = 159、v = 119) で 1。このクロックの立ち上がりで、球とラケットと点が 1 回動く。' },
];

var PONG_LA_GROUPS = [
  { label:'Ball',   color:'#cc5500', ids:['bx','by','left','up','fast'] },
  { label:'Paddle', color:'#2e8b3e', ids:['pl','pr'] },
  { label:'Score',  color:'#b89600', ids:['sl','sr'] },
  { label:'Event',  color:'#0077cc', ids:['hit_l','hit_r','out_l','out_r'] },
  { label:'Sound',  color:'#aa3377', ids:['snd_kind','sound'] },
  { label:'Input',  color:'#5566cc', ids:['up_l','dn_l','up_r','dn_r','auto_l','auto_r'] },
  { label:'Scan',   color:'#7744cc', ids:['h','v','pixel','line_end','frame_end'] },
];

// 記録のしかた (set_la_mode) ごとに最初に出す信号。切り替えると、この組に表示を揃える。
var PONG_LA_MODES = {
  1: { label: '1 画面ごと (球・ラケット・点の動き)',
       on: ['bx','by','left','pl','pr','sl','sr','hit_l','hit_r','out_l','out_r','snd_kind'] },
  0: { label: '1 クロックごと (走査線: h・v・pixel)',
       on: ['h','v','pixel','line_end','frame_end','sound'] },
};

var PONG_LA_CONFIG = {
  canvasId:       'la',
  togglesId:      'la-toggles',
  signals:        PONG_LA_SIGNALS,
  groups:         PONG_LA_GROUPS,
  ringWords:      PONG_RING_WORDS,
  ringSize:       4096,        // harness.cpp の Ring<4096, 3> と一致させる（起動時に上書き）
  storagePrefix:  'pong_la_',
  width:          1200,
  labelWidth:     72,
  trackH:         26,
  numberedLabels: false,
  decodeLane:     null,
  formatters: {},            // snd_kind は名前にせず、値 (0・1・2) をそのまま出す
};
