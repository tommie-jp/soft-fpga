# 13. Integer BASIC 動作検証サンプル

Apple-1 Integer BASIC の動作確認用プログラム集。

> - BASIC は大文字専用・整数演算のみ。整数除算は切り捨て（`7/2` → `3`）。
> - **配列の添字は 1 始まり**。`DIM A(N)` で `A(1)`〜`A(N)` が有効。`A(0)` は `*** RANGE ERR`。
> - `NEW` は非対応（`*** SYNTAX ERR`）。前のプログラムを消すには同じ行番号で上書きするか、シミュレータを再起動する。
> - `END` のないプログラムが末尾まで実行されると `*** END ERR` と表示されるが、これは正常終了を示す。
> - **`IF cond THEN stmt1 : stmt2` の `stmt2` は条件によらず常に実行される。**
>   条件付きで複数処理をしたい場合は `THEN GOTO` で別行に飛ぶこと。

---

## 1. PRINT 文 / 算術

PRINT の文字列出力・算術式・整数除算の切り捨てを確認する。

```basic
10 PRINT "HELLO, APPLE-1"
20 PRINT "2*3+4=";2*3+4
30 PRINT "100/7=";100/7
40 PRINT "DONE"
RUN
```

期待出力:

```text
HELLO, APPLE-1
2*3+4=10
100/7=14
DONE
*** END ERR
```

---

## 2. FOR-NEXT ループ（1〜10 の総和）

FOR-NEXT ループ・変数代入・累算を確認する。

```basic
10 S=0
20 FOR I=1 TO 10
30 S=S+I
40 NEXT I
50 PRINT "SUM=";S
60 END
RUN
```

期待出力:

```text
SUM=55
```

---

## 3. GOTO / 条件分岐（最大公約数）

IF-THEN・GOTO・END・整数剰余 `A-A/B*B` を確認する。

```basic
10 A=252
20 B=105
30 IF B=0 THEN GOTO 80
40 C=A-A/B*B
50 A=B
60 B=C
70 GOTO 30
80 PRINT "GCD=";A
RUN
```

期待出力:

```text
GCD=21
```

---

## 4. GOSUB / RETURN（乗算表 3×3）

入れ子 FOR-NEXT・GOSUB/RETURN・`PRINT ;`（改行なし）を確認する。

```basic
10 FOR I=1 TO 3
20 FOR J=1 TO 3
30 GOSUB 100
40 NEXT J
50 PRINT
60 NEXT I
70 END
100 PRINT I*J;" ";
110 RETURN
RUN
```

期待出力:

```text
1  2  3
2  4  6
3  6  9
```

---

## 5. 素数列挙（2〜30）

GOSUB からの多経路 RETURN・整数除算による割り切れ判定 `N/D*D=N` を確認する。

```basic
10 FOR N=2 TO 30
20 GOSUB 200
30 IF F=1 THEN PRINT N
40 NEXT N
50 END
200 F=1
210 IF N<4 THEN RETURN
220 D=2
230 IF D*D>N THEN RETURN
240 IF N/D*D=N THEN F=0
245 IF F=0 THEN RETURN
250 D=D+1
260 GOTO 230
RUN
```

期待出力:

```text
2
3
5
7
11
13
17
19
23
29
```

---

## 6. INPUT（対話入力）

INPUT 文・`?` プロンプト・対話的な値受け取りを確認する。

```basic
10 INPUT N
20 S=0
30 FOR I=1 TO N
40 S=S+I
50 NEXT I
60 PRINT "SUM 1-";N;"=";S
70 END
RUN
```

`?` に `10` を入力した場合の期待出力:

```text
SUM 1-10=55
```

---

## 7. フィボナッチ数列（中規模）

GOTO ループ・2変数スワップ・条件終了を確認する。1000 以内のフィボナッチ数を列挙する。

```basic
10 A=1
20 B=1
30 IF A>1000 THEN END
40 PRINT A
50 C=A+B
60 A=B
70 B=C
80 GOTO 30
RUN
```

期待出力（16 値）:

```text
1
1
2
3
5
8
13
21
34
55
89
144
233
377
610
987
```

> `IF A>1000 THEN END` の `>` は行内容中の比較演算子。BASIC プロンプト `>` とは無関係。

---

## 8. バブルソート（大規模）

配列 `DIM`・多重 FOR-NEXT・隣接要素スワップを確認する。
10 要素をバブルソートして昇順に出力する。

