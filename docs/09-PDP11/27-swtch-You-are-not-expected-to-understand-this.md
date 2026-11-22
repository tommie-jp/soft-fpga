# 27. 「You are not expected to understand this」を Logic Analyzer で見る

1975 年の UNIX Version 6 には、プログラミングの歴史でいちばん有名なコメントがあります。
`sys/ken/slp.c` の `swtch()` に書かれた `You are not expected to understand this.` です。

このコメントは、次のように紹介されることがよくあります。

> このルーチンは以前のスタックフレームを復元し、return が別の関数で実行を再開するようにしていた。
> PDP-11 の C コンパイラがレジスタを保存するやり方に頼っていた。
> Dennis Ritchie は後に、この仕組みが根本的に壊れていて、別の機種へ移植するときに作り直したと認めている。

この記事では、Verilog で書いた PDP-11 の上で本物の Unix V6 を動かし、この 3 つの文を 1 つずつ波形とスタックで確かめます。
使うのは [09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) のデバッグパネルです。

---

## 1. 該当のコード

コメントが付いているのは、プロセスを切り替える `swtch()` の最後です。

```c
        /*
         * Switch to stack of the new process and set up
         * his segmentation registers.
         */
        retu(rp->p_addr);
        sureg();
        /*
         * If the new process paused because it was
         * swapped out, set the stack level to the last call
         * to savu(u_ssav).  This means that the return
         * which is executed immediately after the call to aretu
         * actually returns from the last routine which did
         * the savu.
         *
         * You are not expected to understand this.
         */
        if(rp->p_flag&SSWAP) {
                rp->p_flag =& ~SSWAP;
                aretu(u.u_ssav);
        }
        /*
         * The value returned here has many subtle implications.
         * See the newproc comments.
         */
        return(1);
```

`savu`・`retu`・`aretu` はアセンブリ（`conf/m40.s`）で書かれた短い関数です。

```asm
_savu:
        bis     $340,PS
        mov     (sp)+,r1
        mov     (sp),r0
        mov     sp,(r0)+
        mov     r5,(r0)+
        bic     $340,PS
        jmp     (r1)

_aretu:
        bis     $340,PS
        mov     (sp)+,r1
        mov     (sp),r0
        br      1f

_retu:
        bis     $340,PS
        mov     (sp)+,r1
        mov     (sp),KISA6
        mov     $_u,r0
1:
        mov     (r0)+,sp
        mov     (r0)+,r5
        bic     $340,PS
        jmp     (r1)
```

3 つの関数がすることは、次のとおりです。

| 関数 | すること |
| --- | --- |
| `savu(a)` | いまの SP と R5 を、`a` の指す 2 語に書く |
| `retu(p)` | KISA6 を `p` に書き換えて u 領域を切り替え、`u.u_rsav` から SP と R5 を読む |
| `aretu(a)` | u 領域はそのままで、`a` の指す 2 語から SP と R5 を読む |

保存するのは SP と R5 の 2 つだけです。R5 は C のフレームポインタで、PC も R2〜R4 も保存しません。
ここが、あとで問題になります。

u 領域は、プロセスごとのカーネルスタックと `user` 構造体が入った 1 KB の領域です。
カーネルの仮想番地 140000 に見え、どのプロセスの物を見せるかを KISA6（カーネルの 6 番のページアドレスレジスタ）で切り替えます。
`u.u_rsav` は 140000、`u.u_ssav` は 140336 にあります。

## 2. なぜ `u_ssav` が要るのか

SSWAP が立つ場面の 1 つは、`fork` の本体である `newproc()` がメモリ不足になったときです。

```c
        savu(u.u_rsav);
        ...
        a2 = malloc(coremap, n);
        /*
         * If there is not enough core for the
         * new process, swap out the current process to generate the
         * copy.
         */
        if(a2 == NULL) {
                rip->p_stat = SIDL;
                rpp->p_addr = a1;
                savu(u.u_ssav);
                xswap(rpp, 0, 0);
                rpp->p_flag =| SSWAP;
                rip->p_stat = SRUN;
        }
```

子プロセスの置き場が無いので、親は自分のメモリをそのままスワップ領域へ書き出し、それを子の像にします。
書き出しの流れは次のとおりです。

