// sft-8080-la-defs.js — Logic Analyzer 信号定義・マシンサイクル判定・メモリ領域色
//
// 06-8080 Web UI から分離。素の <script src> で読み込み、トップレベル定義を
// グローバルに公開（機能不変）。LA_SIGNALS_ALL はテスト・rtlscope-la.js が参照するため
// 生グローバルとして公開する。js/rtlscope-la.js より前に読み込むこと。
//
// ring buffer bit layout:
//  [ 7: 0] io_addr(port)  [ 8] DBIN  [ 9] SYNC  [10] WR_N  [11] HLDA
//  [12] WAIT  [13] INTE  [14] MEMR  [15] MEMW
//  [23:16] io_dout(data)  [24] io_req  [25] io_wr
const LA_SIGNALS_ALL = [
  // --- I/O バス (Word 0) ---
  { id:'port',   label:'port',   word:0, bit:0,  type:'hex', width:8,  color:'#0077cc', on:true,  tip:'I/O ポート番号（バス [7:0]）。IN/OUT 命令が発行されたクロックに有効な値が現れます。' },
  { id:'data',   label:'data',   word:0, bit:16, type:'hex', width:8,  color:'#009900', on:true,  tip:'I/O データ（バス [23:16]）。OUT ならCPU が書いた値、IN なら周辺から読んだ値です。' },
  { id:'io_req', label:'io_req', word:0, bit:24, type:'bit', width:1,  color:'#cc7700', on:true,  tip:'I/O サイクル発生フラグ。IN または OUT 命令の実行クロックで 1 になります。' },
  { id:'io_wr',  label:'io_wr',  word:0, bit:25, type:'bit', width:1,  color:'#cc3333', on:true,  tip:'I/O 書き込み方向。1=OUT（CPU→周辺）、0=IN（周辺→CPU）。io_req が 1 のときのみ有効。' },
  { id:'t_state',label:'T',      word:0, bit:26, type:'hex', width:6,  color:'#336699', on:true,  fmt:'dec', tip:'T ステート番号（マシンサイクル内の位置）。SYNC=1 のクロックで 1 にリセットし、以降毎クロック加算。io_req と組み合わせると OUT が M5 T3 で確定することを確認できます。' },
  { id:'status', label:'status',word:4, bit:0,  type:'hex', width:8,  color:'#445566', on:false, tip:'SYNC でラッチした 8080 ステータスバイト。0xA2=FETCH, 0x82=MEM_RD, 0x10=IO_OUT, 0x40=IO_IN。デコードレーン(M-CYC行)の色分けはこの値に基づきます。' },
  { id:'ir',     label:'IR',    word:4, bit:8,  type:'hex', width:8,  color:'#aa3366', on:false, tip:'命令レジスタ (Instruction Register)。M1 フェッチサイクル完了後に確定するオペコード。MVI A=3E, OUT=D3, HLT=76 など。フェッチ中（MEMR=1 のクロック）はまだ古い値を保持していることがあります。' },
  { id:'f1',     label:'f1',    word:4, bit:16, type:'bit', width:1,  color:'#2288dd', on:false, tip:'クロック φ1 フェーズ（cpm_top.f1）。T-state の前半で High。ステートマシンの前半更新タイミングを確認できます。' },
  { id:'f2',     label:'f2',    word:4, bit:17, type:'bit', width:1,  color:'#dd8822', on:false, tip:'クロック φ2 フェーズ（cpm_top.f2）。T-state の後半で High。レジスタ確定・バスサンプルのタイミングを確認できます。' },
  { id:'mcycle', label:'M-CYC', word:4, bit:18, type:'hex', width:3,  color:'#7755aa', on:false, fmt:'dec', tip:'マシンサイクル番号（M1〜M5）。vm80a の m1..m5 を 1〜5 にエンコード（0=該当なし）。命令フェッチ=M1、以降オペランド読み・メモリ/I-O アクセスごとに M2..M5 と進みます。T ステートと組み合わせるとマイクロシーケンサの進行が観測できます。' },
  { id:'pc',   label:'PC',   word:5, bit:0,  type:'hex', width:16, color:'#2255aa', on:false,
    group:'CPU', desc:'プログラムカウンタ (vm80a r16_pc レジスタ値)' },
  { id:'sp',   label:'SP',   word:5, bit:16, type:'hex', width:16, color:'#aa5522', on:false,
    group:'CPU', desc:'スタックポインタ (vm80a r16_sp レジスタ値)' },
  // --- アドレスバス (Word 1) ---
  { id:'addr',   label:'addr',   word:1, bit:0,  type:'hex', width:16, color:'#880088', on:false, tip:'アドレスバス（16 ビット）。命令フェッチ時は PC、メモリ読み書き時はアクセス先アドレス（HL/SP/BC/DE など）、IN/OUT 時は I/O ポート番号が現れます。MEMR/MEMW/SYNC と組み合わせると各サイクルのアクセス先が読み取れます。' },
  // --- バスサイクル制御 (Word 0) ---
  { id:'dbin',   label:'pin_DBIN', word:0, bit:8,  type:'bit', width:1,  color:'#0099cc', on:false, tip:'[8080 ピン] Data Bus IN（データバス入力イネーブル）。CPU がバスからデータを読むクロックで 1 になります。vm80a: pin_dbin' },
  { id:'sync',   label:'pin_SYNC', word:0, bit:9,  type:'bit', width:1,  color:'#9900cc', on:false, tip:'[8080 ピン] マシンサイクル開始ストローブ。M1（命令フェッチ）やメモリ・I/O サイクルの先頭クロックで 1 になります。SYNC 立ち上がりでオペコードを確定します。vm80a: pin_sync' },
  { id:'wr_n',   label:'pin_WR_N', word:0, bit:10, type:'bit', width:1,  color:'#cc5500', on:false, tip:'[8080 ピン] バス書き込みストローブ（負論理）。メモリ書き込みまたは OUT 命令のデータ確定クロックで 0 になります。vm80a: pin_wr_n' },
  { id:'hlda',   label:'pin_HLDA', word:0, bit:11, type:'bit', width:1,  color:'#887700', on:false, tip:'[8080 ピン] バスホールド応答。DMA 等のバスホールド要求に対して CPU がバスを開放したことを示します。vm80a: pin_hlda' },
  { id:'wait',   label:'pin_WAIT', word:0, bit:12, type:'bit', width:1,  color:'#888888', on:false, tip:'[8080 ピン] ウェイト状態。このシミュレーターでは常に 0 です（WAIT ステートなし）。vm80a: pin_wait' },
  { id:'inte',   label:'pin_INTE', word:0, bit:13, type:'bit', width:1,  color:'#006688', on:false, tip:'[8080 ピン] 割り込みイネーブルフラグ。EI 命令で 1、DI 命令で 0 になります。vm80a: pin_inte' },
  // --- メモリアクセス (Word 0) ---
  { id:'memr',   label:'MEMR',   word:0, bit:14, type:'bit', width:1,  color:'#007744', on:false, tip:'メモリ読み出しサイクル。命令フェッチ・LDAX など、メモリからデータを読むクロックで 1 になります。' },
  { id:'memw',   label:'MEMW',   word:0, bit:15, type:'bit', width:1,  color:'#005522', on:false, tip:'メモリ書き込みサイクル。STAX・PUSH など、メモリへデータを書くクロックで 1 になります。' },
  // --- データ値 (Word 1 上位) ---
  { id:'din',    label:'din',    word:1, bit:16, type:'hex', width:8,  color:'#008888', on:false, tip:'I/O 読みデータ（IN 命令で CPU が周辺から受け取る値）。io_req=1 かつ io_wr=0 のサンプルで有効。' },
  { id:'acc',    label:'A',      word:1, bit:24, type:'hex', width:8,  color:'#aa4400', on:false, tip:'アキュムレータ A の連続スナップショット。BDOS コール後の戻り値（エラーコード等）の確認に便利。' },
  // --- 全レジスタ (Word 2) ---
  { id:'reg_f',  label:'F',      word:2, bit:0,  type:'hex', width:8,  color:'#555599', on:false, fmt:'flags8080', tip:'フラグレジスタ F。セグメント内に SZ.A.P1C を大文字(ON)/小文字(OFF)で表示します。' },
  { id:'reg_b',  label:'B',      word:2, bit:8,  type:'hex', width:8,  color:'#007755', on:false, tip:'レジスタ B。BC ペアの上位バイト。LDIR 代替ループカウンタや汎用レジスタとして使用されます。' },
  { id:'reg_c',  label:'C',      word:2, bit:16, type:'hex', width:8,  color:'#00aa55', on:false, tip:'レジスタ C。BC ペアの下位バイト。CP/M では BDOS ファンクション番号として使われます（CALL 5 の前に C にセット）。' },
  { id:'reg_d',  label:'D',      word:2, bit:24, type:'hex', width:8,  color:'#996600', on:false, tip:'レジスタ D。DE ペアの上位バイト。文字列ポインタや汎用アドレスレジスタとして使われます。' },
  // --- 全レジスタ + CPU データバス (Word 3) ---
  { id:'reg_e',  label:'E',      word:3, bit:0,  type:'hex', width:8,  color:'#cc8800', on:false, tip:'レジスタ E。DE ペアの下位バイト。CP/M では BDOS パラメータアドレス（DMA など）の下位バイトとして使われます。' },
  { id:'reg_h',  label:'H',      word:3, bit:8,  type:'hex', width:8,  color:'#6600aa', on:false, tip:'レジスタ H。HL ペアの上位バイト。主にメモリポインタとして使われます（M = (HL)）。' },
  { id:'reg_l',  label:'L',      word:3, bit:16, type:'hex', width:8,  color:'#9900cc', on:false, tip:'レジスタ L。HL ペアの下位バイト。MEMR/MEMW と合わせると HL が指すアドレスへのアクセスを確認できます。' },
  { id:'dbus',   label:'dbus',   word:3, bit:24, type:'hex', width:8,  color:'#cc0066', on:false, tip:'CPU データバス（全サイクル対応）。MEMR=RAMの読み出しデータ、MEMW/IO OUT=CPUが書くデータ、IO IN=周辺が返すデータ。din とは異なりメモリアクセスのデータも表示します。' },
  // --- MemWatch (Word 6) ---
  { id:'mem1', label:'M1', word:6, bit:0,  type:'hex', width:8, color:'#996633', on:false, tip:'MemWatch 1: アドレス入力で指定したメモリアドレスの値を毎クロックサンプリング。アドレスは信号レーンのラベル右に表示されるテキストボックスで設定。' },
  { id:'mem2', label:'M2', word:6, bit:8,  type:'hex', width:8, color:'#996633', on:false, tip:'MemWatch 2: アドレス入力で指定したメモリアドレスの値を毎クロックサンプリング。' },
  { id:'mem3', label:'M3', word:6, bit:16, type:'hex', width:8, color:'#996633', on:false, tip:'MemWatch 3: アドレス入力で指定したメモリアドレスの値を毎クロックサンプリング。' },
];
const RING_WORDS    = 7;   // ワード/サンプル (harness: RING_SIZE * 7)

