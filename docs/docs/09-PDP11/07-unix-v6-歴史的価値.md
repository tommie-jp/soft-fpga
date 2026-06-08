# 07. Unix V6 / PDP-11 の歴史的価値 <a class="qr-link" href="../../../docs/09-PDP11/07-QR.png">QR</a>

## 1. Unix V6 とは

Unix Version 6 は Ken Thompson・Dennis Ritchie らが Bell Labs で開発した UNIX の
第 6 版（1975 年）。C 言語で書かれた最初期の実用 OS であり、
Lions' Commentary（1977）を通じて世界中の大学に伝わり、現代 OS 設計の直接の原型となった。

## 2. 歴史的位置づけ

```text
1969  UNIX 第 1 版 (PDP-7)     ← アセンブリ実装
1970  PDP-11 発売 (DEC)
1973  UNIX 第 4 版             ← C 言語への移植完成
1975  UNIX V6                  ← examples/09-pdp11 (このディレクトリ)
1977  Lions' Commentary 配布
1979  UNIX V7                  ← V6 の正式後継
1983  4.2BSD                   ← ソケット・TCP/IP が標準化
```

## 3. 技術的価値

| 項目 | 内容 |
|------|------|
| カーネルサイズ | 約 9,000 行の C コード（`usr/sys/`）|
| プロセス管理 | fork/exec モデル（現代 Linux と同一）|
| ファイルシステム | inode 型 UFS 原型（現代 ext4 の祖先）|
| メモリ管理 | MMU PAR/PDR によるセグメント分割（8 ページ × 8KB）|
| デバイスドライバ | RK11 ディスク・DL11 シリアル・KW11 ラインクロック |
| 割り込みモデル | ベクタ割り込み（現代の IRQ 構造の原型）|

## 4. PDP-11 の技術的特徴

| 項目 | 内容 |
|------|------|
| アドレス幅 | 仮想 16 ビット（64 KB）/ 物理 18 ビット（256 KB = Unibus）|
| レジスタ | R0–R5（汎用）、SP（R6）、PC（R7）、PSW |
| 命令セット | オルソゴナル命令セット（src/dst 対称）|
| アドレッシング | 8 モード（レジスタ/間接/自動増加/デクリメント/即値/絶対/相対/デスパッチ）|
| ワードサイズ | 16 ビット。数値はすべて 8 進表記が標準 |

## 5. cpus-pdp11 RTL コアの価値

このプロジェクトが使用する `cpus-pdp11`（Brad Parker 作）は PDP-11/40 の
マイクロアーキテクチャを Verilog で再現した RTL 実装。

「仕様書どおりの PDP-11 動作」ではなく「実チップのマイクロシーケンサの挙動」を再現するため、

- 命令フェッチ・デコード・実行の各ステージ境界
- MMU 変換タイミング
- トラップ・割り込みのバスサイクル

を Logic Analyzer でクロック単位に観測できる。

## 6. soft-FPGA でシミュレートする意義

| 比較対象 | 命令エミュレータ（SIMH 等） | soft-FPGA（このプロジェクト）|
|---------|--------------------------|---------------------------|
| カーネル / ユーザモード境界 | ブラックボックス | PSW[CM] を波形で追跡可能 |
| MMU 変換タイミング | 不可視 | PAR/PDR パネルでリアルタイム表示 |
| 割り込み受け付けクロック | 不可視 | INT 信号の波形で確認可能 |
| RK11 ディスク DMA | 不可視 | バスサイクルをクロック単位で観測 |
| トラップ発生原因 | OS ログ依存 | TRAP 信号で即座に検出 |

## 7. 参考資料

- [cpus-pdp11 リポジトリ](https://github.com/bholt/cpus-pdp11)（Brad Parker）
- [Lions' Commentary on UNIX 6th Edition（Archive.org）](https://archive.org/details/lionscommentaryo00lion)
- [The Unix Heritage Society](https://www.tuhs.org/)
