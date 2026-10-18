# 70. 8080 CP/M → Pico 2 (RP2350) 実装計画

8080 + CP/M 2.2 シミュレータを Raspberry Pi Pico 2 (RP2350) 実機へ移植する計画メモ。
勉強会（2026‑11‑28）のデモ全体と 6502 側の計画は [docs/07](../07-Pico2実機デモ構想%282026-11-28自作CPU勉強会%29.md)。
本メモは 8080 / CP/M 固有の部分だけを扱う。

2026‑10‑12 に実装粒度へ書き直した。6502 側で足回り（Dockerfile.pico・Verilator ベアメタル化・core1 シミュレーション・HIL）が
できているので（docs/07 §12.6）、本メモはそれを前提に「8080 で追加で要るもの」に絞る。

---

## 1. 位置づけと前提

- 6502 / Apple‑1 が当日の主役。8080 / CP/M は「6502 の次」で、**間に合えば見せる**。
- 6502 Phase 2（端末アプリで BASIC が動く）までの足回りを流用する。8080 側の作業はそれが済んでから着手する。
- 6502 Phase 3（LED パネル）・Phase 4（COBS / Web）の成果物は共通部品として作り、8080 にはあとから配線表と定義を足すだけにする。

6502 側から流用するもの（docs/07 §12.1.1・§12.6）:

| 資産 | 8080 での扱い |
| --- | --- |
| `docker/Dockerfile.pico`、`docker/compose.yml` の `firmware` / `flash` / `test-hil` | そのまま |
| `firmware/common/verilator-runtime/`（`verilated.cpp` + `stub_mutex.h`）、`common/cxx_minimal.cpp` | そのまま |
| `firmware/apple1/sim_core.{h,cpp}`（core1 で `step()`、queue 4 本） | **共通化して流用**（§4 Phase A） |
| `firmware/common/input_filter.h` / `display_filter.h` | 入力はラブアウト文字だけ差し替え。表示は CP/M では素通し |
| `scripts/build-pico.sh` / `flash.sh` / `doBuildPico.sh` / `test-hil.sh` / `size.sh` | ターゲット `cpm` を足す |
| `verif/hil/conftest.py`（モジュールの `FIRMWARE` 変数で ELF を選ぶ） | `test_cpm.py` を足すだけ |

---

## 2. 既存の 8080 資産と Pico で問題になる点

[`cxx/harness.cpp`](../../examples/06-8080/cxx/harness.cpp)（1269 行）は `sim_init()` / `step()` / `send_key()` / `get_display_char()` の
API が 6502 と同じ形なので、core1 ループはそのまま使える。問題になるのは次の点。

| 箇所 | 現状 | Pico での問題 | 対処（§4 Phase B） |
| --- | --- | --- | --- |
| `sim_init(bios_path, cpm_path, dsk_path)` | `fopen` で読む | ファイルシステムが無い | バッファ版 `sim_init_buffers()` に分割 |
| `disk_image[4][256256]` | 1 MB を SRAM 常駐 | SRAM 520 KB に載らない | Flash XIP 読み + ダーティセクタキャッシュ（§3.1） |
| `handle_io()` の DCMD（port `$10`）、`load_disk*` / `sim_save_disk` / `sim_get_disk_ptr` | `disk_image` を直接参照 | 同上 | 128 B 単位の read / write 2 関数に集約し、Pico 側で差し替え |
| `mem[0x10000]` シャドウ | `load_cpm_image` / `sim_poke` / `sim_poke_block` が `top->cpm_top->ram` と二重に書く | SRAM 64 KB の無駄 | 除去して `ram` のみに揃える |
| `ring[RING_SIZE * RING_WORDS]` | 4096 × 7 × 4 B = 112 KB | 大きすぎる | `SFA_RING_SIZE` で 1024（28 KB）に |
| port `$A1` ホストファイル転送（R.COM / W.COM） | `fopen` + `std::string` | ファイル無し・`<string>` 禁止 | `#ifndef SFA_PICO` で外し、常に失敗（`0xFF`）を返す |
| port `$34` / `$38` の周波数計測 | `std::chrono::steady_clock` | ベアメタルで使いにくい | `host_now_ns()` ヘルパに置き換え、Pico は `time_us_64()` |
| `fprintf(stderr, ...)` | 診断出力 | Pico の stderr は USB‑CDC = CP/M コンソールと同じ口 | `SIM_LOG()` マクロ経由で core0 が `+LOG` 接頭辞を付けて出す |
| `sim_test` / `sim_run_bin` / `sim_run_bare` | `top` を作り直すテスト用 | 実機では使わない | `#ifndef SFA_PICO` |
| `V*__Dpi.cpp` | Wasm ビルドは除外している（`build-wasm-06.sh`） | `file(GLOB)` で拾うとビルドエラー | CMake で除外 |

