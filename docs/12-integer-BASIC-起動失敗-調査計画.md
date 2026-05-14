# Integer BASIC 起動失敗 — 調査結果

## 現象（修正前）

```text
$ ./doAppleI-basic.sh
\
E000R

E000: 4C
```

`doAppleI-basic.sh` は `${SIM} "E000R"` を実行する。
`E000: 4C` は wozmon の **examine 出力**（アドレス `$E000` の値 `0x4C` を表示している）。
BASIC が起動していれば `>` プロンプトが出るはずだが、それがない。

## 関連ファイル

| ファイル | 役割 |
| --- | --- |
| `examples/04-6502/cxx/harness.cpp` | メモリマップ・PIA エミュ・BASIC/WOZMON ROM 埋め込み |
| `examples/04-6502/cxx/main_linux.cpp` | `boot_cmd` → `send_key()` で "E000R\r" を投入 |
| `examples/04-6502/verilog/apple1_top.v` | CPU ラッパ（メモリは harness 側） |

## メモリマップ（harness.cpp）

| アドレス | 内容 |
| --- | --- |
| `$0000-$CFFF` | RAM (0 初期化) |
| `$D010-$D01F` | PIA (KBD/KBDCR/DSP/DSPCR) |
| `$E000-$EFFF` | Integer BASIC ROM (4096 bytes) |
| `$FF00-$FFFF` | Woz Monitor ROM (256 bytes) |

リセットベクタ `$FFFC-$FFFD` = `$00 $FF` → CPU は `$FF00`（wozmon）から起動。

---

## 根本原因

**`harness.cpp` に埋め込まれていた BASIC ROM バイナリが誤っていた。**

- 正常なバイナリ（whscullin/apple1js 版）と比較すると、オフセット `$0138`（$E138）から末尾まで
  3726 バイトが異なっていた。
- 誤った ROM では `$E2B0` が BASIC コールドスタートではなく別のサブルーチン（ソート比較関数）
  の途中にあり、`DEX` → `RTS` ですぐにリターンしてしまっていた。
- wozmon は正常に `$E000` へ JMP していた（仮説 A は不正解）。

### 誤 ROM での `$E2B0` 付近の動作

```asm
$E2B0: 95 50  STA $50,X   ; X=0 → $50 に書く
$E2B1: D5 78  CMP $78,X   ; 比較
...
$E2B4: CA     DEX         ; X=0 → X=0xFF
$E2B5: 10 xx  BPL ...     ; 負なのでスキップ
$E2B6: 18     CLC
$E2B7: 60     RTS         ; wozmon スタックへ戻り → 暴走
```

### 正 ROM での `$E2B0` 付近の動作

```asm
$E2B0: 20 D3 EF  JSR $EFD3  ; BASIC 初期化ルーチン
$E2B3: 20 CD E3  JSR $E3CD  ; テキストポインタ初期化
...
→ 最終的に $E3CD の > プロンプト出力へ到達
```

---

## 調査フェーズの実施結果

### フェーズ 1 — BASIC 領域に PC が届くか確認

`BASIC PC=E001` が出力された → wozmon は正常に `$E000` へ JMP していた。
仮説 A（wozmon が jump していない）は否定。

### フェーズ 2 — BASIC 起動シーケンス特定

バスサイクルトレースで `$E2B0` 到達後すぐに `RTS` が実行されることを確認。
誤 ROM バイナリが原因と特定。

### フェーズ 3 — PIA / 表示パス確認

DSP への書き込みは正常に `get_display_char()` まで伝わっていた。
表示パスは問題なし。DI タイミングも wozmon では正常動作済み。

---

## 修正内容

`harness.cpp` の `BASIC[4096]` 配列を whscullin/apple1js の正規 ROM に置き換えた。

- ソース: `https://github.com/whscullin/apple1js/blob/main/js/roms/basic.ts`
- 先頭 12 バイト（同一）: `4C B0 E2 AD 11 D0 10 FB AD 10 D0 60`
- `$E2B0`: `20 D3 EF`（JSR $EFD3）→ BASIC 初期化へ正常分岐

## 修正後の動作

```text
$ ./doAppleI-basic.sh
\
E000R

E000: 4C
>
```

`>` プロンプトが表示され、Integer BASIC が正常に起動する。
