"""test_timing_ss_pdp11.py — PDP-11 ベアメタル全命令タイミング図スクリーンショット（55 ケース）

WASM をベアメタルモード（Unix V6 ブートなし）で起動し、各ケースで Python アセンブラで
機械語を生成して RAM に直接ロードし、PC trigger 発火時の Logic Analyzer キャンバスを PNG に保存する。

出力先: test/ss/pdp11/timing-{YYYY-MM-DD-HHMM}/NN-mnemonic.png

実行方法::

    pytest verif/web/test_timing_ss_pdp11.py -v \\
      --base-url http://localhost:8080/examples/09-pdp11/web/index.html

または:

    bash scripts/_doTimingSSPDP11.sh

アセンブリ構文（pdp11asm.py / Unix V6 as サブセット）:
  - 即値:        $value  （例: $5, $0340 — 数値は 8 進）
  - レジスタ:    r0-r5, sp (=r6), pc (=r7)
  - 間接:        (r0)
  - 後置 ++:     (r0)+
  - 前置 --:     -(r0)
  - インデックス: offset(r0)
  - 数値はすべて 8 進数
  - '. = addr' でロケーション設定（8進）
  - `1: br 1b` で無限ループ（ベアメタルで Ctrl-C 不要、各ケースで init_bare リセット）
"""

from __future__ import annotations

import base64
import os
import pathlib
import sys
import time
from dataclasses import dataclass
from datetime import datetime

import pytest
from playwright.sync_api import Page

sys.path.insert(0, os.path.dirname(__file__))
from pdp11asm import assemble, words_at

# ── 出力先 ─────────────────────────────────────────────────────────────────────
_RUN_TS = datetime.now().strftime("%Y-%m-%d-%H%M")
_SS_DIR = (
    pathlib.Path(__file__).parent.parent.parent
    / "test" / "ss" / "pdp11" / f"timing-{_RUN_TS}"
)

# ── (削除: 端末バッファ取得 JS は Unix V6 モードで使用、ベアメタルでは不要) ───
_GET_TERM_JS = """\
() => {
    if (!window.term) return '';
    const buf = window.term.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        lines.push(line ? line.translateToString().trimEnd() : '');
    }
    return lines.join('\\n');
}"""

# ── 信号グループ定数 ────────────────────────────────────────────────────────────
SIG_BUS    = ['pc', 'addr_p', 'data', 'bus_rd', 'bus_wr']
SIG_STD    = SIG_BUS + ['cm']
SIG_MEM    = SIG_STD + ['addr_v', 'byte_op']
SIG_BRANCH = ['pc', 'addr_p', 'bus_rd']


# ── データクラス ────────────────────────────────────────────────────────────────
@dataclass
class TimingCasePDP11:
    seq: int            # 00-54 の連番
    mnemonic: str       # ファイル名用（例: "mov-r-r", "clr-r"）
    asm: str            # . = 01000 から `1: br 1b` までの完全なアセンブリソース
    trigger_pc: int     # 観測する命令のPC（8進整数。例: 0o1006）
    signals: list[str]  # LA に表示する信号 ID のリスト
    zoom: int           # LA ズーム値（8=標準, 4=詳細, 32=広域）
    post_delay: int     # trigger 後に追加で進めるサンプル数
    desc: str = ''      # 説明文
    mem_probe: int | None = None  # LA M1 プローブアドレス（バイトアドレス 8 進整数）
    pre_ticks: int = 40  # プリトリガーランニング tick 数（ring buffer 充填用）

    @property
    def filename(self) -> str:
        return f"{self.seq:02d}-{self.mnemonic}.png"

    @property
    def title(self) -> str:
        desc_part = f' — {self.desc}' if self.desc else ''
        return (
            f"{self.seq:02d} {self.mnemonic.upper().replace('-', ' ')}{desc_part}"
            f"  PC=0o{self.trigger_pc:06o}"
            f"  [{self.zoom}x]  {_RUN_TS}"
        )


# ── ケース定義 ─────────────────────────────────────────────────────────────────
#
# アドレス計算早見表:
#   . = 01000 からの各命令サイズ（ワード単位）
#   - 1オペランド命令（clr r1 など）: 1ワード = 2バイト
#   - 即値付き命令 (mov $5, r1 など): 2ワード = 4バイト
#   - jsr r5, label: 2ワード = 4バイト（命令+アドレス）
#   - sob r1, loop: 1ワード = 2バイト
#   - br, bne, beq など: 1ワード = 2バイト
#
# 例: . = 01000 に `mov $5, r1` (2ワード) → 次命令は 01004
#     . = 01000 に `clr r1` (1ワード) → 次命令は 01002

# ── Phase A — No operand (1件) ─────────────────────────────────────────────────
_A: list[TimingCasePDP11] = [
    # NOP: 1ワード. = 01000
    TimingCasePDP11(
        0, 'nop',
        asm=""". = 01000
nop
1: br 1b
""",
        trigger_pc=0o1000,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='No Operation',
    ),
]

