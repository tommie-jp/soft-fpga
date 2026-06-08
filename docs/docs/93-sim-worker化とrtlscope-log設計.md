# 93. sim-worker.js 全例統一化 と rtlscope-log ライブラリ計画

2026-05-23 決定。

---

## 1. 背景・決定事項

### 現状（2026-05-23 時点）

| 例 | WASM 実行スレッド | sim-worker.js |
|----|-----------------|---------------|
| 01-counter | **メインスレッド** | なし |
| 02-traffic-fsm | **メインスレッド** | なし |
| 03-uart | **メインスレッド** | なし |
| 04-6502 | **メインスレッド** | なし |
| 05-dormann | **メインスレッド** | なし |
| 06-8080 | Web Worker ✅ | あり |

### 決定

**01〜05 を順次 Web Worker 化（sim-worker.js 導入）する。**

2パターン（main thread / Worker）を並存させるより、Worker に統一した方が：

- UI スレッドがブロックされず操作レスポンスが向上する
- ライブラリ（rtlscope-log 等）の実装が単純になる（分岐ゼロ）
- 将来の機能（SharedArrayBuffer 最適化など）を全例で使える

> **注**: `92-rtlscope-ライブラリ化候補.md` § 2「Web Worker 通信（06-8080 固有）→ 汎用化不要」は
> この決定により**方針転換**。Worker 化は全例の共通基盤として扱う。

---

## 2. 01〜05 Worker 化 移行計画

### 移行方針

`examples/06-8080/web/sim-worker.js` を雛形として、各例の差分（ring buffer ワード数・
I/O コールバック・ディスク不要など）を削ったものを各 `web/sim-worker.js` に配置する。

### 移行順序（優先度順）

```text
優先度  例                  理由
──────────────────────────────────────────────────────────────────────
🔴 高   04-6502 (Apple-I)  最も CPU ヘビー。Worker 化の UX 改善効果が最大
🟠 中   03-uart             UART 信号 LA が複雑で将来機能拡張時にも恩恵が大きい
🟡 低   02-traffic-fsm      FSM は軽量だが統一性のために移行する
🟡 低   01-counter          最小例。最後に移行してテンプレートとして整備
🟡 低   05-dormann          04-6502 の派生なので 04 移行後に追随
```

### 各例の移行タスク

各例で行う変更は共通：

1. `examples/XX/web/sim-worker.js` を新規作成
   - 雛形: `examples/06-8080/web/sim-worker.js` から不要部分を削除
   - CP/M 固有（ディスク I/O・マクロ・コールトレース等）は除去
   - 例固有の ring buffer ワード数・信号名を調整
2. `examples/XX/web/index.html` を変更
   - `<script src="sim.js">` を除去
   - `new Worker('sim-worker.js')` を追加
   - `Module.*` への直接アクセスを `workerSend` / `workerRequest` 経由に置換
   - `requestAnimationFrame` ループを Worker の `frame` メッセージ受信に変更

### 移行時の注意点

- `Module.HEAPU32` への直接参照（ring buffer の zero-copy 読取り）は
  Worker 化後は `Transferable` (`.slice().buffer`) に変わる
- `Module._send_key()` 等の直接呼び出しは `workerSend({type:'sendKey', ...})` に変わる
- xterm.js は引き続きメインスレッドに残す（DOM 操作のため）

---

## 3. rtlscope-log ライブラリ設計

### 概要

ブラウザコンソールログ（`console.*` + `Module.printErr`）を WASM FS に書き出し、
既存の CodeMirror エディタで閲覧できるようにするライブラリ。

Worker 化統一後を前提に **Worker パターン専用**で設計する（分岐なし）。

### ファイル構成

```text
js/
  rtlscope-la.js           ← 既存（Logic Analyzer）
  rtlscope-log-worker.js   ← 新規: Worker 側専用
  rtlscope-log-ui.js       ← 新規: Main thread 側専用
```

`doDeployPages.sh` が `js/*.js` を自動コピーするため deploy スクリプトの変更は不要。

### rtlscope-log-worker.js API

```js
// ログバッファ管理・Module フック・FS 書き出しを担う Worker 側ライブラリ
// importScripts で読み込む

RTLScopeLogWorker.installModule(Module)
// Module.printErr / Module.print をフック。
// importScripts('sim.js') より前・Module 定義直後に呼ぶ。

RTLScopeLogWorker.handleMessage(data, { Module, fileTimes })
// flushLog / clearLog を処理。handled なら true を返す。
// onmessage の switch 文の直前に置く。
// → 処理した場合は即 return; して switch に入らない。

RTLScopeLogWorker.getLog()   // バッファ参照（デバッグ用）
RTLScopeLogWorker.clear()    // バッファクリア
```

内部定数:

- `_WORKER_LOG_MAX = 8000` 行（超過分は先頭から破棄）
- ログ形式: `[HH:MM:SS.mmm] [ERR|SIM] <msg>`
- 書き出し先: `/worker.log`（WASM FS）

