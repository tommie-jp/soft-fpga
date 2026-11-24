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
    tip: { ja: 'snd_kind == 1。球がラケットに当たった次の画面で止まる。', en: 'snd_kind == 1. Stops on the frame after the ball hits a paddle.' } },
  { label: '壁・点の音', sig: 'snd_kind', mode: 'eq', value: '2', post: 3, la: 1,
    tip: { ja: 'snd_kind == 2。上下の壁で返したか、点が入った次の画面で止まる (この 2 つは同じ音)。', en: 'snd_kind == 2. Stops on the frame after the ball bounces off the top or bottom wall, or a point is scored (both make the same sound).' } },
  { label: '左のラケットで返した', sig: 'hit_l', mode: 'rise', post: 3, la: 1,
    tip: { ja: 'hit_l の立ち上がり。', en: 'Rising edge of hit_l.' } },
  { label: '右が点を取った (球が左の端を越えた)', sig: 'out_l', mode: 'rise', post: 5, la: 1,
    tip: { ja: 'out_l の立ち上がり。打ち直しの動きまで記録する。', en: 'Rising edge of out_l. Records through the re-serve movement.' } },
  { label: '左の点が 9 になった', sig: 'sl', mode: 'eq', value: '9', post: 0, la: 1,
    tip: { ja: 'sl == 9。左の点が 9 になった画面で止まる。', en: 'sl == 9. Stops on the frame where the left score reaches 9.' } },
  { label: '音の矩形波 (1 クロックごと)', sig: 'sound', mode: 'rise', post: 2000, la: 0,
    tip: { ja: 'sound の立ち上がり。記録を 1 クロックごとに切り替え、矩形波そのものを見る。', en: 'Rising edge of sound. Switches recording to per-clock so the square wave itself is visible.' } },
  { label: '画面の最初 (1 クロックごと)', sig: 'frame_end', mode: 'rise', post: 2000, la: 0,
    tip: { ja: 'frame_end の立ち上がり。画面の最後の画素から、次の画面の最初の行を見る。', en: 'Rising edge of frame_end. Shows the span from the last pixel of the frame to the first line of the next frame.' } },
];