1. `newproc` が `savu(u.u_rsav)` と `savu(u.u_ssav)` を呼ぶ。どちらにも `newproc` の枠の SP と R5 が入る。
2. `xswap` → `swap` がディスクへ書き込みを頼み、終わるまで `sleep` で待つ。
3. `sleep` は `swtch` を呼ぶ。`swtch` の先頭の `savu(u.u_rsav)` が、親の `u.u_rsav` を **`swtch` の枠** の値で上書きする。
4. ディスクが親のメモリを読み出して書き込む。

3 と 4 の順序が大事です。ディスクは遅いので、3 が先に終わります。
すると、ディスクに残る子の像の `u.u_rsav` は、`swtch ← sleep ← swap ← xswap` という、親が待つために積んだ枠を指しています。
子がそこから動き出しても、待つべきディスク転送はとうに終わっています。

そこで、上書きされない場所 `u.u_ssav` にも同じ値を取っておき、子の `p_flag` に SSWAP の印を付けます。
子が初めて動くとき、`swtch` は印を見て `aretu(u.u_ssav)` で SP と R5 を `newproc` の枠へ戻します。

## 3. 観測の準備

[09-PDP-11 / Unix V6](https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web) を開き、`login:` に `root` で入ります。

### 3.1 メモリ不足を起こすプログラム

RAM は 128 KB です。16000 バイトずつ広げたプロセスを 8 個に増やすと、置き場が足りなくなります。

```text
# cat >swp.c
main(){ int i; sbrk(16000); for(i=0;i<3;i++) fork(); sleep(4); }
^D
# cc swp.c
```

### 3.2 デバッグパネルの設定

1. **Logic Analyzer** と **Stack / Memory** のパネルを開く。
2. LA の **RK seek** を `4K clk (1.2 ms)` にする（理由は 7 章）。
3. **Trigger** の Preset で `V6 swtch: SSWAP path (aretu u_ssav)` を選び、**Set** を押す。
4. LA の信号は `VA`・`Data`・`RD`・`PC`・`SP`・`R5`・`KISA6` を出す。
5. 端末で `a.out` を実行する。

プリセットは、016000 番地の命令 `bicb $10,1(r2)`（`rp->p_flag =& ~SSWAP`）をフェッチした瞬間に止めます。
この命令は SSWAP が立っているときしか通りません。命令語（142762）まで比べるので、ユーザープロセスの同じ番地では止まりません。

番地は、配布ディスクの `/rkunix` のものです。

| 番地（8 進） | 命令 | C の行 |
| --- | --- | --- |
| 015770 | `bitb $10,1(r2)` | `if(rp->p_flag&SSWAP)` |
| 016000 | `bicb $10,1(r2)` | `rp->p_flag =& ~SSWAP;` |
| 016006 | `mov $140336,(sp)` | `aretu` の引数 `u.u_ssav` を積む |
| 016012 | `jsr pc,*$_aretu` | `aretu(u.u_ssav);` |
| 016016 | `mov $1,r0` | `return(1);` |
| 016022 | `jmp cret` | 関数の後始末 |

## 4. 止めた瞬間のスタック

`a.out` を実行すると、すぐに止まります。Stack / Memory パネルは次のようになります。

![aretu の手前で止めたときの Stack / Memory パネル](docs/img/27-01-stack-before-aretu.png)

Call chain は、R5 の鎖をたどった呼び出し履歴です。
V6 の C は、関数の入口で `(R5)` に呼び出し元の R5 を、`2(R5)` に戻り番地を置きます。

| R5 | 戻り番地 | どの関数の枠か |
| --- | --- | --- |
| 141606 | 014442 `sleep+170` | `swtch`（`sleep` が呼んだ） |
| 141622 | 045716 `swap+212` | `sleep`（`swap` が呼んだ） |
| 141640 | 020510 `xswap+126` | `swap`（`xswap` が呼んだ） |
| 141662 | 016420 `newproc+372` | `xswap`（`newproc` が呼んだ） |
| 141712 | 035004 `fork+46` | `newproc`（`fork` が呼んだ） |
| 141726 | 022534 `trap1+26` | `fork`（システムコールの入口が呼んだ） |

いま動いているのは、生まれたばかりの子プロセスです。この子は `sleep` も `swap` も呼んでいません。
上の 4 行は、**親が** ディスク転送を待つために積んだ枠が、メモリごと子へ写ったものです。
2 章の 3 と 4 の順序が、そのままスタックに残っています。

`retu` はこの像の `u.u_rsav`（141576 と 141606）を読んだので、SP と R5 は親の `swtch` の枠を指しています。
このまま `return` すると `sleep+170` へ戻り、子は終わった転送を待ち続けます。

