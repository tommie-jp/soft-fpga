# 62. sim API リファレンス

`window.sim` は CP/M 8080 WASM シミュレーターのテスト・デバッグ用パブリック API。

- **JS 側** (`window.sim`) — DevTools コンソール、ブラウザ内スクリプト、`page.evaluate()` から使用
- **Python 側** (`SimAPI`) — Playwright テストから使用（`verif/web/sim_api.py`）

---

## 1. JS API（`window.sim`）

`index.html` の `initUI()` クロージャ内で定義。
`workerSend` / `workerRequest` / `running` / `LA_SIGNALS_ALL` をクロージャで直接参照する。

### 1.1 実行制御

```js
sim.run()                  // シミュレーション再開
sim.pause()                // 一時停止
sim.reset(preset?)         // CP/M リセット。preset 省略時は現在のプリセット
```

### 1.2 キー入力

```js
sim.sendKey(ch)            // ASCII コード (number) or 1 文字 (string) を送信
sim.sendString(str)        // 文字列送信。'\n' → CR(0x0D) に変換
```

### 1.3 メモリ直接アクセス

```js
sim.writeMem(addr, bytes)               // バイト列書き込み（DDT S コマンド相当）
                                        // RAM と Verilator RTL RAM の両方を更新
await sim.readMem(addr, len)            // → Uint8Array  (DDT D コマンド相当)
```

### 1.4 レジスタ

```js
sim.setPC(addr)                         // PC のみ設定（実行開始しない）
sim.runFrom(addr)                       // setPC + run() の短縮形（DDT G コマンド相当）
sim.stepInstr()                         // 1 命令実行して停止（DDT T コマンド相当）
sim.setRegs({a?, b?, c?, d?, e?,
             h?, l?, sp?, pc?})         // レジスタ部分指定書き込み（F は未サポート）
await sim.getRegs()                     // → {a, f, b, c, d, e, h, l, sp, pc}
```

**regId 対応表**（`setRegs` 内部で使用）

| キー | regId | 幅 |
|------|-------|----|
| `a`  | 0 | 8 bit |
| `b`  | 1 | 8 bit |
| `c`  | 2 | 8 bit |
| `d`  | 3 | 8 bit |
| `e`  | 4 | 8 bit |
| `h`  | 5 | 8 bit |
| `l`  | 6 | 8 bit |
| `sp` | 7 | 16 bit |
| `pc` | — | 16 bit（`setPC` に委譲） |
| `f`  | — | 未サポート（warning ログ） |

### 1.5 トリガー設定

```js
sim.setTrigger(opts)        // トリガー設定（type 別オプションは下表参照）
sim.clearTrigger()          // トリガー解除
sim.setPostDelay(n)         // 発火後にリングバッファへ記録し続けるサンプル数
```

**`setTrigger` の type 一覧**

| `type`   | 追加オプション | 説明 |
|----------|----------------|------|
| `'reg'`  | `regId`, `value` | レジスタ値一致。regId: 0=A … 9=PC |
| `'instr'`| `pc?`, `opc?`    | 命令フェッチ。-1=任意 |
| `'io'`   | `port?`          | I/O アクセス（省略=any） |
| `'call'` | `addr?`          | CALL 命令（省略=any） |
| `'ret'`  | —                | RET 命令 |
| `'edge'` | `word`, `bit`, `dir` | 信号エッジ（dir: 0=↑, 1=↓） |
| `'value'`| `word`, `mask`, `cmp` | ring buffer 値一致 |

### 1.6 トリガー待ち

```js
await sim.waitTrigger(timeoutMs=60000)  // → {trigHead}  タイムアウト時は例外
```

### 1.7 ring buffer 読み取り

```js
sim.readSample(signalId, offset=0)
// offset: 0=発火点, +n=後方, -n=前方
// → number | undefined（未発火・不明シグナル時）
```

### 1.8 信号メタデータ

```js
sim.getSignals()
// → [{id, label, word, bit, width, type, writable}, ...]
// writable=true の信号は setRegs() / writeMem() で設定可能
```

**writable=true の信号**（LA ＋ボタンで追加できる信号のうち書き換え可能なもの）