`cpm_top.v` の RAM 書き込みには `!reset` ガードが入っている（Verilator 初期値バグの修正済み）。arm ビルドでも同じ Verilator 5.048 を使うので再発しない。

---

## 3. 設計判断

### 3.1 ディスク: Flash XIP 読み + ダーティセクタキャッシュ（案 1 を採用）

| 案 | 内容 | 判断 |
| --- | --- | --- |
| **案 1（採用）** | `.dsk` を `.rodata`（Flash XIP）に置き、読みはそこから。書きは SRAM のダーティセクタキャッシュに溜める。Flash への書戻しは明示コマンドでのみ行う（Phase E、任意） | 複数ドライブ可。デモでは `SAVE` / `ERA` が動けば足りる |
| 案 2 | A: 1 ドライブだけ SRAM 常駐（250 KB） | 残り SRAM が苦しく、B: の BDS C が載らない |
| 案 3 | Flash 読み取り専用 | `SAVE` が失敗する。案 1 のキャッシュは小さいので、わざわざ選ぶ理由がない |

キャッシュの設計:

- エントリ `{drive, track, sector, data[128]}`（132 B）。固定配列 512 本 ≒ 68 KB。線形探索で足りる（ヒット判定は 3 バイト比較）。
- 読み: キャッシュにあればそれ、無ければ `flash_disk[drive] + offset` から `memcpy`。C: / D: は Flash に置かず、読みは `0xE5` 固定。
- 書き: キャッシュに上書きか追加。満杯なら書き込み失敗とし、`DSTS`（port `$10` IN）で `1` を返す（現状は常に `0`。Linux / Wasm も同じ変数を返すだけなので挙動は変わらない）。
- リセット（`Ctrl‑]` `r`）でキャッシュは消える。「電源を切ると消える RAM ディスク」として聴衆に断る。

Flash への書戻し（Phase E）をやる場合の制約:

- `flash_range_erase` / `flash_range_program` の間は**両コアとも XIP から命令を取れない**。core1 を止めて `flash_safe_execute()`（multicore lockout）で呼ぶ。
- 消去単位 4 KB に合わせて `.dsk` を `.balign 4096` で置く。1 トラック（26 × 128 = 3328 B）は 4 KB 境界をまたぐので、ダーティなセクタを含む 4 KB ブロック単位で「Flash → RAM に読む → キャッシュを当てる → 消去 → 書く」。
- 書換え寿命 10 万回なのでデモでは問題にならない。

### 3.2 Logic Analyzer: COBS でブラウザへ（docs/07 §9.4 と同じ）

Pico はコアだけ動かし、ring を freeze して一括送信。ブラウザ側は Wasm 版と同じ `rtlscope-la.js` と 8080 の信号定義。
ring のワード形式は Wasm 版と同一のまま、サンプル数だけ 1024 に減らす。

- `la_enabled` の初期値を Pico では `false` にする。毎クロック 7 ワードを組み立てるコストを普段は払わない（`sim_set_la_enabled()` はある）。
- キャプチャ要求で `la_enabled=true` → トリガ or 要求で `sim_freeze_ring()` → 1024 × 7 × 4 = 28 KB を送る → `la_enabled=false`。

### 3.3 GP25 はディスクアクセス LED にする（2026‑10‑12 決定）

6502 は GP25 に φ2 を出すが、8080 は 2 MHz 相当で点滅に見えないし、CP/M デモで一番伝わるのは「フロッピーのアクセスランプ」。
DCMD（port `$10`）の READ / WRITE で GP25 を 20 ms 点灯する。φ1 / φ2 は LA 側で見せる。

