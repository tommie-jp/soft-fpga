# CP/M 2.2 — 8080 soft-FPGA 上での動作

vm80a（8080 RTL）を動かす soft-FPGA 上で CP/M 2.2 を起動し、
ブラウザの xterm.js からターミナル操作できるようにするレイヤ。

## CP/M の構成

```text
+---------------------------+  $FFFF
|  BIOS（カスタム実装）      |  ← I/O をホスト（WASM/JS）に委譲
+---------------------------+  $F200 付近
|  BDOS（CP/M 標準バイナリ） |
+---------------------------+  $E400 付近
|  CCP（CP/M 標準バイナリ）  |  ← コマンドラインプロセッサ
+---------------------------+  $DC00 付近
|  TPA（ユーザプログラム領域）|  ← .COM ファイルがここにロードされる
+---------------------------+  $0100
|  ページ 0（システム予約）  |  ← リスタートベクタ・BDOS エントリ
+---------------------------+  $0000
```

## BIOS の役割

CP/M 2.2 の BIOS は 17 個のジャンプベクタで構成される。
実装する主な関数：

| # | 関数 | 役割 | soft-FPGA での実装方針 |
|---|------|------|----------------------|
| 0 | BOOT | コールドブート | ページ 0 初期化 → CCP へジャンプ |
| 1 | WBOOT | ウォームブート | ページ 0 復元 → CCP へジャンプ |
| 2 | CONST | コンソール入力ステータス | IN $02: 0=空, $FF=文字あり |
| 3 | CONIN | コンソール入力（1 文字） | IN $00: ブロッキング読み取り |
| 4 | CONOUT | コンソール出力（1 文字） | OUT $01 |
| 5 | LIST | プリンタ出力 | CONOUT に fallback |
| 6 | PUNCH | 紙テープ穿孔 | no-op |
| 7 | READER | 紙テープ読み取り | EOF ($1A) を返す |
| 8 | HOME | トラック 0 へシーク | SETTRK(0) 呼び出し |
| 9 | SELDSK | ディスク選択 | DPH アドレスを HL で返す |
| 10 | SETTRK | トラック番号設定 | OUT $11 |
| 11 | SETSEC | セクタ番号設定 | OUT $12 |
| 12 | SETDMA | DMA バッファアドレス設定 | OUT $13/$14 |
| 13 | READ | セクタ読み取り | OUT $10 (cmd=0) → IN $10 (status) |
| 14 | WRITE | セクタ書き込み | OUT $10 (cmd=1) → IN $10 (status) |
| 15 | LISTST | プリンタ状態 | 常に $FF（ready） |
| 16 | SECTRAN | セクタ変換 | 1:1 マッピング（変換なし） |

## ディスクイメージ

CP/M 2.2 の標準ディスク形式（SSSD 8 インチ）：

| 項目 | 値 |
|------|-----|
| トラック数 | 77 |
| セクタ/トラック | 26 |
| セクタサイズ | 128 バイト |
| 総容量 | 256 KB |

ソフト的なディスク（DSK ファイル）をメモリ上に展開し、
READ/WRITE BIOS コールで WASM バッファ経由でアクセスする。

## ディレクトリ構成

```text
sw/cpm/
├── README.md       ← このファイル
├── Makefile        ← BIOS ビルド（z80asm）
├── bios/
│   └── bios.asm   ← カスタム BIOS アセンブラソース
└── disks/          ← DSK イメージ置き場
```

## 動作確認の手順（計画）

1. `sudo apt install z80asm` でアセンブラをインストール
2. `make` で BIOS バイナリをビルド（`bios/bios.bin` 生成）
3. CP/M 2.2 バイナリ（CCP+BDOS）を `disks/` に配置
4. C++ ハーネスが RAM に CCP+BDOS+BIOS を配置して起動
5. ネイティブ Linux でホスト実行して起動確認
6. Emscripten で WASM 化 → ブラウザ動作確認

## CP/M バイナリの入手

CP/M 2.2 は Digital Research が 2001 年に公開したため再配布可能。

- 公式放流版ソース: `http://www.cpm.z80.de/source.html`
- RunCPM（動作確認済みバイナリ付き）: `https://github.com/MockbaTheBorg/RunCPM`

## I/O ポート割り当て

8080 の `IN`/`OUT` 命令を BIOS 経由で JS に渡す。

| ポート | 方向 | 用途 |
|--------|------|------|
| $00 | IN | CONIN: コンソール入力（1 文字） |
| $01 | OUT | CONOUT: コンソール出力（1 文字） |
| $02 | IN | CONST: 入力ステータス（0=空, 1=ready） |
| $10 | OUT/IN | DCMD/DSTS: ディスクコマンド（0=READ, 1=WRITE）/ 結果 |
| $11 | OUT | DTRK: トラック番号 |
| $12 | OUT | DSEC: セクタ番号 |
| $13 | OUT | DDMA\_L: DMA アドレス低バイト |
| $14 | OUT | DDMA\_H: DMA アドレス高バイト |

## 参考

- [../../README.md](../../README.md) — 06-8080 全体構成
- [../../../../docs/01-soft-FPGA-WebAssembly-設計議論メモ.md](../../../../docs/01-soft-FPGA-WebAssembly-設計議論メモ.md) — CP/M WASM 化の設計方針
- vm80a RTL: `https://github.com/1801BM1/vm80a`
- cpmtools（DSK 操作）: `https://www.moria.de/~michael/cpmtools/`