| id | label | 設定メソッド |
|----|-------|-------------|
| `acc`   | A | `sim.setRegs({a: …})` |
| `reg_b` | B | `sim.setRegs({b: …})` |
| `reg_c` | C | `sim.setRegs({c: …})` |
| `reg_d` | D | `sim.setRegs({d: …})` |
| `reg_e` | E | `sim.setRegs({e: …})` |
| `reg_h` | H | `sim.setRegs({h: …})` |
| `reg_l` | L | `sim.setRegs({l: …})` |
| `sp`    | SP | `sim.setRegs({sp: …})` |
| `pc`    | PC | `sim.setPC(…)` / `sim.setRegs({pc: …})` |

### 1.9 スクリーンショット

```js
sim.screenshotCanvas(selector='#la')
// → 'data:image/png;base64,...'  （キャンバスの DataURL）
```

### 1.10 状態取得

```js
sim.trigFired     // boolean  トリガー発火済みか
sim.trigHead      // number   発火位置（ring buffer 絶対インデックス）。未発火は -1
sim.isRunning     // boolean  シミュレーションが実行中か
```

---

## 2. Python API（`SimAPI`）

ファイル: `verif/web/sim_api.py`

### 2.1 基本構造

```python
from sim_api import SimAPI

sim = SimAPI(page)   # Playwright Page を渡す
```

pytest フィクスチャとして使う場合（`test_8080.py` に定義済み）:

```python
def test_something(self, sim: SimAPI) -> None:
    sim.write_mem(0x0300, [0x3E, 0xFF, 0x76])
    sim.run_from(0x0300)
    sim.await_wait_trigger(30_000)
```

### 2.2 命名規則

| 規則 | 意味 | 例 |
|------|------|----|
| 通常メソッド | JS 側が同期 | `run()`, `pause()`, `write_mem()` |
| `await_` メソッド | JS 側が非同期（Promise）。Python からは同期的に呼べる | `await_get_regs()`, `await_wait_trigger()` |

### 2.3 メソッド一覧

#### 実行制御

```python
sim.run()
sim.pause()
sim.reset(preset: int | None = None)
```

#### キー入力

```python
sim.send_key(ch: int | str)
sim.send_string(s: str)
```

#### メモリ

```python
sim.write_mem(addr: int, data: list[int] | bytes)
data: bytes = sim.await_read_mem(addr: int, length: int)
```

#### レジスタ

```python
sim.set_pc(addr: int)                              # PC のみ設定
sim.run_from(addr: int)                            # setPC + run
sim.step_instr()                                   # 1 命令ステップ
sim.set_regs(a=?, b=?, c=?, d=?, e=?, h=?, l=?, sp=?, pc=?)
regs: dict = sim.await_get_regs()                 # {'a':…, 'pc':…, …}
```

#### トリガー

```python
sim.set_trigger(type='reg', regId=9, value=0x0300)
sim.set_trigger(type='instr', opc=0x76)
sim.set_trigger(type='edge', word=0, bit=9, dir=0)
sim.clear_trigger()
sim.set_post_delay(n: int)
result: dict = sim.await_wait_trigger(timeout_ms=30_000)  # {'trigHead': …}
```

#### ring buffer

```python
val: int | None = sim.read_sample(signal_id: str, offset: int = 0)
signals: list[dict] = sim.get_signals()
```

#### Logic Analyzer 表示操作

```python
sim.show_signals('pc', 'sp', 'acc', 'reg_f', 'reg_b', 'reg_c',
                 'reg_d', 'reg_e', 'reg_h', 'reg_l')  # 指定シグナルを LA に表示
sim.set_zoom('16x')          # ズーム倍率設定（'8x', '16x' など）
sim.goto_trigger()           # TRIG 発火位置をキャンバス中央にスクロール
```

#### スクリーンショット

```python
# タイトルなし
sim.screenshot_canvas_to_file(path: str | Path, selector: str = "#la")

# タイトルバーを画像上部に追加（Pillow 不要・DPR 対応）
sim.screenshot_canvas_to_file(
    path,
    title="MVI A,$FF; HLT  A=0xFF  PC=0x0302 [16x]",
    title_height=28,  # タイトルバーの高さ (CSS px)、デフォルト 28
)
```

#### プロパティ

```python
sim.trig_fired   # bool
sim.trig_head    # int  (-1 = 未発火)
sim.is_running   # bool
```

---

## 3. 典型的なテストパターン

### 3.1 任意アドレスへのコード配置と実行

