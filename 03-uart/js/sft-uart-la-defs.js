// sft-uart-la-defs.js — 03-uart の Logic Analyzer 信号定義とフレーム表示
//
// ring buffer ビットレイアウト（1 サンプル = 2 word、examples/03-uart/cxx/harness.cpp）:
//   word0: [0] txd [1] rxd [2] tx_valid [3] tx_ready [4] rx_valid [5] rx_error
//          [7:6] tx_state [9:8] rx_state [12:10] tx_bit [15:13] rx_bit [23:16] tx_data [31:24] rx_data
//   word1: [0] rst
var UART_RING_WORDS = 2;
var UART_STATE_NAMES = ['IDLE', 'START', 'DATA', 'STOP'];

var UART_LA_SIGNALS = [
  { id:'txd',      label:'txd',      word:0, bit:0,  type:'bit', width:1, color:'#00a860', on:true,
    tip:'送信線。アイドルは 1。START ビットで 0 に落ち、データ 8 ビット（LSB 先頭）、STOP ビットで 1 に戻ります。' },
  { id:'rxd',      label:'rxd',      word:0, bit:1,  type:'bit', width:1, color:'#4466dd', on:true,
    tip:'受信線。このデモは txd を rxd に戻すループバック接続なので、txd と同じ波形になります。' },
  { id:'tx_valid', label:'tx_valid', word:0, bit:2,  type:'bit', width:1, color:'#cc7700', on:false,
    tip:'送信要求。tx_ready が 1 のクロックに 1 回だけ立ち、送信バッファへバイトを渡します。' },
  { id:'tx_ready', label:'tx_rdy',   word:0, bit:3,  type:'bit', width:1, color:'#dd9900', on:true,
    tip:'送信可。送信機が IDLE のとき 1。フレーム送信中は 0 です。' },
  { id:'rx_valid', label:'rx_vld',   word:0, bit:4,  type:'bit', width:1, color:'#cc44cc', on:true,
    tip:'受信完了パルス。STOP ビットの終わりで 1 クロックだけ 1 になり、そのとき rx_data が確定します。' },
  { id:'rx_error', label:'rx_err',   word:0, bit:5,  type:'bit', width:1, color:'#cc2222', on:false,
    tip:'フレーミングエラー。STOP ビットが 1 でなかったときに 1 になります。' },
  { id:'tx_state', label:'tx_state', word:0, bit:6,  type:'hex', width:2, color:'#117755', on:true,  fmt:'uart_state',
    tip:'送信機の状態（IDLE / START / DATA / STOP）。' },
  { id:'rx_state', label:'rx_state', word:0, bit:8,  type:'hex', width:2, color:'#3344aa', on:true,  fmt:'uart_state',
    tip:'受信機の状態（IDLE / START / DATA / STOP）。START ビットの中央でサンプリングを始めます。' },
  { id:'tx_bit',   label:'tx_bit',   word:0, bit:10, type:'hex', width:3, color:'#557766', on:false, fmt:'dec',
    tip:'送信中のデータビット番号（0〜7）。' },
  { id:'rx_bit',   label:'rx_bit',   word:0, bit:13, type:'hex', width:3, color:'#556699', on:false, fmt:'dec',
    tip:'受信中のデータビット番号（0〜7）。' },
  { id:'tx_data',  label:'tx_data',  word:0, bit:16, type:'hex', width:8, color:'#33aa55', on:true,
    tip:'送信バッファの内容（16 進）。' },
  { id:'rx_data',  label:'rx_data',  word:0, bit:24, type:'hex', width:8, color:'#5566cc', on:true,
    tip:'最後に受信したバイト（16 進）。rx_valid のクロックで更新されます。' },
  { id:'rst',      label:'rst',      word:1, bit:0,  type:'bit', width:1, color:'#cc3333', on:false,
    tip:'リセット入力。Reset ボタンで 2 クロック分だけ 1 になります。' },
];

var UART_LA_GROUPS = [
  { label:'Line',  color:'#117755', ids:['txd','rxd'] },
  { label:'TX',    color:'#cc7700', ids:['tx_valid','tx_ready','tx_state','tx_bit','tx_data'] },
  { label:'RX',    color:'#3344aa', ids:['rx_valid','rx_error','rx_state','rx_bit','rx_data'] },
  { label:'Ctrl',  color:'#cc3333', ids:['rst'] },
];

// 文字の表示用（0x20〜0x7E のみ文字、それ以外は 16 進）
function uartByteLabel(v) {
  return (v >= 0x20 && v < 0x7F) ? "'" + String.fromCharCode(v) + "'" : '0x' + v.toString(16).toUpperCase().padStart(2, '0');
}

// デコードレーン: 上半分に送信フレーム、下半分に受信フレームを箱で描き、バイトを書く。
function uartDecodeRender(ctx, p) {
  var RW = p.ringWords, mask = p.ringSize - 1;
  ctx.fillStyle = '#555'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('FRAME', 2, p.decY + p.decH * 0.72);

  var halfH = (p.decH - 2) / 2;
  function frames(stateShift, dataShift, y, fill, tag, useEndValue) {
    var segStart = -1, lastData = 0;
    for (var i = 0; i <= p.samples; i++) {
      var w = (i < p.samples) ? p.heapu32[((p.startSamp + i) & mask) * RW] : 0;
      var active = (i < p.samples) && (((w >>> stateShift) & 3) !== 0);
      if (active) {
        if (segStart < 0) segStart = i;
        lastData = (w >>> dataShift) & 0xFF;
      } else if (segStart >= 0) {
        // 受信側は rx_data が STOP の終わりで確定するので、フレーム直後のサンプルの値を使う
        var value = (useEndValue && i < p.samples) ? ((w >>> dataShift) & 0xFF) : lastData;
        var bx = p.sigX + segStart * p.laZoom;
        var bw = (i - segStart) * p.laZoom;
        if (bw > 0.5) {
          ctx.fillStyle = fill;
          ctx.fillRect(bx, y, bw - 1, halfH - 1);
          if (bw > 34) {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            var txt = tag + ' ' + uartByteLabel(value);
            ctx.fillText(txt, bx + bw / 2, y + halfH * 0.78);
          }
        }
        segStart = -1;
      }
    }
  }
  frames(6, 16, p.decY + 1,          'rgba(20,130,90,0.75)', 'TX', false);
  frames(8, 24, p.decY + 1 + halfH,  'rgba(50,80,190,0.75)', 'RX', true);
}

var UART_LA_CONFIG = {
  canvasId:       'la',
  togglesId:      'la-toggles',
  signals:        UART_LA_SIGNALS,
  groups:         UART_LA_GROUPS,
  ringWords:      UART_RING_WORDS,
  ringSize:       4096,
  storagePrefix:  'uart_la_',
  width:          1200,
  labelWidth:     72,
  trackH:         24,
  decodeLaneH:    30,
  numberedLabels: false,
  decodeLane:     { label: 'FRAME', render: uartDecodeRender },
  formatters: {
    uart_state: function (v) { return UART_STATE_NAMES[v & 3] || String(v); }
  }
};
