# 94. xterm-jp106 キーボードライブラリ

## 1. 概要

`js/xterm-jp106.js` — xterm.js 向け日本語 106 キーボード補正ライブラリ。

### 1.1 動機

- Windows の IME / キーボードレイアウト設定が US になっていると、xterm.js は JP 106
  キーボードの記号キーを US 配列として解釈してしまう。
- `e.key` は OS レイアウト設定に依存するため使用不可。
- `e.code`（物理キー位置、レイアウト非依存）と `e.shiftKey` を組み合わせて JP 106 配列を
  明示的にルックアップする方式を採用した。

### 1.2 キー処理の優先順位

```text
入力イベント
  │
  ├─① SUPPRESS_CODES  IME・システムキーを抑制（レイアウト問わず）
  │       半角/全角, 無変換, 変換, カタカナ/ひらがな,
  │       Windowsキー, PrintScreen, ScrollLock, Pause
  │
  ├─② extraMap        アプリ定義カスタムキー（レイアウト問わず）
  │       F1='HELP\r' 等を onSendSeq で送出
  │
  ├─③ xterm.js 委任  US 配列 / Ctrl+key / F1〜F12 / 矢印 / ナビゲーション
  │       （xterm.js が正しい VT100/xterm ESC シーケンスを送出）
  │
  └─④ JP106_TABLE    jp106 モード時の記号リマップ
          e.code + e.shiftKey → 文字 → onSendKey/onInputChar
```

## 2. API

```javascript
var jp = new XtermJP106(opts);
```

### 2.1 コンストラクタオプション

| オプション | 型 | 必須 | 説明 |
|---|---|---|---|
| `term` | `Terminal` | ✅ | xterm.js Terminal インスタンス |
| `onSendKey` | `function(charCode)` | ✅ | 1 文字コードを受け取り端末へ送信する |
| `onSendSeq` | `function(seq)` | — | ESC シーケンス文字列を受け取り端末へ送信する。省略時は `onSendKey` を 1 バイトずつ呼ぶ |
| `onInputChar` | `function(ch)` | — | 印字可能文字 `ch` を受け取り `inputBuf` 等を更新する |
| `storageKey` | `string` | — | localStorage キー（既定: `'xterm_jp106_layout'`） |
| `debug` | `boolean` | — | コンソールログ有効化（既定: `false`） |
| `autoDetect` | `boolean` | — | localStorage 未設定時に `getLayoutMap()` で自動検知（後述） |
| `captureCtrl` | `boolean\|string[]` | — | Ctrl+key 横取り（後述。既定 `true` = Ctrl+[A-Z] 全て） |
| `captureAlt` | `boolean\|object[]` | — | Alt+矢印キーの横取り（後述。既定: `DEFAULT_ALT_CAPTURE`） |
| `extraMap` | `object` | — | カスタムキー→シーケンスマップ（後述） |

### 2.2 インスタンスメソッド

| メソッド | 説明 |
|---|---|
| `getLayout()` | 現在のレイアウト文字列を返す（`'us'` / `'jp106'`） |
| `setLayout(layout)` | レイアウトを切り替え（localStorage ＋ バインド済みラジオボタンも更新） |
| `bindLayoutBar(radios)` | `<input type="radio">` 集合と双方向バインド |
| `detect()` | `getLayoutMap()` で自動検知して `setLayout()` を呼ぶ。`Promise<string\|null>` を返す |
| `attachToInput(el, insertFn?)` | textarea や CodeMirror コンテナに JP106 補正を付与（後述） |

#### `attachToInput(el, insertFn?)`

xterm.js 以外の入力要素（テキストエディタ等）に同じ JP106 補正を適用する。

- `el`: キーイベントを受け取る DOM 要素（textarea / CodeMirror コンテナ等）
- `insertFn(ch)`: 省略時は `document.execCommand('insertText')` → `selectionStart` 直接操作のフォールバック

**ターミナルとの違い:**

- `captureCtrl` / `captureAlt` は適用しない（エディタの Ctrl+S・Ctrl+A 等はそのまま通す）
- capture フェーズ（`useCapture: true`）で登録するため CodeMirror の内部ハンドラより先に発火し、`preventDefault()` で二重入力を防ぐ
- 同一要素への二重登録は自動的に無視される

**使用例:**

