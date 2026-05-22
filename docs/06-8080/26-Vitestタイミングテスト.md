# 26. Vitest Logic Analyzer タイミングテスト

vm80a の Logic Analyzer タイミングが Intel 8080A 仕様に対して正しいかを  
WASM + Vitest で自動検証するテストスイートの設計・実装メモ。

---

## 1. 概要

| 項目 | 内容 |
|------|------|
| テストフレームワーク | Vitest v1.6 (Node.js / ESM) |
| テスト対象 | リングバッファの SYNC タイミング・T-state 数・マシンサイクル数 |
| テスト数 | 56 テスト (8080 命令 20 グループ) |
| 実行時間 | 約 180 ms |
| テスト配置 | `examples/06-8080/tests/` |

```bash
cd examples/06-8080/tests
npm test
```

---

## 2. アーキテクチャ

```text
build-wasm-06.sh
  └─ em++ (MODULARIZE=1, EXPORT_ES6=1, ENVIRONMENT=node)
       └─ tests/sim-test.mjs + sim-test.wasm

Vitest
  └─ timing/instructions.test.mjs
       ├─ helpers/sim.mjs   … WASM ローダー・captureInstruction
       └─ helpers/ring.mjs  … リングバッファ解析
```

### 2.1 テスト用 WASM ビルド

`scripts/build-wasm-06.sh` 末尾に追加したテストビルドセクションで  
`examples/06-8080/tests/sim-test.mjs` を生成する。

通常の `sim.js`（ブラウザ向け）と別に、以下のフラグを追加している。

```bash
-s MODULARIZE=1    # factory 関数としてエクスポート (複数インスタンス対応)
-s EXPORT_ES6=1    # ES Module の default export
-s ENVIRONMENT=node
```

### 2.2 sim_poke 関数

テスト用に `harness.cpp` へ追加した RAM 書き込み API。

```cpp
EMSCRIPTEN_KEEPALIVE
void sim_poke(uint16_t addr, uint8_t val)
{
    mem[addr] = val;
    if (top) top->cpm_top->ram[addr] = val;
}
```

`sim_init_wasm()` 後に呼ぶことで、CP/M RAM の任意アドレスをテストコードで上書きできる。

---

## 3. テスト手法

### 3.1 captureInstruction の仕組み

```javascript
sim.captureInstruction([0x3E, 0xFF]);  // MVI A, $FF
```

内部では以下の順序で動作する。

1. `sim_init_wasm()` — CP/M / BIOS ロード・CPU リセット
2. `sim_poke(0x0000, JMP testAddr)` — リセットベクターを上書き
3. `sim_poke(testAddr, instrBytes)` + `JMP testAddr` (ループ) を配置
4. `sim_set_instr_trigger(testAddr, -1)` — 命令トリガー設定
5. `sim_set_post_delay(N)` — トリガー後 N サンプル記録
6. `step()` ループ → トリガーヒット待ち
7. `sim_freeze_ring()` — リングバッファをフリーズ
8. `readRingBuffer(...)` で **postDelay+1** サンプル読み取り

**+1 の理由**: `ring_head` はサンプル書き込み後にインクリメントされるため、  
トリガーサンプル（M1 T1 f1）が `fireHead - 1` に位置する。  
`postDelay + 1` サンプルを読むことで先頭サンプルが含まれる。

### 3.2 SYNC 立ち上がりエッジ検出

vm80a では SYNC が T1 の **f1・f2 両フェーズ** で High になる。  
「SYNC=1 のサンプルで分割」すると T1 が 2 グループに割れるため、  
`groupByMachineCycle` は **立ち上がりエッジ**（0→1 遷移）を検出する。

```javascript
const risingEdge = s.sync && !prevSync;
if (risingEdge) { /* 新マシンサイクル開始 */ }
```

これにより 1 T-state = 2 サンプル（f1+f2）が正しくカウントされる。

### 3.3 命令終了の検出 (afterAddr)

`captureInstruction` は命令直後（`testAddr + instrLen`）に `JMP testAddr` を配置する。  
この JMP M1 の SYNC が afterAddr に一致したとき命令終了と判定する。

```text
testAddr = 0x0100, instrLen = 2 (MVI A) → afterAddr = 0x0102
M1: 0x0100 (MVI A opcode)
M2: 0x0101 (即値)
JMP M1: 0x0102 = afterAddr → ここで終了
```

