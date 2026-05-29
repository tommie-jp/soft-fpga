# 64. 信号名是正・API 整合・可視化拡張の修正記録（2026-05-29）

8080 実装の網羅レビューで判明した 7 件を修正し、検証中に発見した既存バグ 1 件も併せて修正した記録。

## 1. 概要

レビューの主テーマは「可視化の正確性」と「ドキュメントと実装の乖離」。
コード修正（#1〜#3）はネイティブスモークテストと Vitest 418 件全 PASS で回帰なしを確認済み。

## 2. コード修正

### 2.1 デバッグ信号の名称是正と実害バグ修正（#1）

`cpm_top.v` のデバッグ用ポートが名前と実体で食い違っていた。

- `dbg_pc`（実体はアドレスバス `cpu_addr`）→ `dbg_addr` にリネーム
- `dbg_a`（実体はデータバス `cpu_dout`）→ `dbg_dbus` にリネーム
- `dbg_f`（実体は `{7'b0, cpu_wr_n}` で `dbg_wr_n` と冗長）→ ポート削除

名称詐称が API の実害バグになっていた箇所を修正した。

- `get_pc()`（`harness.cpp`）: アドレスバスを返していた。sim-worker は命令デコード用に
  PC 周辺バイトを読むため、本物の PC（`vm80a r16_pc`）を返すよう修正。
- レジスタ値トリガーの F（`trig_reg_id==1`）: `dbg_f`（= `cpu_wr_n` のみ）を返していた。
  `make_f_byte()`（PSW 個別ビットから再構成）に修正。

なお、コールトレース（SYNC エッジでのフェッチアドレス取得）は用途上アドレスバスで正しいため、
名称のみ `dbg_addr` に追従。ring buffer 内の PC/A/F は元から本物のレジスタ参照で正しい。

### 2.2 マシンサイクル（M-CYC）の可視化追加（#2）

T-state は既に可視化済みだったが、マシンサイクル（M1〜M5）がトップに出ていなかった。
vm80a の `m1`〜`m5`（`/* verilator public */` 済み）を `harness.cpp` で読み、
ring buffer の Word4 空きビット `[20:18]` に番号（1=M1 … 5=M5、0=該当なし）として格納。
`index.html` の `LA_SIGNALS_ALL` に `mcycle`（label `M-CYC`）を追加し LA に表示可能にした。

### 2.3 テストランナーのバッファ枯渇ガード（#3）

`main_linux.cpp` の `run_mode_run_test` が `get_display_char()` を戻り値 `n` 回ループする際、
`-1`（バッファ枯渇）ガードを欠いていた。`n` が実出力数を超えると巡回した誤データを読む。
`run_mode_bare_test` と同じく `if (ch < 0) break;` を追加。

### 2.4 ring.mjs リングストライド（検証中に発見した既存バグ）

`tests/helpers/ring.mjs` のサンプルストライドが `* 6` のままだった。
`RING_WORDS` が 6→7 に増えた時点（Word5=PC/SP・Word6=MemWatch 追加）で取り残された既存バグ。
`* 7` に修正したところタイミングテスト群（400 件）が解消し、全 418 件 PASS した。
レビュー依頼の 7 件とは独立だが、テスト基盤を正しく動かすために必須だった。

## 3. ドキュメント整合（#4〜#7）

| 項目 | ファイル | 内容 |
|------|----------|------|
| #4 | `62-sim-api.md` | F レジスタ「未サポート」は誤り。`setRegs({f})` は `setFlags` 経由で対応済み |
| #5 | `25-デバッグパネル-使い方.md` | ring buffer ワードレイアウトを 7 ワード構成（+M-CYC）に全面更新 |
| #6 | `11-vm80a-タイミング解析.md` | §5.1 の掲載コードを現行の f2 フェーズ発火方式に更新 |
| #7 | `62-sim-api.md` | `setMemWatch` / `thawRing` / `freezeRing` を追記 |

## 4. 検証結果

- ネイティブスモークテスト: `./build/cpm --test` → exit 0（`sim_test: 2 bytes out (Hi)`）
- wasm ビルド: `scripts/build-wasm-06.sh` 成功（`web/sim.js` / `sim.wasm` / `tests/sim-test.mjs`）
- Vitest: 15 ファイル / 418 テスト全 PASS
- markdownlint: 編集 3 ファイルともエラー 0

## 5. 残課題（任意改善）

- `index.html` の `WRITABLE` マップに `reg_f` が無く、`getSignals()` の `writable` には
  `reg_f` が現れない。`setRegs({f})` は動作するため、一貫性のため `WRITABLE` に
  `reg_f: true` を足すと `getSignals()` と挙動が揃う。
- `ring.mjs` の `RING_WORDS` はハードコード（`* 7`）。`cpm_const.h` と連動させるか
  `_get_ring_words()` から取得すると再発を防げる。