# ── Phase B — Single-operand register (9件) ────────────────────────────────────
_B: list[TimingCasePDP11] = [
    # CLR R1: 1ワード. trigger=01000
    TimingCasePDP11(
        1, 'clr-r',
        asm=""". = 01000
mov $177777, r1
clr r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Clear Register R1',
    ),

    # COM R1: setup `mov $5555, r1` (2ワード=01000-01003) → com r1 at 01004
    TimingCasePDP11(
        2, 'com-r',
        asm=""". = 01000
mov $5555, r1
com r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Complement R1',
    ),

    # INC R1: `clr r1` (1ワード=01000) → inc r1 at 01002
    TimingCasePDP11(
        3, 'inc-r',
        asm=""". = 01000
mov $177776, r1
inc r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Increment R1',
    ),

    # DEC R1: `mov $1, r1` (2ワード=01000-01003) → dec r1 at 01004
    TimingCasePDP11(
        4, 'dec-r',
        asm=""". = 01000
mov $1, r1
dec r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Decrement R1',
    ),

    # NEG R1: `mov $1, r1` (2ワード) → neg r1 at 01004
    TimingCasePDP11(
        5, 'neg-r',
        asm=""". = 01000
mov $1, r1
neg r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Negate R1 (twos complement)',
    ),

    # ADC R1 (C=0): `clr r1` (1ワード=01000) → adc r1 at 01002
    TimingCasePDP11(
        6, 'adc-r',
        asm=""". = 01000
mov $777, r1
adc r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Add Carry to R1 (C=0)',
    ),

    # SBC R1 (C=0): `clr r1` (1ワード=01000) → sbc r1 at 01002
    TimingCasePDP11(
        7, 'sbc-r',
        asm=""". = 01000
mov $777, r1
sbc r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Subtract Carry from R1 (C=0)',
    ),

    # TST R1: `mov $5555, r1` (2ワード) → tst r1 at 01004
    TimingCasePDP11(
        8, 'tst-r',
        asm=""". = 01000
mov $5555, r1
tst r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Test R1 (set N/Z flags)',
    ),

    # SXT R1: `mov $200, r1` (2ワード) → sxt r1 at 01004
    # bit7=1 → N=1 → 符号拡張で r1=0177600
    TimingCasePDP11(
        9, 'sxt-r',
        asm=""". = 01000
mov $200, r1
sxt r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Sign Extend (N=1 → R1=177600)',
    ),
]

# ── Phase C — Shift/Rotate register (6件) ─────────────────────────────────────
_C: list[TimingCasePDP11] = [
    # ROR R1 (C=0): `mov $1, r1` (2ワード) → ror r1 at 01004
    TimingCasePDP11(
        10, 'ror-r',
        asm=""". = 01000
mov $1, r1
ror r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Rotate Right through Carry (C=0)',
    ),

    # ROL R1 (C=0): `mov $100000, r1` (2ワード) → rol r1 at 01004
    TimingCasePDP11(
        11, 'rol-r',
        asm=""". = 01000
mov $100000, r1
rol r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Rotate Left through Carry (C=0)',
    ),

    # ASR R1: `mov $100, r1` (2ワード) → asr r1 at 01004
    # 0o100 = 64 → ASR → 0o40 = 32
    TimingCasePDP11(
        12, 'asr-r',
        asm=""". = 01000
mov $100, r1
asr r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Arithmetic Shift Right R1',
    ),

    # ASL R1: `mov $1, r1` (2ワード) → asl r1 at 01004
    TimingCasePDP11(
        13, 'asl-r',
        asm=""". = 01000
mov $1, r1
asl r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Arithmetic Shift Left R1',
    ),

    # SWAB R1: `mov $1200, r1` (2ワード) → swab r1 at 01004
    # バイトスワップ: 0o1200 → hi=0o12, lo=0o00 → 0o0012
    TimingCasePDP11(
        14, 'swab-r',
        asm=""". = 01000
mov $1200, r1
swab r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Swap Bytes of R1',
    ),

    # SXT R1 (N=0): `clr r1` (1ワード) → sxt r1 at 01002 (N=0 → r1=0)
    TimingCasePDP11(
        15, 'sxt-r-n0',
        asm=""". = 01000
mov $177777, r1
clr r2
sxt r1
1: br 1b
""",
        trigger_pc=0o1006,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Sign Extend (N=0 → R1=0)',
    ),
]