### rtlscope-log-ui.js API

```js
// console.* 捕捉・UI ボタン動作・WASM FS 書き出しを担う Main thread ライブラリ
// <script> タグで読み込む

RTLScopeLogUI.init(options)
// options:
//   workerRequest(msg, [transfer])   — Worker への Promise ベース送受信
//   openFile(name)                   — FS ファイルをエディタで開く
//   updateFSList()                   — FS 一覧の再描画
//   maxLines                         — バッファ上限（省略時 5000）

RTLScopeLogUI.attach(element)
// ボタン要素にクリックハンドラをセット

RTLScopeLogUI.flush()
// ① workerRequest({type:'flushLog'}) → Worker が /worker.log に書き込む
// ② _mainLog → workerRequest({type:'writeFS', name:'main.log'})
// ③ openFile('worker.log') でエディタを開く
```

### 各プロジェクトへの組み込み（最小変更）

**sim-worker.js（3 行追加）:**

```js
// --- 先頭 ---
importScripts('../../../js/rtlscope-log-worker.js'); // ① 追加

var Module = { ... };
RTLScopeLogWorker.installModule(Module);             // ② Module 定義直後に追加
importScripts('sim.js');

// --- onmessage ---
self.onmessage = function(e) {
  if (RTLScopeLogWorker.handleMessage(                // ③ switch 前に追加
        e.data, { Module: Module, fileTimes: fileTimes })) return;
  switch (e.data.type) { ... }
};
```

**index.html（HTML 1 行 + JS 3 行追加）:**

```html
<script src="../../../js/rtlscope-log-ui.js"></script>
<button id="btn-show-log" class="btn-dl"
        style="padding:3px 8px;font-size:12px;"
        title="コンソールログを WASM FS に書き出してエディタで開く">📋 Log</button>
```

```js
// initUI() 内に追加
RTLScopeLogUI.init({
  workerRequest: workerRequest,
  openFile:      window.openEditorFile || window.openEditorFallback,
  updateFSList:  window.updateFSList,
});
RTLScopeLogUI.attach(document.getElementById('btn-show-log'));
```

### flush フロー

```text
[📋 Log] クリック
  │
  ├─ workerRequest({type:'flushLog'})
  │       Worker: RTLScopeLogWorker.handleMessage
  │         → Module.FS.writeFile('/worker.log', _workerLog.join('\n'))
  │       → postMessage({type:'fsResult', ok:true})
  │
  ├─ _mainLog → workerRequest({type:'writeFS', name:'main.log'})
  │
  ├─ window.updateFSList()
  │
  └─ window.openEditorFile('worker.log')  ← 既存 CodeMirror エディタ
```

---

## 4. 実装フェーズ

### Phase 0: 06-8080 に rtlscope-log を導入（Worker 化済み例で先行実装・動作確認）

| ファイル | 変更内容 |
|---------|---------|
| `js/rtlscope-log-worker.js` | 新規作成 |
| `js/rtlscope-log-ui.js` | 新規作成 |
| `examples/06-8080/web/sim-worker.js` | 3 行追加 |
| `examples/06-8080/web/index.html` | 4 行追加 |

### Phase 1〜4: 01〜05 を順次 Worker 化 → rtlscope-log 組み込み

```text
Phase 1: 04-6502  Worker 化 + rtlscope-log 組み込み
Phase 2: 03-uart  Worker 化 + rtlscope-log 組み込み
Phase 3: 02-traffic-fsm  同上
Phase 4: 01-counter / 05-dormann  同上
```

---

## 5. 制約・注意点

| 事項 | 内容 |
|------|------|
| `installModule` のタイミング | `importScripts('sim.js')` の **前**でないと Emscripten 初期化ログが捕捉されない |
| `Module.print` の対象（8080） | CP/M コンソール出力は `_get_display_char()` 経由なので `Module.print` には流れない |
| `/worker.log` の寿命 | ページリロードで消える。永続化は既存の IDB-based FS save 機能で対応可 |
| CodeMirror ASCII フィルタ | ログ **表示**（readFS → CM）は読み取り専用なのでフィルタ無関係 |
| `rtlscope-log-ui.js` の Editor 依存 | `openFile` が未提供の場合 `window.open(Blob URL)` でフォールバック表示する |

---

## 6. 関連ドキュメント

- [91-rtlscope-la-LogicAnalyzerライブラリ.md](91-rtlscope-la-LogicAnalyzerライブラリ.md) — LA ライブラリ（設計の参考）
- [92-rtlscope-ライブラリ化候補.md](92-rtlscope-ライブラリ化候補.md) — ライブラリ候補一覧 ※ Worker 方針を更新済み
- [05-deploy-gh-pages.md](05-deploy-gh-pages.md) — デプロイ手順
