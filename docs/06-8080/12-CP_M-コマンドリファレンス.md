# 12. CP/M コマンドリファレンス

このシミュレータに収録されている CP/M 2.2 のコマンド一覧。

## 1. CCP 組み込みコマンド

CCP (Console Command Processor) に内蔵。ディスクなしで常に使用できる。

| コマンド | 書式 | 説明 |
|---------|------|------|
| `DIR` | `DIR [afn]` | ファイル一覧。`DIR *.COM` のようにワイルドカード可 |
| `ERA` | `ERA afn` | ファイル削除。`ERA *.BAK` で一括削除。`ERA *.*` 実行時は「ALL FILES (Y/N)?」確認あり |
| `REN` | `REN new=old` | ファイル名変更 |
| `TYPE` | `TYPE file` | テキストファイルをコンソールに表示 |
| `SAVE` | `SAVE n file` | TPA 先頭 n×256 バイトをファイルに保存 |
| `USER` | `USER n` | ユーザーエリア切り替え（0〜15） |

## 2. トランジェントコマンド

ディスク上の `.COM` ファイル。TPA にロードして実行される。

### 2.1 ファイル操作

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `PIP` | ファイルコピー・連結。Peripheral Interchange Program | `PIP DST.TXT=SRC.TXT` |
| `STAT` | ファイルサイズ・属性表示、ディスク空き容量確認 | `STAT *.*` / `STAT` |
| `COPY` | ドライブ間ファイルコピー | `COPY` |
| `SDIR` | DIR の拡張版。サイズ・属性も表示 | `SDIR` |
| `XDIR` | 拡張ディレクトリ表示 | `XDIR` |
| `SURVEY` | ディスク使用状況の詳細レポート | `SURVEY` |

### 2.2 開発ツール

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `ASM` | Intel 8080 アセンブラ。`.ASM` → `.HEX` + `.PRN`（リスト） | `ASM PROG` |
| `MAC` | マクロアセンブラ（ASM 上位互換）。`.ASM` → `.HEX` + `.PRN` | `MAC PROG` |
| `LOAD` | `.HEX` → `.COM` 変換 | `LOAD PROG` |
| `DDT` | Dynamic Debugging Tool。機械語デバッガ | `DDT PROG.COM` |
| `DUMP` | バイナリを 16 進ダンプ | `DUMP FILE.COM` |
| `MEMMAP` | メモリマップ表示 | `MEMMAP` |

### 2.3 テキスト編集

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `ED` | 行指向テキストエディタ（CP/M 標準付属） | `ED FILE.TXT` |
| `WM` | WordMaster。フルスクリーンエディタ。キー説明は `TYPE WM.HLP` | `WM FILE.TXT` |
| `VIEW` | テキストファイルのスクロール閲覧 | `VIEW FILE.TXT` |

### 2.4 バッチ処理

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `SUBMIT` | `.SUB` バッチファイルを実行。`$1`〜`$n` で引数置換（例: `$1=X`, `$2=PRN`） | `SUBMIT BUILD` / `SUBMIT ASMBL X PRN` |
| `XSUB` | SUBMIT 拡張版。プログラムへの標準入力もバッチ化可能 | `XSUB` |

### 2.5 システム管理

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `MOVCPM` | CP/M を別メモリサイズ向けに再配置 | `MOVCPM 62 *` |
| `SYSGEN` | CP/M イメージをシステムトラックに書き込み | `SYSGEN` |
| `FORMAT` | ディスクフォーマット | `FORMAT` |
| `CLS` | 画面クリア | `CLS` |
| `BYE` | システム終了 / ログアウト | `BYE` |

## 3. よく使うパターン

```text
A>DIR *.COM              ← COM ファイルのみ表示
A>STAT *.*               ← 全ファイルのサイズ一覧
A>STAT                   ← ディスク空き容量
A>TYPE FILE.TXT          ← テキスト表示
A>PIP B:=A:FILE.COM      ← A: から B: へコピー
A>ERA *.BAK              ← バックアップファイル一括削除
```

### アセンブル → 実行の流れ

```text
A>ASM PROG        ← PROG.ASM → PROG.HEX (+ PROG.PRN)
A>LOAD PROG       ← PROG.HEX → PROG.COM
A>PROG            ← 実行
```

### デバッガ（DDT）の主なコマンド

逆アセンブル表示は **Intel 8080 ニーモニック**（`MOV`/`LXI`/`JMP` 形式）。Z80 ニーモニック（`LD`/`JP`）とは異なる。