// 8080 ステータスバイトからマシンサイクルタイプを判定
var MTYPE_FETCH  = { label:'FETCH',  color:'rgba(40,90,200,0.60)'  };
var MTYPE_MEM_RD = { label:'MEM RD', short:'RD', color:'rgba(30,150,30,0.60)'  };
var MTYPE_MEM_WR = { label:'MEM WR', short:'WR', color:'rgba(180,110,0,0.60)'  };
var MTYPE_IO_IN  = { label:'IO IN',  short:'IN',  color:'rgba(0,120,220,0.65)'  };
var MTYPE_IO_OUT = { label:'IO OUT', color:'rgba(200,30,30,0.65)'  };

function getMachineType(s) {
  // 8080 MEMW ステータスバイト = 0x00（WO_BAR=0、他ビット全て0）のため
  // falsy チェック(!s)は使わない。0x00 は MTYPE_MEM_WR として正しく扱う。
  if (s == null) return null;
  if (s & 0x40) return MTYPE_IO_IN;   // cycle_inp = status[6]
  if (s & 0x10) return MTYPE_IO_OUT;  // cycle_out = status[4]
  if (s & 0x20) return MTYPE_FETCH;   // M1 bit = status[5] (0xA2 に存在)
  if (s & 0x80) return MTYPE_MEM_RD;  // bit7 (0x82 に存在)
  return MTYPE_MEM_WR;                // 0x00 = MEMW / 0x04 = Stack WR など
}