# ── Phase D — Double-operand register-register (7件) ──────────────────────────
_D: list[TimingCasePDP11] = [
    # MOV R0,R1: `clr r0` (1ワード=01000) → mov r0, r1 at 01002
    TimingCasePDP11(
        16, 'mov-r-r',
        asm=""". = 01000
clr r0
mov $177777, r1
mov r0, r1
1: br 1b
""",
        trigger_pc=0o1006,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Move R0 to R1',
    ),

    # CMP R0,R1 (equal): mov $5,r0 (2ワード=01000-01003)
    #   + mov $5,r1 (2ワード=01004-01007) → cmp r0, r1 at 01010
    TimingCasePDP11(
        17, 'cmp-r-r',
        asm=""". = 01000
mov $5, r0
mov $5, r1
cmp r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Compare R0 and R1 (equal, Z=1)',
    ),

    # BIT R0,R1: mov $17,r0 (2ワード) + mov $37,r1 (2ワード) → bit r0,r1 at 01010
    TimingCasePDP11(
        18, 'bit-r-r',
        asm=""". = 01000
mov $17, r0
mov $37, r1
bit r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Bit Test R0 AND R1',
    ),

    # BIC R0,R1: mov $17,r0 (2ワード) + mov $37,r1 (2ワード) → bic r0,r1 at 01010
    TimingCasePDP11(
        19, 'bic-r-r',
        asm=""". = 01000
mov $17, r0
mov $37, r1
bic r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Bit Clear: R1 &= ~R0',
    ),

    # BIS R0,R1: clr r1 (1ワード) + mov $3,r0 (2ワード=01002-01005) → bis r0,r1 at 01006
    TimingCasePDP11(
        20, 'bis-r-r',
        asm=""". = 01000
mov $177774, r1
mov $3, r0
bis r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Bit Set: R1 |= R0',
    ),

    # ADD R0,R1: mov $3,r0 (2ワード) + mov $5,r1 (2ワード=01004-01007) → add r0,r1 at 01010
    TimingCasePDP11(
        21, 'add-r-r',
        asm=""". = 01000
mov $3, r0
mov $5, r1
add r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Add R0 to R1',
    ),

    # SUB R0,R1: mov $3,r0 (2ワード) + mov $10,r1 (2ワード=01004-01007) → sub r0,r1 at 01010
    TimingCasePDP11(
        22, 'sub-r-r',
        asm=""". = 01000
mov $3, r0
mov $10, r1
sub r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Subtract R0 from R1',
    ),
]

# ── Phase E — Immediate operand (4件) ─────────────────────────────────────────
_E: list[TimingCasePDP11] = [
    # MOV #5, R1: 命令自体が2ワード(01000-01003) → trigger=01000（命令開始）
    TimingCasePDP11(
        23, 'mov-imm-r',
        asm=""". = 01000
mov $177777, r1
mov $5, r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Move Immediate 5 to R1',
    ),

    # ADD #3, R1: mov $10,r1 (2ワード=01000-01003) → add $3,r1 (2ワード) at 01004
    TimingCasePDP11(
        24, 'add-imm-r',
        asm=""". = 01000
mov $10, r1
add $3, r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Add Immediate 3 to R1',
    ),

    # CMP #5, R1 (equal): mov $5,r1 (2ワード=01000-01003) → cmp $5,r1 (2ワード) at 01004
    TimingCasePDP11(
        25, 'cmp-imm-r',
        asm=""". = 01000
mov $5, r1
cmp $5, r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Compare Immediate 5 with R1 (equal, Z=1)',
    ),

    # BIS #017, R1: clr r1 (1ワード=01000) → bis $17,r1 (2ワード) at 01002
    TimingCasePDP11(
        26, 'bis-imm-r',
        asm=""". = 01000
mov $177760, r1
bis $17, r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Bit Set: R1 |= 017',
    ),
]

