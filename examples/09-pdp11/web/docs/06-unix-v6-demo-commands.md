# 06. Unix V6 デモコマンド集

## ブート直後（定番の確認）

```text
who
pwd
ls -l
cat /etc/passwd
```

`/etc/passwd` はパスワード平文保存——1975年の時代性を示す小ネタ。

## システム探索（可視化との相性が良い）

```text
ps -ag          # プロセス一覧 — fork/exec の生き証人
ls -l /dev      # デバイス一覧
/etc/mount      # マウント情報
```

`ps` 実行中に MMU PAR/PDR が動くので Logic Analyzer との相性が良い。

## dc — Thompson の逆ポーランド電卓（1970年代そのまま）

```text
dc
  2 3 + p
  10 k
  355 113 / p
  q
```

- `2 3 + p` → 5
- `10 k` で小数 10 桁モード
- `355 113 / p` → π ≈ 3.1415929203

## ed — 最初期のラインエディタ

```text
ed
  a
  Hello from 1975!
  .
  p
  q
```

## C コンパイル（最大の見せ場）

```text
cat > hello.c
main() {
    printf("Hello, Unix V6!\n");
}
^D

cc hello.c
./a.out
```

コンパイル中に r0–r5・SP と MMU PAR が激しく変化する。
Logic Analyzer ビューとの組み合わせがデモのクライマックスに最適。

## ゲーム（締め）

```text
/usr/games/wump     # Wumpus — 史上初のテキストアドベンチャー
/usr/games/ttt      # 三目並べ
/usr/games/chess    # チェス
```

## 終了手順

Unix V6 には `halt` / `shutdown` コマンドがない。

```text
# sync
# sync
```

`sync` を 2 回実行してディスクへ書き込んだ後、行頭（Enter 直後）で **`~.`** と入力してシミュレーターを終了する（ssh/tip/cu と同じ方式）。

- `~.` — シミュレーター終了
- `~~` — `~` を 1 文字送信（エスケープ）
- Ctrl-C — Unix V6 プロセスへの割り込み（シミュレーターは終了しない）

---

## 推奨デモシナリオ

1. ブート → `login: root` → `ls -l /`（OS 起動の実感）
2. `ps -ag`（プロセスの存在）
3. `dc` で計算（割り込み波形が Logic Analyzer に出る）
4. `cc hello.c && ./a.out`（コンパイル中に MMU・GPR が大変動 → 可視化の本命）
5. `/usr/games/wump` で締め