```javascript
// CodeMirror 6 コンテナへの適用
var container = document.getElementById('editor-cm');
jp106.attachToInput(container, function(ch) {
  cmView.dispatch(cmView.state.replaceSelection(ch));
});

// textarea へのデフォルト適用（insertFn 省略）
jp106.attachToInput(textareaEl);
```

**注意:** `insertFn` がある場合は CodeMirror 等のエディタ API 経由で挿入するため
Undo 履歴（Ctrl+Z）も正しく機能する。`insertFn` を省略した場合の `execCommand` は
一部ブラウザで Undo 履歴に乗らないことがある。

### 2.3 静的プロパティ（参照・テスト用）

| プロパティ | 内容 |
|---|---|
| `XtermJP106.TABLE` | JP 106 記号マップ |
| `XtermJP106.SUPPRESS_CODES` | 常に抑制するキーコード一覧 |
| `XtermJP106.FKEY_SEQ` | F1〜F12 ESC シーケンス参照表（xterm.js 既定値） |
| `XtermJP106.NAV_SEQ` | 矢印・ナビゲーション ESC シーケンス参照表 |
| `XtermJP106.DETECT_PROBES` | 自動検知で使用する照合キー一覧 |
| `XtermJP106.DEFAULT_CTRL_CAPTURE` | Ctrl+key 横取りのデフォルトリスト |
| `XtermJP106.DEFAULT_ALT_CAPTURE` | Alt+矢印横取りのデフォルトリスト |

### 2.4 captureCtrl — ブラウザに取られる Ctrl+key の横取り

#### 問題

Chrome / Edge は Ctrl+W（タブを閉じる）、Ctrl+R（再読み込み）等を
**ブラウザレベルで処理**する。xterm.js が `e.preventDefault()` を呼んでも
間に合わない場合がある。

#### 解決策：document capture フェーズで先行取得

```text
イベント伝播（capture → bubble）
  document  ←── ① ここで捕まえる（capture フェーズ）
    │                preventDefault()  タブが閉じない
    │                stopPropagation() xterm.js に届かない（二重送信防止）
    │                onSendKey(0x17)   端末へ Ctrl+W(0x17) を送る
    ▼
  xterm.js のリスナ（届かない）
```

#### 設定例

```javascript
// 既定（Ctrl+[A-Z] を全て横取り）
new XtermJP106({ term, onSendKey });                     // captureCtrl 省略 = true
new XtermJP106({ term, onSendKey, captureCtrl: true });  // 明示的に全横取り

// 一部だけ横取り（後方互換・細かい制御が必要な場合のみ）
new XtermJP106({ term, onSendKey, captureCtrl: ['KeyW', 'KeyD'] });

// 無効化（ブラウザのデフォルト動作を優先）
new XtermJP106({ term, onSendKey, captureCtrl: false });
```

#### 横取り対象: Ctrl+[A-Z] 全 26 キー

フォーカス中は `e.code = 'Key[A-Z]'` の全 Ctrl+letter を横取りする。
Ctrl+Shift+I（DevTools）等の Shift 付きや Ctrl+数字（タブ切り替え）は対象外。

| キー | 制御文字 | 主なブラウザ動作 | 端末での用途 |
|---|---|---|---|
| Ctrl+A | 0x01 | テキスト全選択 | 行先頭（readline） |
| Ctrl+B | 0x02 | — | 1文字左（readline） |
| Ctrl+C | 0x03 | コピー | **割り込み (SIGINT)** |
| Ctrl+D | 0x04 | ブックマーク | **EOF・ログアウト** |
| Ctrl+E | 0x05 | — | 行末（readline） |
| Ctrl+F | 0x06 | 検索 | 1文字右（readline） |
| Ctrl+G | 0x07 | — | BEL |
| Ctrl+H | 0x08 | 履歴タブ | Backspace |
| Ctrl+I | 0x09 | — | Tab |
| Ctrl+J | 0x0A | ダウンロード | LF |
| Ctrl+K | 0x0B | — | 行末削除（readline） |
| Ctrl+L | 0x0C | アドレスバー | 画面クリア |
| Ctrl+M | 0x0D | — | CR (Enter 相当) |
| Ctrl+N | 0x0E | 新規ウィンドウ | 次の履歴（readline） |
| Ctrl+O | 0x0F | — | DC3 |
| Ctrl+P | 0x10 | 印刷 | 前の履歴（readline） |
| Ctrl+Q | 0x11 | — | XON（フロー再開） |
| Ctrl+R | 0x12 | **再読み込み** | reverse-search（readline） |
| Ctrl+S | 0x13 | 保存 | XOFF（フロー停止） |
| Ctrl+T | 0x14 | 新規タブ | DC4 |
| Ctrl+U | 0x15 | ソース表示 | **行全削除（readline）** |
| Ctrl+V | 0x16 | 貼り付け | SYN |
| Ctrl+W | 0x17 | **タブを閉じる** | **単語削除（readline）** |
| Ctrl+X | 0x18 | 切り取り | CAN |
| Ctrl+Y | 0x19 | — | yank（readline） |
| Ctrl+Z | 0x1A | 元に戻す | **SIGTSTP（一時停止）** |

