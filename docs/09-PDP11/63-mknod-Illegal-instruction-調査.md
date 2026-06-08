# 63. /etc/mknod の Illegal instruction 調査 <a class="qr-link" href="../../../docs/09-PDP11/63-QR.png">QR</a>

2026-06-07 調査。`ps` を動かすための `/dev` ノード作成を V6 内から試みた際、
`/etc/mknod` が引数なしでもクラッシュした問題の根本原因。

---

## 1. 症状

```text
# /etc/mknod
Illegal instruction -- Core dumped
```

引数なし（usage 表示だけのはず）でも即クラッシュ。一方 `ls`・`date`・`mount`・
`echo` など他の C プログラムは正常動作する。

## 2. 根本原因（結論）

**ディスクイメージ上の `/etc/mknod` バイナリが破損している。** CPU コアのバグでも、
FP11 / SETD 未実装でもない。

`/etc/mknod` の inode が参照するデータブロックは `[2246, 2249, 2252, 2255]` の 4 つだが、
**`#2252` と `#2255` が完全にゼロ**。C の関数プロローグが呼ぶ `csv` ルーチン
（text オフセット `0o2004`）がこのゼロ領域に当たる。

実行の流れ（RTL 計装によるユーザーモード命令トレース）:

```text
pc=000016 isn=004767   crt0 が _main を呼ぶ (jsr pc, _main)
pc=000032 isn=004567   _main 先頭 jsr r5, 0o1750(pc)  → csv 呼び出し
                        実効アドレス = 0o1750 + 0o34 = 0o2004
pc=002006 isn=000000   飛んだ先 0o2004 が 000000 = HALT
[TRAP_PRIV] pc=002006 isn=000000 mode=3   ← ユーザーモードで HALT
```

ユーザーモードの `HALT`（特権命令）は **vector 010** へトラップする。V6 カーネルの
[`/usr/sys/ken/trap.c`](https://www.tuhs.org/) は vector 010 を
`case 1+USER: illegal instruction` として扱い `SIGINS` を送る。シェルは `SIGINS`
（signal 4）を「Illegal instruction」と表示する。

破損は元のイメージ（`.bak`・`web/disk` 含む全コピー）に存在し、本調査の操作で
生じたものではない。

## 3. SETD は無関係（誤誘導の除外）

全 C プログラムの先頭は cc の crt0 が出す `SETD`（`0170011`、FP11 倍精度モード設定）で、
FP11 非実装のコアでは `is_illegal`→ vector 010 にトラップする。ただし `trap.c` は
**「faulting 命令が SETD かつ SIGINS がデフォルト」なら読み飛ばす**特別処理を持つため、
`ls`・`mknod` を含む全プログラムがこれを無事通過する。`mknod` の先頭 SETD を NOP に
置換してもクラッシュは消えなかったことから、SETD はクラッシュ原因ではないと確定した。

真の killer は `SETD`（`trap_ill`）ではなく `HALT` による **`trap_priv`**（特権命令トラップ）。
当初 `trap_priv` を計装していなかったため見落とした。

## 4. 調査用 RTL 計装（再現方法）

[`vendor/cpus-pdp11/rtl/pdp11.v`](../../vendor/cpus-pdp11/rtl/pdp11.v) に、通常ビルドへ
影響しない `ifdef` ゲート付きの `$display` 計装を追加してある。

| define | 出力 |
|--------|------|
| `trap_trace` | `trap_ill` / `trap_res` / `trap_priv` 発火時に `pc`・`isn`・`mode`・`sp` |
| `trap_trace_isn` | ユーザーモード（mode=3）の全命令の `pc`・`isn`（直前の流れ追跡用）|

ネイティブ sim を計装付きでビルドする例:

```bash
verilator --cc --no-timing --top-module test_top_wasm \
  +define+trap_trace +define+trap_trace_isn \
  examples/09-pdp11/verilog/test_top_wasm.v \
  +incdir+examples/09-pdp11/verilog +incdir+vendor/cpus-pdp11/rtl \
  --Mdir obj_dir_09_traptrace
# 以降は scripts/build-host-09.sh と同様に g++ でリンク
```

`$display` は stdout がハーネス側で stderr に振られるため `2>log` で取得する。

## 5. 影響と対処

- **`ps` 修正には mknod は不要。** `/dev/rk0`・`/dev/swap` はホスト側の
  [`scripts/patch-v6-disk-ps.py`](../../scripts/patch-v6-disk-ps.py) でオフライン作成
  しており、壊れた `/etc/mknod` を経由しない。
- mknod を実際に直すには、破損していない V6 の `/etc/mknod` バイナリ（TUHS 等）を
  イメージへ差し込む必要がある（欠損したコードブロックは復元不能）。本対応のスコープ外。

## 6. 参考

- [10-unix-v6-コマンドリファレンス.md](10-unix-v6-コマンドリファレンス.md)
- `/usr/sys/ken/trap.c`（ディスクイメージ内のカーネルソース）