```text
-L100             ← アドレス 0100H から逆アセンブル（List）
-D100             ← アドレス 0100H から 16 進ダンプ（Display）
-G100             ← アドレス 0100H から実行（Go）
-T                ← 1 命令トレース実行（Trace）
-X                ← レジスタ表示・変更（eXamine）
-R PROG.COM       ← ファイルをメモリに読み込み（Read）
-A100             ← アドレス 0100H からインラインアセンブル（Assemble）
-F100,1FF,0       ← 100H〜1FFH をゼロフィル（Fill）
-M100,1FF,200     ← メモリ移動（Move）
-S100             ← アドレス 0100H のメモリ値を設定（Set）
Ctrl+C            ← DDT 終了（ウォームブートで A> に戻る）
```

コマンドとアドレスの間にスペースは不可（`-L100` が正しく、`-L 100` は `?` エラーになる）。
`-Q` コマンドは存在せず、終了は `Ctrl+C` のみ。

**シミュレータの終了**: `Ctrl+\`（Ctrl+バックスラッシュ）。
`Ctrl+C` はエミュレータ内部に渡されるため DDT → CP/M のウォームブートとして機能する。

### ED（行指向テキストエディタ）の使い方

ED はバッファを介してファイルを編集する。テキストは一度メモリバッファに読み込まれ、編集後に書き出す。

#### 起動

```text
A>ED FILE.TXT          ← 既存ファイルを編集（なければ新規作成）
```

起動後は `*` プロンプトが現れ、コマンド入力待ちになる。

#### 主なコマンド

| コマンド | 説明 |
|---------|------|
| `I` | 挿入モード開始。テキストを入力し `Ctrl+Z` で終了 |
| `nT` | CP から n 行分表示（省略時は 1）。`0T` = CP から行末まで。`#T` で全行表示 |
| `±nL` | n 行前進（省略時は 1）。`-nL` で後退。`0L` で行頭へ |
| `±nC` | n 文字前進（省略時は 1）。`-nC` で後退 |
| `B` | バッファ先頭へ移動。`-B` でバッファ末尾へ |
| `nA` | ディスクから n 行読み込む。`0A` = 50% 以上になるまで。`#A` = 全部 |
| `E` | 保存して終了（`.BAK` を作成） |
| `Q` | 保存せず終了 |
| `nK` | n 行削除（省略時は 1）。`-nK` で後方削除 |
| `nD` | n 文字削除（省略時は 1）。`-nD` で後方削除 |
| `Fstr<cr>` | 文字列 `str` を前方検索（Enter で確定） |
| `Sold^Znew<cr>` | `old` を `new` に置換（1 回）。`^Z` は 2 つの文字列の区切り、Enter で確定 |
| `nSold^Znew<cr>` | n 回置換。`#S` で全置換 |
| `U` | 小文字→大文字変換を有効化 |
| `-U` | 小文字→大文字変換を無効化（公式デフォルト。このディスクは U がデフォルト） |

`^Z` は `Ctrl+Z`。`<cr>` は Enter キー。コマンドは複数つなげて実行可能（例: `BFhello^Z` = 先頭から "hello" を検索）。文字列終端に `<cr>` の代わりに `^Z` を使うと後続コマンドを同じ行に繋げられる。

#### 典型的な操作例

```text
* I                    ← 挿入モード開始
Hello, CP/M!
^Z                     ← 挿入終了
* #T                   ← 全行表示
      1: Hello, CP/M!
* B                    ← 先頭に戻る
* SHello^ZGoodbye      ← 大文字で正確に一致させて置換（Enter で確定）
* #T
      1: Goodbye, CP/M!
* E                    ← 保存して終了

; 小文字で置換したい場合は -U で変換を無効化してから実行する:
* -U                   ← 小文字→大文字変換を無効化
* B
* SGoodbye^Zhello      ← 小文字で置換（-U 後は小文字がそのまま格納される、Enter で確定）
* #T
      1: hello, CP/M!
* E
```

#### 注意

- 検索・置換は**大文字小文字を区別**する
- **ED には U/-U モードがある。** `U` コマンドで小文字→大文字変換を有効化、`-U` で無効化する
- このディスクイメージの ED は **U モードがデフォルトで有効**なため、小文字で入力しても大文字でバッファに格納される
  （例: `SLINE^Zlinexx^Z` を入力すると `SLINE^ZLINEXX^Z` として処理される）
- 小文字を使いたい場合は `* -U` を実行してから編集する
- `#S` で全置換中に対象文字列が見つからなくなると `BREAK "#" AT X` と表示して中断する（正常動作）
- `E` で終了すると元ファイルが `.BAK` に退避され、編集結果が元のファイル名に保存される
- `Q` で終了すると変更は破棄される（`.BAK` も作られない）