> **注意**: Ctrl+V（貼り付け）と Ctrl+C（コピー）も横取りされるため、
> クリップボードからの貼り付けは右クリック→貼り付け、またはターミナル外で
> フォーカスを外してから操作する。

#### 修飾キー単体の扱い

| キー | 扱い | 理由 |
|---|---|---|
| Ctrl 単体 | 横取り不要 | 文字を送らない・ブラウザ動作なし |
| Shift 単体 | 横取り不要 | 同上 |
| Alt 単体 | 横取り不要 | Chrome ではメニュー起動しない |
| Windows キー | `SUPPRESS_CODES` で抑制済み | OS レベルで取られるため JS では阻止不可 |

#### 注意

- ターミナル要素にフォーカスがある間のみ横取りする（`term.element.contains(activeElement)`）
- ターミナル外でフォーカスが外れているときは通常通りブラウザの動作になる
- Ctrl+R を横取りするとページを再読み込みできなくなる。F5 か、ターミナル外でクリックしてから Ctrl+R で対処する

### 2.5 captureAlt — Alt+矢印キーの横取り

#### 問題

ブラウザは Alt+← / Alt+→ を「戻る/進む」として処理する。
端末での readline は Alt+左右で単語単位のカーソル移動（ESC b / ESC f）に使う。

#### 既定の横取り対象（`DEFAULT_ALT_CAPTURE`）

| キー | 送出シーケンス | readline での動作 |
|---|---|---|
| Alt+← | `ESC b` (`\x1bb`) | backward-word（単語を左へ移動） |
| Alt+→ | `ESC f` (`\x1bf`) | forward-word（単語を右へ移動） |
| Alt+↑ | `ESC <` (`\x1b<`) | beginning-of-history（履歴の先頭） |
| Alt+↓ | `ESC >` (`\x1b>`) | end-of-history（履歴の末尾） |

#### 設定例

```javascript
// 既定（DEFAULT_ALT_CAPTURE を使用）
new XtermJP106({ term, onSendKey, captureAlt: true });

// カスタム（Alt+← と Alt+→ だけ、別のシーケンスで）
new XtermJP106({ term, onSendKey, captureAlt: [
  { code: 'ArrowLeft',  seq: '\x1b[1;3D' },  // xterm Alt+← 形式
  { code: 'ArrowRight', seq: '\x1b[1;3C' },  // xterm Alt+→ 形式
]});

// 無効化
new XtermJP106({ term, onSendKey, captureAlt: false });
```

### 2.6 autoDetect — 自動検知

`autoDetect: true` を指定すると、**初回訪問時**（localStorage に設定がない場合のみ）
`navigator.keyboard.getLayoutMap()` API でレイアウトを自動判定し `setLayout()` を呼ぶ。

```javascript
new XtermJP106({
  term: term,
  autoDetect: true,   // ← 未設定時に自動検知
  // ...
});
```

#### 検知の仕組み

`DETECT_PROBES` に定義した複数のキーを `getLayoutMap()` で照会し、
JP106 期待値との一致数（スコア）で多数決を取る。

| `e.code` | JP106 期待値 | US 期待値 |
|---|---|---|
| `BracketLeft` | `@` | `[` |
| `Equal` | `^` | `=` |
| `Quote` | `:` | `'` |
| `Semicolon` | `;` | `;` |

`jp106Score >= usScore` なら jp106 モードに設定する。

#### ブラウザ対応

| ブラウザ | 対応 |
|---|---|
| Chrome 97+ | ✅ |
| Edge 97+ | ✅ |
| Firefox | ❌（非対応時は何もしない） |
| Safari | ❌（非対応時は何もしない） |