# ── Phase F — Memory access (6件) ──────────────────────────────────────────────
# データ領域は . = 01200 に配置
_F: list[TimingCasePDP11] = [
    # MOV (R1),R2 (load):
    #   mov $01200, r1 (2ワード=01000-01003)
    #   clr r2         (1ワード=01004)
    #   mov (r1), r2   (1ワード=01006) ← trigger
    TimingCasePDP11(
        27, 'mov-ind-r',
        asm=""". = 01000
mov $01200, r1
clr r2
mov (r1), r2
1: br 1b
. = 01200
012345
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Load R2 from memory (R1)',
        mem_probe=0o1200,
    ),

    # MOV R2,(R1) (store):
    #   mov $01200, r1 (2ワード=01000-01003)
    #   mov $042, r2   (2ワード=01004-01007)
    #   mov r2, (r1)   (1ワード=01010) ← trigger
    TimingCasePDP11(
        28, 'mov-r-ind',
        asm=""". = 01000
mov $01200, r1
mov $042, r2
mov r2, (r1)
1: br 1b
. = 01200
0177777
""",
        trigger_pc=0o1010,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Store R2 to memory (R1)',
        mem_probe=0o1200,
    ),

    # MOV (R1)+,R2 (auto-increment):
    #   mov $01200, r1 (2ワード=01000-01003)
    #   clr r2         (1ワード=01004)
    #   mov (r1)+, r2  (1ワード=01006) ← trigger  r1: 01200→01202
    TimingCasePDP11(
        29, 'mov-autoinc-r',
        asm=""". = 01000
mov $01200, r1
clr r2
mov (r1)+, r2
1: br 1b
. = 01200
054321
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Load R2 auto-increment (R1)+',
        mem_probe=0o1200,
    ),

    # MOV -(R1),R2 (auto-decrement):
    #   mov $01202, r1 (2ワード=01000-01003)   r1=01202
    #   clr r2         (1ワード=01004)
    #   mov -(r1), r2  (1ワード=01006) ← trigger  r1: 01202→01200
    TimingCasePDP11(
        30, 'mov-autodec-r',
        asm=""". = 01000
mov $01202, r1
clr r2
mov -(r1), r2
1: br 1b
. = 01200
076543
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Load R2 auto-decrement -(R1)',
        mem_probe=0o1200,
    ),

    # MOV 2(R1),R2 (indexed):
    #   mov $01200, r1 (2ワード=01000-01003)
    #   clr r2         (1ワード=01004)
    #   mov 2(r1), r2  (2ワード=01006-01011) ← trigger
    TimingCasePDP11(
        31, 'mov-idx-r',
        asm=""". = 01000
mov $01200, r1
clr r2
mov 2(r1), r2
1: br 1b
. = 01200
0
011111
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=120,
        desc='Load R2 indexed 2(R1)',
        mem_probe=0o1202,
    ),

    # MOVB (R1),R2 (byte load, sign-extend):
    #   mov $01200, r1 (2ワード=01000-01003)
    #   clr r2         (1ワード=01004)
    #   movb (r1), r2  (1ワード=01006) ← trigger
    TimingCasePDP11(
        32, 'movb-ind-r',
        asm=""". = 01000
mov $01200, r1
clr r2
movb (r1), r2
1: br 1b
. = 01200
0377
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Byte Load R2 from (R1), sign-extend',
        mem_probe=0o1200,
    ),
]

# ── Phase G — Branch (8件) ────────────────────────────────────────────────────
_G: list[TimingCasePDP11] = [
    # BR taken: BR自体が1ワード(01000) → trigger=01000
    TimingCasePDP11(
        33, 'br-taken',
        asm=""". = 01000
br done
nop
done: 1: br 1b
""",
        trigger_pc=0o1000,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch (always taken)',
    ),

    # BNE taken (Z=0):
    #   clr r0 (1ワード=01000)
    #   inc r0 (1ワード=01002) → Z=0
    #   bne done (1ワード=01004) ← trigger
    TimingCasePDP11(
        34, 'bne-taken',
        asm=""". = 01000
clr r0
inc r0
bne done
nop
done: 1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if Not Equal (Z=0, taken)',
    ),

    # BNE not-taken (Z=1):
    #   clr r0 (1ワード=01000) → Z=1
    #   bne done (1ワード=01002) ← trigger (fall through)
    TimingCasePDP11(
        35, 'bne-nt',
        asm=""". = 01000
clr r0
bne done
nop
done: 1: br 1b
""",
        trigger_pc=0o1002,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if Not Equal (Z=1, not taken)',
    ),

    # BEQ taken (Z=1):
    #   clr r0 (1ワード=01000) → Z=1
    #   beq done (1ワード=01002) ← trigger
    TimingCasePDP11(
        36, 'beq-taken',
        asm=""". = 01000
clr r0
beq done
nop
done: 1: br 1b
""",
        trigger_pc=0o1002,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if Equal (Z=1, taken)',
    ),

    # BGE taken (N=V=0, signed >= 0):
    #   clr r0 (1ワード=01000) → N=0, V=0
    #   bge done (1ワード=01002) ← trigger
    TimingCasePDP11(
        37, 'bge-taken',
        asm=""". = 01000
clr r0
bge done
nop
done: 1: br 1b
""",
        trigger_pc=0o1002,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if >= 0 (N=V=0, taken)',
    ),

    # BLT taken (N=1, V=0 → N xor V = 1):
    #   mov $100000, r0 (2ワード=01000-01003) → N=1
    #   tst r0          (1ワード=01004)
    #   blt done        (1ワード=01006) ← trigger
    TimingCasePDP11(
        38, 'blt-taken',
        asm=""". = 01000
mov $100000, r0
tst r0
blt done
nop
done: 1: br 1b
""",
        trigger_pc=0o1006,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if < 0 (N=1, V=0, taken)',
    ),

    # BCC taken (C=0): after CLR + ADD $1,r0 → C=0
    #   clr r0           (1ワード=01000)
    #   add $1, r0       (2ワード=01002-01005) → C=0 (1+0=1, no carry)
    #   bcc done         (1ワード=01006) ← trigger
    TimingCasePDP11(
        39, 'bcc-taken',
        asm=""". = 01000
clr r0
add $1, r0
bcc done
nop
done: 1: br 1b
""",
        trigger_pc=0o1006,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if Carry Clear (C=0, taken)',
    ),

    # BCS taken (C=1): 177777 + 1 = 0 with C=1
    #   mov $177777, r0  (2ワード=01000-01003)
    #   add $1, r0       (2ワード=01004-01007) → 177777+1=0, C=1
    #   bcs done         (1ワード=01010) ← trigger
    TimingCasePDP11(
        40, 'bcs-taken',
        asm=""". = 01000
mov $177777, r0
add $1, r0
bcs done
nop
done: 1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_BRANCH,
        zoom=32,
        post_delay=60,
        desc='Branch if Carry Set (C=1, taken)',
    ),
]

# ── Phase H — JSR/RTS (2件) ───────────────────────────────────────────────────
_H: list[TimingCasePDP11] = [
    # JSR R5, sub:
    #   まず SP を初期化 (mov $01400, sp → 2ワード=01000-01003)
    #   jsr r5, sub      (2ワード=01004-01007) ← trigger
    TimingCasePDP11(
        41, 'jsr-r5',
        asm=""". = 01000
mov $01400, sp
jsr r5, sub
1: br 1b
sub: rts r5
. = 01376
0177777
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=120,
        desc='Jump to Subroutine via R5',
        mem_probe=0o1376,
    ),

    # RTS R5: jsr の後, サブルーチン内 rts r5 を観測
    #   mov $01400, sp   (2ワード=01000-01003)
    #   jsr r5, sub      (2ワード=01004-01007)
    #   halt at 01010
    #   sub: rts r5 at 01012 ← trigger
    TimingCasePDP11(
        42, 'rts-r5',
        asm=""". = 01000
mov $01400, sp
jsr r5, sub
1: br 1b
sub: rts r5
""",
        trigger_pc=0o1012,
        signals=SIG_STD,
        zoom=32,
        post_delay=120,
        desc='Return from Subroutine via R5',
    ),
]

