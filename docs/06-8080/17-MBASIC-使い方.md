# 17. MBASIC 使い方

Microsoft BASIC (MBASIC 5.21) — CP/M 2.2 上で動作するインタプリタ型 BASIC。

## 1. 起動と終了

```text
A>MBASIC              ← 対話モードで起動
A>MBASIC HAMURABI.BAS ← BASファイルを読み込んで起動
```

**CP/M に戻る方法（重要）:**

```text
Ok
SYSTEM
```

`SYSTEM` コマンドを入力すると MBASIC を終了して CP/M プロンプトに戻る。
`QUIT` や `EXIT` は通じない。

## 2. 基本操作

### プログラムの実行

```text
Ok
LOAD "HAMURABI.BAS"  ← ディスクから読み込む
RUN                  ← 実行
```

起動時にファイル名を指定した場合は自動的に LOAD される（RUN は手動）。

### よく使うコマンド

| コマンド | 動作 |
|---------|------|
| `RUN` | プログラムを先頭から実行 |
| `LIST` | プログラムを画面に表示 |
| `LIST 10,50` | 10〜50 行を表示 |
| `NEW` | プログラムをメモリから消去 |
| `LOAD "FILE.BAS"` | ファイルを読み込む |
| `SAVE "FILE.BAS"` | ファイルに保存 |
| `SYSTEM` | **MBASIC を終了して CP/M に戻る** |

### 実行の中断

```text
Ctrl+C   ← 実行中断（プログラムは残る）
```

中断後は `CONT` で再開、`RUN` で先頭から再実行できる。

## 3. このディスクに収録されている BAS ゲーム

| ファイル | ゲーム内容 |
|---------|-----------|
| `HAMURABI.BAS` | 古代都市の農業・人口管理シミュレーション |
| `BLACKJCK.BAS` | ブラックジャック |
| `CHECKERS.BAS` | チェッカーズ（ドラフツ） |
| `AWARI.BAS` | アフリカの伝統ボードゲーム（マンカラ系） |

起動例:

```text
A>MBASIC HAMURABI.BAS
```

終了してCP/Mに戻るには、ゲームを抜けた後（または Ctrl+C で中断後）:

```text
Ok
SYSTEM
```

## 4. 直接文を実行する（電卓として使う）

行番号なしで入力すると即座に実行される。

```text
Ok
PRINT 2^16
 65536
Ok
PRINT SQR(2)
 1.41421
Ok
```

## 5. 参考

- [12-CP_M-コマンドリファレンス.md](12-CP_M-コマンドリファレンス.md) — CP/M コマンド一覧
- [16-CP_M-ソフトウェア入手先.md](16-CP_M-ソフトウェア入手先.md) — MBASIC の入手元