#### ユーザーが手動で変更した場合

`bindLayoutBar()` でバインドしたラジオボタンを操作すると `setLayout()` が呼ばれ、
localStorage に設定が保存される。次回以降は `autoDetect: true` でも
「localStorage に設定あり」としてスキップされるため、ユーザー設定が優先される。

### 2.7 extraMap — カスタムキー割り当て

`e.code` をキーとするオブジェクト。値は文字列か `function(e) → string|null`。

```javascript
extraMap: {
  // 例: F1 を CP/M HELP コマンドに割り当て
  'F1': 'HELP\r',

  // 例: F2 は Shift の有無で送るシーケンスを変える
  'F2': function(e) {
    return e.shiftKey ? '\x1b[1;2Q' : XtermJP106.FKEY_SEQ['F2'];
  },
}
```

- SUPPRESS_CODES にあるキーより extraMap は優先されない（抑制が先）
- Ctrl / Meta が押されている場合は extraMap を適用せず xterm.js に委任

### 2.8 使用例（CP/M ターミナル）

```javascript
var _jp106 = new XtermJP106({
  term:        term,
  storageKey:  'cpm_kbd_layout',
  onSendKey:   function (charCode) {
    workerSend({ type: 'sendKey', ch: charCode });
  },
  onSendSeq:   function (seq) {
    for (var i = 0; i < seq.length; i++) {
      workerSend({ type: 'sendKey', ch: seq.charCodeAt(i) });
    }
  },
  onInputChar: function (ch) {
    inputBuf += ch;
    histIdx = -1;
  },
  debug: true,
});
_jp106.bindLayoutBar(document.querySelectorAll('input[name="kbd-layout"]'));
```

## 3. キーカテゴリ別の動作一覧

### 3.1 JP106 記号マップ（jp106 モード時のみ）

`XtermJP106.TABLE` として公開。形式: `{ e.code: [通常, Shift] }`。`null` = 送信なし。

| `e.code` | Shift OFF | Shift ON | 備考 |
|---|---|---|---|
| `Digit1` | `1` | `!` | |
| `Digit2` | `2` | `"` | US では `@` |
| `Digit3` | `3` | `#` | |
| `Digit4` | `4` | `$` | |
| `Digit5` | `5` | `%` | |
| `Digit6` | `6` | `&` | US では `^` |
| `Digit7` | `7` | `'` | US では `&` |
| `Digit8` | `8` | `(` | US では `*` |
| `Digit9` | `9` | `)` | |
| `Digit0` | `0` | *(未定義)* | |
| `Minus` | `-` | `=` | US では `_` |
| `Equal` | `^` | `~` | US では `=` / `+` |
| `BracketLeft` | `@` | `` ` `` | US では `[` / `{` |
| `BracketRight` | `[` | `{` | US では `]` / `}` |
| `Backslash` | `]` | `}` | US では `\` / `\|` |
| `Semicolon` | `;` | `+` | US では `;` / `:` |
| `Quote` | `:` | `*` | US では `'` / `"` |
| `Comma` | `,` | `<` | |
| `Period` | `.` | `>` | |
| `Slash` | `/` | `?` | |
| `IntlYen` | `\` | `\|` | JP 固有キー（¥マーク） |
| `IntlRo` | `\` | `_` | JP 固有キー（ろ） |

### 3.2 常に抑制するキー（`SUPPRESS_CODES`）

レイアウト（US / jp106）に関係なく端末へ送らない。

| `e.code` | キー名 | 理由 |
|---|---|---|
| `Backquote` | 半角/全角 | IME トグル。JP106 の物理位置は US の `` ` `` / `~` |
| `NonConvert` | 無変換 | IME 制御 |
| `Convert` | 変換 | IME 制御 |
| `KanaMode` | カタカナ/ひらがな | IME 制御 |
| `MetaLeft` | Windows キー (左) | OS が先取りするが届いた場合も抑制 |
| `MetaRight` | Windows キー (右) | 同上 |
| `PrintScreen` | PrintScreen | 端末上に意味なし |
| `ScrollLock` | ScrollLock | 端末上に意味なし |
| `Pause` | Pause/Break | 端末上に意味なし |

### 3.3 xterm.js に委任するキー（デフォルト）

