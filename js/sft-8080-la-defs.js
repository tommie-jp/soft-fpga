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
  { id:'port',   label:'port',   word:0, bit:0,  type:'hex', width:8,  color:'#0077cc', on:true,  name:{ ja:'I/O ポート番号', en:'I/O port number' }, tip:{ ja:'I/O ポート番号（バス [7:0]）。IN/OUT 命令が発行されたクロックに有効な値が現れます。', en:'I/O port number (bus [7:0]). A valid value appears on the clock in which an IN/OUT instruction is issued.' } },
  { id:'data',   label:'data',   word:0, bit:16, type:'hex', width:8,  color:'#009900', on:true,  name:{ ja:'I/O データバス', en:'I/O data bus' }, tip:{ ja:'I/O データ（バス [23:16]）。OUT ならCPU が書いた値、IN なら周辺から読んだ値です。', en:'I/O data (bus [23:16]). For OUT, the value written by the CPU; for IN, the value read from the peripheral.' } },
  { id:'io_req', label:'io_req', word:0, bit:24, type:'bit', width:1,  color:'#cc7700', on:true,  name:{ ja:'I/O サイクル要求フラグ', en:'I/O cycle request' }, tip:{ ja:'I/O サイクル発生フラグ。IN または OUT 命令の実行クロックで 1 になります。', en:'I/O cycle flag. Goes to 1 on the clock in which an IN or OUT instruction executes.' } },
  { id:'io_wr',  label:'io_wr',  word:0, bit:25, type:'bit', width:1,  color:'#cc3333', on:true,  name:{ ja:'I/O 書き込み方向フラグ', en:'I/O write direction' }, tip:{ ja:'I/O 書き込み方向。1=OUT（CPU→周辺）、0=IN（周辺→CPU）。io_req が 1 のときのみ有効。', en:'I/O write direction. 1 = OUT (CPU to peripheral), 0 = IN (peripheral to CPU). Valid only while io_req is 1.' } },
  { id:'t_state',label:'T',      word:0, bit:26, type:'hex', width:6,  color:'#336699', on:true,  fmt:'dec', name:{ ja:'T ステート番号', en:'T-state number' }, tip:{ ja:'T ステート番号（マシンサイクル内の位置）。SYNC=1 のクロックで 1 にリセットし、以降毎クロック加算。io_req と組み合わせると OUT が M5 T3 で確定することを確認できます。', en:'T-state number (position within the machine cycle). Reset to 1 on the clock where SYNC=1, then incremented every clock. Combined with io_req, it shows that OUT is committed at M5 T3.' } },
  { id:'status', label:'status',word:4, bit:0,  type:'hex', width:8,  color:'#445566', on:false, name:{ ja:'ステータスバイト', en:'Status byte' }, tip:{ ja:'SYNC でラッチした 8080 ステータスバイト。0xA2=FETCH, 0x82=MEM_RD, 0x10=IO_OUT, 0x40=IO_IN。デコードレーン(M-CYC行)の色分けはこの値に基づきます。', en:'The 8080 status byte latched at SYNC. 0xA2=FETCH, 0x82=MEM_RD, 0x10=IO_OUT, 0x40=IO_IN. The colors of the decode lane (M-CYC row) are based on this value.' } },
  { id:'ir',     label:'IR',    word:4, bit:8,  type:'hex', width:8,  color:'#aa3366', on:false, name:{ ja:'命令レジスタ', en:'Instruction register' }, tip:{ ja:'命令レジスタ (Instruction Register)。M1 フェッチサイクル完了後に確定するオペコード。MVI A=3E, OUT=D3, HLT=76 など。フェッチ中（MEMR=1 のクロック）はまだ古い値を保持していることがあります。', en:'Instruction register. The opcode, settled once the M1 fetch cycle completes. MVI A=3E, OUT=D3, HLT=76, etc. During a fetch (clocks where MEMR=1) it may still hold the old value.' } },
  { id:'f1',     label:'f1',    word:4, bit:16, type:'bit', width:1,  color:'#2288dd', on:false, name:{ ja:'クロック位相 φ1', en:'Clock phase φ1' }, tip:{ ja:'クロック φ1 フェーズ（cpm_top.f1）。T-state の前半で High。ステートマシンの前半更新タイミングを確認できます。', en:'Clock phase φ1 (cpm_top.f1). High during the first half of a T-state. Shows the timing of the first-half state machine update.' } },
  { id:'f2',     label:'f2',    word:4, bit:17, type:'bit', width:1,  color:'#dd8822', on:false, name:{ ja:'クロック位相 φ2', en:'Clock phase φ2' }, tip:{ ja:'クロック φ2 フェーズ（cpm_top.f2）。T-state の後半で High。レジスタ確定・バスサンプルのタイミングを確認できます。', en:'Clock phase φ2 (cpm_top.f2). High during the second half of a T-state. Shows when registers settle and the bus is sampled.' } },
  { id:'mcycle', label:'M-CYC', word:4, bit:18, type:'hex', width:3,  color:'#7755aa', on:false, fmt:'dec', name:{ ja:'マシンサイクル番号', en:'Machine cycle number' }, tip:{ ja:'マシンサイクル番号（M1〜M5）。vm80a の m1..m5 を 1〜5 にエンコード（0=該当なし）。命令フェッチ=M1、以降オペランド読み・メモリ/I-O アクセスごとに M2..M5 と進みます。T ステートと組み合わせるとマイクロシーケンサの進行が観測できます。', en:'Machine cycle number (M1 to M5). Encodes vm80a m1..m5 as 1 to 5 (0 = none). The instruction fetch is M1; operand reads and memory/I-O accesses follow as M2..M5. Combined with the T-state, it lets you observe the microsequencer advancing.' } },
  { id:'pc',   label:'PC',   word:5, bit:0,  type:'hex', width:16, color:'#2255aa', on:false,
    name:{ ja:'プログラムカウンタ', en:'Program counter' }, group:'CPU', desc:'プログラムカウンタ (vm80a r16_pc レジスタ値)' },
  { id:'sp',   label:'SP',   word:5, bit:16, type:'hex', width:16, color:'#aa5522', on:false,
    name:{ ja:'スタックポインタ', en:'Stack pointer' }, group:'CPU', desc:'スタックポインタ (vm80a r16_sp レジスタ値)' },
  // --- アドレスバス (Word 1) ---
  { id:'addr',   label:'addr',   word:1, bit:0,  type:'hex', width:16, color:'#880088', on:false, name:{ ja:'アドレスバス', en:'Address bus' }, tip:{ ja:'アドレスバス（16 ビット）。命令フェッチ時は PC、メモリ読み書き時はアクセス先アドレス（HL/SP/BC/DE など）、IN/OUT 時は I/O ポート番号が現れます。MEMR/MEMW/SYNC と組み合わせると各サイクルのアクセス先が読み取れます。', en:'Address bus (16 bits). Shows PC during an instruction fetch, the target address (HL/SP/BC/DE, etc.) during a memory read/write, and the I/O port number during IN/OUT. Combined with MEMR/MEMW/SYNC, it reveals the access target of each cycle.' } },
  // --- バスサイクル制御 (Word 0) ---
  { id:'dbin',   label:'pin_DBIN', word:0, bit:8,  type:'bit', width:1,  color:'#0099cc', on:false, name:{ ja:'データバス入力イネーブル', en:'Data bus in' }, tip:{ ja:'[8080 ピン] Data Bus IN（データバス入力イネーブル）。CPU がバスからデータを読むクロックで 1 になります。vm80a: pin_dbin', en:'[8080 pin] Data Bus IN (data bus input enable). Goes to 1 on clocks where the CPU reads data from the bus. vm80a: pin_dbin' } },
  { id:'sync',   label:'pin_SYNC', word:0, bit:9,  type:'bit', width:1,  color:'#9900cc', on:false, name:{ ja:'マシンサイクル開始ストローブ', en:'Machine cycle sync strobe' }, tip:{ ja:'[8080 ピン] マシンサイクル開始ストローブ。M1（命令フェッチ）やメモリ・I/O サイクルの先頭クロックで 1 になります。SYNC 立ち上がりでオペコードを確定します。vm80a: pin_sync', en:'[8080 pin] Machine cycle start strobe. Goes to 1 on the first clock of M1 (instruction fetch) and of memory and I/O cycles. The opcode is settled at the rising edge of SYNC. vm80a: pin_sync' } },
  { id:'wr_n',   label:'pin_WR_N', word:0, bit:10, type:'bit', width:1,  color:'#cc5500', on:false, name:{ ja:'バス書き込みストローブ（負論理）', en:'Write strobe (active low)' }, tip:{ ja:'[8080 ピン] バス書き込みストローブ（負論理）。メモリ書き込みまたは OUT 命令のデータ確定クロックで 0 になります。vm80a: pin_wr_n', en:'[8080 pin] Bus write strobe (active low). Goes to 0 on the clock where data is settled for a memory write or an OUT instruction. vm80a: pin_wr_n' } },
  { id:'hlda',   label:'pin_HLDA', word:0, bit:11, type:'bit', width:1,  color:'#887700', on:false, name:{ ja:'バスホールド応答', en:'Hold acknowledge' }, tip:{ ja:'[8080 ピン] バスホールド応答。DMA 等のバスホールド要求に対して CPU がバスを開放したことを示します。vm80a: pin_hlda', en:'[8080 pin] Hold acknowledge. Indicates that the CPU has released the bus in response to a bus hold request such as DMA. vm80a: pin_hlda' } },
  { id:'wait',   label:'pin_WAIT', word:0, bit:12, type:'bit', width:1,  color:'#888888', on:false, name:{ ja:'ウェイト状態', en:'Wait state' }, tip:{ ja:'[8080 ピン] ウェイト状態。このシミュレーターでは常に 0 です（WAIT ステートなし）。vm80a: pin_wait', en:'[8080 pin] Wait state. Always 0 in this simulator (no WAIT states). vm80a: pin_wait' } },
  { id:'inte',   label:'pin_INTE', word:0, bit:13, type:'bit', width:1,  color:'#006688', on:false, name:{ ja:'割り込みイネーブルフラグ', en:'Interrupt enable flag' }, tip:{ ja:'[8080 ピン] 割り込みイネーブルフラグ。EI 命令で 1、DI 命令で 0 になります。vm80a: pin_inte', en:'[8080 pin] Interrupt enable flag. Set to 1 by the EI instruction and cleared to 0 by DI. vm80a: pin_inte' } },
  // --- メモリアクセス (Word 0) ---
  { id:'memr',   label:'MEMR',   word:0, bit:14, type:'bit', width:1,  color:'#007744', on:false, name:{ ja:'メモリ読み出しサイクル', en:'Memory read cycle' }, tip:{ ja:'メモリ読み出しサイクル。命令フェッチ・LDAX など、メモリからデータを読むクロックで 1 になります。', en:'Memory read cycle. Goes to 1 on clocks where data is read from memory, such as instruction fetch and LDAX.' } },
  { id:'memw',   label:'MEMW',   word:0, bit:15, type:'bit', width:1,  color:'#005522', on:false, name:{ ja:'メモリ書き込みサイクル', en:'Memory write cycle' }, tip:{ ja:'メモリ書き込みサイクル。STAX・PUSH など、メモリへデータを書くクロックで 1 になります。', en:'Memory write cycle. Goes to 1 on clocks where data is written to memory, such as STAX and PUSH.' } },
  // --- データ値 (Word 1 上位) ---
  { id:'din',    label:'din',    word:1, bit:16, type:'hex', width:8,  color:'#008888', on:false, name:{ ja:'I/O 読み出しデータ', en:'I/O input data' }, tip:{ ja:'I/O 読みデータ（IN 命令で CPU が周辺から受け取る値）。io_req=1 かつ io_wr=0 のサンプルで有効。', en:'I/O read data (the value the CPU receives from the peripheral on an IN instruction). Valid in samples where io_req=1 and io_wr=0.' } },
  { id:'acc',    label:'A',      word:1, bit:24, type:'hex', width:8,  color:'#aa4400', on:false, name:{ ja:'アキュムレータ A', en:'Accumulator A' }, tip:{ ja:'アキュムレータ A の連続スナップショット。BDOS コール後の戻り値（エラーコード等）の確認に便利。', en:'Continuous snapshot of accumulator A. Handy for checking return values (error codes, etc.) after a BDOS call.' } },
  // --- 全レジスタ (Word 2) ---
  { id:'reg_f',  label:'F',      word:2, bit:0,  type:'hex', width:8,  color:'#555599', on:false, fmt:'flags8080', name:{ ja:'フラグレジスタ F', en:'Flag register F' }, tip:{ ja:'フラグレジスタ F。セグメント内に SZ.A.P1C を大文字(ON)/小文字(OFF)で表示します。', en:'Flag register F. The segment shows SZ.A.P1C, with uppercase for ON and lowercase for OFF.' } },
  { id:'reg_b',  label:'B',      word:2, bit:8,  type:'hex', width:8,  color:'#007755', on:false, name:{ ja:'レジスタ B（BC の上位）', en:'Register B (high byte of BC)' }, tip:{ ja:'レジスタ B。BC ペアの上位バイト。LDIR 代替ループカウンタや汎用レジスタとして使用されます。', en:'Register B. The high byte of the BC pair. Used as a loop counter in place of LDIR and as a general-purpose register.' } },
  { id:'reg_c',  label:'C',      word:2, bit:16, type:'hex', width:8,  color:'#00aa55', on:false, name:{ ja:'レジスタ C（BC の下位）', en:'Register C (low byte of BC)' }, tip:{ ja:'レジスタ C。BC ペアの下位バイト。CP/M では BDOS ファンクション番号として使われます（CALL 5 の前に C にセット）。', en:'Register C. The low byte of the BC pair. In CP/M it holds the BDOS function number (set C before CALL 5).' } },
  { id:'reg_d',  label:'D',      word:2, bit:24, type:'hex', width:8,  color:'#996600', on:false, name:{ ja:'レジスタ D（DE の上位）', en:'Register D (high byte of DE)' }, tip:{ ja:'レジスタ D。DE ペアの上位バイト。文字列ポインタや汎用アドレスレジスタとして使われます。', en:'Register D. The high byte of the DE pair. Used for string pointers and as a general-purpose address register.' } },
  // --- 全レジスタ + CPU データバス (Word 3) ---
  { id:'reg_e',  label:'E',      word:3, bit:0,  type:'hex', width:8,  color:'#cc8800', on:false, name:{ ja:'レジスタ E（DE の下位）', en:'Register E (low byte of DE)' }, tip:{ ja:'レジスタ E。DE ペアの下位バイト。CP/M では BDOS パラメータアドレス（DMA など）の下位バイトとして使われます。', en:'Register E. The low byte of the DE pair. In CP/M it is used as the low byte of BDOS parameter addresses (such as the DMA address).' } },
  { id:'reg_h',  label:'H',      word:3, bit:8,  type:'hex', width:8,  color:'#6600aa', on:false, name:{ ja:'レジスタ H（HL の上位）', en:'Register H (high byte of HL)' }, tip:{ ja:'レジスタ H。HL ペアの上位バイト。主にメモリポインタとして使われます（M = (HL)）。', en:'Register H. The high byte of the HL pair. Mainly used as a memory pointer (M = (HL)).' } },
  { id:'reg_l',  label:'L',      word:3, bit:16, type:'hex', width:8,  color:'#9900cc', on:false, name:{ ja:'レジスタ L（HL の下位）', en:'Register L (low byte of HL)' }, tip:{ ja:'レジスタ L。HL ペアの下位バイト。MEMR/MEMW と合わせると HL が指すアドレスへのアクセスを確認できます。', en:'Register L. The low byte of the HL pair. Combined with MEMR/MEMW, it shows accesses to the address HL points to.' } },
  { id:'dbus',   label:'dbus',   word:3, bit:24, type:'hex', width:8,  color:'#cc0066', on:false, name:{ ja:'CPU データバス', en:'CPU data bus' }, tip:{ ja:'CPU データバス（全サイクル対応）。MEMR=RAMの読み出しデータ、MEMW/IO OUT=CPUが書くデータ、IO IN=周辺が返すデータ。din とは異なりメモリアクセスのデータも表示します。', en:'CPU data bus (all cycles). MEMR = data read from RAM, MEMW/IO OUT = data written by the CPU, IO IN = data returned by the peripheral. Unlike din, it also shows data of memory accesses.' } },
  // --- MemWatch (Word 6) ---
  { id:'mem1', label:'M1', word:6, bit:0,  type:'hex', width:8, color:'#996633', on:false, name:{ ja:'メモリ監視 1', en:'Memory watch 1' }, tip:{ ja:'MemWatch 1: アドレス入力で指定したメモリアドレスの値を毎クロックサンプリング。アドレスは信号レーンのラベル右に表示されるテキストボックスで設定。', en:'MemWatch 1: samples the value at the memory address given in the address input on every clock. Set the address in the text box shown to the right of the signal lane label.' } },
  { id:'mem2', label:'M2', word:6, bit:8,  type:'hex', width:8, color:'#996633', on:false, name:{ ja:'メモリ監視 2', en:'Memory watch 2' }, tip:{ ja:'MemWatch 2: アドレス入力で指定したメモリアドレスの値を毎クロックサンプリング。', en:'MemWatch 2: samples the value at the memory address given in the address input on every clock.' } },
  { id:'mem3', label:'M3', word:6, bit:16, type:'hex', width:8, color:'#996633', on:false, name:{ ja:'メモリ監視 3', en:'Memory watch 3' }, tip:{ ja:'MemWatch 3: アドレス入力で指定したメモリアドレスの値を毎クロックサンプリング。', en:'MemWatch 3: samples the value at the memory address given in the address input on every clock.' } },
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
// トリガーのプリセット (Trigger の「Preset」から選ぶと欄に入る。Set は自分で押す)
// fields は index.html の #dbg-trig-detail の欄の id → 値。trig-type を先に書く (種類に応じた欄の表示が先に切り替わる)
// I/O ポートは cpm_top.v の表 ($00 CONIN・$01 CONOUT・$10 DCMD など)。欄が空なら任意のポート
var CPM8080_TRIGGER_PRESETS = [
  { label: 'Console out (OUT 01h)', tip: { ja: 'CONOUT: 1 文字をコンソールへ出した瞬間', en: 'CONOUT: the moment one character is sent to the console' },
    fields: { 'trig-type': '1', 'trig-addr': '01', 'trig-post': '200' } },
  { label: 'Console in (IN 00h)', tip: { ja: 'CONIN: キーボードから 1 文字を読んだ瞬間 (キーを押すと止まる)', en: 'CONIN: the moment one character is read from the keyboard (stops when a key is pressed)' },
    fields: { 'trig-type': '1', 'trig-addr': '00', 'trig-post': '200' } },
  { label: 'BDOS call (CALL 0005h)', tip: { ja: 'CP/M のシステムコール (BDOS) の入口へ CALL した瞬間。関数番号は C レジスタ', en: 'The moment CALL jumps to the CP/M system call (BDOS) entry point. The function number is in register C' },
    fields: { 'trig-type': '2', 'trig-addr': '0005', 'trig-post': '200' } },
  { label: 'Program start (PC = 0100h)', tip: { ja: 'TPA の先頭 0100h の命令をフェッチした瞬間 (.COM の実行開始)', en: 'The moment the instruction at 0100h, the start of the TPA, is fetched (start of .COM execution)' },
    fields: { 'trig-type': 'instr', 'trig-instr-pc': '0100', 'trig-instr-opc': '', 'trig-post': '100' } },
  { label: 'Warm boot (PC = 0000h)', tip: { ja: '0000h の命令をフェッチした瞬間 (プログラム終了後の JMP 0 = ウォームブート)', en: 'The moment the instruction at 0000h is fetched (JMP 0 after a program ends = warm boot)' },
    fields: { 'trig-type': 'instr', 'trig-instr-pc': '0000', 'trig-instr-opc': '', 'trig-post': '100' } },
  { label: 'HLT instruction (76h)', tip: { ja: 'どこかで HLT 命令 (76h) をフェッチした瞬間', en: 'The moment an HLT instruction (76h) is fetched anywhere' },
    fields: { 'trig-type': 'instr', 'trig-instr-pc': '', 'trig-instr-opc': '76', 'trig-post': '50' } },
  { label: 'Disk command (OUT 10h)', tip: { ja: 'DCMD: ディスクの読み書きを指示した瞬間', en: 'DCMD: the moment a disk read/write is commanded' },
    fields: { 'trig-type': '1', 'trig-addr': '10', 'trig-post': '200' } },
  { label: 'Any I/O (IN / OUT)', tip: { ja: 'どのポートでも、IN か OUT を実行した瞬間', en: 'The moment an IN or OUT is executed, on any port' },
    fields: { 'trig-type': '1', 'trig-addr': '', 'trig-post': '100' } },
];

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
