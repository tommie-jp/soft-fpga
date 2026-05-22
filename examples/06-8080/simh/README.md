# simh — Altair 8800 ディスクイメージ

[simh](http://simh.trailing-edge.com)（`sudo apt install simh`）の `altair` コマンドで
Intel 8080 / CP/M 2.2 を動かすためのディスクイメージ一式。

詳細な使い方 → [docs/06-8080/55-simh-使い方.md](../../../docs/06-8080/55-simh-使い方.md)

---

## ファイル一覧

| ファイル | 内容 |
|---------|------|
| `altcpm.dsk` | CP/M 2.2 for Altair 8800（MITS 88-DISK 形式、330 KB） |
| `altdos.dsk` | Altair DOS 1.0（同形式、330 KB） |
| `cpm-key.txt` | Caldera ライセンスキー |
| `cpm_license.txt` | Caldera ライセンス全文（非商用フリー） |
| `ceoaltair.zip` | 上記を収録した配布 zip（元ファイル） |
| `doGetDisk.sh` | ディスクイメージ再取得スクリプト |

---

## 起動手順

```bash
cd examples/06-8080/simh
altair
```

altair 起動後、SIMH プロンプトで:

```text
sim> attach dsk0 altcpm.dsk
sim> go 177400
62K CP/M VERSION 2.2 (ALTAIR 8800)
A>
```

`177400`（8進）= `0xFF00` がブート ROM のエントリポイント。

---

## `.ini` で自動起動

```text
; altair.ini
set cpu 8080
set cpu noitrap
attach dsk0 altcpm.dsk
go 177400
```

```bash
altair altair.ini
```

---

## ⚠️ 本プロジェクトの cpm22.dsk との非互換

| 項目 | 本プロジェクト | simh altair |
|------|--------------|-------------|
| フォーマット | IBM 3740 | MITS 88-DISK |
| サイズ | 256 KB | 337 KB（実ファイルは 330 KB） |
| コンソールポート | 0x00–0x02 | 0x10–0x13（2SIO） |

`sw/cpm/disks/cpm22.dsk` をそのまま attach しても動かない。
simh は **CP/M ソフトの動作確認・比較用**として使う。

---

## ディスクイメージの再取得

```bash
bash doGetDisk.sh
```

または手動:

```bash
wget http://simh.trailing-edge.com/kits/ceoaltair.zip
unzip ceoaltair.zip   # → altcpm.dsk, altdos.dsk, cpm-key.txt
```

---

## ライセンス

`altcpm.dsk` / `altdos.dsk` は **Caldera 非商用ライセンス**。
詳細は `cpm_license.txt` を参照。商用利用不可。
