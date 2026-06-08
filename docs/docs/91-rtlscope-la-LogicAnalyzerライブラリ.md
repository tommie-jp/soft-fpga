# 91. rtlscope-la.js — 汎用 Logic Analyzer Canvas ライブラリ

`js/rtlscope-la.js` は、soft-FPGA 各例（01〜06 以降）で共用できる
汎用 Logic Analyzer Canvas レンダリングライブラリ。

06-8080 の `index.html` に直書きされていた LA コードを 2026-05-22 に抽出・ライブラリ化した。

---

## 1. 配置とロード方法

```text
soft-FPGA/
└── js/
    └── rtlscope-la.js      ← ライブラリ本体
examples/06-8080/web/
└── index.html              ← <script src="../../../js/rtlscope-la.js"> でロード
```

HTML からは次のように読み込む（`<script type="module">` より前に置く）。

```html
<script src="../../../js/rtlscope-la.js"></script>
```

### ローカル開発（serve.py）

`serve.py` は `examples/XX/web/` をルートとして起動する。
`doStart.sh` が次のシンボリックリンクを自動生成する。

```bash
ln -sfn "$ROOT/js" "$SCRIPT_DIR/js"
```

これにより `http://localhost:8000/js/rtlscope-la.js` が解決される。
シンボリックリンクは `.gitignore` 除外済み（追跡しない）。

### GitHub Pages デプロイ

`scripts/doDeployPages.sh` が `js/*.js` を `$WORKTREE/js/` にコピーする。

```text
gh-pages ブランチ/
├── js/
│   └── rtlscope-la.js      ← コピー済み
└── 06-8080/
    └── index.html          ← ../../../js/rtlscope-la.js → /js/rtlscope-la.js
```

---

## 2. 設計方針：コールバック注入

ライブラリ本体はプロジェクト固有コードをゼロ含む。
プロジェクト固有の処理はコンストラクタ config のコールバックで注入する。

| コールバック | 内容 | 8080 例 |
|-------------|------|---------|
| `decodeLane.render` | デコードレーン描画 | M-CYC（FETCH/MEM RD/WR/IO IN/OUT） |
| `formatters` | 値フォーマット関数辞書 | `flags8080`（SZ-AC-PV-C 表示） |
| `signalBackground` | 信号背景色 | CPM_REGIONS（OS/BIOS/RAM 色分け） |
| `getTState` | T-state 番号抽出 | `(w0) => (w0 >>> 26) & 0x3F` |
| `getCursorExtra` | カーソル補足情報 | `T3(MEM RD)` 形式の文字列 |

いずれも `null` を渡せば無効化される。

---

## 3. コンストラクタ設定リファレンス

```javascript
window.la = new RTLScopeLA({
  // ── 必須 ──
  canvasId:      'la',           // Canvas 要素 ID
  togglesId:     'la-toggles',  // トグル UI 挿入先 ID
  signals:       LA_SIGNALS,    // 信号定義配列（後述）
  groups:        LA_GROUPS,     // グループ定義配列
  ringSize:      4096,          // リングバッファ サンプル数（2の累乗）
  ringWords:     6,             // 1サンプルあたりの uint32 ワード数

  // ── 任意 ──
  storagePrefix: 'la_',         // localStorage キー接頭辞
  width:         900,           // Canvas 幅 (px)
  labelWidth:    56,            // 信号ラベル幅 (px)
  trackH:        28,            // 1トラック高さ (px)
  timeRulerH:    14,            // 時間ルーラー高さ (px)
  decodeLaneH:   22,            // デコードレーン高さ (px)

  // ── コールバック ──
  decodeLane:        { label: 'M-CYC', render: fn(ctx, p) },
  formatters:        { 'flags8080': fn(val) → str },
  signalBackground:  fn(sig, val) → fillStyle or null,
  getTState:         fn(word0) → number,
  getCursorExtra:    fn(heapu32, ringSize, ringWords, absIdx) → str or null,
});
```

### 信号定義オブジェクト

```javascript
{ id:'addr', label:'AB', word:0, bit:0, type:'hex', width:16,
  color:'#88ccff', on:true, fmt:'dec', tip:'ツールチップ文字列' }
```

| フィールド | 意味 |
|-----------|------|
| `type` | `'bit'`（1ビット波形）または `'hex'`（多ビットセグメント） |
| `word` | ring buffer の何ワード目か（0-based） |
| `bit` | そのワード内のビットシフト量 |
| `fmt` | `'dec'` → 10進表示、`'flags8080'` → カスタム formatter 名 |