## 4. このシミュレータ固有のコマンド

| コマンド | 説明 |
|---------|------|
| `8080EX1` | 8080 命令セット全 20 グループのエクササイザ（独自実装） |
| `R <filename>` | ホスト PC → CP/M ディスクへファイルを転送 |
| `W <filename>` | CP/M ディスク → ホスト PC へファイルを転送 |
| `!command` | Linux コマンドを実行してその出力を表示（ネイティブ `cpm` コマンド専用） |

### ! — Linux シェルエスケープ（`cpm` コマンド専用）

ネイティブの `cpm` コマンド実行中、CP/M プロンプトで行の先頭に `!` を入力すると Linux コマンドを実行できる。

```text
A>!ls                ← カレントディレクトリのファイル一覧
A>!date              ← 現在日時を表示
A>!pwd               ← カレントディレクトリのパス表示
A>!cat hello.c       ← ホスト上のファイル内容を表示
A>!ls *.c            ← ホスト上の C ファイル一覧
```

- **行の先頭のみ有効**：`A>` プロンプトで最初の文字が `!` の場合にシェルエスケープとなる。途中での入力は通常の文字として CP/M へ送られる
- `!` の後ろに続くすべての文字列が Linux コマンドとして実行される（`2>&1` リダイレクトが自動付加）
- コマンドは `cpm` を起動したシェルの環境（カレントディレクトリ・環境変数等）で動作する
- コマンド実行後、CP/M のプロンプト（`A>`）が再表示される
- **制限事項**：`bash`・`vim` 等の対話型コマンドは raw モード端末のため正常動作しない。出力を返すワンショットコマンドのみ使用可能
- **WASM 版では使用不可**：ブラウザ上のシミュレータにはこの機能は存在しない

### R / W — ホストファイル転送コマンド

ディスクイメージに収録されているカスタムユーティリティ（v1.0）。標準 CP/M には存在しない。

```text
A>R HELLO.ASM       ← ホスト PC 上の HELLO.ASM を CP/M ディスクへ書き込む
A>W RESULT.TXT      ← CP/M ディスクの RESULT.TXT をホスト PC へ書き出す
```

- `cpm` を起動したカレントディレクトリのファイルを参照する
- ファイル名は CP/M 互換形式（英大文字・数字・記号、アンダースコア不可、8+3 文字以内）
  - NG: `test_host.txt`（アンダースコア → CCP が 4 文字で打ち切る）
  - OK: `HELLO.ASM`, `RESULT.TXT`, `PROG.COM`
- ワイルドカード非対応
- 内部で I/O ポート `$A1h` を使用（`harness.cpp` の `handle_io` / `read_io` に実装済み）

### 8080EX1 — 成功例

```text
A>8080ex1
8080 instruction exerciser
ld r,n (MVI)....................OK
ld r,r (MOV)....................OK
lxi/push/pop....................OK
ex/xthl/pchl/sphl...............OK
add a,r.........................OK
adc a,r.........................OK
sub r...........................OK
sbc a,r.........................OK
and r...........................OK
or/xor r........................OK
cp r............................OK
inc r...........................OK
dec r...........................OK
inx/dcx/dad.....................OK
sta/lda/stax/ldax/shld/lhld.....OK
rlca/rrca/rla/rra/scf/ccf/cpl...OK
jp cond (all 8).................OK
call cond (all 8)...............OK
ret cond (all 8)................OK
rst 1/7.........................OK
Tests complete
```

全 20 グループが `OK` で終わり `Tests complete` が表示されれば合格。

## 5. 参考

- [10-テスト仕様書.md](10-テスト仕様書.md) — コマンドを使ったテスト手順
- [52-メモリマップ.md](52-メモリマップ.md) — CP/M のメモリレイアウト
- [CP/M Operating System Manual — Archive.org](https://archive.org/details/CPM_Operating_System_Manual) — DIR/ERA/REN/DDT/ASM/PIP/STAT 等の公式マニュアル
- [CPM ED (A Context Editor) User's Manual — Archive.org](https://archive.org/details/CPM_ED_A_Context_Editor_Users_Manual) — ED コマンド公式マニュアル
- [CPM ED テキスト全文 — Archive.org](https://archive.org/stream/CPM_ED_A_Context_Editor_Users_Manual/CPM_ED_A_Context_Editor_Users_Manual_djvu.txt) — テキスト版（検索しやすい）
