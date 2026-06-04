// sft-8080-disasm.js — 8080 逆アセンブラ・シンボル表・フラグ整形
//
// 06-8080 Web UI から分離した純粋関数群（DOM 非依存）。
// 素の <script src> で読み込み、トップレベル関数/変数をグローバルに公開する
// （既存 index.html と同じグローバル名で参照可能・機能不変）。
// 利用元: index.html の updateRegPanel / renderIOLog / renderCallTrace、
//         および js/rtlscope-la.js（disasm8080 / fmtFlags8080 を注入）。

// ---- 8080 逆アセンブラ ----
// 引数: b0, b1, b2 (PC, PC+1, PC+2 の各バイト)
// 戻り値: ニーモニック文字列
function disasm8080(b0, b1, b2) {
  var h2 = function(n) { return (n & 0xFF).toString(16).toUpperCase().padStart(2, '0'); };
  var h4 = function(n) { return (n & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); };
  var R   = ['B','C','D','E','H','L','M','A'];
  var RP  = ['B','D','H','SP'];
  var ALU = ['ADD','ADC','SUB','SBB','ANA','XRA','ORA','CMP'];
  var CC  = ['NZ','Z','NC','C','PO','PE','P','M'];
  var op  = b0 & 0xFF;
  var r1  = (op >> 3) & 7, r2 = op & 7, rp = (op >> 4) & 3;
  var i8  = b1 & 0xFF, i16 = (b1 & 0xFF) | ((b2 & 0xFF) << 8);
  // MOV: 01 DDD SSS (76 = HLT を除く)
  if (op >= 0x40 && op <= 0x7F && op !== 0x76) return 'MOV ' + R[r1] + ',' + R[r2];
  // ALU reg: 10 OOO SSS
  if (op >= 0x80 && op <= 0xBF) return ALU[(op >> 3) & 7] + ' ' + R[r2];
  // 正規グループ (rp 関連)
  switch (op & 0xCF) {
    case 0x01: return 'LXI '  + RP[rp] + ',$' + h4(i16);
    case 0x03: return 'INX '  + RP[rp];
    case 0x09: return 'DAD '  + RP[rp];
    case 0x0B: return 'DCX '  + RP[rp];
    case 0xC1: return 'POP '  + (rp === 3 ? 'PSW' : RP[rp]);
    case 0xC5: return 'PUSH ' + (rp === 3 ? 'PSW' : RP[rp]);
  }
  // 正規グループ (r1 関連)
  switch (op & 0xC7) {
    case 0x04: return 'INR ' + R[r1];
    case 0x05: return 'DCR ' + R[r1];
    case 0x06: return 'MVI ' + R[r1] + ',$' + h2(i8);
    case 0xC0: return 'R'   + CC[(op >> 3) & 7];
    case 0xC2: return 'J'   + CC[(op >> 3) & 7] + ' $' + h4(i16);
    case 0xC4: return 'C'   + CC[(op >> 3) & 7] + ' $' + h4(i16);
    case 0xC6: return ALU[(op >> 3) & 7] + 'I $' + h2(i8);
    case 0xC7: return 'RST ' + ((op >> 3) & 7);
  }
  switch (op) {
    case 0x00: return 'NOP';
    case 0x02: return 'STAX B';  case 0x07: return 'RLC';
    case 0x0A: return 'LDAX B';  case 0x0F: return 'RRC';
    case 0x12: return 'STAX D';  case 0x17: return 'RAL';
    case 0x1A: return 'LDAX D';  case 0x1F: return 'RAR';
    case 0x22: return 'SHLD $' + h4(i16);
    case 0x27: return 'DAA';
    case 0x2A: return 'LHLD $' + h4(i16);
    case 0x2F: return 'CMA';
    case 0x32: return 'STA $'  + h4(i16);
    case 0x37: return 'STC';
    case 0x3A: return 'LDA $'  + h4(i16);
    case 0x3F: return 'CMC';
    case 0x76: return 'HLT';
    case 0xC3: return 'JMP $'  + h4(i16);
    case 0xC9: return 'RET';
    case 0xCD: return 'CALL $' + h4(i16);
    case 0xD3: return 'OUT $'  + h2(i8);
    case 0xDB: return 'IN $'   + h2(i8);
    case 0xE3: return 'XTHL';  case 0xE9: return 'PCHL';
    case 0xEB: return 'XCHG';
    case 0xF3: return 'DI';    case 0xF9: return 'SPHL';  case 0xFB: return 'EI';
  }
  return 'DB $' + h2(op);
}

// I/O ポートシンボル表 (CP/M BIOS I/O ポート)
var IO_SYMS = {
  0x00:'CONIN', 0x01:'CONOUT', 0x02:'CONST',
  0x10:'DCMD', 0x11:'DTRK', 0x12:'DSEC',
  0x13:'DDMAL', 0x14:'DDMAH', 0x15:'DDRV',
  0x20:'WBOOT',
  0x30:'CYCRST', 0x31:'CYC1', 0x32:'CYC2', 0x33:'CYC3',
  0x34:'FMHZ', 0x35:'FMHZH', 0x36:'FKHZ', 0x37:'FHZ',
  0x38:'FLAT',
  0xA1:'HFILE',
};

// CP/M アドレスシンボル表（よく使われる BIOS/BDOS エントリなど）
var ADDR_SYMS = {
  0x0000:'BOOT', 0x0005:'BDOS', 0x0080:'DMA',
  0xDC00:'CCP',  0xE400:'BDOS', 0xF200:'BIOS',
};
function addrSym(a) { return ADDR_SYMS[a] || ''; }

// 8080 フラグレジスタ → 表示文字列 (例: sZ.a.P1c)
// S Z . AC . P 1 C (bit 7〜0)
function fmtFlags8080(v) {
  var f = v & 0xFF;
  return (f & 0x80 ? 'S' : 's') +
         (f & 0x40 ? 'Z' : 'z') +
         '.' +
         (f & 0x10 ? 'A' : 'a') +
         '.' +
         (f & 0x04 ? 'P' : 'p') +
         '1' +
         (f & 0x01 ? 'C' : 'c');
}
