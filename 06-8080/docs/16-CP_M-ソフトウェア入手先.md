# 16. CP/M ソフトウェア入手先

## 1. アーカイブサイト

| サイト | 内容 |
|--------|------|
| [**Walnut Creek CP/M CD** — archive.org](https://archive.org/search?query=walnut+creek+cpm) | 大量のパブリックドメイン CP/M ソフトを収録した CD イメージ。カテゴリ別に整理されており最も網羅的 |
| [**Gaby's CP/M Archive**](http://www.gaby.de/cpm/) | カテゴリ別整理。BDS C・Aztec C など開発ツールも揃う |
| [**retroarchive.org**](http://www.retroarchive.org/) | BDS C・Aztec C の公式フリーウェア版が置いてある |

## 2. C コンパイラ

このシミュレータは **Intel 8080** (vm80a) なので、Z80 専用コンパイラ (Hi-Tech C 等) は動かない。

| コンパイラ | 対象 CPU | ライセンス | 特徴 |
|-----------|---------|-----------|------|
| **BDS C** | 8080/Z80 | フリーウェア（作者 Leor Zolman 公開） | CP/M 2.2 時代の代表格。`.COM` を直接生成。標準ライブラリ付き。最初の選択肢 |
| **Aztec C** | 8080/Z80 | フリーウェア（Manx Software 公開） | 高品質。リンカ分離型。ライブラリ豊富 |
| **Small C** | 8080 | パブリックドメイン | C のサブセット実装。ソースあり。移植・学習向け |
| Hi-Tech C | **Z80 専用** | フリーウェア | vm80a では動作しない |

## 3. その他のアプリ

| カテゴリ | アプリ | 備考 |
|---------|-------|------|
| Pascal | **Turbo Pascal 3.x** | Borland が公式フリーウェア化。CP/M 版あり |
| BASIC | **MBASIC** (Microsoft BASIC) | CP/M の定番 BASIC |
| ゲーム | **Zork I/II/III** | Infocom 製テキスト ADV。CP/M 版が広く流通 |
| ゲーム | **Adventure** (Colossal Cave) | 元祖テキスト ADV |
| ゲーム | **Ladder** | アーケード風ゲーム |
| DB | **dBASE II** | 歴史的 DB ソフト |
| ワープロ | **WordStar 3.x** | 著名ワープロ（著作権残存注意） |

## 4. ディスクイメージへの追加手順

`cpmtools` パッケージ（Ubuntu/Debian）を使う。

```bash
sudo apt install cpmtools
```

`ibm-3740` は cpmtools に内蔵されているため **diskdefs への追記不要**。

### 4-1. 新規ディスクイメージを作成する

```bash
# IBM-3740: 77 トラック × 26 セクタ × 128 B = 256,256 B
dd if=/dev/zero of=new.dsk bs=128 count=$((77*26))

# CP/M ファイルシステムを書き込む
mkfs.cpm -f ibm-3740 new.dsk
```

> **補足**  
> `dd` でゼロ埋めしたあと `mkfs.cpm` がディレクトリエントリ領域（boottrk 2 以降）を
> 0xE5 で初期化する。これで cpmtools・このシミュレータ双方から使える空ディスクになる。

### 4-2. 既存イメージの基本操作

```bash
# ファイル一覧
cpmls -f ibm-3740 new.dsk

# ホスト → CP/M ディスクへコピー
cpmcp -f ibm-3740 new.dsk PROG.COM 0:PROG.COM

# CP/M ディスク → ホストへ取り出し
cpmcp -f ibm-3740 new.dsk 0:PROG.COM ./PROG.COM

# ファイル削除
cpmrm -f ibm-3740 new.dsk 0:PROG.COM
```

## 5. 参考

- [15-ファイル構成とファイル交換.md](15-ファイル構成とファイル交換.md) — DSK ファイルの場所と構造
- [12-CP_M-コマンドリファレンス.md](12-CP_M-コマンドリファレンス.md) — CP/M 組み込みコマンド一覧
