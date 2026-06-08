# 58. DDT 自動化

## 1. 概要

CP/M 2.2 の DDT（Dynamic Debugging Tool）はインタラクティブ専用で、  
`.SUB` ファイル（SUBMIT）から **DDT 内部コマンドを送ることはできない**。

このシミュレーター上では以下の方法で自動化できる。

---

## 2. 方法の比較

| 方法 | DDT 内コマンド自動化 | 難易度 |
|------|---------------------|--------|
| ブラウザ `sendKey` 注入 | ✅ できる | 低（JS） |
| CP/M SUBMIT | ❌ DDT 内部は不可 | — |
| 独自 .COM プログラム | ✅（DDT 不使用） | 高（asm） |
| Node.js WASM テスト | ✅（DDT 不使用） | 低（JS） |

---

## 3. 方法 1: ブラウザ `sendKey` 注入（推奨）

### 3.1 `index.html` への追加

```javascript
// グローバル公開: コンソールから autoType("ddt\r") で使用可
window.autoType = async function(str, intervalMs = 30) {
  for (const ch of str) {
    const code = ch === '\r' ? 13 : ch === '\n' ? 13 : ch.charCodeAt(0);
    workerSend({ type: 'sendKey', ch: code });
    if (intervalMs > 0) await new Promise(r => setTimeout(r, intervalMs));
  }
};

// DDT コマンド列を実行するヘルパー
window.ddtScript = async function(commands, waitMs = 400) {
  for (const cmd of commands) {
    await window.autoType(cmd + '\r');
    await new Promise(r => setTimeout(r, waitMs));
  }
};
```

### 3.2 使い方（ブラウザのコンソール）

```javascript
// DDT を起動 (CP/M コマンドライン)
await ddtScript(['ddt myprogram.com'], 1000);

// DDT 内コマンドを順番に実行
await ddtScript([
  'd0100,0110',   // Display: メモリダンプ
  'l0100',        // List: 逆アセンブル
  'g0100',        // Go: 実行
  'x',            // eXamine: レジスタ表示
], 300);
```

---

## 4. 方法 2: CP/M SUBMIT でできる範囲

SUBMIT はシェルスクリプト相当だが、DDT の内部コマンドは送れない。  
「DDT を起動する」ところまでのみ自動化可能。

```text
; AUTO.SUB — SUBMIT AUTO で実行
DDT MYPRG.COM
```

DDT 起動後の `D`, `G`, `T` 等は自動化できない。

---

## 5. 方法 3: Node.js WASM テスト（DDT 不使用）

DDT と同等の操作を Node.js から WASM 経由で行う方法。  
詳細は [`26-Vitestタイミングテスト.md`](26-Vitestタイミングテスト.md) を参照。

### 5.1 主な API

| DDT コマンド | API |
|---|---|
| `D addr` | `sim.M._sim_read_byte(addr)` |
| `S addr val` | `sim.poke(addr, val)` |
| `R` | `sim.M._sim_snap_regs()` → 12 バイト配列 |
| `G addr` | `sim.setInstrTrigger(addr, -1)` + `sim.step()` ループ |
| `T` | `sim.step()` |

### 5.2 最小スクリプト例

```javascript
import { loadSim } from './tests/helpers/sim.mjs';

const sim = await loadSim();
sim.init();

// プログラムを配置
sim.poke(0x0000, 0xC3); sim.poke(0x0001, 0x00); sim.poke(0x0002, 0x01);
sim.pokeBytes(0x0100, [0x3E, 0x42, 0xC6, 0x01, 0x76]); // MVI A,42 / ADI 1 / HLT

// 0x0104 (HLT) まで実行
sim.clearTrigger();
sim.setInstrTrigger(0x0104, -1);
for (let i = 0; i < 50000; i++) {
  sim.step();
  if (sim.isTriggerHit()) break;
}

// レジスタ読み出し [A, F, B, C, D, E, H, L, SPH, SPL, PCH, PCL]
const regPtr = sim.M._sim_snap_regs() >>> 0;
const regs   = new Uint8Array(sim.M.HEAPU8.buffer, regPtr, 12);
console.log(`A=0x${regs[0].toString(16).padStart(2, '0')}`); // → A=0x43
```

実行:

```bash
cd examples/06-8080
node my-script.mjs
```

---

## 6. DDT コマンドリファレンス（手動操作用）

| コマンド | 書式 | 動作 |
|---|---|---|
| D | `Dssss` / `Dssss,eeee` | メモリダンプ（16 進 + ASCII） |
| L | `Lssss` | 逆アセンブル |
| G | `Gssss` | 指定アドレスから実行 |
| T | `T` | 1 命令トレース（レジスタ表示付き） |
| U | `U` | Until（サブルーティン呼び出しをスキップしてトレース） |
| R | `Rfilespec` | ファイルをメモリに読み込む |
| S | `Saaaa` | メモリ内容を 1 バイトずつ表示・設定 |
| X | `X` / `Xreg` | レジスタ表示・設定 |
| I | `Ifilespec` | 入力ファイル名を設定（G 実行時の FCB に使用） |
| H | `Haaaa,bbbb` | 16 進演算（加算・減算） |
| M | `Mssss,eeee,dddd` | メモリブロックコピー |
| F | `Fssss,eeee,vv` | メモリブロックフィル |
| Q | —（`^C`） | DDT 終了・CP/M に戻る |
