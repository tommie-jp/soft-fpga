# 56. Unix V6 での MMU の使われ方 <a class="qr-link" href="../../../docs/09-PDP11/56-QR.png">QR</a>

PDP-11 のメモリ管理（KT11 / MMU）を Unix V6 がどう使っているかの整理。
本プロジェクトの可視化（MMU パネル）で何が見えているのかを理解するための背景資料。
対象は **PDP-11/40 系（18bit 物理・I/D 分離なし）**。Lions 解説（Lions' Commentary on UNIX 6th Edition）準拠。

---

## 1. ハードの前提（おさらい）

PDP-11 MMU は **モードごとに 8 個のセグメント（APR: Active Page Register）** を持つ。

- モード: **Kernel** / Supervisor / **User**（V6 は Kernel と User のみ使用）。
- 各 APR = **PAR**（Page Address Register, 物理ベース）＋ **PDR**（Page Descriptor Register, 長さ・方向・保護）。
- 1 セグメント最大 8KB（= 128 ブロック × 64 バイト）。8 セグメント × 8KB = **仮想 64KB/モード**。
- 物理は 18bit = **256KB**。V6 の 1 プロセスは最大 64KB（text+data+stack）。

V6 は MMU の柔軟性をごく限定的にしか使わない（固定的な割り当て）。

---

## 2. カーネル空間のマッピング（KISA0–7）

| セグメント | 用途 | 仮想アドレス | 備考 |
|-----------|------|------------|------|
| KISA0–5 | **カーネル本体（命令＋データ）** | 0 〜 0o137777 | 低位物理メモリに固定 |
| **KISA6** | **実行中プロセスの u-area＋カーネルスタック** | 0o140000〜 | **コンテキストスイッチ毎に張り替え**（後述） |
| **KISA7** | **I/O ページ**（デバイスレジスタ） | 0o160000〜0o177777 | 物理 0o760000〜0o777777 にマップ |

### 2.1 KISA7 = I/O ページ（デバイスアクセスの要）

カーネルは KISA7 を通して UNIBUS の I/O ページ（最上位 8KB）にアクセスする。
RK ディスク・KL11 コンソール・クロック等のレジスタはここ。
**本プロジェクトの MMU パネル／信号テストが見ている「kernel seg7 PAR」がこれ**
（[`boot-signals.test.mjs`](../../examples/09-pdp11/tests/signals/boot-signals.test.mjs) の
"MMU kernel seg7 PAR>0" 検証）。

### 2.2 KISA6 = u-area の「常に同じ仮想アドレス」トリック

V6 最大の MMU 活用ポイント。各プロセスの **per-process データ（`user` 構造体 `u.` ＋カーネルスタック）**
は物理的にはプロセスごとに別の場所にあるが、**KISA6 を切替えることで、カーネルからは常に
同じ仮想アドレス 0o140000 に見える**。

- コンテキストスイッチ（`swtch`）で `retu(p->p_addr)` / `aretu`（`m40.s`）が KISA6 を
  そのプロセスのスワップアドレスに張り替える。
- これにより、カーネルコードは「現在のプロセスの `u.`」を固定アドレスで参照できる
  （プロセス毎にコードを書き換える必要がない）。

---

## 3. ユーザー空間のマッピング（UISA0–7）

プロセスのアドレス空間は **text / data / stack** に分かれる（11/40 は I/D 非分離なので 1 空間 64KB）。

| 領域 | セグメント | 保護 | 備考 |
|------|-----------|------|------|
| text（純コード） | UISA0〜 | 読取専用・共有可 | `text.c` が共有 text を管理（複数プロセスで物理共有） |
| data（初期化＋BSS＋heap） | text の直後 | 読み書き | `sbrk` で上方拡張 |
| **stack** | **UISA7（最上位）** | 読み書き | **expand-down**（下方伸長） |

### 3.1 expand-down スタック（PDR の ED ビット）

スタックセグメントは PDR の **ED（Expand Down）ビット**を立て、ページ長フィールド（PLF）で
「上端から下に向かって有効」な範囲を定義する。スタックを伸ばす＝下限を下げる。