var PONG_LA_SIGNALS = [
  // ---- 球 ----
  { id:'bx', label:'bx', word:0, bit:0, type:'hex', width:8, color:'#cc5500', on:true, fmt:'dec',
    name:{ ja:'球の横位置 (左端)', en:'Ball X (left edge)' },
    tip:{ ja: '球の左端の横位置 (0〜159)。1 画面に 2 画素ずつ動く。左右の壁 (ラケット) で向きが替わる。', en: 'Horizontal position of the left edge of the ball (0-159). Moves 2 pixels per frame. Reverses direction at the left and right walls (paddles).' } },
  { id:'by', label:'by', word:0, bit:8, type:'hex', width:7, color:'#cc5500', on:true, fmt:'dec',
    name:{ ja:'球の縦位置 (上端)', en:'Ball Y (top edge)' },
    tip:{ ja: '球の上端の縦位置 (0〜119)。1 画面に 1 か 2 画素 (fast のとき 2) ずつ動き、上下の壁 (2 と 115) で向きが替わる。', en: 'Vertical position of the top edge of the ball (0-119). Moves 1 or 2 pixels per frame (2 when fast). Reverses direction at the top and bottom walls (2 and 115).' } },
  { id:'left', label:'left', word:0, bit:29, type:'bit', width:1, color:'#cc5500', on:true,
    name:{ ja:'球は左へ向かう', en:'Ball moving left' },
    tip:{ ja: '球は左へ動いている (1)・右へ (0)。ラケットに当たると反転する。', en: 'Ball is moving left (1) or right (0). Flips when it hits a paddle.' } },
  { id:'up', label:'up', word:0, bit:30, type:'bit', width:1, color:'#cc5500', on:false,
    name:{ ja:'球は上へ向かう', en:'Ball moving up' },
    tip:{ ja: '球は上へ動いている (1)・下へ (0)。上下の壁に当たると反転する。', en: 'Ball is moving up (1) or down (0). Flips when it hits the top or bottom wall.' } },
  { id:'fast', label:'fast', word:0, bit:31, type:'bit', width:1, color:'#cc5500', on:false,
    name:{ ja:'球の縦が速い', en:'Ball fast vertical' },
    tip:{ ja: '球が縦に 2 画素ずつ動く (1)。ラケットの端の 4 画素で返したときに 1 になる。', en: 'Ball moves 2 pixels per frame vertically (1). Set to 1 when the ball is returned by the 4 pixels at the end of the paddle.' } },
  // ---- ラケット ----
  { id:'pl', label:'pl', word:0, bit:15, type:'hex', width:7, color:'#2e8b3e', on:true, fmt:'dec',
    name:{ ja:'左ラケットの上端', en:'Left paddle top' },
    tip:{ ja: '左のラケットの上端 (縦位置)。長さ 16 画素。ボタンを押している間 1 画面に 2 画素、AUTO では 1 画素ずつ動く。', en: 'Top edge (vertical position) of the left paddle. 16 pixels long. Moves 2 pixels per frame while the button is held, and 1 pixel per frame in AUTO.' } },
  { id:'pr', label:'pr', word:0, bit:22, type:'hex', width:7, color:'#2e8b3e', on:true, fmt:'dec',
    name:{ ja:'右ラケットの上端', en:'Right paddle top' },
    tip:{ ja: '右のラケットの上端 (縦位置)。', en: 'Top edge (vertical position) of the right paddle.' } },
  // ---- 点 ----
  { id:'sl', label:'sl', word:1, bit:0, type:'hex', width:4, color:'#b89600', on:true, fmt:'dec',
    name:{ ja:'左の点', en:'Left score' },
    tip:{ ja: '左の点 (0〜9)。球が右の端を越えたときに 1 増える。9 の次は 0。', en: 'Left score (0-9). Increments by 1 when the ball passes the right edge. Wraps from 9 to 0.' } },
  { id:'sr', label:'sr', word:1, bit:4, type:'hex', width:4, color:'#b89600', on:true, fmt:'dec',
    name:{ ja:'右の点', en:'Right score' },
    tip:{ ja: '右の点 (0〜9)。球が左の端を越えたときに 1 増える。', en: 'Right score (0-9). Increments by 1 when the ball passes the left edge.' } },
  // ---- 出来事 ----
  { id:'hit_l', label:'hit_l', word:1, bit:8, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'左ラケットで返した', en:'Left paddle hit' },
    tip:{ ja: '球が左のラケットに当たった。この画面の最後で球の向きが右へ替わる。', en: 'The ball hit the left paddle. At the end of this frame the ball direction changes to the right.' } },
  { id:'hit_r', label:'hit_r', word:1, bit:9, type:'bit', width:1, color:'#0077cc', on:true,
    name:{ ja:'右ラケットで返した', en:'Right paddle hit' },
    tip:{ ja: '球が右のラケットに当たった。', en: 'The ball hit the right paddle.' } },
  { id:'out_l', label:'out_l', word:1, bit:10, type:'bit', width:1, color:'#cc3333', on:true,
    name:{ ja:'球が左の端を越えた', en:'Ball out on left' },
    tip:{ ja: '球が左の端を越えた。右の点 (sr) が 1 増え、球は真ん中から打ち直される。', en: 'The ball passed the left edge. The right score (sr) increments by 1 and the ball is re-served from the center.' } },
  { id:'out_r', label:'out_r', word:1, bit:11, type:'bit', width:1, color:'#cc3333', on:true,
    name:{ ja:'球が右の端を越えた', en:'Ball out on right' },
    tip:{ ja: '球が右の端を越えた。左の点 (sl) が 1 増える。', en: 'The ball passed the right edge. The left score (sl) increments by 1.' } },
  // ---- 音 ----
  { id:'snd_kind', label:'snd_kind', word:1, bit:21, type:'hex', width:2, color:'#aa3377', on:true, fmt:'dec',
    name:{ ja:'鳴らす音の種類', en:'Sound kind' },
    tip:{ ja: 'いま鳴らす音 (次の画面から鳴る)。0 = 無音、1 = ヒット (v[3]、450 Hz)、2 = 壁で返した・点が入った (v[4]、225 Hz)。ヒットと壁は 1 画面、点は 16 画面。', en: 'Sound being played now (starts from the next frame). 0 = silent, 1 = hit (v[3], 450 Hz), 2 = wall bounce or point scored (v[4], 225 Hz). A hit or wall sound lasts 1 frame; a point sound lasts 16 frames.' } },
  { id:'sound', label:'sound', word:1, bit:20, type:'bit', width:1, color:'#aa3377', on:false,
    name:{ ja:'スピーカー出力 (矩形波)', en:'Speaker output (square wave)' },
    tip:{ ja: 'スピーカーへ出る矩形波。鳴らす間だけ、垂直カウンタの 1 ビット (ヒットは v[3]、壁と点は v[4]) がそのまま出る。1 クロックごとのモードで見える。', en: 'Square wave sent to the speaker. Only while a sound plays, one bit of the vertical counter (v[3] for a hit, v[4] for a wall or point) is output as is. Visible in per-clock mode.' } },
  // ---- 入力 ----
  { id:'up_l', label:'up_l', word:1, bit:12, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'左ラケット 上ボタン', en:'Left paddle up button' },
    tip:{ ja: '左のラケットを上へ (W キー)。押している間 1。', en: 'Move the left paddle up (W key). 1 while held.' } },
  { id:'dn_l', label:'dn_l', word:1, bit:13, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'左ラケット 下ボタン', en:'Left paddle down button' },
    tip:{ ja: '左のラケットを下へ (S キー)。', en: 'Move the left paddle down (S key).' } },
  { id:'up_r', label:'up_r', word:1, bit:14, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'右ラケット 上ボタン', en:'Right paddle up button' },
    tip:{ ja: '右のラケットを上へ (↑ キー)。', en: 'Move the right paddle up (↑ key).' } },
  { id:'dn_r', label:'dn_r', word:1, bit:15, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'右ラケット 下ボタン', en:'Right paddle down button' },
    tip:{ ja: '右のラケットを下へ (↓ キー)。', en: 'Move the right paddle down (↓ key).' } },
  { id:'auto_l', label:'auto_l', word:1, bit:16, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'左ラケット AUTO', en:'Left paddle AUTO' },
    tip:{ ja: '左のラケットが球を追う (AUTO)。', en: 'The left paddle tracks the ball (AUTO).' } },
  { id:'auto_r', label:'auto_r', word:1, bit:17, type:'bit', width:1, color:'#5566cc', on:false,
    name:{ ja:'右ラケット AUTO', en:'Right paddle AUTO' },
    tip:{ ja: '右のラケットが球を追う (AUTO)。', en: 'The right paddle tracks the ball (AUTO).' } },
  // ---- 走査 (1 クロックごとのモードで見る) ----
  { id:'h', label:'h', word:2, bit:0, type:'hex', width:8, color:'#7744cc', on:false, fmt:'dec',
    name:{ ja:'画素の横位置', en:'Pixel X (horizontal count)' },
    tip:{ ja: 'いま出している画素の横 (0〜159)。1 クロックに 1 ずつ増え、159 の次は 0 に戻る。', en: 'Horizontal position of the pixel currently being output (0-159). Increments by 1 per clock and wraps to 0 after 159.' } },
  { id:'v', label:'v', word:2, bit:8, type:'hex', width:7, color:'#7744cc', on:false, fmt:'dec',
    name:{ ja:'画素の縦位置', en:'Pixel Y (vertical count)' },
    tip:{ ja: 'いま出している画素の縦 (0〜119)。h が 159 から 0 に戻るときに 1 増える。', en: 'Vertical position of the pixel currently being output (0-119). Increments by 1 when h wraps from 159 to 0.' } },
  { id:'pixel', label:'pixel', word:2, bit:15, type:'bit', width:1, color:'#222222', on:false,
    name:{ ja:'画素 (白=1)', en:'Pixel (white = 1)' },
    tip:{ ja: 'この画素が白 (1)。壁・ネット・ラケット・球・点のどれかの形に (h, v) が入ったとき 1。', en: 'This pixel is white (1). Set to 1 when (h, v) falls inside the shape of the wall, net, paddle, ball, or score digits.' } },
  { id:'line_end', label:'line_end', word:1, bit:19, type:'bit', width:1, color:'#7744cc', on:false,
    name:{ ja:'行の最後の画素', en:'End of line' },
    tip:{ ja: '行の最後の画素 (h = 159) で 1。', en: 'Set to 1 on the last pixel of a line (h = 159).' } },
  { id:'frame_end', label:'frame_end', word:1, bit:18, type:'bit', width:1, color:'#7744cc', on:false,
    name:{ ja:'画面の最後の画素', en:'End of frame' },
    tip:{ ja: '画面の最後の画素 (h = 159、v = 119) で 1。このクロックの立ち上がりで、球とラケットと点が 1 回動く。', en: 'Set to 1 on the last pixel of the frame (h = 159, v = 119). On the rising edge of this clock, the ball, paddles, and score each update once.' } },
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
