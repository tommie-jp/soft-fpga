# 11. Thompson シェル 使い方 <a class="qr-link" href="../../../docs/09-PDP11/11-QR.png">QR</a>

Unix V6 の `/bin/sh` は Ken Thompson が書いた最初期のシェル。
Bourne シェル（V7）や bash よりシンプルで、覚えやすい。

---

## 1. 基本操作

```text
# pwd                    ← カレントディレクトリ表示
# ls                     ← ファイル一覧
# ls -l                  ← 詳細一覧（パーミッション・サイズ）
# ls -la                 ← 隠しファイルも表示
# chdir /usr/sys/ken     ← ディレクトリ移動（V6 は cd ではなく chdir）
# cat file.txt           ← ファイル表示
# echo hello world       ← 文字列出力
```

---

## 2. リダイレクト

```text
# echo hello > out.txt        ← 標準出力をファイルへ
# echo world >> out.txt       ← 追記
# cat < in.txt                ← 標準入力をファイルから
# ls -l 2> err.txt            ← 標準エラー出力をファイルへ（V6 では 2> は未対応。代わりに >/dev/null）
```

---

## 3. パイプ

複数のコマンドを `|` でつなぐ。

```text
# ls /bin | wc -l             ← /bin のファイル数を数える
# cat /etc/passwd | grep root ← root のエントリを探す
# ls -l /usr/sys/ken | sort   ← ソート
```

---

## 4. バックグラウンド実行

```text
# dc &                        ← バックグラウンドで起動
# ps -ag                      ← プロセス一覧で確認
```

---

## 5. シェル変数

```text
# x=hello
# echo $x
hello
# path=/usr/bin
# ls $path
```

変数はクォートなしでスペースに弱い点に注意。

---

## 6. 制御構造

Thompson シェルはスクリプト用の制御構造を持つ。

### if

```text
if test -f file.c
then
    echo "exists"
fi
```

### for

```text
for f in *.c
do
    echo $f
done
```

### while

```text
while test -f lock
do
    sleep 1
done
```

---

## 7. シェルスクリプト

ファイルに書いて実行する。

```text
# cat > hello.sh
echo Hello from shell script
date
^D
# chmod 755 hello.sh
# ./hello.sh
Hello from shell script
Thu Jan  1 00:00:00 1970
```

---

## 8. `test` コマンド

条件判定に使う。

| 式 | 意味 |
|----|------|
| `test -f file` | ファイルが存在する |
| `test -d dir` | ディレクトリが存在する |
| `test -r file` | 読み取り可能 |
| `test s1 = s2` | 文字列が等しい |
| `test n1 -eq n2` | 整数が等しい |
| `test n1 -lt n2` | n1 < n2 |

---

## 9. よく使うコマンドの組み合わせ

```text
# ls /usr/sys/ken | grep '\.c$'      ← .c ファイルのみ
# cat /etc/passwd | sort           ← パスワードファイルをソート表示
# echo 'main(){printf("x");}' | cc  ← パイプからコンパイル
# od -c /bin/sh | grep 'S H E L'    ← バイナリ検索
```

---

## 10. Bourne シェル・bash との主な違い

| 機能 | Thompson sh | Bourne sh / bash |
|------|------------|-----------------|
| 関数定義 | なし | あり |
| `$()` コマンド置換 | なし（`` ` ` `` のみ）| あり |
| 配列 | なし | あり（bash のみ）|
| `[[...]]` | なし | あり（bash のみ）|
| `2>` リダイレクト | 非対応 | 対応 |
| `set -e` | 非対応 | 対応 |

---

## 11. 参考

- [10-unix-v6-コマンドリファレンス.md](?doc=10-unix-v6-コマンドリファレンス.md) — 個別コマンド詳細
- [06-unix-v6-demo-commands.md](?doc=06-unix-v6-demo-commands.md) — デモシナリオ
- [Unix V6 sh(1) マニュアル（TUHS）](https://www.tuhs.org/cgi-bin/utree.pl?act=get&file=V6/usr/man/man1/sh.1)