以下は `JP106_TABLE` 外・`SUPPRESS_CODES` 外なので `return true` → xterm.js が処理。

| キー | xterm.js が送出するシーケンス（参考） |
|---|---|
| F1 〜 F4 | `\x1bOP` 〜 `\x1bOS` |
| F5 | `\x1b[15~` |
| F6 | `\x1b[17~` |
| F7 | `\x1b[18~` |
| F8 | `\x1b[19~` |
| F9 | `\x1b[20~` |
| F10 | `\x1b[21~` |
| F11 | `\x1b[23~` |
| F12 | `\x1b[24~` |
| ↑ | `\x1b[A` |
| ↓ | `\x1b[B` |
| → | `\x1b[C` |
| ← | `\x1b[D` |
| Insert | `\x1b[2~` |
| Delete | `\x1b[3~` |
| Home | `\x1bOH` |
| End | `\x1bOF` |
| PageUp | `\x1b[5~` |
| PageDown | `\x1b[6~` |
| Ctrl+C | `0x03` |
| Ctrl+Z | `0x1a` |
| Ctrl+A〜Z | `0x01`〜`0x1a` |

`extraMap` を使うと特定キーのシーケンスを上書きできる。

## 4. テスト計画（未実装）

### 4.1 ユニットテスト（静的検証）

**ファイル候補**: `verif/kbd/test_jp106.js`

検証内容:

- `XtermJP106.TABLE` の全エントリに型・値の期待値が揃っているか
- Shift あり/なし両方が定義されているか（`null` 許容のものを含む）
- 重複エントリがないか
- `SUPPRESS_CODES` にあるキーが `TABLE` に含まれていないか

### 4.2 インタラクティブテストページ（実機検証）

**ファイル候補**: `examples/06-8080/web/kbd-test.html`

```text
┌──────────────────────────────────────────────────────┐
│ JP106 キーボードテスト                   進捗: 0/44   │
├──────────────────────────────────────────────────────┤
│ e.code        │ Shift │ 期待値 │ 実測値 │ 結果       │
│ ──────────────────────────────────────────────────── │
│ Digit1        │  off  │  '1'  │       │  待機中    │
│ Digit1        │  on   │  '!'  │       │  待機中    │
│ ...                                                  │
│ BracketLeft   │  off  │  '@'  │       │  待機中    │
│ BracketLeft   │  on   │  '`'  │       │  待機中    │
├──────────────────────────────────────────────────────┤
│ ▶ キーを押してください（ここにフォーカス）           │
│                                                      │
│ 直近のイベント:                                      │
│   keydown  Digit1  shift=false  → '1'  ✅ PASS       │
└──────────────────────────────────────────────────────┘
```

動作フロー:

1. テーブル中の「待機中」行を順番にハイライト（ガイド）
2. ユーザーがキーを押す → `XtermJP106.TABLE` と同じロジックで変換
3. 期待値と一致 → ✅ PASS（緑）、不一致 → ❌ FAIL（赤）
4. 全キーのテスト完了後にサマリー表示

テストケース数: TABLE 22 エントリ × 2（Shift ON/OFF）= 44 ケース

## 5. Windows キーボード設定

### 5.1 問題の構造

Windows のキーボード関連設定は **IME** と **キーボードレイアウト** の 2 層に分かれている。

```text
物理キー入力
    │
    ▼
キーボードレイアウト（ドライバ層）
    │   「どの物理キーが何の文字か」を定義する。
    │   ← ここが US のままだと e.key が US 配列になる
    ▼
IME（入力メソッドエディタ）
    │   ひらがな/カタカナ変換、かな⇔英数切り替えを行う。
    │   Microsoft IME や Google 日本語入力が担当。
    ▼
ブラウザへ e.key / e.code を渡す
```

xterm-jp106.js は `e.key` が US 配列になる状況を `e.code` ベースのテーブルで吸収する
ライブラリである。**OS 側を正しく設定すれば本ライブラリは不要**になる。

### 5.2 Google 日本語入力（Google IME）固有の問題

Windows のキーボードレイアウトを `日本語キーボード (106/109 キー)` に正しく設定していても、
**Google IME の英数モード（IME オフ）時はブラウザに US 配列が渡される**。

```text
IME オン（日本語変換中）  → JP106 レイアウト → e.key = '@'  ✅
IME オフ（英数直接入力）  → US レイアウト   → e.key = '['  ❌
```

#### 原因

Google IME は「ローマ字→ひらがな変換」を US QWERTY 配列を基準に設計されている。
英数モードでは文字変換を行わずキーをブラウザへ渡すが、このとき
**OS のハードウェアレイアウト（106/109）ではなく Google IME 内部の US テーブルを経由する**。

```text
物理キー（JP106 の @ キー）
    │
    ▼
