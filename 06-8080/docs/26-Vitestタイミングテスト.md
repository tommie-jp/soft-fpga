# 26. Vitest Logic Analyzer タイミングテスト

vm80a の Logic Analyzer 信号値・タイミングが Intel 8080A 仕様に対して正しいかを  
WASM + Vitest で自動検証するテストスイートの設計・実装メモ。

---

## 1. 概要

| 項目 | 内容 |
|------|------|
| テストフレームワーク | Vitest v1.6 (Node.js / ESM) |
| テスト対象 | リングバッファの SYNC タイミング・T-state 数・マシンサイクル数・レジスタ値・フラグ・バス信号 |
| テスト数 | 143 テスト (タイミング 56 + 信号値 87) |
| 実行時間 | 約 500 ms |
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

## 5. signals/ テストスイート — レジスタ値・フラグ・バス信号の検証

`tests/signals/` に 87 テストを含む 3 ファイルを追加した。  
リングバッファの各フィールドが命令実行後に正しい値を示すかを確認する。

### 5.1 テスト一覧

| ファイル | テスト数 | 検証対象 |
|----------|---------|---------|
| `register-values.test.mjs` | 28 | A/B/C/D/E/H/L/SP レジスタ値 |
| `flags.test.mjs` | 21 | F レジスタ各フラグ (S/Z/AC/P/C/bit1) |
| `bus-signals.test.mjs` | 38 | SYNC/t_state/addr/ir/status_byte/memr/memw/dbin/wr_n/dbus/pc/sp |

```bash
cd examples/06-8080
npx vitest run tests/signals/
# → 3 Test Files / 87 Tests passed
```

### 5.2 captureWithSetup — セットアップ付きキャプチャ

複数命令にまたがるテスト（例: `MVI A,$42` → `MOV B,A` で B=0x42 を確認）には  
`captureWithSetup` を使う。

```text
メモリ配置:
  0x0000         : JMP testAddr        (リセットベクター)
  testAddr       : setupBytes          (1 回だけ実行)
  targetAddr     : instrBytes          (測定対象、ループ先)
  targetAddr+len : JMP targetAddr      (セットアップをスキップしてループ)
```

```javascript
// setup: MVI A,$42  target: MOV B,A
const result = sim.captureWithSetup([0x3E, 0x42], [0x47]);
expect(lastSample(result).b).toBe(0x42);
```

### 5.3 パイプライン遅延と settledSample パターン

vm80a は acc（アキュムレータ）とフラグを **1 マシンサイクル分遅延**してパイプライン確定する。  
`instrSamples` の最終サンプルでは acc/フラグが更新されていない場合がある。

#### 影響を受ける命令

| 命令例 | acc 更新タイミング | サンプル |
|--------|------------------|---------|
| INR A / DCR A | 命令内 T5 (alu_awr パス) | `lastSample` で OK |
| ADD A / XRA A など id_op 系 | 次命令 M1 T2 f2 (alu_ald パス) | `settledSample` が必要 |

フラグ（F レジスタ）は INR A / DCR A も含め、**常に** 次命令 M1 T2 f2 で確定する。

#### settledSample の定義

```javascript
function settledSample(result) {
  const idx = result.instrSamples.length + 2;
  return result.parsedSamples[idx] ?? lastSample(result);
}
```

`instrSamples.length + 2` = 次命令の M1 T2 f2 サンプル（JMP の T2 f2）。  
これが acc/フラグの確定後サンプル。

#### 詳細メカニズム

```text
1. JMP targetAddr の M1 T1 開始時: IR にはまだ前命令（ADD A 等）のオペコードが残る
   (IR は M1 T3 f1 で更新されるため ~2 クロック遅延)
2. JMP M1 T1: t2222=1 かつ id_add=1 → alu_ald が発火
3. JMP M1 T2 f2: acc ← s = 演算結果
```

### 5.4 xchg_dh フラグとレジスタ物理/論理マッピング

vm80a は内部で `xchg_dh` フラグにより物理レジスタの論理的な HL/DE 割り当てを入れ替える。

| xchg_dh | 論理 HL | 論理 DE |
|---------|--------|--------|
| 0 (RESET 直後) | 物理 r16_de | 物理 r16_hl |
| 1 (XCHG 後) | 物理 r16_hl | 物理 r16_de |

`harness.cpp` のリングバッファ構築時にこのフラグを参照してスワップする。