// シグナルグループ定義（color: アクティブバー・ピッカーで使うグループ単位の色）
var LA_SIGNAL_GROUPS = [
  { label:'I/O',      color:'#0066bb', ids:['port','data','io_req','io_wr','t_state'] },
  { label:'Control',  color:'#7722aa', ids:['dbin','sync','wr_n','hlda','wait','inte','f1','f2'] },
  { label:'Mem',      color:'#007755', ids:['addr','memr','memw','dbus'] },
  { label:'Data',     color:'#445566', ids:['status','ir','din','acc','reg_f','reg_b','reg_c','reg_d','reg_e','reg_h','reg_l'] },
  { label:'CPU',      color:'#335599', ids:['pc','sp'] },
  { label:'MemWatch', color:'#996633', ids:['mem1','mem2','mem3'] },
];

// CP/M メモリ領域定義（addr 信号背景色）
var CPM_REGIONS = [
  { lo: 0x0000, hi: 0x00FF, color: 'rgba(255,180,0,0.18)',  name: 'P0'   },
  { lo: 0xDC00, hi: 0xE3FF, color: 'rgba(0,100,255,0.14)',  name: 'CCP'  },
  { lo: 0xE400, hi: 0xF1FF, color: 'rgba(0,180,60,0.14)',   name: 'BDOS' },
  { lo: 0xF200, hi: 0xFFFF, color: 'rgba(220,0,0,0.12)',    name: 'BIOS' },
];