- スタックを踏み越えると **セグメンテーションフォルト（page-length abort, ベクタ 0o250）** が発生。
- `trap.c` がこれを受け、`grow()` でスタックを下方拡張してから命令を再実行する。
- → 本プロジェクトの cc バグ調査でも重要だった「expand-down スタック拡張」はこれ
  （[41-cc-コンパイル-バグ調査.md](?doc=41-cc-コンパイル-バグ調査.md) 参照）。

---

## 4. セグメントレジスタの設定経路（estabur → sureg）

| 関数 | 役割 |
|------|------|
| `estabur(nt, nd, ns, sep)` | text/data/stack サイズから **プロトタイプ** PAR/PDR を計算し `u.u_uisa[]` / `u.u_uisd[]` に格納（Lions ~1650） |
| `sureg()` | `u.u_uisa[]` / `u.u_uisd[]` を **ハードの UISA/UISD レジスタへロード**（Lions ~1739）。コンテキストスイッチ・`exec`・`grow` 後に呼ぶ |

`exec`（新プログラムロード）・`fork`・スタック/データ拡張・スワップイン時に再計算される。

---

## 5. カーネル↔ユーザー間のデータコピー（mfpi/mtpi）

カーネルがユーザー空間のデータを読み書きするときは **mfpi / mtpi**
（move from/to previous instruction space）命令を使う。

- PSW の **previous mode** フィールドが「どの APR セットを使うか」を選ぶ。
- `fubyte`/`subyte`（fetch/store user byte）, `copyin`/`copyout` の足回り。

---

## 6. スワッピング

V6 は **プロセス丸ごと**スワップする。スワップイン時に物理位置が変わるため、
`estabur`/`sureg` でセグメントレジスタを再計算してロードし直す。

---

## 7. 本プロジェクトでの観測ポイント（可視化の勘所）

| 見える信号 | V6 での意味 |
|-----------|------------|
| **kernel seg7 PAR**（KISA7） | I/O ページ。ブート直後から固定値 |
| **kernel seg6 PAR**（KISA6） | 実行中プロセスの u-area。**プロセス切替で値が変わる** ← 可視化の見どころ |
| **user seg PAR/PDR**（UISA/UISD） | 実行中ユーザープロセスの text/data/stack 配置。`exec`/`fork`/スタック拡張で変化 |
| **cpu mode（kernel/user）** | mfpi/mtpi・トラップ・rti での mode 遷移 |
| **abort（ベクタ 0o250）** | スタック expand-down フォルト → `grow()` |

MMU パネルでこれらを並べると、「プロセス切替で KISA6 が張り替わる」「exec で user セグメントが
再配置される」「スタック拡張で abort→再実行」といった **V6 のメモリ管理の動きがそのまま見える**。

---

## 8. 具体例: Hello, World! プログラムでの MMU の動き

小さな C プログラムを `cc` でコンパイル・実行する流れを MMU 視点で追う。
小さいほど「ロード時の再配置」と「syscall 境界」が際立つ良い教材。

```c
main() {
    printf("Hello, World!\n");
}
```

`# cc hello.c` → `# a.out` を想定。a.out は V6 標準の **0407 形式**
（text+data 結合・書込可、stack 別）、プログラムは 8KB 未満とする。

### 8.1 ロード直後のセグメント配置（`exec` → `estabur` → `sureg`）

8KB 未満なので user セグメントは実質 2 つだけ:

| APR | 仮想アドレス | PAR（物理ベース） | PDR | 中身 |
|-----|------------|------------------|-----|------|
| **UISA0** | 0o000000〜 | a.out の物理位置 | 上方・R/W・長さ=プログラムのブロック数 | コード＋`"Hello, World!\n"`＋データ |
| UISA1–6 | — | — | **非常駐（access=0）** | 触ると abort |
| **UISA7** | 0o160000〜0o177777 | スタックの物理位置 | **expand-down**・R/W | スタック（0o177776 から下へ） |

> **第1の見どころ**: `a.out` 実行の瞬間、user セグメントが一斉に書き換わる
> （sh の配置 → hello の配置）。`cc` は内部で c0/c1/c2/as/ld を順に `exec` するので、
> コンパイル中は user セグメントが**パスごとに何度も切り替わる**のが見える。

この間カーネル側は **KISA7**=I/O ページ（固定）、**KISA6**=実行中プロセスの u-area（切替で張替え）。

### 8.2 実行中の MMU 活動