### 3.4 LED パネルの配線（6502 と同じ 26 本）

| 信号 | 本数 | 割り当て | 6502 との違い |
| --- | --- | --- | --- |
| A0〜A15 | 16 | GP0〜15 | 同じ。`latched_addr`（SYNC でラッチ、T3〜T4 も保持）を出す |
| D0〜D6 | 7 | GP16〜22 | 同じ。ring Word 3 の `dbus` と同じ値 |
| D7 / WR_N / SYNC | 3 | GP26 / GP27 / GP28 | RW → WR_N、SYNC は 8080 の SYNC |
| ディスクアクセス | 1 | GP25 | 6502 は φ2 |

SYNC サンプルモードは `dbg_sync`、STEP モードは既存の `sim_step_instr()` で実装できる。

### 3.5 コンソールの文字変換

| 方向 | 6502（Apple‑1） | 8080（CP/M） |
| --- | --- | --- |
| 小文字 | `send_key()` が大文字化 | **そのまま**（CP/M は小文字を受け付け、CCP が大文字化する） |
| BS / DEL | `_`（ラブアウト） | DEL（`0x7F`）→ BS（`0x08`）。CCP の 1 文字削除 |
| LF | CR に | CR に（同じ） |
| Ctrl‑C | 通す | 通す（ウォームブート） |
| 表示 | `DisplayFilter`（LF → CR LF、制御文字を捨てる） | **素通し**。CP/M が CR LF を自分で出す。WordMaster 等の ESC 列も通す |

`InputFilter` にラブアウト文字をコンストラクタ引数で渡せるようにする（既定 `'_'`、CP/M は `0x08`）。

---

## 4. 実装フェーズ

半日〜2 日のタスクに切る。各フェーズの最後の行が完了条件。A〜C は実機が要らない。

### Phase A — 足回りの共通化（目安 1 日、apple1 を壊さない）

| # | タスク | 成果物 |
| --- | --- | --- |
| A‑1 | `firmware/apple1/sim_core.{h,cpp}` を `firmware/common/sim_core.{h,cpp}` に移し、namespace を `fw` に。ターゲット固有は `extern "C" void sim_target_init(); void sim_target_reset();` の 2 本にし、apple1 は `apple1/target.cpp` で `sim_init()` / `reset_sim()` に委譲 | apple1 が従来どおりビルド |
| A‑2 | `InputFilter` にラブアウト文字の引数を足す（既定 `'_'`）。`firmware/test/test_input_filter.cpp` に `0x08` 版のケースを追加 | `scripts/test-fw-unit.sh` PASS |
| A‑3 | `firmware/CMakeLists.txt`: `apple1_configure_target()` → `sfa_configure_target()`、`APPLE1_DEBUG_UART` → `SFA_DEBUG_UART`（`scripts/` と docs/07 §12.1.2 も置換）。Verilator 実行を `sfa_verilate(NAME TOP RTL... ARGS...)` 関数にして 2 ターゲット目から使い回す | — |
| A‑4 | `scripts/size.sh` で apple1 のサイズが変わらないことを確認 | サイズ表 |

完了条件: `scripts/build-pico.sh` と `scripts/test-fw-unit.sh` が通り、`apple1.uf2` のサイズが前と同じ。

### Phase B — `harness.cpp` の Pico 対応（目安 1〜2 日、Linux / Wasm の回帰を保つ）

