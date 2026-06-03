# examples/09-pdp11/disk/ — ディスクイメージ取得手順

このディレクトリは `.gitignore` で管理対象外です。
シミュレーションを動かすには、以下の手順でディスクイメージを配置してください。

---

## 必要なファイル

| ファイル | 用途 | サイズ |
| --- | --- | --- |
| `unix_v6_rk05.dsk` | Unix V6 ブートデモ（主目的） | 2,494,464 bytes |
| `rt11.dsk` | RT-11 起動確認（軽量テスト用、任意） | — |

---

## 1. Unix V6 RK05 ディスクイメージの入手

### 方法 A — simh の「Unix V6 for simh」セットから直接ダウンロード（最速）

Bob Supnik の simh 配布物には用意済みの RK05 イメージが含まれています。

```bash
# simh 配布物から RK05 イメージを取得する例
# （URL は配布状況により変わる場合があります）
cd examples/09-pdp11/disk

# TUHS の Ken Thompson's Unix V6 アーカイブ
# https://www.tuhs.org/Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/
# ここに unix_v6_rk05.dsk または同等のファイルが置かれていることがある

# または simh サンプルイメージ
# http://simh.trailing-edge.com/kits/uv6swre.zip
curl -L http://simh.trailing-edge.com/kits/uv6swre.zip -o /tmp/uv6swre.zip
cd /tmp && unzip uv6swre.zip
# 解凍後の rk0.dsk を unix_v6_rk05.dsk としてコピー
cp /tmp/unix_v6.dsk ~/36-soft-FPGA/examples/09-pdp11/disk/unix_v6_rk05.dsk
```

### 方法 B — シムテープ + simh で RK05 イメージを作成

TUHS からシムテープを取得し、simh の PDP-11 シミュレータを使って
RK05 ディスクイメージに変換します。

#### 1) シムテープの取得

```bash
# TUHS Unix V6 アーカイブ
# https://www.tuhs.org/Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/
# 必要なファイル:
#   Ken_Thompson_s_Unix_V6.tar (または個別 v6*.tar.gz)

cd examples/09-pdp11/disk
# simtape 形式のファイル（例: unix_v6.tap または v6.simtape）を
# TUHS からダウンロードしてここに配置する
```

#### 2) simh PDP-11 でブートしてディスクイメージ作成

```bash
# simh PDP-11 を用意（ubuntu: sudo apt install simh）
apt install simh

# simh 設定ファイルを作成
cat > /tmp/pdp11_v6.ini << 'EOF'
set cpu 11/40
set rk0 writeenabled
attach rk0 unix_v6_rk05.dsk
attach tm0 v6.simtape
boot tm0
EOF

# simh を起動してテープからインストール
pdp11 /tmp/pdp11_v6.ini
# simh 内で Unix V6 のインストール手順を実行
# （詳細は TUHS の Notes ファイルを参照）
```

### 方法 C — Brad Parker heeltoe.com から取得

Brad Parker の cpus-pdp11 README に記載されているディスクイメージ。

```bash
# https://www.heeltoe.com/download/pdp11/ を確認
# rk.dsk または unix_v6_rk05.dsk が提供されている場合がある
```

### 方法 D — 手元で確認済みのイメージを使用（推奨）

```bash
# 本プロジェクトでの動作確認済みファイル:
#   MD5: f51be45bbfabeb21c106bc088d3ab756
#   サイズ: 2,494,464 bytes（RK05 正規サイズ: 203×2×12×512）
#   内容: rkunix / rpunix / hpunix / unix カーネル + Unix V6 ファイルシステム

md5sum unix_v6_rk05.dsk
# → f51be45bbfabeb21c106bc088d3ab756 なら OK
```

---

## 2. 配置後の確認

```bash
# ネイティブシミュレーションで動作確認
cd ~/36-soft-FPGA
bash scripts/build-host-09.sh
IDEIMAGE=examples/09-pdp11/disk/unix_v6_rk05.dsk examples/09-pdp11/build/pdp11_sim
# → "@" プロンプトに "rkunix" + Enter → "login:" が出ればOK

# WASM 用にも配置
cp examples/09-pdp11/disk/unix_v6_rk05.dsk examples/09-pdp11/web/disk/
cd examples/09-pdp11/web && python3 -m http.server 8080
# → http://localhost:8080 で Boot ボタン → "@rkunix" → login:
```

---

## 3. ライセンス

Unix V6 は 2002 年に Caldera International（現 SCO）から
**歴史的目的のための非商用利用**が許可されました。

- ライセンス全文: [TUHS Unix Archive License](https://www.tuhs.org/Archive/Caldera-license.pdf)
- 主要条件: 非商用・研究・教育目的のみ。ソースコードの再配布可。

**本リポジトリにディスクイメージは含めません。** ユーザー各自が上記の
ライセンスを確認した上で取得・使用してください。

---

## 4. 参考リンク

- [TUHS Unix Heritage Society](https://www.tuhs.org/)
- [TUHS Unix V6 アーカイブ](https://www.tuhs.org/Archive/Distributions/Research/Ken_Thompson_s_Unix_V6/)
- [simh シミュレータ](http://simh.trailing-edge.com/)
- [Brad Parker cpus-pdp11 README](https://www.heeltoe.com/download/pdp11/README.html)
- [Lions' Commentary on Unix Sixth Edition](https://en.wikipedia.org/wiki/Lions%27_Commentary_on_Unix_6th_Edition,_with_Source_Code)