Hello World は小さく・スタックも伸びないので**実行中のマップはほぼ静止**する。
MMU が動く瞬間は限られ、そこが明快。

#### (a) 命令フェッチ・文字列参照（user モード）

- PC のフェッチ → **UISA0** 経由で変換。`"Hello, World!\n"` も UISA0（data 域）にあり同じセグメント。
- CPU mode = **user**。

#### (b) `printf` → `write(1, …)` システムコール（★カーネル↔ユーザー境界）

`printf` は整形後 `write` を呼ぶ。`trap` でカーネルに入る:

1. **CPU mode が user → kernel** に遷移（PSW の previous mode = user）。
2. tty 出力処理が**ユーザーのバッファから1バイトずつ**取り出す。ここで
   **`mfpi`（move from previous instruction space）** を使い、previous mode=user なので
   カーネルは**ユーザーの UISA0 マップ越しに**文字を読む（`fubyte`/`cpass`）。
3. 取り出した文字を KL11 コンソールへ → **KISA7（I/O ページ）**経由でデバイスレジスタに書く。

> **第2の見どころ**: 1 回の `write` で「**user→kernel mode 遷移**」「**mfpi による
> previous-mode アクセス**」「**KISA7 経由の I/O**」が同時に観測できる。
> MMU の3つの役割（保護・モード分離・I/O 到達）が1イベントに凝縮されている。

#### (c) スタック（今回は静か）

- 引数・戻り番地は UISA7（expand-down）に積まれるが、Hello World 程度では**伸長しない**。
- 深い再帰や大きなローカル配列で下限を踏み越えると → **abort（ベクタ 0o250）** →
  `trap.c` の `grow()` がスタックを下方拡張して命令を再実行（UISD7 の長さが変わるのが見える）。

### 8.3 終了 → シェルへ

- `main` return → `exit` → プロセス破棄・u-area 解放。
- スケジューラが sh に戻る `swtch` で **KISA6 が sh の u-area に張替え** → 次の `#` プロンプト。

### 8.4 MMU 視点のタイムライン要約

| 時刻 | イベント | MMU の動き（パネルで見える変化） |
|------|---------|-------------------------------|
| `cc hello.c` | sh が fork→exec(cc) | KISA6 張替え、user セグ → cc。c0/c1/c2/as/ld で**繰り返し再配置** |
| `a.out` | sh が fork→exec(a.out) | **user セグ一斉更新**（UISA0=hello、UISA7=stack、UISA1–6=非常駐） |
| 実行中 | 命令・文字列参照 | UISA0 経由変換（mode=user、マップは静止） |
| `printf`→`write` | システムコール | **mode user→kernel**、**mfpi で user バッファ読取**、**KISA7 で I/O** |
| return→`exit` | プロセス終了 | u-area 解放、swtch で **KISA6 → sh** |

### 8.5 教材としての要点

- **小さいプログラムほど MMU の本質が見やすい** — 動的な伸長ノイズが無く、
  mode 分離・保護・mfpi・I/O ページが際立つ。
- MMU パネルで **KISA6 / KISA7 / UISA0 / UISA7 と CPU mode を並べる**と、この流れが
  そのまま波形・数値で追える。命令エミュレータには出せない RTL 可視化ならではの観測点。
- 関連: cc 実行の回帰テスト [`cc-hello.v6`](../../examples/09-pdp11/tests/v6-scripts/cc-hello.v6)。

---

## 9. 参考資料

- [UNIX V6 kernel memory layout — Computer History Wiki](https://gunkies.org/wiki/UNIX_V6_kernel_memory_layout)
- [UNIX V6 memory layout — Computer History Wiki](https://gunkies.org/wiki/UNIX_V6_memory_layout)
- [UNIX V6 internals — Computer History Wiki](https://gunkies.org/wiki/UNIX_V6_internals)
- Lions' Commentary on UNIX 6th Edition — `estabur`/`sureg`（main.c）, `swtch`/`retu`（slp.c, m40.s）, `grow`（trap.c）
- 関連: [52-メモリマップ.md](?doc=52-メモリマップ.md) / [55-MMU-タイミングと実機比較.md](?doc=55-MMU-タイミングと実機比較.md) / [41-cc-コンパイル-バグ調査.md](?doc=41-cc-コンパイル-バグ調査.md)