| # | タスク | 成果物 |
| --- | --- | --- |
| B‑1 | `sim_init()` を分割: 内部 `sim_init_buffers(bios, bios_n, cpm, cpm_n)` に初期化本体を移し、既存の `sim_init(paths)` は `#ifndef SFA_PICO` で `fopen` → `sim_init_buffers` を呼ぶ薄い皮にする | — |
| B‑2 | `mem[0x10000]` を除去。`load_cpm_image` / `sim_poke` / `sim_poke_block` は `top->cpm_top->ram` だけに書く | SRAM −64 KB |
| B‑3 | ディスク I/O を `static void disk_read128(int drive, uint32_t off, uint8_t* dst)` / `static bool disk_write128(int drive, uint32_t off, const uint8_t* src)` に集約。Linux / Wasm は `disk_image[]` 実装、Pico は `extern "C"` の `sfa_disk_read128` / `sfa_disk_write128` に委譲。`disk_image` と `load_disk*` / `sim_save_disk` / `sim_get_disk_ptr` / `sim_init_disk` / `sim_load_disk_file` は `#ifndef SFA_PICO` | — |
| B‑4 | port `$10` IN（DSTS）を変数 `disk_status` に。書き込み失敗で `1` | — |
| B‑5 | port `$A1` と `fcb_to_filename()`（`<string>`）、`host_file` を `#ifndef SFA_PICO`。Pico では `last_a1_result = 0xFF` | — |
| B‑6 | `<chrono>` を `static uint64_t host_now_ns()` に置き換え。Linux / Wasm は chrono、Pico は `extern "C" uint64_t sfa_now_us()` を使う | FREQ.COM が Pico でも動く |
| B‑7 | `cpm_const.h` の `RING_SIZE` を `#ifndef SFA_RING_SIZE` で上書き可能にする（既定 4096）。`la_enabled` の初期値を `#ifdef SFA_PICO` で `false` | — |
| B‑8 | `fprintf(stderr, ...)` を `SIM_LOG(...)` マクロに。Linux / Wasm は stderr、Pico は `extern "C" void sfa_log(const char*)`（core1 → log queue → core0 が `+LOG` 接頭辞付きで出力） | — |
| B‑9 | `step()` 末尾に `sim_bus_observe(latched_addr, dbus, wr_n, sync, status)` フック（`#ifdef SFA_PICO`、6502 と同じ形）。DCMD の READ / WRITE で `sim_disk_activity()` フック | — |
| B‑10 | 回帰: `scripts/_test-8080-cpm-inner.sh`・`_test-8080-sim-api.sh`・Vitest タイミングテスト（[26](26-Vitestタイミングテスト.md)）・`scripts/build-wasm-06.sh` を通す | 全 PASS |

完了条件: Linux / Wasm のテストが全部通り、`harness.cpp` の Pico 向け `#ifdef` が揃う。

### Phase C — ROM / ディスクの Flash 配置と `cpm` ターゲット（目安 1〜2 日）

| # | タスク | 成果物 |
| --- | --- | --- |
| C‑1 | `firmware/cpm/images.S`: `.incbin` で `bios.bin` / `cpm22.bin` / `cpm22.dsk` / `bdsc.dsk` を `.rodata` に置く（`.balign 4096`、`sfa_bios_bin` / `sfa_bios_bin_end` などのシンボル）。CMake は 4 ファイルの存在を確認し、無ければ `scripts/setup-cpm22.sh` と `make -C examples/06-8080/sw/cpm` を案内して `FATAL_ERROR`（`*.bin` は gitignore、`*.dsk` は追跡済み） | — |
| C‑2 | `firmware/cpm/disk_store.{h,cpp}`: §3.1 のキャッシュ。Flash 配列の先頭はポインタで受け取り、ホスト単体テストではモック配列を渡す | — |
| C‑3 | `firmware/test/test_disk_store.cpp`: read‑through、write → read、別ドライブの独立、満杯で失敗、reset で消える、C: / D: は `0xE5` | `scripts/test-fw-unit.sh` PASS |
| C‑4 | `firmware/cpm/target.cpp`: `sim_target_init()` = `disk_store_reset()` + `sim_init_buffers(...)`。`sim_target_reset()` も同じ。`sfa_disk_read128` / `sfa_disk_write128` / `sfa_now_us` / `sfa_log` の実装 | — |
| C‑5 | `firmware/cpm/main_pico.cpp`: apple1 の `main_pico.cpp` を元に、`InputFilter(0x08)`、表示は素通し、`Ctrl‑]` コマンドは `i` / `b` / `r` に `d`（`+XD drv=A trk=NN sec=NN dma=XXXX dirty=N`）を追加 | — |
| C‑6 | `firmware/CMakeLists.txt`: `sfa_verilate(cpm cpm_top cpm_top.v vm80a.v -Wno-WIDTHEXPAND -Wno-WIDTHTRUNC -Wno-UNOPTFLAT)`、`V*__Dpi.cpp` を除外、`-DSFA_PICO=1 -DSFA_RING_SIZE=1024`。`scripts/doBuildPico.sh --flash cpm`、`compose.yml` のコメント、`size.sh` | `firmware/build/cpm.uf2` |
| C‑7 | `sw/cpm/Makefile` に `pico` ターゲット（サインオン `... soft-FPGA Pico 2`）。サインオンは BIOS 末尾なのでルーチンの番地は変わらない。当面は `linux` 版の `bios.bin` でも動く | — |
| C‑8 | サイズを docs に記録。見込み: SRAM = Verilator `ram` 64 KB + ring 28 KB + キャッシュ 68 KB + core1 スタック 16 KB + `saved_ccp` 5.6 KB + SDK ≒ 190 KB。Flash = 本体 ≒ 250 KB + ディスク 512 KB | サイズ表 |

