# 02. CP/M の歴史的価値

## 1. CP/M とは

CP/M（Control Program for Microcomputers）は Gary Kildall（Digital Research）が
1974 年に開発した 8080 向け OS。1977–1981 年にかけてマイクロコンピュータの
事実上の標準 OS として普及し、商業ソフトウェア産業の基盤を作った。

## 2. 歴史的位置づけ

```text
1971  Intel 4004          ← examples/04 (予定)
1974  Intel 8080          ← examples/06-8080 (このディレクトリ)
1975  Altair 8800         ← 8080 搭載・CP/M の舞台
1976  CP/M 1.3 リリース
1977  CP/M 2.2（最終版）
1981  IBM PC / MS-DOS     ← CP/M の後継として登場
```

## 3. 技術的価値

| 項目 | 内容 |
|------|------|
| 命令セット | 78 命令（6502 の約 2 倍）、レジスタ豊富（B/C/D/E/H/L/A/F） |
| メモリモデル | 64 KB フラット（セグメントなし） |
| I/O モデル | メモリマップド I/O ではなく IN/OUT ポート命令で分離 |
| OS 設計 | BIOS/BDOS/CCP の 3 層構造（今日の OS 設計の原型） |
| ソフトウェア資産 | WordStar・dBASE II・Turbo Pascal など多数が CP/M 上で誕生 |

## 4. soft-FPGA でシミュレートする意義

| 比較対象 | 命令エミュレータ | soft-FPGA（このプロジェクト） |
|---------|----------------|----------------------------|
| IN/OUT ポート | ブラックボックス | クロック単位で観測可能 |
| バスサイクル | 不可視 | Logic Analyzer で波形表示 |
| BIOS コール | 直接実行 | ハンドシェイク信号まで見える |
| デキャップ互換 | なし | バグ互換・タイミング互換 |

## 5. vm80a の価値

vm80a は NEC D8080AFC（Intel 8080A の NEC セカンドソース）の
デキャップ画像から論理を起こした Verilog RTL。
「仕様書通りの 8080 動作」ではなく「実チップと同じ挙動」を再現する。

未定義命令・未定義フラグビット・タイミング微差まで一致するため、
Klaus Dormann や Ian Bartholomew の CPU Exerciser を使った
**シリコン等価性検証**が可能。

## 6. 参考資料

- [Digital Research CP/M 2.2 ソース](http://www.cpm.z80.de/source.html)
- [vm80a リポジトリ](https://github.com/1801BM1/vm80a)
- [The Unofficial CP/M Web site](http://www.cpm.z80.de/)