## 5. `aretu` の前後

**▶ Step** を 1 回押すと 300 tick 進みます。波形に `aretu` から復帰までが入ります。

![aretu の前後の波形。R5 と SP が newproc の枠へ移る](docs/img/27-03-la-aretu.png)

トリガーからの tick 数で並べると、次のようになります。値は `tests/swtch` の実行結果です。

| tick | 番地 | 起きたこと | SP | R5 |
| --- | --- | --- | --- | --- |
| 0 | 016000 | `bicb $10,1(r2)` をフェッチ（トリガー） | 141576 | 141606 |
| +33 | 016012 | `jsr pc,*$_aretu` をフェッチ | 141576 | 141606 |
| +40 | 141574 | 戻り番地 016016 を積む | 141574 | 141606 |
| +81 | 141576 | 引数 140336（`&u.u_ssav`）を R0 へ読む | 141576 | 141606 |
| +98 | 140336 | `u.u_ssav[0]` = 141672 を読む | **141672** | 141606 |
| +109 | 140340 | `u.u_ssav[1]` = 141712 を読む | 141672 | **141712** |
| +140 | 016016 | `swtch` へ戻り、`mov $1,r0` をフェッチ | 141672 | 141712 |

2 語を読むだけで、SP は 141576 から 141672 へ、R5 は 141606 から 141712 へ移ります。
`aretu` は `jmp (r1)` で `swtch` の続きへ戻るので、PC は `swtch` の中のままです。
関数は `swtch` のまま、スタックの枠だけが `newproc` の物に入れ替わりました。

Step の後の Stack パネルでは、親が積んだ 4 つの枠が呼び出し履歴から消えています。

![Step で aretu と return を通した後の Stack / Memory パネル](docs/img/27-02-stack-after-step.png)

`aretu` は最後に割り込みの禁止を解きます。待っていた時計割り込みがここで入ることがあり、そのときは PC が `call`（割り込みの入口）を指します。
Step をもう数回押すと `swtch` へ戻ります。

## 6. `return(1)` が `fork` へ戻る

続く `return(1)` は、`jmp cret` になります。`cret` はどの関数でも共通の後始末です。

```asm
csv:
        mov     r5,r0
        mov     sp,r5
        mov     r4,-(sp)
        mov     r3,-(sp)
        mov     r2,-(sp)
        jsr     pc,(r0)

cret:
        mov     r5,r1
        mov     -(r1),r4
        mov     -(r1),r3
        mov     -(r1),r2
        mov     r5,sp
        mov     (sp)+,r5
        rts     pc
```

`cret` は、レジスタも戻り番地も **R5 を基準に** 取り出します。波形では次のように見えます。

| tick | 読む番地 | 読んだ値 | 入る先 |
| --- | --- | --- | --- |
| +175 | 141710 | 063154 | R4 |
| +186 | 141706 | 063230 | R3 |
| +197 | 141704 | 057722 | R2 |
| +216 | 141712 | 141726 | R5（`fork` の枠） |
| +227 | 141714 | 035004 | PC（`fork+46`） |

+230 tick で CPU は 035004 番地、つまり `fork` の中の `newproc()` を呼んだ直後の命令をフェッチします。R0 は 1 です。
`swtch` を呼んだのは `fork` ではありません。それでも `swtch` の `return(1)` は、`newproc` が `fork` へ 1 を返した形になりました。
`newproc` のコメントにある「新しいプロセスでは 1 を返す」は、こうして実現されています。
親の側は、ふつうに `newproc` の最後の `return(0)` で `fork` へ戻ります。

これが成り立つのは、V6 の C コンパイラの決まりのおかげです。

- どの関数も入口で同じ `csv` を呼び、R2〜R4 を R5 のすぐ下に、同じ順で積む。
- どの関数も出口で同じ `cret` を使い、R5 だけを頼りにレジスタと戻り番地を取り出す。

だから、R5 を別の関数の枠へ向けてから `return` すれば、その関数からの `return` として通用します。
冒頭の 2 つめの文「PDP-11 の C コンパイラがレジスタを保存するやり方に頼っていた」は、この決まりのことです。

## 7. ディスクが速いと、何も起きない

LA の **RK seek** を `Off` に戻して、同じ操作をもう一度します。今度は `aretu` の前後で値が変わりません。

