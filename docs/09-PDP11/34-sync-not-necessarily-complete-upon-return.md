# 34. sync は書き込みの完了を待たずに戻る <a class="qr-link" href="../../../docs/09-PDP11/img/34-QR.png">QR</a>

UNIX を止める前には `sync` を打て、と昔から言われます。3 回打て、という言い伝えもあります。
理由としてよく引かれるのが、UNIX Version 7 のマニュアル `sync(2)` の BUGS の節です。

> The writing, although scheduled, is not necessarily complete upon return from sync.

訳すと次のようになります。

> 書き込みは予定に入るが、sync から戻った時点で終わっているとは限らない。

`sync` を打ってプロンプトが返っても、ディスクはまだ書いている最中かもしれない、と読めます。
この記事では、V6 の `sync` が実際にどこまで待つのかを確かめます。

| 番号 | 確かめること |
| --- | --- |
| 1 | `sync` の前半は、書き込みを 1 つずつ終わりまで待つ |
| 2 | 後半は、書き込みを出すだけで、終わる前にユーザーへ戻る |
| 3 | プロンプトが返ったとき、書き込みは残っているのか |

Verilog で書いた PDP-11 の上で本物の Unix V6 を動かし、3 つを波形で確かめます。
使うのは [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) のデバッグパネルです。
3 つめの答えは、言い伝えとは違っていました。

---

## 1. 該当のコード

`sync` コマンドは、システムコールの `sync` を呼ぶだけです。カーネルの側は `sys/ken/alloc.c` の `update()` です。

```c
update()
{
        ...
        for(mp = &mount[0]; mp < &mount[NMOUNT]; mp++)
                if(mp->m_bufp != NULL) {
                        ...
                        bcopy(ip, bp->b_addr, 256);
                        bwrite(bp);
                }
        for(ip = &inode[0]; ip < &inode[NINODE]; ip++)
                if((ip->i_flag&ILOCK) == 0) {
                        ip->i_flag =| ILOCK;
                        iupdat(ip, time);
                        prele(ip);
                }
        updlock = 0;
        bflush(NODEV);
}
```

仕事は 3 つあります。スーパーブロックを書き、変更のあった inode を書き、最後に `bflush()` を呼びます。
前の 2 つは `bwrite()` で書きます。`iupdat()` も、中で `bwrite()` を呼びます。

`bwrite()` は `sys/dmr/bio.c` にあります。

```c
bwrite(bp)
struct buf *bp;
{
        ...
        flag = rbp->b_flags;
        rbp->b_flags =& ~(B_READ | B_DONE | B_ERROR | B_DELWRI);
        rbp->b_wcount = -256;
        (*bdevsw[rbp->b_dev.d_major].d_strategy)(rbp);
        if ((flag&B_ASYNC) == 0) {
                iowait(rbp);
                brelse(rbp);
        } else if ((flag&B_DELWRI)==0)
                geterror(rbp);
}
```

`d_strategy` は、ディスクのドライバに書き込みを頼みます。そのあとが分かれ目です。
`B_ASYNC` が立っていなければ、`iowait()` で書き込みの終わりを待ちます。立っていれば、待たずに戻ります。

`B_ASYNC` を立てるのが、同じファイルにある `bflush()` です。

```c
bflush(dev)
{
        register struct buf *bp;

loop:
        spl6();
        for (bp = bfreelist.av_forw; bp != &bfreelist; bp = bp->av_forw) {
                if (bp->b_flags&B_DELWRI && (dev == NODEV||dev==bp->b_dev)) {
                        bp->b_flags =| B_ASYNC;
                        notavail(bp);
                        bwrite(bp);
                        goto loop;
                }
        }
        spl0();
}
```

`B_DELWRI` は、あとで書くことにしてあるバッファの印です。ファイルに書いた半端なブロックや、ディレクトリのブロックに付きます。
`bflush()` はそれを探し、`B_ASYNC` を立ててから `bwrite()` を呼びます。この書き込みだけが、待たれません。

## 2. 観測の準備

[09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) を開き、`login:` に `root` で入ります。
`#` のプロンプトが出たら、次のボタンを押します。設定がまとめて入り、トリガーが待ち受けになります。

[▶ この設定を入れる](?scenario=sync-bflush)

そのあと、端末で次の 1 行を実行します。

```text
# date >y; sync
```

ボタンは次の 4 つの操作をします。手で設定するときも、この順です。

1. **Logic Analyzer** のパネルを開く。
2. LA の **RK seek** を `4K clk (1.2 ms)` にする。
3. **Trigger** の Preset で `V6 bflush: B_ASYNC set (write not awaited)` を選び、**Set** を押す。
4. LA の信号を `PC`・`Mode`・`RK`・`INT`・`Vec`・`VA`・`Data`・`WR` だけにする。