```basic
10 DIM A(10)
20 A(1)=5
30 A(2)=3
40 A(3)=8
50 A(4)=1
60 A(5)=9
70 A(6)=2
80 A(7)=7
90 A(8)=4
100 A(9)=6
110 A(10)=10
120 FOR I=1 TO 9
130 FOR J=1 TO 10-I
140 IF A(J)<=A(J+1) THEN GOTO 180
150 T=A(J)
160 A(J)=A(J+1)
170 A(J+1)=T
180 NEXT J
190 NEXT I
200 FOR I=1 TO 10
210 PRINT A(I)
220 NEXT I
RUN
```

期待出力:

```text
1
2
3
4
5
6
7
8
9
10
*** END ERR
```

---

## 9. 九九表（中規模）

2重ループ・条件付きスペース挿入・書式付き `PRINT ;` を確認する。
積が 1 桁のとき先頭に空白を挿入して列を揃える。

```basic
10 FOR I=1 TO 9
20 FOR J=1 TO 9
30 P=I*J
40 IF P<10 THEN PRINT " ";
50 PRINT P;" ";
60 NEXT J
70 PRINT
80 NEXT I
RUN
```

期待出力:

```text
 1  2  3  4  5  6  7  8  9
 2  4  6  8 10 12 14 16 18
 3  6  9 12 15 18 21 24 27
 4  8 12 16 20 24 28 32 36
 5 10 15 20 25 30 35 40 45
 6 12 18 24 30 36 42 48 54
 7 14 21 28 35 42 49 56 63
 8 16 24 32 40 48 56 64 72
 9 18 27 36 45 54 63 72 81
*** END ERR
```

---

## 10. 完全数探索（大規模）

GOSUB 内 FOR-NEXT・除数和・`S=N` 判定を確認する。
「完全数」（真の約数の和が自分自身に等しい数）を探索する。

```basic
10 FOR N=2 TO 500
20 GOSUB 200
30 IF S=N THEN PRINT N
40 NEXT N
50 END
200 S=0
210 FOR D=1 TO N/2
220 IF N/D*D=N THEN S=S+D
230 NEXT D
240 RETURN
RUN
```

期待出力:

```text
6
28
496
```

> `N=2 TO 500` は時間がかかる。素早く確認するには `N=2 TO 30`（結果: 6, 28）に絞る。

---

## 11. Byte Sieve — エラトステネスの篩（大規模・ベンチマーク）

1981年 BYTE 誌掲載の Integer BASIC 公式ベンチマーク。
入力なし・決定論的で、実機 Apple II では約 166 秒かかった計測が残っている。

> **Apple-1 BASIC の変数名制限と遅延確保の注意点:**
>
> - 変数名は英字 1 文字（A〜Z）または英字+数字 2 文字（A0〜Z9）のみ有効。
>   元の BYTE 誌版（Apple II 向け）の多文字名 `FLAGS`/`SIZE`/`COUNT`/`PRIME` は使用不可。
> - `DIM F(N)` は配列の上限のみ登録し、実メモリは初回書き込み時に遅延確保する。
>   FOR ループ内で `F(I) = 1` を書くと変数テーブルが拡張・移動し、
>   FOR-NEXT が保持する変数 `I` のアドレスポインタが無効化されて `*** BAD NEXT ERR` になる。
>   **回避策**: 配列の初期化は GOTO ベースのループで行い、全要素を確保してから FOR-NEXT を使う。

```basic
1 S = 100
2 DIM F(100)
3 PRINT "SIEVE START"
4 I = 1
5 F(I) = 1
6 I = I+1
7 IF I <= S THEN GOTO 5
8 C = 0
9 FOR I = 1 TO S
10 IF F(I) = 0 THEN 18
11 P = I+I+1
12 K = I+P
13 IF K > S THEN 17
14 F(K) = 0
15 K = K+P
16 GOTO 13
17 C = C+1
18 NEXT I
19 PRINT C
RUN
```

期待出力（奇数 3〜201 の素数個数 = 45）:

```text
SIEVE START
45
*** END ERR
```

> **SIZE の上限について:** Apple-1 BASIC の HIMEM（ヒープ上限）が約 1〜2 KB に制限されている。
> `DIM F(N)` は `(N+1)×2` バイトを確保するため、N が大きすぎると `*** MEM FULL ERR` になる。
> `S = 8190` に変更すると元の BYTE 誌ベンチマーク結果（1899）が得られるが、
> Apple-1 BASIC ではメモリ不足のため動作しない。
