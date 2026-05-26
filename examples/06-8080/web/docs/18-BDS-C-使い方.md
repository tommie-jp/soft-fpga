# 18. BDS C コンパイラ 使い方

BDS C v1.60 (Leor Zolman 作、フリーウェア) — Intel 8080/Z80 + CP/M 2.2 向け C コンパイラ。
`.COM` ファイルを直接生成できる。

---

## 1. ディスク構成（BDS C ディスク）

シミュレータのディスクセレクターで **BDS C (CC + CLINK + DEFF)** を選択すると、
以下のファイルが入ったディスクで起動する。

| ファイル | 役割 |
|---------|------|
| `CC.COM` | C コンパイラ（ソース → .CRL 中間コード） |
| `CC2.COM` | コンパイラ第 2 パス（大規模ソース向け） |
| `CLINK.COM` | リンカ（.CRL → .COM） |
| `DEFF.CRL` | 標準ライブラリ（printf / malloc / 文字列関数 等） |
| `DEFF2.CRL` | 拡張ライブラリ（浮動小数点 等） |
| `C.CCC` | CC + CC2 + CLINK を一括実行する SUBMIT スクリプト |
| `ED.COM` | テキストエディタ（ソース編集用） |
| `HELLO.C` | サンプルソース |

---

## 2. コンパイル手順

### 2.1 基本（3 ステップ）

```text
A>CC HELLO.C       ← ソースをコンパイル → HELLO.CRL を生成
A>CLINK HELLO      ← リンク → HELLO.COM を生成
A>HELLO            ← 実行
```

`CC2` は高度な機能を使うときだけ必要。単純なプログラムなら `CC → CLINK` で十分。

### 2.2 CC2 が必要なケース

```text
A>CC HELLO.C
A>CC2 HELLO        ← 省略可能だが、複雑な式・大規模なソースでは必要
A>CLINK HELLO
```

### 2.3 DEFF2.CRL を使う場合（浮動小数点等）

```text
A>CLINK HELLO,DEFF2
```

### 2.4 実行例（HELLO.C をそのままコンパイル）

```text
A>CC HELLO.C
BD Software C Compiler   v1.60

A>CLINK HELLO
BD Software C Linker   v1.60

Last code address: 0E48
Writing output...
  45K link space remaining

A>HELLO
Hello, CP/M!
```

---

## 3. サンプルプログラム

### 3.1 Hello, CP/M!（ディスク収録済み）

```c
/* HELLO.C */
main()
{
    printf("Hello, CP/M!\n");
}
```

> BDS C は関数の戻り値型を省略できる（デフォルト `int`）。

### 3.2 文字入出力

```c
/* INPUT.C */
main()
{
    int c;
    printf("Name: ");
    while ((c = getchar()) != '\n')   /* BDS C getchar() returns '\n', not '\r' */
        putchar(c);
    putchar('\n');
}
```

### 3.3 文字列操作

```c
/* STRING.C */
main()
{
    char buf[64];
    int i, len;

    strcpy(buf, "CP/M-80");
    len = strlen(buf);
    printf("Length: %d\n", len);

    for (i = 0; i < len; i++)
        buf[i] = toupper(buf[i]);
    printf("Upper: %s\n", buf);
}
```

### 3.4 コマンドライン引数

```c
/* ARGS.C */
main(argc, argv)
int argc;
char *argv[];
{
    int i;
    printf("%d args:\n", argc);
    for (i = 0; i < argc; i++)
        printf("  [%d] %s\n", i, argv[i]);
}
```

### 3.5 簡易電卓

```c
/* CALC.C */
main()
{
    int a, b;
    printf("a b: ");
    scanf("%d %d", &a, &b);
    printf("%d + %d = %d\n", a, b, a + b);
    printf("%d * %d = %d\n", a, b, a * b);
}
```

---

## 4. 主要ライブラリ関数（DEFF.CRL）

| 分類 | 関数 |
|------|------|
| 出力 | `printf(fmt, ...)` `putchar(c)` `puts(s)` |
| 入力 | `scanf(fmt, ...)` `getchar()` `gets(buf)` |
| 文字列 | `strlen` `strcpy` `strcat` `strcmp` `strchr` |
| 文字 | `toupper` `tolower` `isalpha` `isdigit` |
| メモリ | `malloc(n)` `free(p)` `memcpy` `memset` |
| 変換 | `atoi` `itoa` |
| 終了 | `exit(code)` |

---

## 5. 標準 C との主な違い

| 項目 | BDS C v1.60 |
|------|-------------|
| ヘッダ | `#include <stdio.h>` なし。ファイル I/O は `#include "bdscio.h"` |
| プロトタイプ | 関数宣言省略可（K&R スタイル） |
| `char` | デフォルトで **unsigned** |
| 浮動小数点 | DEFF2.CRL が必要。精度は単精度相当 |
| 行末 | CP/M は `\r\n`。`getchar()` は BDOS fn10 経由で `\n`(0x0A) を返す（`\r` は除去される） |
| スタック | 約 4KB。深い再帰は不可 |
| `int` サイズ | 16 ビット（−32768 〜 32767） |

---

## 6. ソース編集（ED.COM）

ED.COM は行指向エディタ。vi/Emacs とは操作が異なる。

```text
A>ED HELLO.C         ← 既存ファイルを開く（なければ新規作成）

#I                   ← Insert モード（コロンのないところでテキスト入力）
main()
{
    printf("test\n");
}
^Z                   ← Insert モード終了（Ctrl+Z）

#E                   ← 保存して終了
```

基本コマンド:

| コマンド | 動作 |
|---------|------|
| `nT` | n 行分を表示（`0T` = 全体） |
| `nD` | n 行削除 |
| `S/old/new/` | 文字列置換 |
| `#E` | 保存終了 |
| `#Q` | 保存せずに終了 |

---

## 7. よくあるエラー

| エラーメッセージ | 原因と対処 |
|----------------|-----------|
| `Error writing: 0/A:HELLO.COM` | ディスクがほぼ満杯。`ERA *.CRL` などで不要ファイルを削除してから再試行 |
| `Can't open DEFF.CRL` | CLINK がライブラリを見つけられない。カレントドライブを確認 |
| `? on line N` | 構文エラー。行 N 付近を確認（K&R 構文で書く） |
| `Link ABORTED` | リンク失敗。中間ファイル (.CRL) が壊れている場合は CC からやり直す |

---

## 8. ディスク容量の注意

BDS C ディスクは **IBM 3740 SSSD（256 KB）**。コンパイル中間ファイル (`.CRL`) が蓄積すると満杯になる。

```text
A>ERA *.CRL          ← コンパイル後に中間ファイルを削除
A>ERA HELLO.COM      ← 古い実行ファイルを削除
```

生成されるファイルの目安:

| ファイル | サイズ |
|---------|--------|
| `HELLO.CRL`（中間） | ソース規模に依存、数 KB |
| `HELLO.COM`（最終） | 通常 1〜20 KB |
