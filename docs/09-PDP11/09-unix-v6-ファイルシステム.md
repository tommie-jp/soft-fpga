# 09. Unix V6 ファイルシステム構成 <a class="qr-link" href="../../../docs/09-PDP11/img/09-QR.png">QR</a>

## 1. ディレクトリ階層

```text
/
├── bin/        基本コマンド（ls, cat, sh, cc, as, ld, ed ...）
├── dev/        デバイスファイル（rk0, tty, mem, kmem ...）
├── etc/        管理ファイル（passwd, group, rc, motd, fstab）
├── lib/        コンパイラパス・ライブラリ（c0, c1, c2, libc.a ...）
├── tmp/        一時ファイル（再起動でクリア）
├── unix        ブート可能なカーネルバイナリ
├── usr/
│   ├── bin/    追加コマンド（dc, od, grep, diff, nm, size ...）
│   ├── games/  ゲーム（wump, chess, ttt, maze ...）
│   ├── include/ヘッダファイル（stdio.h, ctype.h, sys/ ...）
│   ├── lib/    ライブラリ・マニュアル用データ
│   ├── man/    マニュアルページ（man1/ man2/ man3/ ...）
│   ├── source/ コマンドソース（cmd/）
│   └── sys/    カーネルソース（conf/ ken/ dmr/ dev/ h/）
└── (その他)
```

## 2. 重要なファイル

| パス | 内容 |
|------|------|
| `/unix` | 起動カーネルバイナリ（bootrom が `rkunix` でロード）|
| `/etc/passwd` | ユーザーアカウント（パスワード平文）|
| `/etc/group` | グループ定義 |
| `/etc/rc` | ブート時に実行されるシェルスクリプト |
| `/etc/motd` | ログイン時のメッセージ |
| `/dev/rk0` | RK05 ディスク raw デバイス |
| `/dev/tty` | コンソール端末 |
| `/dev/mem` | 物理メモリ（`ps` などが使用）|

## 3. デバイスファイル (`/dev`)

```text
# ls -l /dev
crw-rw-rw-  1 root    0,  0  rk0    ← RK05 ディスク（ブロック 0=）
crw-rw-rw-  1 root    1,  0  mem    ← 物理メモリ
crw-rw-rw-  1 root    1,  1  kmem   ← カーネルメモリ
crw-rw-rw-  1 root    3,  0  tty    ← コンソール端末
```

- `c` = キャラクタデバイス、`b` = ブロックデバイス
- 先頭のメジャー番号がドライバ番号

## 4. RK05 ディスク構成（2.4 MB）

| 領域 | 用途 |
|------|------|
| ブロック 0–1 | ブートブロック（bootrom がロード）|
| ブロック 2–5 | スーパーブロック（i-node 数・フリーリスト）|
| ブロック 6–… | i-node テーブル |
| 残り | データブロック（1 ブロック = 512 バイト）|

## 5. よく使うファイル操作

```text
# ls -la /usr/sys/ken      ← カーネル C ソース一覧
# cat /etc/passwd          ← ユーザー一覧（root のパスワードは空）
# ls /usr/games            ← 収録ゲーム一覧
# od -c /bin/ls            ← バイナリの 8 進ダンプ
# size /bin/sh             ← text+data+bss サイズ確認
```

## 6. ディスクイメージ上の配置

このシミュレータは `unix_v6_rk05.dsk`（2,494,464 バイト）を使用。
RK05 の規格: 203 シリンダ × 2 ヘッド × 12 セクタ × 512 バイト = 2,496,768 バイト。

bootrom は電源投入後に RK05 のブロック 0 を読み込み、
`@` プロンプトでカーネル名（`rkunix`）の入力を待つ。

## 7. 参考

- [10-unix-v6-コマンドリファレンス.md](?doc=10-unix-v6-コマンドリファレンス.md) — コマンド一覧
- [52-メモリマップ.md](?doc=52-メモリマップ.md) — デバイスレジスタアドレス
- [07-unix-v6-歴史的価値.md](?doc=07-unix-v6-歴史的価値.md) — システム概要
