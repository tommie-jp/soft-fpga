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

## 4. 追加修正（レビュー MEDIUM/LOW 項目）

レビューで挙がった保守性・規約・軽微項目もまとめて対応した。

### 4.1 DRY: 論理 DE/HL 取得の重複解消

`harness.cpp` の xchg_dh 論理マッピング（読み取り）が `step()` と `sim_snap_regs()` に
コピペされていた。`logical_de()` / `logical_hl()` ヘルパーに抽出。
（`sim_set_reg` 側は書き込みで逆方向のため対象外）

### 4.2 マジックナンバー除去

`sim_con_in_space()` の `255` を `CON_IN_SIZE - 1` に変更（`CON_IN_SIZE` 変更時の齟齬防止）。

### 4.3 エラー握りつぶしの解消

`sim-worker.js` の `listFS` / `deleteFS` の空 `catch` に `console.warn` を追加
（CLAUDE.md「catch でエラーを握りつぶさない」準拠）。

### 4.4 XSS 対策

`index.html` の FS ファイル名を `innerHTML` に挿入する際、HTML エスケープを追加
（`data-name` 属性・`title`・`<span>` の 3 箇所。self-XSS だが規約準拠）。

### 4.5 WRITABLE 整合 + ring.mjs ストライド連動（前回残課題の解消）

- `index.html` の `WRITABLE` に `reg_f: true` を追加。`setRegs({f})` 対応と `getSignals()` の
  `writable` 一覧が揃った。`62-sim-api.md` の表・出力例・注意事項も追従更新。
- `tests/helpers/ring.mjs` の `readRingBuffer` に `ringWords` 引数を追加し、
  `sim.mjs` が `_get_ring_words()` の値を渡すよう変更。`* 7` ハードコードを排除し再発防止。

### 4.6 ドキュメント整合

- `19-インタラクティブコマンド.md`: §3 配下の見出し番号衝突（`2.1`〜`2.4`）を `3.1`〜`3.4` に修正。
- `26-Vitestタイミングテスト.md`: テスト数「143 (56+87)」→ 実測「418 (タイミング 331 + 信号値 87)」。
  （`61-全命令タイミングテスト計画.md` の 331 は `timing/` 系のみの計画値で正しいため据え置き）

## 5. 検証結果

- ネイティブスモークテスト: `./build/cpm --test` → exit 0（`sim_test: 2 bytes out (Hi)`）
- wasm ビルド: `scripts/build-wasm-06.sh` 成功（`web/sim.js` / `sim.wasm` / `tests/sim-test.mjs`）
- Vitest: 15 ファイル / 418 テスト全 PASS（タイミング系 331 + 信号値系 87）
- markdownlint: 編集ファイルすべてエラー 0

## 6. 未対応（要相談・大規模）

以下は単独で大規模リファクタとなり回帰リスクが高いため、別途方針を確認のうえ着手する。

- `index.html` のインラインスクリプト約 2400 行のモジュール分割（規約 800 行/ファイル超過）。
- SharedArrayBuffer によるゼロコピー経路の新規実装（現状は毎フレーム約 112KB の `slice()` コピー転送。
  機能は動作しており、規約「ゼロコピー」未達だが性能最適化の位置づけ）。