---

## 4. 公開 API

| メソッド | 説明 |
|---------|------|
| `update(head, heapu32, frozen, trigFireHead)` | RAF ループから毎フレーム呼ぶ |
| `buildToggles()` | トグル UI を DOM に生成する |
| `setZoom(idx)` | ズームインデックスを設定（0〜8: 0.25x〜64x） |
| `freeze()` / `thaw()` | フリーズ / 解除 |
| `setFrozen(bool)` | フリーズ状態を直接設定 |
| `setEnabled(bool)` | LA 全体 ON/OFF |
| `setTrigFireHead(head)` | トリガー発火位置を設定 |
| `gotoTrig()` | トリガー位置をビュー中央へ移動 |
| `_drawOff()` | OFF 表示を描画（LA 無効時） |

| getter | 説明 |
|--------|------|
| `.zoom` | 現在のズーム倍率 |
| `.zoomLabel` | `'4x'` / `'1/2x'` 形式の文字列 |
| `.frozen` | フリーズ中か否か |
| `.enabled` | LA が有効か否か |

---

## 5. 各例との互換性

### リングバッファ ワード数

| 例 | ringWords | 備考 |
|----|:---------:|------|
| 01-counter | 1 | `struct Sample { uint32_t count; }` |
| 02-traffic-fsm | 1 | 1 ワードにビットパック |
| 03-uart | 1 | 1 ワードにビットパック |
| 04-6502 / Apple-I | 2 | Word0: AB/DB/WE/SYNC、Word1: A/X/Y/SP |
| 06-8080 / CP/M | 6 | Word0〜5 に全信号を格納 |

### 呼び出し方の違い

06-8080 は Web Worker + SharedArrayBuffer（スナップショット転送）なので、
`update()` に渡す `heapu32` はリングのスナップショット（index 0 = ring[0]）。

01/02/03/04 は同期 Emscripten Module（`Module.HEAPU32` + `ringBase` オフセット）なので、
`subarray` でスライスして渡す。

```javascript
// 01〜04 の場合（ringWords=1 の例）
const ringBase = Module._get_ring_ptr() >>> 2;   // byte → uint32 index
const ringSnap = Module.HEAPU32.subarray(ringBase, ringBase + RING_SIZE * 1);
la.update(head, ringSnap, false, -1);
```

コピーなし（ビュー）なのでオーバーヘッドはゼロ。

---

## 6. UI 機能一覧（2026-05-22 時点）

| 機能 | 説明 |
|------|------|
| zoom/pan | ズームボタン・ホイール・ピンチ（タッチ）・ドラッグでパン |
| マーカー A/B | クリックで A、Shift+クリックまたは右クリックで B。A-B 差分を T ステート数で表示 |
| カーソル tooltip | マウス位置の全信号値 ＋ getCursorExtra 追加情報 |
| 信号トグル | グループ別チェックボックス、ON の信号は色付き表示 |
| 信号並べ替え | ラベル列ドラッグで表示順を変更（localStorage 永続化） |
| デコードレーン | M-CYC など上部 1 ライン。チェックボックスで表示/非表示 |
| T ステートグリッド | getTState が返す値が 1 の位置に縦線（T1 境界） |
| トリガーライン | setTrigFireHead した位置に赤縦線 "TRIG" |
| ズーム 4x 以上 | 全信号の全セグメントに値を表示（重なり許容） |
| M-CYC ラベル | 幅があれば `MEM RD`、狭ければ `RD`（WR/IN も同様） |
| hex 値 | `0x` プレフィックスなし、桁幅に応じてフル/ショート切替 |
| `fmt:'dec'` | 10進表示（T-state 信号など） |
| DPR 対応 | `devicePixelRatio` に応じた高解像度描画 |

---

## 7. ローカルサーバー起動手順

```bash
cd examples/06-8080/web
bash doStart.sh     # ビルド済みなら --no-build オプション相当（要改修）
# → http://localhost:8000/
```

`doStart.sh` が `js` シンボリックリンクを自動生成するので、
手動で `ln -sfn` を実行する必要はない。

---

## 8. 今後の拡張予定

- **04-6502 への移行**: `04-6502/web/index.html` の旧 `drawLA` を RTLScopeLA に置き換え（6502 ページ本格リニューアル時）
- **01/02/03 への移行**: 各例リニューアル時に順次移行
- **UART デコードレーン**: START/DATA/STOP フレームを色ブロック表示（03-uart 向け）
- **6502 サイクル デコードレーン**: FETCH/READ/WRITE の色分け（04-6502 向け）