完了条件: `cpm.uf2` ができ、ホスト単体テストが通る。

### Phase D — 実機で CP/M ブート（目安 1〜2 日、実機が要る）

| # | タスク | 成果物 |
| --- | --- | --- |
| D‑1 | 書き込み → 端末アプリで `64K CP/M VERS 2.2 ...` と `A>` | 起動 |
| D‑2 | `DIR` / `TYPE` / `SAVE 1 X.COM` → `DIR` / `ERA X.COM` / `B:` → `DIR` / `Ctrl‑C` ウォームブート | — |
| D‑3 | 実効クロック: `Ctrl‑]` `b`（`step()` 回数 / 秒。8080 の実効クロックはその **1/2**。`step()` 1 回 = φ1 か φ2 の半サイクル）と、CP/M 内の `FREQ.COM`（[22](22-クロック計測とベンチマーク手順.md)）。結果を 22 に追記 | 実効クロック [kHz] |
| D‑4 | `verif/hil/test_cpm.py`（`FIRMWARE = "cpm"`）: サインオン → `A>`、`DIR` に `.COM`、`SAVE` → `DIR` → `ERA`、ウォームブート。apple1 と同じく、実機の前に socat の PTY シムでホスト検証する | `scripts/test-hil.sh` PASS |
| D‑5 | `-Os` / `-O2` の比較。10 kHz 相当を切るならキャッシュを 256 本に減らして ring を 2048 に戻すなど、SRAM と速度の配分を見直す | ベンチマーク表 |

完了条件: タブレット + 端末アプリ + Bluetooth キーボードで CP/M が使える。**ここまでで最低限のデモが成立する。**

### Phase E — Flash への書戻し（任意、目安 1 日）

| # | タスク | 成果物 |
| --- | --- | --- |
| E‑1 | `Ctrl‑]` `w`: core0 がコマンドキューで core1 を一時停止 → `flash_safe_execute()` 内で §3.1 の 4 KB ブロック単位の書戻し → キャッシュクリア → core1 再開。`+XW blocks=N` を返す | — |
| E‑2 | HIL: `SAVE` → `w` → リセット → `DIR` に残る | — |

当日に要るものではない。Phase D までで間に合わない場合は飛ばす。

### Phase F — LED パネル・COBS・Web（6502 Phase 3〜4 の共通部品に 8080 分を足す、各 0.5〜1 日）

| # | タスク | 成果物 |
| --- | --- | --- |
| F‑1 | 6502 Phase 3 の `led_panel.cpp` を `common/` に置き、配線表（§3.4）を構造体で渡す。`sim_bus_observe()` から更新し、`sim_disk_activity()` で GP25 を 20 ms 点灯 | SYNC サンプル / STEP / SLOW が動く |
| F‑2 | 6502 Phase 4 の `console.cpp`（COBS 多重）を共通化。`0x03` レジスタは `sim_snap_regs()` の 12 B、`0x04` ディスク状態（drive / track / sector / dma）を追加 | プロトコル定義 |
| F‑3 | `examples/06-8080/web/pico.html`: `index.html` の Worker ブリッジを `sft-serial-bridge.js`（6502 Phase 4‑3 で作るものを `js/` に共通化）に置換。ring 形式は Wasm 版と同じなので LA 定義とデバッグパネルはそのまま。ディスクパネルは `0x04` から更新 | ページ |
| F‑4 | gh‑pages に載せて、タブレットの Chrome から開く | 公開 URL |