プリセットは、カーネルの 046012 番地の命令 `bis $400,(r4)` で発火します。`bflush()` の `bp->b_flags =| B_ASYNC;` です。
この命令は、あとで書くバッファが 1 つでも残っているときにしか通りません。

`date >y` は、新しいファイルを作るために入れてあります。ディレクトリのブロックが書き換わり、あとで書くバッファとして残ります。
同じ名前で繰り返すとディレクトリは変わらないので、やり直すときは `y2`・`y3` のように名前を変えてください。

RK seek は、ディスクが書き込みを始めるまでの待ち時間です。既定の Off では、ディスクが速すぎて順序の違いが見えません。
この設定は Reset をまたいで残ります。試し終わったら Off に戻してください。

サンプルの間隔は 4 tick になります。1 回の取り込みで、発火から 16,000 tick 先までを見るためです。

V6 は `/etc/update` という常駐のプログラムを動かしていて、30 秒ごとに同じ `sync` を呼びます。
`date >y; sync` を打つ前に止まったら、止めたのはそちらです。波形の形は同じなので、そのまま読めます。

## 3. bflush: 書き込みを出して、待たずに戻る

止まったら、LA の倍率を `1/4x` にします。取り込んだ全体が 1 画面に入ります。

![B_ASYNC を立ててからの 16,000 tick。RK が動き出し、止まるまでのあいだ、Mode はほぼ Kernel のまま](docs/img/34-01-la-bflush-overview.png)

横軸の数字はサンプルの番号で、1 サンプルが 4 tick です。`RK` の行は、RK11 の制御回路の状態です。

| サンプル | tick | RK | 出来事 |
| --- | --- | --- | --- |
| 0 | 0 | 00 | `B_ASYNC` を立てる（トリガー）。RK11 は止まっている |
| +477 | 1,908 | 17 | `bwrite()` が RK11 に書き込みを出す。待ち時間が始まる |
| +1,501 | 6,004 | 転送中 | 4,096 tick の待ちが終わり、256 語の転送が始まる |
| +2,517 | 10,068 | 転送中 | `sync` がユーザーモードへ戻る |
| +3,682 | 14,728 | 00 | 転送が終わり、RK11 が割り込む（ベクタ 220） |

`Mode` が User になるところを、倍率 `1x` で拡大します。

![RK の行が動き続けているあいだに、Mode が Kernel から User に変わる](docs/img/34-02-la-bflush-return.png)

`RK` の行は、転送のあいだ細かく動き続けています。その途中のサンプル +2,517 で、`Mode` が User に変わります。
このときの PC は 000052 で、`/bin/sync` の中の `sys sync` の次の命令です。システムコールは、ここで終わりました。
書き込みが終わって RK11 が割り込むのは、4,660 tick あとです。

マニュアルの一文は、このことを言っています。`sync` から戻った時点で、書き込みはまだ終わっていません。

## 4. 前半は 1 つずつ待つ

同じ `sync` の前半は、波形の窓には入りません。`bflush()` より 20 万 tick 以上前に始まるからです。
ここでは、1 tick ずつ記録して数えた結果を示します。`date >y; sync` の `sync` の中で、RK11 は次の順に動きました。

```text
S W i W i R i W i R i W i W i R i W i B A W U i
```

| 記号 | 出来事 |
| --- | --- |
| S | カーネルの `sync()` に入る |
| W | RK11 に書き込みを出す（RKCS に 000103 を書く） |
| R | RK11 に読み出しを出す（RKCS に 000105 を書く） |
| i | RK11 の割り込み。転送が終わった |
| B | `bflush()` に入る |
| A | `B_ASYNC` を立てる |
| U | ユーザーモードへ戻る |

S から B までは、W や R の次が必ず i です。1 つ出しては終わりを待つ、を繰り返しています。
`bwrite()` の `iowait()` が、プロセスを眠らせているためです。書き込みは 6 回、読み出しは 3 回ありました。
読み出しは、inode を書くために、その inode が入ったブロックを先に読んでいるものです。

B のあとだけ、並びが変わります。W の次が i ではなく U です。3 章で見た、待たない書き込みです。

## 5. それでもプロンプトは、書き込みのあとに出る

`sync` から戻ったあとも、記録を続けます。プロンプトの `#` が出るまでは、次のようになりました。

```text
B A W U X i W i P
```

X はカーネルの `exit()` に入ったところ、P は端末に `#` を出したところです。
U と P のあいだに、書き込みがもう 1 回あります。出しているのは `exit()` です。

```c
        a = malloc(swapmap, 1);
        if(a == NULL)
                panic("out of swap");
        p = getblk(swapdev, a);
        bcopy(&u, p->b_addr, 256);
        bwrite(p);
```

