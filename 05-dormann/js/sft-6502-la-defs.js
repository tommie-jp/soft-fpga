// sft-6502-la-defs.js — 04-6502 / 05-dormann 共通の Logic Analyzer 信号定義と命令デコードレーン
//
// ring buffer ビットレイアウト（1 サンプル = 2 word。両 example のハーネスで共通）:
//   word0: [15:0] AB  [23:16] DB  [24] WE  [25] SYNC  [26] reset
//   word1: [7:0] A  [15:8] X  [23:16] Y  [31:24] SP
//
// SYNC=1 のサンプルでは DB がフェッチしたオペコードになる（DI は次の posedge で IR に取り込まれる）。
var M6502_RING_WORDS = 2;

// 公式 151 命令のニーモニック。未定義オペコードは '???'。
var M6502_MNEMONICS = (
  'BRK ORA ??? ??? ??? ORA ASL ??? PHP ORA ASL ??? ??? ORA ASL ??? ' +
  'BPL ORA ??? ??? ??? ORA ASL ??? CLC ORA ??? ??? ??? ORA ASL ??? ' +
  'JSR AND ??? ??? BIT AND ROL ??? PLP AND ROL ??? BIT AND ROL ??? ' +
  'BMI AND ??? ??? ??? AND ROL ??? SEC AND ??? ??? ??? AND ROL ??? ' +
  'RTI EOR ??? ??? ??? EOR LSR ??? PHA EOR LSR ??? JMP EOR LSR ??? ' +
  'BVC EOR ??? ??? ??? EOR LSR ??? CLI EOR ??? ??? ??? EOR LSR ??? ' +
  'RTS ADC ??? ??? ??? ADC ROR ??? PLA ADC ROR ??? JMP ADC ROR ??? ' +
  'BVS ADC ??? ??? ??? ADC ROR ??? SEI ADC ??? ??? ??? ADC ROR ??? ' +
  '??? STA ??? ??? STY STA STX ??? DEY ??? TXA ??? STY STA STX ??? ' +
  'BCC STA ??? ??? STY STA STX ??? TYA STA TXS ??? ??? STA ??? ??? ' +
  'LDY LDA LDX ??? LDY LDA LDX ??? TAY LDA TAX ??? LDY LDA LDX ??? ' +
  'BCS LDA ??? ??? LDY LDA LDX ??? CLV LDA TSX ??? LDY LDA LDX ??? ' +
  'CPY CMP ??? ??? CPY CMP DEC ??? INY CMP DEX ??? CPY CMP DEC ??? ' +
  'BNE CMP ??? ??? ??? CMP DEC ??? CLD CMP ??? ??? ??? CMP DEC ??? ' +
  'CPX SBC ??? ??? CPX SBC INC ??? INX SBC NOP ??? CPX SBC INC ??? ' +
  'BEQ SBC ??? ??? ??? SBC INC ??? SED SBC ??? ??? ??? SBC INC ???'
).split(' ');

var M6502_LA_SIGNALS = [
  { id:'addr',  label:'addr',  word:0, bit:0,  type:'hex', width:16, color:'#2266cc', on:true,
    tip:'アドレスバス（16 ビット）。命令フェッチ時は PC、データアクセス時は参照先アドレスです。背景色はメモリ領域（ゼロページ・スタック・PIA・ROM）を表します。' },
  { id:'data',  label:'data',  word:0, bit:16, type:'hex', width:8,  color:'#1f9d3a', on:true,
    tip:'データバス（8 ビット）。WE=1 なら CPU が書く値、WE=0 なら CPU が読む値です。SYNC=1 のときはフェッチしたオペコードです。' },
  { id:'we',    label:'we',    word:0, bit:24, type:'bit', width:1,  color:'#cc4444', on:true,
    tip:'書き込みストローブ。1 のクロックで CPU がメモリへ書き込みます。' },
  { id:'sync',  label:'sync',  word:0, bit:25, type:'bit', width:1,  color:'#cc7700', on:true,
    tip:'命令フェッチの先頭サイクルを示します。SYNC の立ち上がりで 1 命令が始まり、data がオペコードになります。' },
  { id:'reset', label:'reset', word:0, bit:26, type:'bit', width:1,  color:'#aa2222', on:false,
    tip:'リセット入力。リセット中は 1 です。' },
  { id:'a',     label:'A',     word:1, bit:0,  type:'hex', width:8,  color:'#aa4400', on:false,
    tip:'アキュムレータ A。' },
  { id:'x',     label:'X',     word:1, bit:8,  type:'hex', width:8,  color:'#006688', on:false,
    tip:'インデックスレジスタ X。' },
  { id:'y',     label:'Y',     word:1, bit:16, type:'hex', width:8,  color:'#7a3fa0', on:false,
    tip:'インデックスレジスタ Y。' },
  { id:'sp',    label:'SP',    word:1, bit:24, type:'hex', width:8,  color:'#667700', on:false,
    tip:'スタックポインタ（下位 8 ビット。実アドレスは 0x0100 + SP）。' },
];

