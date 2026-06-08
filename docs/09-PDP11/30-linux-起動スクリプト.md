# 30. Linux 起動スクリプト（doPDP11-unix-v6.sh） <a class="qr-link" href="../../../docs/09-PDP11/30-QR.png">QR</a>

## 1. 概要

`./doPDP11-unix-v6.sh` で PDP-11 / Unix V6 の Linux ネイティブシミュレーターを起動する。
WASM 版とは異なり、ターミナルを直接使ってインタラクティブに Unix V6 を操作できる。

```bash
$ ./doPDP11-unix-v6.sh
@rkunix

login: root
# ls /
bin  dev  etc  hpunix  lib  mnt  rkunix  rpunix  tmp  unix  usr
# ~.    ← 終了
```

## 2. 仕組み

### 2.1 構成

```text
doPDP11-unix-v6.sh
  └─ examples/09-pdp11/build/pdp11_sim
       ├─ Vtest_top_wasm（Verilator 生成 C++）
       ├─ wasm_uart.v（DPI ベース UART）
       ├─ ide_v5.cpp（RK05 ディスク DPI）
       └─ main_linux.cpp（端末 I/O + 起動シーケンス）
```

### 2.2 TTY I/O

WASM 版と同じ `wasm_uart.v`（DPI）を使用する。

| 方向 | 関数 | 実装 |
|------|------|------|
| PDP-11 → 端末 | `dpi_tty_putc(ch)` | `write(g_tty_fd, &c, 1)` |
| 端末 → PDP-11 | `dpi_tty_getc()` | `read(STDIN_FILENO, ...)` ノンブロッキング |

`g_tty_fd` は起動時に `dup(STDOUT_FILENO)` で確保する。
Verilator の `$display`（`BUSERR` 等）は `dup2(STDERR, STDOUT)` で stderr に向けており、
スクリプト側の `2>/dev/null` で抑制できる。

### 2.3 自動ブートシーケンス

`dpi_tty_getc()` 内で処理する。

1. 8,000,000 クロック待機（`fake_uart.v` の `fake_init_delay` と同値）
2. `"rkunix\r"` を 3,000 クロック間隔で 1 文字ずつ送信
3. 以降はインタラクティブ入力（stdin ポーリング）

## 3. 終了方法：`~.` エスケープ

### 3.1 設計の背景

ssh / tip / cu と同じ「行頭チルダ」方式を採用。

| ツール | エスケープキー | 検出方式 |
|--------|--------------|---------|
| ssh | `~.` | 改行後に `~` → 状態機械 |
| tip / cu | `~.` | 同上 |
| SIMH | `Ctrl-E` | 1 文字インターセプト |
| QEMU | `Ctrl-A x` | プレフィックス方式 |

`^\`（SIGQUIT 方式）は `cfmakeraw()` が `ISIG` を無効化するため生成されない。

### 3.2 状態機械（main_linux.cpp）

```text
起動直後 → ST_AFTER_NL（行頭扱い）

ST_NORMAL   ─ \r/\n ─→ ST_AFTER_NL
ST_AFTER_NL ─  ~   ─→ ST_AFTER_TILDE（~ を保留）
            ─ その他 ─→ ST_NORMAL
ST_AFTER_TILDE ─ . ─→ g_stop = 1（終了）
               ─ ~ ─→ ST_AFTER_NL、~ を 1 文字送信（~~ → ~）
               ─ X ─→ ~ を送信、X を tty_pending に保留
```

### 3.3 操作

| 入力 | 動作 |
|------|------|
| `~.`（行頭） | シミュレーター終了 |
| `~~`（行頭） | `~` を 1 文字 PDP-11 に送る |
| `~X`（行頭） | `~X` をそのまま PDP-11 に送る |
| `Ctrl-C` | Unix V6 プロセスへ割り込み（ホストは終了しない） |

## 4. ビルド

```bash
bash scripts/build-host-09.sh
```

- Verilator で `test_top_wasm.v` → C++ 生成
- `g++ -O2` でリンク（`verilated.cpp`、`verilated_threads.cpp`、`ide_v5.cpp`、`ram_v5.cpp`、`main_linux.cpp`）
- 出力: `examples/09-pdp11/build/pdp11_sim`

## 5. 関連ファイル

| ファイル | 役割 |
|----------|------|
| `doPDP11-unix-v6.sh` | 起動スクリプト |
| `examples/09-pdp11/cxx/main_linux.cpp` | 端末 I/O、起動シーケンス、~. エスケープ |
| `examples/09-pdp11/cxx/ide_v5.cpp` | RK05 ディスク DPI 実装 |
| `examples/09-pdp11/verilog/wasm_uart.v` | DPI ベース UART（WASM/Linux 共用） |
| `scripts/build-host-09.sh` | Linux ネイティブビルドスクリプト |
| `examples/09-pdp11/disk/unix_v6_rk05.dsk` | Unix V6 RK05 ディスクイメージ |
