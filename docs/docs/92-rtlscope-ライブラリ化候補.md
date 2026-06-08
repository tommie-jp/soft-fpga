# 92. rtlscope ライブラリ化候補メモ

各例（01〜06 以降）の `index.html` を横断調査した結果。
2026-05-22 時点の評価。

---

## 1. 調査対象ファイルと規模

| ファイル | 行数 | 特徴 |
|---------|-----:|------|
| `examples/01-counter/web/index.html` | ~130 | 最小構成（ダーク固定・ズームなし） |
| `examples/02-traffic-fsm/web/index.html` | ~355 | State Diagram + 簡易 LA |
| `examples/03-uart/web/index.html` | ~315 | UART 信号 LA + 受信履歴 |
| `examples/04-6502/web/index.html` | ~485 | xterm.js + Dormann テスト分岐 |
| `examples/06-8080/web/index.html` | ~2430 | Worker・CP/M マクロ・多機能 |
| `js/rtlscope-la.js` | ~890 | **既にライブラリ化済み** |

---

## 2. 候補一覧

### 🔴 高価値 — `js/rtlscope-term.js`（xterm.js ラッパー）

**対象例**: 04-6502、06-8080（将来: 07-Z80 / 08-8085 など端末を持つ例）

#### 重複している共通コア（~20行）

```javascript
// 両ファイルで実質同一
const term = new Terminal({ fontSize: 14, fontFamily: 'monospace', ... });
term.open(document.getElementById('terminal'));
term.onData(function(s) {
  for (var i = 0; i < s.length; i++) Module._send_key(s.charCodeAt(i));
});
// 文字出力
function writeChar(c) { term.write(String.fromCharCode(c)); }
```

#### 06-8080 の追加機能（コールバックで注入）

- CP/M マクロ（`onData` フック）
- WordMaster キーバインド変換
- エスケープシーケンス拡張

#### 設計イメージ

```javascript
window.la_term = new RTLScopeTerm({
  containerId: 'terminal',
  sendKey:     function(code) { Module._send_key(code); },  // または workerSend
  fontSize:    14,
  onData:      null,   // 追加フック（マクロ等）
});
la_term.write(charCode);
```

**移行タイミング**: 07-Z80 を作り始める前、または 04-6502 をリニューアルする時。

---

### 🟠 中価値 — `js/rtlscope-sim.js`（Emscripten Module 初期化 + RAF ループ）

**対象例**: 01〜04（同期 Module パターン）

#### 重複している共通コア

```javascript
// 4ファイルで完全に同一
const RING_SIZE = Module._get_ring_size();
const ringBase  = Module._get_ring_ptr() >>> 2;   // byte → uint32 index
// la.update() 呼び出し時
const ringSnap = Module.HEAPU32.subarray(ringBase, ringBase + RING_SIZE * RW);

// RAF ループ骨格も同じ
function loop() {
  if (running) { /* サンプル取得 → 描画 */ }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

#### 注意点

- 01〜04 は各 100〜485 行と小さく、削減量は限定的
- 06-8080 は Web Worker 経由なので**このパターンに合わない**
- 優先度は 01〜04 リニューアル時でよい

---

### 🟡 低価値（当面は不要）

#### State Diagram（02-traffic-fsm 固有）

- 信号機 4 状態に特化した Canvas 描画（~80 行）
- 各 FSM で遷移構造が異なるため汎用化コストが高い
- 将来的には [Cytoscape.js](https://cytoscape.org/) 等の既存ライブラリ導入を検討

#### テーマ切替（06-8080 固有）

- ライト/ダーク/グリーン/アンバー/ペーパーの 5 種（~80 行）
- 01〜04 は固定ダーク → 他例をリニューアルする時に移植すれば十分

#### Web Worker 通信（06-8080 固有）

- CP/M ディスク I/O・大容量 WASM に特化
- 01〜04 はシングルスレッドで問題なし → 汎用化不要

---

## 3. 優先ロードマップ

```text
優先度  ライブラリ           対象例              タイミング
──────────────────────────────────────────────────────────────
🔴 高   rtlscope-term.js    04-6502, 06-8080   07-Z80 着手前 / 04 リニューアル時
🟠 中   rtlscope-sim.js     01〜04             各例リニューアル時（必要に応じて）
🟡 低   State Diagram       02-traffic-fsm     02 リニューアル時に Cytoscape 検討
🟡 低   テーマ切替           全例               全例リニューアル後
```

---

## 4. 既存ライブラリとの関係

```text
js/
├── rtlscope-la.js    ✅ 完成（Logic Analyzer Canvas、zoom/pan・マーカー等）
├── rtlscope-term.js  🔜 次候補（xterm.js ラッパー）
└── rtlscope-sim.js   💡 将来候補（Emscripten Module + RAF ループ）
```

設計方針は `rtlscope-la.js` と同様：
**ライブラリ本体は汎用、プロジェクト固有処理はコールバックで注入**。

---

## 関連ドキュメント

- [91-rtlscope-la-LogicAnalyzerライブラリ.md](91-rtlscope-la-LogicAnalyzerライブラリ.md) — LA ライブラリ詳細
- [90-rtlscope-OBSERVEマクロ設計メモ.md](90-rtlscope-OBSERVEマクロ設計メモ.md) — RTL レベルの OBSERVE マクロ