# ── Phase I — JMP, SOB (3件) ──────────────────────────────────────────────────
_I: list[TimingCasePDP11] = [
    # JMP (R1) — register indirect:
    #   mov $done, r1    (2ワード=01000-01003)  r1=アドレス of done
    #   jmp (r1)         (1ワード=01004) ← trigger
    #   nop at 01006
    #   done: halt at 01010 (approx)
    TimingCasePDP11(
        43, 'jmp-ind',
        asm=""". = 01000
mov $done, r1
jmp (r1)
nop
done: 1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Jump indirect via R1',
    ),

    # SOB taken (R1>0 after decrement):
    #   mov $2, r1       (2ワード=01000-01003)
    #   loop: sob r1, loop (1ワード=01004) ← trigger (r1: 2→1>0, branch taken)
    TimingCasePDP11(
        44, 'sob-taken',
        asm=""". = 01000
mov $2, r1
loop: sob r1, loop
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Subtract One and Branch (R1=2→1, taken)',
    ),

    # SOB not-taken (R1=1→0):
    #   mov $1, r1       (2ワード=01000-01003)
    #   loop: sob r1, loop (1ワード=01004) ← trigger (r1: 1→0, not taken)
    TimingCasePDP11(
        45, 'sob-nt',
        asm=""". = 01000
mov $1, r1
loop: sob r1, loop
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=80,
        desc='Subtract One and Branch (R1=1→0, not taken)',
    ),
]

# ── Phase J — Byte operations (4件) ──────────────────────────────────────────
_J: list[TimingCasePDP11] = [
    # MOVB R0,R1 (byte move, sign-extend):
    #   mov $377, r0     (2ワード=01000-01003)
    #   movb r0, r1      (1ワード=01004) ← trigger (下位バイト符号拡張)
    TimingCasePDP11(
        46, 'movb-r-r',
        asm=""". = 01000
mov $377, r0
movb r0, r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Move Byte R0 to R1 (sign-extend)',
    ),

    # CLRB R1 (clear lower byte, upper unchanged):
    #   mov $177777, r1  (2ワード=01000-01003)
    #   clrb r1          (1ワード=01004) ← trigger (下位バイトのみ 0)
    TimingCasePDP11(
        47, 'clrb-r',
        asm=""". = 01000
mov $177777, r1
clrb r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Clear Byte lower R1 (upper unchanged)',
    ),

    # INCB R1:
    #   clr r1           (1ワード=01000)
    #   incb r1          (1ワード=01002) ← trigger
    TimingCasePDP11(
        48, 'incb-r',
        asm=""". = 01000
clr r1
incb r1
1: br 1b
""",
        trigger_pc=0o1002,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Increment Byte R1',
    ),

    # CMPB R0,R1 (byte compare):
    #   mov $5, r0       (2ワード=01000-01003)
    #   mov $5, r1       (2ワード=01004-01007)
    #   cmpb r0, r1      (1ワード=01010) ← trigger
    TimingCasePDP11(
        49, 'cmpb-r-r',
        asm=""". = 01000
mov $5, r0
mov $5, r1
cmpb r0, r1
1: br 1b
""",
        trigger_pc=0o1010,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Compare Bytes R0 and R1 (equal, Z=1)',
    ),
]

# ── Phase K — Addressing mode showcase (5件) ──────────────────────────────────
# MOV 命令で各アドレッシングモードを比較する
_K: list[TimingCasePDP11] = [
    # Mode 0: MOV R0, R1 (register) — 1ワード
    #   mov $042, r0     (2ワード=01000-01003)
    #   mov r0, r1       (1ワード=01004) ← trigger
    TimingCasePDP11(
        50, 'mode0-reg',
        asm=""". = 01000
mov $042, r0
mov r0, r1
1: br 1b
""",
        trigger_pc=0o1004,
        signals=SIG_STD,
        zoom=32,
        post_delay=60,
        desc='Mode 0: Register direct MOV R0,R1',
    ),

    # Mode 1: MOV (R0), R1 (register indirect) — 1ワード
    #   mov $01200, r0   (2ワード=01000-01003)
    #   clr r1           (1ワード=01004)
    #   mov (r0), r1     (1ワード=01006) ← trigger
    TimingCasePDP11(
        51, 'mode1-ind',
        asm=""". = 01000
mov $01200, r0
clr r1
mov (r0), r1
1: br 1b
. = 01200
0123
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Mode 1: Register indirect MOV (R0),R1',
        mem_probe=0o1200,
    ),

    # Mode 2: MOV (R0)+, R1 (auto-increment) — 1ワード
    #   mov $01200, r0   (2ワード=01000-01003)
    #   clr r1           (1ワード=01004)
    #   mov (r0)+, r1    (1ワード=01006) ← trigger
    TimingCasePDP11(
        52, 'mode2-autoinc',
        asm=""". = 01000
mov $01200, r0
clr r1
mov (r0)+, r1
1: br 1b
. = 01200
0456
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Mode 2: Auto-increment MOV (R0)+,R1',
        mem_probe=0o1200,
    ),

    # Mode 4: MOV -(R0), R1 (auto-decrement) — 1ワード
    #   mov $01202, r0   (2ワード=01000-01003)
    #   clr r1           (1ワード=01004)
    #   mov -(r0), r1    (1ワード=01006) ← trigger
    TimingCasePDP11(
        53, 'mode4-autodec',
        asm=""". = 01000
mov $01202, r0
clr r1
mov -(r0), r1
1: br 1b
. = 01200
0765
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=100,
        desc='Mode 4: Auto-decrement MOV -(R0),R1',
        mem_probe=0o1200,
    ),

    # Mode 6: MOV 2(R0), R1 (indexed) — 2ワード
    #   mov $01200, r0   (2ワード=01000-01003)
    #   clr r1           (1ワード=01004)
    #   mov 2(r0), r1    (2ワード=01006-01011) ← trigger
    TimingCasePDP11(
        54, 'mode6-idx',
        asm=""". = 01000
mov $01200, r0
clr r1
mov 2(r0), r1
1: br 1b
. = 01200
0
0321
""",
        trigger_pc=0o1006,
        signals=SIG_MEM,
        zoom=32,
        post_delay=120,
        desc='Mode 6: Indexed MOV 2(R0),R1',
        mem_probe=0o1202,
    ),
]