var M6502_LA_GROUPS = [
  { label:'Bus',  color:'#2266cc', ids:['addr','data','we','sync','reset'] },
  { label:'Regs', color:'#aa4400', ids:['a','x','y','sp'] },
];

// アドレスの領域色（Apple-I のメモリマップ。Dormann でも ZP / スタックの区別に使える）
function m6502RegionColor(sig, val) {
  if (sig.id !== 'addr') return null;
  if (val < 0x0100) return 'rgba(255,180,0,0.18)';     // ゼロページ
  if (val < 0x0200) return 'rgba(160,80,200,0.15)';    // スタック
  if (val >= 0xFF00) return 'rgba(220,0,0,0.12)';      // WozMon ROM
  if (val >= 0xE000) return 'rgba(0,100,255,0.12)';    // BASIC ROM
  if (val >= 0xD000 && val < 0xE000) return 'rgba(0,170,170,0.18)';  // PIA（キーボード / 表示）
  return null;
}

// デコードレーン: SYNC で命令境界を切り、各命令のオペコードをニーモニックで表示する。
function m6502DecodeRender(ctx, p) {
  var RW = p.ringWords, mask = p.ringSize - 1;
  ctx.fillStyle = '#555'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('INSTR', 2, p.decY + p.decH * 0.72);

  function word0(i) { return p.heapu32[((p.startSamp + i) & mask) * RW]; }

  // SYNC=1 のサンプル位置を集める
  var starts = [];
  for (var i = 0; i < p.samples; i++) {
    if ((word0(i) >>> 25) & 1) starts.push(i);
  }
  // 先頭の SYNC より前（命令の途中）は無印の箱にする
  var first = starts.length ? starts[0] : p.samples;
  if (first > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    ctx.fillRect(p.sigX, p.decY + 1, first * p.laZoom - 1, p.decH - 2);
  }
  for (var k = 0; k < starts.length; k++) {
    var s = starts[k];
    var e = (k + 1 < starts.length) ? starts[k + 1] : p.samples;
    var op = (word0(s) >>> 16) & 0xFF;
    var bx = p.sigX + s * p.laZoom;
    var bw = (e - s) * p.laZoom;
    ctx.fillStyle = (k & 1) ? 'rgba(40,90,200,0.62)' : 'rgba(30,70,160,0.62)';
    ctx.fillRect(bx, p.decY + 1, bw - 1, p.decH - 2);
    if (bw > 26) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(M6502_MNEMONICS[op], bx + bw / 2, p.decY + p.decH * 0.72);
    }
  }
}

var M6502_LA_CONFIG = {
  canvasId:         'la',
  togglesId:        'la-toggles',
  signals:          M6502_LA_SIGNALS,
  groups:           M6502_LA_GROUPS,
  ringWords:        M6502_RING_WORDS,
  ringSize:         4096,
  storagePrefix:    'm6502_la_',
  width:            1200,
  labelWidth:       72,
  trackH:           26,
  decodeLaneH:      22,
  numberedLabels:   false,
  decodeLane:       { label: 'INSTR', render: m6502DecodeRender },
  signalBackground: m6502RegionColor
};
