# Docker ビルド・テスト・実行手順

## 前提

- Docker Desktop（または Docker Engine）が起動していること
- リポジトリルートで作業すること

```bash
cd ~/36-soft-FPGA
```

---

## 1. イメージをビルドする（初回・Verilator バージョン変更時）

```bash
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml build
```

- Verilator をソースからビルドするため **5〜10 分**かかる
- 再ビルド時は Docker のレイヤーキャッシュが効くので速い
- Verilator バージョンは `docker/Dockerfile` の `VERILATOR_TAG` で管理

---

## 2. サンプルをビルドする

```bash
scripts/build-sim.sh 04-6502
```

成果物: `examples/04-6502/build/sim`

対応サンプル:

| 引数               | 内容                           |
| ------------------ | ------------------------------ |
| `01-counter`       | 8bit バイナリカウンタ          |
| `02-traffic-fsm`   | 信号機 FSM（歩行者ボタン付き） |
| `03-uart`          | UART 送受信機                  |
| `04-6502`          | 6502 / Apple-1 シミュレータ    |

---

## 3. Klaus Dormann 機能テストを実行する

6502 CPU コアの正当性を確認する自動テスト。

```bash
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml run --rm dormann
```

成功時の出力:

```text
PASS: trapped at $3469 after 96241373 cycles
```

失敗時は `FAIL: trapped at $XXXX` と表示される。

---

## 4. Apple-1 をインタラクティブに実行する

```bash
examples/04-6502/build/sim
```

- ホスト上で直接実行（Docker 不要）
- raw termios モード。**Ctrl+C** で終了
- Apple-1 は大文字のみ・CR で確定

### Woz Monitor 基本操作

```text
NN.MM R    # アドレス NN〜MM のメモリを表示
NNNNR      # アドレス NNNN から実行
E000R      # Integer BASIC を起動
```

### Integer BASIC 起動例

```text
E000R
>10 PRINT "HELLO"
>RUN
HELLO
```

---

## 5. 開発用インタラクティブシェル

コンテナ内で直接コマンドを試したいとき。

```bash
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml run --rm dev
```

コンテナ内で使えるツール: `verilator`, `g++`, `cmake`, `ninja`, `ccache`

---

## 6. WebAssembly をビルドする

### 6.1. イメージをビルドする（初回・Emscripten バージョン変更時）

```bash
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml build build-wasm
```

- `sfa-dev:local`（ネイティブ用）を先にビルドしておく必要がある
- Emscripten のダウンロードで **10〜20 分**かかる
- Emscripten バージョンは `docker/Dockerfile.wasm` の `EMSCRIPTEN_VERSION` で管理

### 6.2. WASM をビルドする

```bash
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml run --rm build-wasm
```

成果物: `examples/06-8080/web/sim.js`, `examples/06-8080/web/sim.wasm`

### 6.3. ブラウザで動作確認する

```bash
cd examples/06-8080/web
python3 -m http.server
# → http://localhost:8000
```

---

## ファイル構成

```text
docker/
  Dockerfile          # Ubuntu 24.04 + Verilator v5.048 + g++ + ccache
  Dockerfile.wasm     # sfa-dev:local + Emscripten 5.0.7
  compose.yml         # dev / build-sim / dormann / build-wasm サービス
scripts/
  build-sim.sh        # Docker ラッパー（ホストから呼ぶ）
  _build-sim-inner.sh # コンテナ内ビルドスクリプト（cmake -S/-B + cmake --build）
verif/dormann/
  run.sh              # Klaus Dormann テスト（コンテナ内で実行）
  CMakeLists.txt
examples/<EXAMPLE>/
  CMakeLists.txt
  build/sim           # ビルド成果物（.gitignore 対象）
```