# ── 全ケースリスト ─────────────────────────────────────────────────────────────
CASES: list[TimingCasePDP11] = (
    _A + _B + _C + _D + _E + _F + _G + _H + _I + _J + _K
)
assert len(CASES) == 55, f"期待 55 ケース、実際 {len(CASES)} ケース"


# ── ヘルパー関数（ベアメタルモード）────────────────────────────────────────────

def _poll(page: Page, expr: str, timeout: float) -> bool:
    """JS 式が真になるまでポーリング。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate(expr):
            return True
        time.sleep(0.05)
    return False


def bare_init(page: Page, start_pc: int, timeout: float = 10.0) -> None:
    """WASM をベアメタルモードで初期化する。

    init_bare メッセージを送信し、bare_ready 通知を待つ。
    """
    page.evaluate("() => { window._pdp11BareReady = false; window._pdp11TriggeredPC = null; }")
    page.evaluate(f"() => window.worker.postMessage({{type:'init_bare', start_pc:{start_pc}}})")
    assert _poll(page, "() => window._pdp11BareReady", timeout), (
        f"init_bare timeout (start_pc=0o{start_pc:06o})"
    )


def bare_write_words(page: Page, words: dict[int, int]) -> None:
    """アドレス→ワードの dict を WASM RAM に書き込む。"""
    for addr, word in sorted(words.items()):
        page.evaluate(
            f"() => window.worker.postMessage({{type:'write_word', addr:{addr}, word:{word}}})"
        )
    # ワード書き込みは非同期なので、短い同期待ちが必要
    time.sleep(0.02)


def bare_set_trigger(page: Page, pc: int) -> None:
    """PC トリガーを設定する。"""
    page.evaluate("() => window._pdp11TriggeredPC = null")
    page.evaluate(f"() => window.worker.postMessage({{type:'set_trigger', pc:{pc}}})")


def bare_resume(page: Page) -> None:
    """シミュレーションを開始（resume）する。"""
    page.evaluate("() => window.worker.postMessage({type:'resume'})")


def bare_wait_trigger(page: Page, timeout: float = 10.0) -> int | None:
    """PC トリガー発火まで待機。発火した PC 値を返す（タイムアウト時は None）。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        pc = page.evaluate("() => window._pdp11TriggeredPC")
        if pc is not None:
            return int(pc)
        time.sleep(0.05)
    return None