```python
# MVI A,$FF; HLT を 0x0300 に配置して実行、レジスタ検証
sim.write_mem(0x0300, [0x3E, 0xFF, 0x76])
sim.set_trigger(type="instr", opc=0x76)   # HLT でトリガー
sim.set_post_delay(20)
sim.run_from(0x0300)
sim.await_wait_trigger(10_000)
regs = sim.await_get_regs()
assert regs["a"] == 0xFF
assert regs["pc"] == 0x0302
```

### 3.2 I/O タイミング確認

```python
sim.set_trigger(type="io", port=0x01)     # port 1 の I/O
sim.set_post_delay(200)
sim.run()
sim.await_wait_trigger(30_000)
t_state = sim.read_sample("t_state", 0)  # 発火点の T ステート
assert t_state == 3                        # OUT は M5 T3 で確定
```

### 3.3 全レジスタ表示 + スクリーンショット保存

```python
import pathlib
import time

# verif/web/test_8080.py の 3 階層上 = プロジェクトルート
_SS_DIR = pathlib.Path(__file__).parent.parent.parent / "test" / "ss"

# 全レジスタ信号 ID（LA_SIGNALS_ALL の id 値）
_ALL_REGS = ('pc', 'sp', 'acc', 'reg_f',
             'reg_b', 'reg_c', 'reg_d', 'reg_e', 'reg_h', 'reg_l')

sim.await_wait_trigger(30_000)
sim.show_signals(*_ALL_REGS)      # 全レジスタを LA に表示
sim.set_zoom('16x')               # 16x: 全命令マシンサイクルをカバー
time.sleep(0.2)
sim.goto_trigger()                # TRIG 発火位置をキャンバス中央に
time.sleep(0.3)                   # RAF 更新を待つ
regs = sim.await_get_regs()
sim.screenshot_canvas_to_file(
    _SS_DIR / "la_io_timing.png",
    title=f"I/O port=0x01  A=0x{regs['a']:02X} [16x]",  # タイトルバー付き
)
# → <project_root>/test/ss/la_io_timing.png（CWD 非依存の絶対パス）
```

### 3.4 全信号一覧の確認

```python
signals = sim.get_signals()
writable = [s for s in signals if s["writable"]]
print([s["id"] for s in writable])
# ['acc', 'reg_b', 'reg_c', 'reg_d', 'reg_e', 'reg_h', 'reg_l', 'sp', 'pc']
```

---

## 4. C++ / Worker 対応表

| JS API | Worker メッセージ | C++ 関数 |
|--------|------------------|---------|
| `writeMem` | `writeMem` + ArrayBuffer | `sim_poke(addr, val)` × N |
| `readMem` | `readMem` → `memData` | `sim_read_byte(addr)` |
| `setPC` | `setPC` | `sim_set_pc(addr)` |
| `setRegs` | `setReg` × N | `sim_set_reg(regId, value)` |
| `getRegs` | `getRegs` → `regsData` | `sim_snap_regs()` |
| `stepInstr` | `stepInstr` | `sim_step_instr()` |
| `screenshotCanvas` | — (メインスレッド) | — |

---

## 5. 注意事項

- `setPC` / `setRegs` / `write_mem` は **命令境界**（`step_instr()` 後または `pause()` 中）で呼ぶこと。実行中に呼ぶと RTL の内部パイプラインと競合する可能性がある。
- `f` (フラグレジスタ) は vm80a がビット単位で保持しているため `setRegs` では設定できない。
- `screenshotCanvas` はキャンバス要素の **現在の描画** を取得する。LA の更新は RAF（requestAnimationFrame）で行われるため、トリガー発火後 0.3〜0.5 秒待ってから呼ぶこと。
- `screenshot_canvas_to_file` は **ホストのファイルシステム**に書き込む（WASM FS ではない）。
  JS 側でキャンバスを DataURL に変換し、Python 側でデコードしてファイルに保存する。
- パスは必ず `pathlib.Path(__file__).parent.parent.parent / "test" / "ss"` を基点にした絶対パスにすること。
  相対パスは pytest の実行 CWD に依存し、`doTest.sh` 経由と直接実行で保存先が変わる。
- 保存先は `<project_root>/test/ss/`（`~/36-soft-FPGA/test/ss/`）。
- `test/ss/` ディレクトリは `.gitignore` に追加推奨（バイナリ PNG が大量に増えるため）。