```cpp
bool xchg = (bool)cpu->__PVT__xchg_dh;
uint16_t logical_de = xchg ? cpu->__PVT__r16_de : cpu->__PVT__r16_hl;
uint16_t logical_hl = xchg ? cpu->__PVT__r16_hl : cpu->__PVT__r16_de;
```

### 5.5 r16_pc の動作 — T1 時点では命令アドレスを保持しない

vm80a の内部 PC レジスタ `r16_pc` は、**JMP 経由で命令に到達した場合**、  
M1 T1 f1 時点ではジャンプ先アドレスをまだ保持していない。

```text
JMP 0x0100 (0x0000 に配置):
  M1: fetch 0xC3 at 0x0000  → r16_pc 0x0000 → 0x0001
  M2: fetch lo byte at 0x0001 → r16_pc → 0x0002
  M3: fetch hi byte at 0x0002 → r16_pc → 0x0003
  goto=1, WZ=0x0100

次命令 MVI A の M1 T1 f1:
  goto=1 のため r16_pc は WZ に置き換わらない → r16_pc = 0x0003
  ※ アドレスバス (addr フィールド) は WZ=0x0100 を正しく出力する

次命令 MVI A の M1 T2 f2:
  r16_pc ← a + 1 = 0x0100 + 1 = 0x0101  ← ここで初めて更新
```

そのため `instrSamples[3]`（M1 T2 f2）の `pc` フィールドで testAddr+1 を確認する。

```javascript
// M1 T2 f2 (instrSamples[3]) で r16_pc = testAddr + 1
expect(result.instrSamples[3].pc).toBe(TEST_ADDR + 1);

// 命令完了後 (lastSample) で r16_pc = testAddr + instrLen
expect(lastSample(result).pc).toBe(TEST_ADDR + 2); // MVI A = 2バイト
```

---

## 6. ファイル構成

```text
examples/06-8080/tests/
├── package.json             … Vitest 依存
├── vitest.config.mjs
├── sim-test.mjs             … ビルド生成 (gitignore)
├── sim-test.wasm            … ビルド生成 (gitignore)
├── helpers/
│   ├── sim.mjs              … WASM ローダー・SimWrapper・captureInstruction・captureWithSetup
│   └── ring.mjs             … リングバッファ解析ユーティリティ
├── timing/
│   └── instructions.test.mjs … 56 命令タイミングテスト
└── signals/
    ├── register-values.test.mjs … 28 レジスタ値テスト (A/B/C/D/E/H/L/SP)
    ├── flags.test.mjs           … 21 フラグテスト (S/Z/AC/P/C/bit1)
    └── bus-signals.test.mjs     … 38 バス信号テスト (SYNC/t_state/addr/ir/memr/memw/dbin/wr_n/dbus/pc/sp)
```

### 主要 API

```javascript
// helpers/sim.mjs
const sim = await loadSim();
const { timing } = sim.captureInstruction([0x3E, 0xFF]);
// timing.machineCycles, timing.totalTStates, timing.cycles[i].tStates

// セットアップ付きキャプチャ (例: MVI A,$42 → MOV B,A)
const { parsedSamples, instrSamples } = sim.captureWithSetup([0x3E, 0x42], [0x47]);

// helpers/ring.mjs
extractFirstInstr(parsedSamples, startAddr)     // 1 命令分抽出 (ループバック検出)
extractNMachineCycles(parsedSamples, n)          // n マシンサイクル抽出
groupByMachineCycle(samples)                     // SYNC 立ち上がりで分割
analyzeTiming(parsedSamples)                     // machineCycles/totalTStates を返す
formatTiming(timing)                             // デバッグ用テキスト
```

---

## 7. ビルドと実行

```bash
# WASM ビルド (通常ビルド + テストビルド)
bash scripts/build-wasm-06.sh

# npm install (初回のみ)
cd examples/06-8080/tests
npm install

# 全テスト実行
npm test

# タイミングテストのみ
cd examples/06-8080
npx vitest run tests/timing/

# 信号値テストのみ
npx vitest run tests/signals/
```

---

## 8. 参考

- [11-vm80a-タイミング解析.md](11-vm80a-タイミング解析.md) — f1/f2 二相クロック詳細
- [25-デバッグパネル-使い方.md](25-デバッグパネル-使い方.md) — Logic Analyzer UI
- Intel 8080A User's Manual — Table 2-4 Instruction Set Timing
- [vm80a GitHub](https://github.com/Feipg/vm80a)