def bare_step(page: Page, n_ticks: int, timeout: float = 10.0) -> None:
    """トリガーなしで n_ticks だけ進める（ポストトリガー用）。"""
    page.evaluate("() => { window._pdp11BareStepped = false; }")
    page.evaluate(f"() => window.worker.postMessage({{type:'step_bare', n:{n_ticks}}})")
    assert _poll(page, "() => window._pdp11BareStepped", timeout), (
        f"step_bare timeout (n={n_ticks})"
    )


def screenshot_la(page: Page, output_path: pathlib.Path, title: str = "") -> None:
    """LA キャンバス (#la) を PNG ファイルに保存する。

    window.sim.screenshotCanvas() 経由で DataURL を取得し、base64 デコードして保存する。
    タイトルを指定するとキャンバス上部にダークバーとテキストを描き込む。
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if title:
        data_url: str = page.evaluate(f"""() => {{
            var src = document.querySelector('#la');
            if (!src) return null;
            var dpr = window.devicePixelRatio || 1;
            var barH = Math.round(24 * dpr);
            var tmp = document.createElement('canvas');
            tmp.width  = src.width;
            tmp.height = src.height + barH;
            var ctx = tmp.getContext('2d');
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, tmp.width, barH);
            ctx.fillStyle = '#e0e0e0';
            ctx.font = (Math.round(13 * dpr)) + 'px monospace';
            ctx.textBaseline = 'middle';
            ctx.fillText({repr(title)}, Math.round(6 * dpr), barH / 2);
            ctx.drawImage(src, 0, barH);
            return tmp.toDataURL('image/png');
        }}""")
    else:
        data_url = page.evaluate("() => window.sim.screenshotCanvas('#la')")

    if not data_url:
        raise RuntimeError(f"screenshotCanvas returned null for {output_path}")

    raw = base64.b64decode(data_url.split(",", 1)[1])
    output_path.write_bytes(raw)


# ── テスト実行関数（ベアメタルモード）─────────────────────────────────────────

def _make_loopable(asm: str) -> str:
    """末尾の '1: br 1b' 自己ループを先頭ループに変換する。

    変換前:  . = 01000
             <setup>
             <instruction>
             1: br 1b        ← 自己ループ

    変換後:  . = 01000
             1:              ← ループ先頭
             <setup>
             <instruction>
             br 1b           ← 先頭へ戻る

    これにより pre_ticks 分のプリランで setup + instruction が繰り返され、
    ring buffer にプリトリガーデータが充填される。
    """
    if '1: br 1b' not in asm:
        return asm
    asm = asm.replace('1: br 1b', 'br 1b')
    lines = asm.split('\n')
    result: list[str] = []
    inserted = False
    for line in lines:
        result.append(line)
        if not inserted and line.strip().startswith('. ='):
            result.append('1:')
            inserted = True
    return '\n'.join(result)


def run_timing_case(page: Page, case: TimingCasePDP11, ss_dir: pathlib.Path) -> None:
    """ベアメタルモードで 1 ケースを実行してスクリーンショットを保存する。

    1. Python アセンブラで asm 文字列を機械語ワード列に変換
    2. init_bare で WASM をリセット（Unix V6 ブートなし）
    3. 機械語を RAM に書き込む
    4. pre_ticks 分プリラン（ring buffer にプリトリガーデータを充填）
    5. LA 信号・ズームを設定
    6. PC トリガーを設定して実行
    7. trigger 発火後に post_delay 分だけ追加で進める
    8. スクリーンショット保存
    """
    # アセンブル（'1: br 1b' 末尾ループ → '1:' 先頭ループに変換）
    prog = assemble(_make_loopable(case.asm))
    all_words = prog.words   # {byte_addr: word}

    # ベアメタル初期化
    bare_init(page, prog.start)

    # メモリプローブアドレス設定（M1 信号用: 0xFFFFFFFF でプローブ無効）
    probe_addr = case.mem_probe if case.mem_probe is not None else 0xFFFFFFFF
    page.evaluate(f"() => window.worker.postMessage({{type:'set_mem_probe', addr:{probe_addr}}})")

    # M1 ラベルにプローブアドレスを表示: "M1(1200)" 形式（アドレスは 8 進）
    m1_label = f'M1({case.mem_probe:o})' if case.mem_probe is not None else 'M1'
    page.evaluate(f"""() => {{
        var s = (window.la._signals || []).find(function(x) {{ return x.id === 'mem_m1'; }});
        if (s) s.label = '{m1_label}';
    }}""")

    # 機械語を RAM に書き込む
    bare_write_words(page, all_words)

    # LA 信号・ズーム設定
    page.evaluate("() => window.pdp11SetSignals(window.la._signals.map(s => s.id))")
    page.evaluate(f"() => window.pdp11SetZoom({case.zoom})")

    # プリトリガーランニング: ring buffer に setup + instruction を充填する。
    # ループ化した asm を pre_ticks 分走らせることで、トリガー前に実データが入る。
    if case.pre_ticks > 0:
        bare_step(page, case.pre_ticks)

    # PC トリガー設定と実行開始をアトミックに送る。
    # resume + set_trigger を別々に送ると setTimeout(simLoop,0) が
    # set_trigger より先に発火する競合で trigger_pc = 0o1000 の初回フェッチを
    # 取り逃すことがある。set_trigger_and_run で 1 メッセージにまとめて解決。
    page.evaluate(
        f"() => window.worker.postMessage({{type:'set_trigger_and_run', pc:{case.trigger_pc}}})"
    )

    # トリガー発火待ち
    pc = bare_wait_trigger(page, timeout=10.0)
    assert pc is not None, (
        f"trigger timeout: {case.mnemonic} @ PC=0o{case.trigger_pc:06o}"
    )

    # ポストトリガー: 命令の実行フェーズを ring buffer に収める
    # post_delay サンプル × 4 ticks/sample
    bare_step(page, case.post_delay * 4)

    # 表示パン: T=-20 が左端に来るよう _pan を計算してから再描画する。
    # gotoTrig(fracX) の代わりに直接 _pan を設定することで
    # 「トリガーより20T前が左端」となる位置を正確に指定できる。
    #   _pan = trigOffset - (samplesInView - SHOW_PRE - 1)
    # ここで trigOffset = lastHead - trigHead (ポストトリガー分)
    show_pre = min(case.pre_ticks, 20) if case.pre_ticks > 0 else 4
    page.evaluate(f"""() => {{
        var la = window.la;
        if (!la || la._trigHead < 0) {{ la.gotoTrig(0.2); return; }}
        var trigOffset   = ((la._lastHead >>> 0) - (la._trigHead >>> 0)) >>> 0;
        var samplesInView = Math.ceil(la._VIEW_W / la._zoom);
        var SHOW_PRE     = {show_pre};
        la._pan = Math.max(0, trigOffset - (samplesInView - SHOW_PRE - 1));
        if (la._lastHeapu32) la._draw(la._lastHeapu32, la._lastHead);
    }}""")

    # 命令オペコードをリングバッファから読む（word4 bits[20:5] = ISN）
    # トリガー発火サンプル直前（pre_ticks > 0 なら istate=FETCH のサンプルを探す）
    # から最初の非ゼロ ISN を取得する
    isn: int = page.evaluate("""() => {
        var la = window.la;
        if (!la || la._trigHead < 0 || !la._lastHeapu32) return 0;
        var RW = 9, RS = 4096;
        for (var i = 0; i <= 12; i++) {
            var base = ((la._trigHead + i) & (RS - 1)) * RW;
            var isn = (la._lastHeapu32[base + 4] >>> 5) & 0xFFFF;
            if (isn) return isn;
        }
        return 0;
    }""") or 0

    # タイトル構築（opc=0o{octal} を PC= の左に追加）
    desc_part = f' — {case.desc}' if case.desc else ''
    title = (
        f"{case.seq:02d} {case.mnemonic.upper().replace('-', ' ')}{desc_part}"
        f"  opc=0o{isn:06o}  PC=0o{case.trigger_pc:06o}"
        f"  [{case.zoom}x]  {_RUN_TS}"
    )

    # スクリーンショット保存
    out = ss_dir / case.filename
    screenshot_la(page, out, title=title)


# ── フィクスチャ ────────────────────────────────────────────────────────────────

@pytest.fixture(scope='module')
def bare_page(browser, base_url: str) -> Page:
    """WASM ページをロードするだけ（Unix V6 ブートなし）。

    各テストケースで init_bare を呼ぶためセッション共有でよい。
    """
    # 幅を広げてLA が 1100px 以上確保できるようにする
    ctx = browser.new_context(viewport={'width': 1800, 'height': 900})
    page = ctx.new_page()
    page.goto(base_url)

    # WASM モジュールがロードされ、worker が起動するまで待つ
    page.wait_for_function(
        "() => { var b=document.getElementById('btn-boot'); return b && !b.disabled; }",
        timeout=30_000,
    )
    page.wait_for_function("() => window.worker != null", timeout=10_000)

    yield page
    ctx.close()


# ── パラメータ化テスト ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('case', CASES, ids=lambda c: c.mnemonic)
def test_pdp11_timing_ss(bare_page: Page, case: TimingCasePDP11) -> None:
    """1 命令のタイミング図スクリーンショットを撮る（ベアメタルモード）。"""
    run_timing_case(bare_page, case, _SS_DIR)