JMP 自身（instrBytes = [0xC3, 0x00, 0x01]）のように afterAddr に到達しない場合は  
startAddr へのループバック SYNC で終了する。

### 3.4 DAD・RST・CALL など特殊命令

`extractNMachineCycles(parsed, n)` で SYNC 立ち上がり n 回を抽出する。  
afterAddr 検出が機能しない命令（DAD、CALL、RET、RST）に使う。

---

## 4. vm80a と Intel 8080A 仕様との差異

テストを通じて判明した vm80a 固有の挙動。

### 4.1 XCHG — 4T（仕様: 4T、要確認の誤記に注意）

Intel 8080A User's Manual では **XCHG = 4T, M=1**。  
SPHL・PCHL・MOV などは 5T であるため混同しやすい。

| 命令 | T-state | マシンサイクル |
|------|---------|---------------|
| XCHG | **4T** | 1 |
| SPHL | 5T | 1 |
| PCHL | 5T | 1 |
| MOV r,r | 5T | 1 |

### 4.2 DAD — SYNC は M1 のみ（仕様: M=3）

Intel 8080A では DAD が 3 マシンサイクル（FETCH + SDAD + SDAD）を生成し、  
各マシンサイクルで SYNC を出力する。

vm80a ではこの SDAD サイクルで **SYNC を出力しない**。  
リングバッファ上では **1 つの 10T マシンサイクル** として見える。

```text
Intel 8080A:  M1(4T) + M2(3T) + M3(3T) = 10T  →  SYNC×3
vm80a:        10T 全体が 1 SYNC グループ         →  SYNC×1
```

合計 10T は同じだが、Logic Analyzer 上の SYNC 分割が異なる。

### 4.3 CALL — M1=5T, M5=3T（仕様: M1=4T, M5=4T）

Intel 8080A User's Manual では CALL を M1=4T, M5=4T と定義するが、  
vm80a は M1=5T, M5=3T で実装されている（合計 17T は同じ）。

| マシンサイクル | Intel 8080A | vm80a |
|:---:|:---:|:---:|
| M1 (fetch) | 4T | **5T** |
| M2 (addr lo) | 3T | 3T |
| M3 (addr hi) | 3T | 3T |
| M4 (push PCH) | 3T | 3T |
| M5 (push PCL) | **4T** | 3T |
| **合計** | **17T** | **17T** |

---

## 5. ファイル構成

```text
examples/06-8080/tests/
├── package.json             … Vitest 依存
├── vitest.config.mjs
├── sim-test.mjs             … ビルド生成 (gitignore)
├── sim-test.wasm            … ビルド生成 (gitignore)
├── helpers/
│   ├── sim.mjs              … WASM ローダー・SimWrapper・captureInstruction
│   └── ring.mjs             … リングバッファ解析ユーティリティ
└── timing/
    └── instructions.test.mjs … 56 命令タイミングテスト
```

### 主要 API

```javascript
// helpers/sim.mjs
const sim = await loadSim();
const { timing } = sim.captureInstruction([0x3E, 0xFF]);
// timing.machineCycles, timing.totalTStates, timing.cycles[i].tStates

// helpers/ring.mjs
extractFirstInstr(parsedSamples, startAddr)     // 1 命令分抽出 (ループバック検出)
extractNMachineCycles(parsedSamples, n)          // n マシンサイクル抽出
groupByMachineCycle(samples)                     // SYNC 立ち上がりで分割
analyzeTiming(parsedSamples)                     // machineCycles/totalTStates を返す
formatTiming(timing)                             // デバッグ用テキスト
```

---

## 6. ビルドと実行

```bash
# WASM ビルド (通常ビルド + テストビルド)
bash scripts/build-wasm-06.sh

# npm install (初回のみ)
cd examples/06-8080/tests
npm install

# テスト実行
npm test
```

---

## 7. 参考

- [11-vm80a-タイミング解析.md](11-vm80a-タイミング解析.md) — f1/f2 二相クロック詳細
- [25-デバッグパネル-使い方.md](25-デバッグパネル-使い方.md) — Logic Analyzer UI
- Intel 8080A User's Manual — Table 2-4 Instruction Set Timing
- [vm80a GitHub](https://github.com/Feipg/vm80a)