完了条件: タブレットの Chrome で端末 + RTLScopeLA + ディスク状態が見える。

---

## 5. スケジュール案（6502 側 docs/07 §12.4 に差し込む）

| 週 | 期間 | 6502 側 | 8080 側 |
| --- | --- | --- | --- |
| 1〜2 | 10/13〜10/26 | Phase 0〜2 | 着手しない |
| 3 | 10/27〜11/2 | Phase 3（工作待ちの隙間あり） | **Phase A・B**（実機不要） |
| 4 | 11/3〜11/9 | Phase 4 | **Phase C・D**（実機は 6502 と共用。Probe で焼き分ける） |
| 5 | 11/10〜11/16 | Phase 4 | Phase F（共通部品に 8080 分を足す） |
| 6 | 11/17〜11/23 | Phase 5 リハーサル | Phase E は余力があれば |
| — | 11/24〜11/27 | 予備 | — |

6502 の進みが遅れたら 8080 は Phase D で止める（端末アプリで CP/M が立つ所まで）。
それも無理なら 8080 は Wasm 版をタブレットで見せる。

---

## 6. 当日のシナリオ案（8080 分、約 10 分。6502 のあとに続ける）

| # | 目安 | 操作 | 見える物 |
| --- | --- | --- | --- |
| 1 | 2 分 | リセット → サインオン → `A>` | GP25（ディスク LED）が起動中に点滅する |
| 2 | 2 分 | `DIR` / `TYPE HELLO.TXT` | ディスク LED と、LA / ディスクパネルの track / sector |
| 3 | 3 分 | `MBASIC` → `PRINT 2+2` → 短い `FOR` ループ（[17](17-MBASIC-使い方.md)） | 1976 年の BASIC が 2026 年の Pico で動く |
| 4 | 2 分 | `SAVE 1 X.COM` → `DIR` → `ERA X.COM` | 書き込みが RAM キャッシュに入る（`Ctrl‑]` `d` で dirty 数） |
| 5 | 1 分 | `FREQ`（CP/M 内の自己計測） | 実効クロック。Wasm 版との比較 |

---

## 7. リスクと逃げ道

| リスク | 兆候 | 逃げ道 |
| --- | --- | --- |
| 実効クロックが低い（vm80a は `step()` 2 回で 1 T‑state） | Phase D‑3 で 8080 換算 50 kHz 未満 | `la_enabled=false` を徹底、`-O2`、`set_sys_clock_khz` でオーバークロック。MBASIC は短い式だけにする |
| キャッシュ満杯 | BDS C コンパイルなど大量書き込みで `DSTS=1` | デモは `SAVE` / `ERA` 程度に留める。Phase E で解消 |
| SRAM 不足 | `size.sh` で bss 400 KB 超 | 見込み 190 KB。超えるならキャッシュ 256 本、ring 512 |
| `.incbin` のパス解決が Docker 内で崩れる | configure 時エラー | `CMAKE_SOURCE_DIR` 基準の絶対パスを `-I` で渡し、`.incbin` はファイル名だけにする |
| `V*__Dpi.cpp` を拾ってビルドが落ちる | `svdpi.h` の `uint8_t` エラー | C‑6 の除外。Wasm ビルドと同じ |
| 共通化（Phase A）で apple1 が壊れる | `apple1.uf2` のサイズ変化、HIL 失敗 | A‑4 のサイズ確認と `test-fw-unit.sh`。apple1 の実機確認が済んでから A に入る |

---

## 8. 未確定・要確認

- `cpm22.dsk` に MBASIC / FREQ.COM / HELLO.TXT が入っているか（`sw/cpm/disks/doCopyAllToDisk.sh` の内容）。入っていなければデモ用ディスクを `cpmtools` で作る。
- ダーティキャッシュの本数（512 本 ≒ 68 KB）は Phase D‑5 の実測で決める。
- ~~GP25 をディスク LED にする案（§3.3）でよいか~~ → ディスクアクセス LED で確定（2026‑10‑12）。
