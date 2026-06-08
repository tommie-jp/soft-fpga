# 54. SIMH — PDP-11 シミュレータ <a class="qr-link" href="../../../docs/09-PDP11/54-QR.png">QR</a>

SIMH は Digital Equipment Corporation の歴史的コンピュータを再現する
ソフトウェアシミュレータ群。PDP-11/Unix V6 を完全に動かせる。

**WASM 版で cc が動かない**場合、SIMH なら `cc hello.c` が正常動作する。

---

## 1. インストール（Ubuntu / WSL2）

```bash
sudo apt install simh
```

`pdp11` コマンドが使えるようになる。

---

## 2. 起動手順

```bash
pdp11
```

起動したら以下を入力:

```text
PDP-11 simulator V3.8-1
sim> set cpu 11/40
Disabling XQ
sim> attach rk0 examples/09-pdp11/disk/unix_v6_rk05.dsk
sim> boot rk0
```

bootrom の `@` プロンプトが出たら:

```text
@rkunix

login: root
#
```

---

## 3. cc でコンパイルする

SIMH では `cc` が正常動作する（WASM 版のバグ `41-cc-コンパイル-バグ調査.md` の影響なし）。

```text
# ed
a
main()
{
    printf("Hello, Unix V6!\n");
}
.
w hello.c
q
# cc hello.c
# ./a.out
Hello, Unix V6!
```

---

## 4. SIMH 終了

Unix V6 内で `sync` を 2 回叩いてからシミュレータを終了する。

```text
# sync
# sync
```

その後、SIMH プロンプトに戻るには `Ctrl-E`:

```text
Simulation stopped, PC: 015670 (...)
sim> quit
```

---

## 5. よく使う SIMH コマンド

SIMH プロンプト（`sim>`）で使えるコマンド:

| コマンド | 説明 |
|---------|------|
| `set cpu 11/40` | PDP-11/40 を選択 |
| `attach rk0 <file>` | RK05 ディスクイメージを接続 |
| `boot rk0` | RK05 からブート |
| `quit` | SIMH 終了 |
| `examine 0` | アドレス 0 の値を表示 |
| `deposit 0 177777` | アドレス 0 に値を書き込む |
| `show cpu` | CPU 設定を表示 |
| `Ctrl-E` | 実行中断・SIMH プロンプトへ |

---

## 6. SIMH と soft-FPGA の比較

| 比較項目 | SIMH | soft-FPGA（WASM 版）|
|---------|------|-------------------|
| cc 動作 | **正常** | 失敗（MMU バグ）|
| ブート速度 | 約 10 秒 | 約 30〜60 秒 |
| バス波形 | 不可視 | Logic Analyzer で観測可能 |
| MMU 内部状態 | 不可視 | パネルでリアルタイム表示 |
| 用途 | 開発・テスト | 教育・可視化デモ |

---

## 7. ディスクイメージの共有

soft-FPGA と SIMH は同じ `unix_v6_rk05.dsk` を使える（SIMH で書いたファイルを soft-FPGA でも参照可能）。

```bash
# SIMH で編集したディスクイメージを WASM 版にコピー
cp examples/09-pdp11/disk/unix_v6_rk05.dsk examples/09-pdp11/web/disk/
```

---

## 8. 参考

- [41-cc-コンパイル-バグ調査.md](?doc=41-cc-コンパイル-バグ調査.md) — WASM 版 cc バグの詳細
- [53-参考資料.md](?doc=53-参考資料.md) — SIMH 公式サイトリンク
- [SIMH 公式サイト](http://simh.trailing-edge.com/)