Google IME（英数モード）  ← 内部で US レイアウトテーブルを参照
    │
    ▼
ブラウザ  e.key='['  ← JP106 では '@' のはずが US の '[' になる
```

CP/M ターミナルは常に英数入力（IME オフ）で使うため、
**Google IME を使い続ける限り JP106 モードは必須**。

Microsoft IME に切り替えると `e.key` が正しく `@` になり、US モードで動作する。

### 5.3 正しい設定手順（Windows 11）

#### キーボードレイアウトを JP106 にする

1. **設定** → **時刻と言語** → **言語と地域**
2. 言語一覧の **日本語** の右の `...` → **言語のオプション**
3. **キーボード** セクションを確認
   - `日本語キーボード (106/109 キー)` があれば OK
   - なければ **キーボードを追加** → `日本語キーボード (106/109 キー)` を選択
   - `英語キーボード (101/102 キー)` は削除してよい（残しておくと切り替わる場合がある）

#### 設定後の確認方法

メモ帳などで以下のキーを押して文字を確認する。

| キー | JP設定が正しい場合 | US設定のまま |
|---|---|---|
| Shift+2 | `"` | `@` |
| Shift+6 | `&` | `^` |
| `@` キー（P の右隣） | `@` | `[` |
| `[` キー（@ の右隣） | `[` | `]` |

#### 設定が反映されない場合

- サインアウト → サインイン で再適用される場合がある
- **設定** → **時刻と言語** → **入力** → **高度なキーボード設定** で
  「アプリウィンドウごとに異なる入力方式を設定する」のチェックを外す

### 5.4 Windows 10 の場合

1. **設定** → **時刻と言語** → **言語**
2. **日本語** → **オプション**
3. **キーボード** → **キーボードを追加** → `Microsoft IME`（すでにある場合はスキップ）
4. ハードウェアキーボードレイアウト（ページ下部）→ **レイアウトを変更する**
   → `日本語キーボード (106/109 キー)` を選択 → **今すぐサインアウト**

### 5.5 WSL2 + Windows Terminal の場合

WSL2 内のシェルから Web サーバを起動してブラウザでアクセスする構成では、
キーボードイベントは **Windows 側ブラウザ** が生成するため、WSL2 側のロケール設定
（`/etc/locale.gen` 等）はキーボードレイアウトに影響しない。

Windows 側のキーボードレイアウトを JP106 に設定すれば `e.key` が正しくなり、
本ライブラリの JP106 補正は不要（US モードのままで正しく動作する）になる。

### 5.6 本ライブラリを使う場面

以下のいずれかに該当する場合、JP106 モードが必要。

| 状況 | JP106 モード |
|---|---|
| Google IME を使っている（英数モードで端末入力） | **必須** |
| Microsoft IME を使い、Windows レイアウトが 106/109 | 不要（US モードで動作） |
| OS レイアウト設定を変更できない（会社 PC ポリシー等） | **必須** |

## 6. 既知の制限・注意

- `IntlYen` / `IntlRo` は Windows + JP 106 環境で生成される `e.code`。
  macOS（JIS 配列）では異なる `e.code` が割り当てられる場合がある。
- xterm.js 5.3.0 では `term.input()` が存在しないため `workerSend` を直接呼ぶ設計。
  xterm.js のバージョンアップ時に `term.input()` の有無を確認すること。
- `Backquote` を SUPPRESS_CODES に入れているため、US 配列のバッククォート（`` ` ``）は
  jp106 モードでのみ `BracketLeft` Shift として入力できる。US モードでは xterm.js に
  委任されるが、`Backquote` が抑制されるため US 配列のバッククォートは入力不可になる。
  必要であれば `extraMap: { 'Backquote': '`' }` で補完できる。
- `onInputChar` は JP106_TABLE 由来の文字にのみ呼ばれる。F キー・ナビゲーションキー
  等は xterm.js が処理するため呼ばれない。`extraMap` 経由のキーも呼ばれない。