| RK seek | `aretu` の直前（SP / R5） | `aretu` の直後（SP / R5） |
| --- | --- | --- |
| `4K clk` | 141576 / 141606 | 141672 / 141712 |
| `Off` | 141672 / 141712 | 141672 / 141712 |

`Off` のとき、このシミュレータの RK11 は、書き込みを頼まれた直後に転送を始めます。
親の `swtch` が `u.u_rsav` を上書きするのは、転送が始まってから約 560 tick 後です。
`u.u_rsav` は u 領域の先頭の 2 語で、転送は 1 語あたり約 28 tick で進みます。
上書きより先に、`newproc` の値のままディスクへ出てしまいます。
2 章の 3 と 4 の順序が入れ替わり、`u_rsav` と `u_ssav` が同じ値になるので、`aretu` は何も変えません。

実機の RK05 は、ヘッドの移動に平均 50 ms、円盤が回ってくるのを待つのに平均 20 ms かかります。
このシミュレータは 1 tick がおよそ 0.3 µs なので、4096 クロックの遅延でも 1.2 ms にしかなりません。
それでも順序が実機と同じになり、`aretu` が働きます。

`aretu(u.u_ssav)` は、ディスクが CPU よりずっと遅いという前提の上で意味を持つ 1 行でした。
速いディスクでは働く場面が無く、消しても動いてしまいます。動かして初めて分かったことです。

## 8. Ritchie が「壊れていた」と言ったこと

Dennis Ritchie は、後年のページ [Odd Comments and Strange Doings in Unix](https://9p.io/who/dmr/odd.html) でこのコメントに触れています。要点は次のとおりです。

- コメントは挑発ではなく、「これは試験に出ません（This won't be on the exam）」のつもりで書いた。
- 本当の問題は、書いた本人たちも何が起きているのかを分かっていなかったことだった。
- `savu` / `retu` の仕組みは「fundamentally broken」だった。以前のスタックフレームへ切り替え、状態を保存したのとは別の関数で、関数の return のコードを実行することに頼っていたからである。
- PDP-11 で動いたのは、コンパイラがいつも同じやり方でレジスタを保存したからだった。Interdata のコンパイラでは、保存するレジスタによって return のコードが変わった。
- Steve Johnson と別の機種へ移植したとき、この部分は「試験に出た」。1 週間ほど悩んだ末に、コンパイラを直しても解決しないと認め、制御を渡す基本の関数を作り直した。

6 章で見たとおり、`swtch` の `return` は `newproc` の枠を `swtch` の `cret` で片付けます。
関数ごとに保存するレジスタが違うコンパイラでは、枠の形と片付け方が食い違い、戻り番地の位置さえずれます。
冒頭の 3 つめの文は、このことを指しています。

Version 7 では、`savu` / `retu` / `aretu` が `save` / `resume` に置き換わりました。
`save` は R2〜R5・SP に加えて戻り番地も保存し、`resume` は保存した関数自身へ戻ります。C の `setjmp` / `longjmp` と同じ形です。
別の関数の `return` に頼らなくなったので、コメントも要らなくなりました。

## 9. まとめ

| 冒頭の文 | 確かめたこと |
| --- | --- |
| 以前のスタックフレームを復元し、return が別の関数で再開する | `aretu` で SP・R5 が `newproc` の枠へ移り、`swtch` の `return(1)` が `fork+46` へ戻った |
| C コンパイラのレジスタの保存のしかたに頼っていた | `cret` が R5 を基準に R2〜R4 と戻り番地を取り出すので、別の関数の枠でも片付く |
| 根本的に壊れていて、作り直した | 関数ごとに枠の形が違うコンパイラでは成り立たない。V7 で `save` / `resume` になった |

もう 1 つ、動かして分かったことがあります。
この 1 行が働くのは、ディスクが遅くて `u_rsav` が上書きされたときだけです。
命令エミュレータで動かしても V6 は起動しますが、SP と R5 が動く瞬間と、その前後のスタックを並べて見るには、内部の信号を取り出せる仕組みが要ります。

## 10. 関連ドキュメント

- [20-デバッグパネル-使い方.md](?doc=20-デバッグパネル-使い方.md) — Stack / Memory パネル、Post、RK seek の説明
- [56-MMU-unix-v6-での使われ方.md](?doc=56-MMU-unix-v6-での使われ方.md) — KISA6 と u 領域
- [57-レジスタとistate.md](?doc=57-レジスタとistate.md) — レジスタと CPU の内部状態
- [53-参考資料.md](?doc=53-参考資料.md) — Unix V6 のソースと解説書