V6 のプロセスは、終わるときに自分の記録（終了の状態と使った時間）をスワップ領域へ 1 ブロック書きます。親の `wait` がそれを読みます。
この `bwrite()` には `B_ASYNC` が立っていません。終わるまで待ちます。
そして、ドライバは頼まれた順に書きます。`exit()` の書き込みは、`bflush()` が出した書き込みの後ろに並びます。

`sync` コマンドは、`sync` を呼んだらすぐに終わるプログラムです。
だから `sync` コマンドの `exit()` は、`bflush()` の書き込みが全部終わるまで進めません。プロンプトが出るのは、そのあとです。

RK seek を変えて、`bflush()` に入った tick を 0 として測りました。

| RK seek | ユーザーへ戻る | `bflush()` の書き込みが終わる | `exit()` の書き込みが終わる | プロンプト |
| --- | --- | --- | --- | --- |
| Off | 10,694 | 11,363 | 34,009 | 105,442 |
| 4K clk | 10,343 | 14,980 | 37,511 | 104,634 |
| 64K clk | 9,914 | 76,532 | 152,351 | 218,234 |
| 256K clk | 9,929 | 272,581 | 544,924 | 610,904 |

どの設定でも、ユーザーへ戻るのは書き込みが終わる前です。マニュアルの一文のとおりです。
そして、どの設定でも、プロンプトが出るのは最後の書き込みが終わったあとです。プロンプトのあとに来た RK11 の割り込みは、0 回でした。
`exit()` がスワップへ書いたブロックは 4014 番で、ファイルシステムの外でした。

## 6. 3 回打つと何が起きるか

`cp /bin/ls x` でファイルを書いたあと、`sync` を続けて 3 回打ちました。RK seek は Off です。

| 回 | `sync` の中の書き込み | `exit()` の書き込み |
| --- | --- | --- |
| 1 回め | 7 | 1 |
| 2 回め | 4 | 1 |
| 3 回め | 4 | 1 |

2 回め、3 回めでも、書き込みは 0 になりません。
書いているのは inode の入ったブロックです。番号を調べると、端末（`/dev/tty8`）やシェル（`/bin/sh`）の inode が入ったブロックでした。
コマンドを 1 つ実行すると、使ったファイルの時刻が変わります。`sync` を打つこと自体が、次に書くものを作っています。

V6 では、1 回めのプロンプトが出た時点で、1 回めの書き込みは終わっています。
3 回打つことの効き目は、打っているあいだに時間が過ぎることだけです。

## 7. V7 で何が変わったか

V7 でも、`update()` と `bflush()` の作りは同じです。`bflush()` は `B_ASYNC` を立てて `bwrite()` を呼びます。
変わったのは `exit()` です。

```c
        p->p_stat = SZOMB;
        ((struct xproc *)p)->xp_xstat = rv;
        ((struct xproc *)p)->xp_utime = u.u_cutime + u.u_utime;
        ((struct xproc *)p)->xp_stime = u.u_cstime + u.u_stime;
```

V7 は、終わったプロセスの記録をプロセス表の中に置きます。スワップへは書きません。
`exit()` がディスクを待たなくなったので、`sync` コマンドは `bflush()` の書き込みを残したまま終われます。
冒頭の BUGS の一文は、その V7 のマニュアルのものです。V7 では、プロンプトが書き込みより先に返ることがありえます。

## 8. 確かめた結果

| 確かめること | 確かめたこと |
| --- | --- |
| 前半は、書き込みを 1 つずつ終わりまで待つ | スーパーブロックと inode の書き込み 6 回と読み出し 3 回は、どれも次の転送の前に割り込みが来た |
| 後半は、終わる前にユーザーへ戻る | `bflush()` が `B_ASYNC` を立てて出した書き込みは、ユーザーへ戻ってから 4,660 tick あとに終わった（RK seek = 4K clk） |
| プロンプトが返ったとき、書き込みは残っているのか | 残っていない。`exit()` がスワップへ 1 ブロックを待って書くので、RK seek を 256K clk にしても、プロンプトは最後の書き込みのあとに出た |

マニュアルの一文は、システムコールについては V6 でもそのとおりでした。
コマンドとしての `sync` は、V6 では書き込みが終わるまでプロンプトを返しません。`exit()` がディスクに書く、という V6 の作りのためです。

## 9. 関連ドキュメント

- [09-unix-v6-ファイルシステム.md](?doc=09-unix-v6-ファイルシステム.md): スーパーブロックと inode
- [27-swtch-You-are-not-expected-to-understand-this.md](?doc=27-swtch-You-are-not-expected-to-understand-this.md): RK seek を遅くして、ディスクの待ちに頼ったコードを見る
- [29-fork-the-return-locations-differ-by-one-word.md](?doc=29-fork-the-return-locations-differ-by-one-word.md): シェルがコマンドを実行するときの `fork`
- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md): Trigger、Post、RK seek、シナリオの説明
- [53-参考資料.md](?doc=53-参考資料.md): Unix V6 のソースと解説書
