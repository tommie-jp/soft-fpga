"""test_timing_ss.py — 8080 CPU 全命令タイミング図スクリーンショット（73 ケース）

各ケースで Logic Analyzer キャンバスを PNG に保存する。

出力先: test/ss/timing/{seq:02d}_{mnemonic}_{YYYY-MM-DD-HHMM}.png

実行方法::

    pytest verif/web/test_timing_ss.py -v \\
      --base-url http://localhost:8080/examples/06-8080/web/index.html

"""

from __future__ import annotations

import pathlib
import time
from dataclasses import dataclass, field
from datetime import datetime

import pytest
from playwright.sync_api import Page

from sim_api import SimAPI

# ── 出力先 ────────────────────────────────────────────────────────────────────
# テスト実行開始時刻を一度だけ取得し、ディレクトリ名に埋め込む（全ケース共通）
_RUN_TS = datetime.now().strftime("%Y-%m-%d-%H%M")
_SS_DIR = pathlib.Path(__file__).parent.parent.parent / "test" / "ss" / f"timing-{_RUN_TS}"

# ── 信号グループ定数 ──────────────────────────────────────────────────────────
#  全レジスタ（常時表示）
_ALL_REGS = ['pc', 'sp', 'acc', 'reg_f',
             'reg_b', 'reg_c', 'reg_d', 'reg_e', 'reg_h', 'reg_l']
_CTRL     = ['sync', 'addr', 'dbus', 'ir', 't_state']

SIG_STD     = _CTRL + _ALL_REGS                          # 15 信号 (全命令共通)
SIG_STD_MEM = SIG_STD + ['memr', 'memw']                # 17 信号 (メモリアクセス命令)
SIG_STD_IO  = SIG_STD + ['port', 'data', 'io_req', 'io_wr']  # 19 信号 (IN/OUT)
SIG_STD_CTL = SIG_STD + ['inte']                         # 16 信号 (EI/DI)


# ── データクラス ───────────────────────────────────────────────────────────────
@dataclass
class TimingCase:
    seq: int                          # 連番 00-72
    mnemonic: str                     # ファイル名用ニモニック（レジスタ/値を含む）
    opc: int                          # トリガーオペコード（M1 フェッチ）
    t_states: int
    machine_cycles: int
    code: list[int]                   # 0x0300 からのバイト列（先頭は常に 0x00 NOP）
    signals: list[str]                # LA 表示信号
    zoom: str                         # '16x' or '8x'
    post_delay: int                   # トリガー後の ring buffer サンプル数
    setup_regs: dict[str, int] = field(default_factory=dict)
    setup_mem: dict[int, list[int]] = field(default_factory=dict)
    desc: str = ''                        # 命令の意味（タイトルバーに表示）

    @property
    def filename(self) -> str:
        return f"{self.seq:02d}-{self.mnemonic.replace('_', '-')}.png"

    @property
    def title(self) -> str:
        desc_part = f' — {self.desc}' if self.desc else ''
        return (
            f"{self.seq:02d} {self.mnemonic.upper().replace('_', ' ')}{desc_part}  "
            f"opc=0x{self.opc:02X}  {self.t_states}T/{self.machine_cycles}M  [{self.zoom}]"
            f"  {_RUN_TS}"
        )


# ── ケース定義 ────────────────────────────────────────────────────────────────
#
# 共通メモリレイアウト:
#   0x0300: NOP (pre-context)
#   0x0301: テスト命令バイト
#   0x030X: HLT (終端)
#   0x0350: HL オペランド領域 (HL=0x0350 で参照)
#   0x0360: BC オペランド領域 (BC=0x0360 で参照)
#   0x0370: DE オペランド領域 (DE=0x0370 で参照)
#   0x03FE: スタック書き込み領域
#   0x0400-0x04FF: スタック (SP=0x0400)
#
# ズーム戦略: T ≤ 13 → 16x / T > 13 → 8x
# post_delay = T_states × 2 + 20 サンプル

# ── Phase A — T4M1: NOP / ALU レジスタ命令 ───────────────────────────────────
_A: list[TimingCase] = [
    # NOP — 4T/1M
    TimingCase(0,  'nop',     0x00, 4, 1,
               [0x00, 0x00, 0x76],
               SIG_STD, '16x', 28,
               desc='No Operation'),

    # ADD r — 4T/1M
    TimingCase(1,  'add_b',   0x80, 4, 1,
               [0x00, 0x80, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x05, 'b': 0x03},
               desc='Add B to A'),

    # ADC r — 4T/1M
    TimingCase(2,  'adc_c',   0x89, 4, 1,
               [0x00, 0x89, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x05, 'c': 0x03},
               desc='Add C to A with Carry'),

    # SUB r — 4T/1M
    TimingCase(3,  'sub_d',   0x92, 4, 1,
               [0x00, 0x92, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x0A, 'd': 0x03},
               desc='Subtract D from A'),

    # SBB r — 4T/1M
    TimingCase(4,  'sbb_e',   0x9B, 4, 1,
               [0x00, 0x9B, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x0A, 'e': 0x03},
               desc='Subtract E from A with Borrow'),

    # ANA r — 4T/1M
    TimingCase(5,  'ana_h',   0xA4, 4, 1,
               [0x00, 0xA4, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0xFF, 'h': 0x0F},
               desc='AND H with A'),

    # XRA r — 4T/1M
    TimingCase(6,  'xra_l',   0xAD, 4, 1,
               [0x00, 0xAD, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0xFF, 'l': 0x0F},
               desc='XOR L with A'),

    # ORA r — 4T/1M
    TimingCase(7,  'ora_a',   0xB7, 4, 1,
               [0x00, 0xB7, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x42},
               desc='OR A with A (set flags)'),

    # CMP r — 4T/1M
    TimingCase(8,  'cmp_b',   0xB8, 4, 1,
               [0x00, 0xB8, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x05, 'b': 0x05},
               desc='Compare A with B'),

    # RLC — 4T/1M (RRC/RAL/RAR/DAA/CMA/STC/CMC/XCHG/EI/DI も同じ T4M1)
    TimingCase(9,  'rlc',     0x07, 4, 1,
               [0x00, 0x07, 0x76],
               SIG_STD, '16x', 28,
               setup_regs={'a': 0x81},
               desc='Rotate A Left, Carry = MSB'),
]

# ── Phase B — T5M1: MOV r,r / INR r / DCR r / INX / DCX / PCHL ──────────────
_B: list[TimingCase] = [
    # MOV B,C — 5T/1M
    TimingCase(10, 'mov_b_c', 0x41, 5, 1,
               [0x00, 0x41, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'b': 0x00, 'c': 0xAB},
               desc='Move C to B'),

    # MOV A,H — 5T/1M
    TimingCase(11, 'mov_a_h', 0x7C, 5, 1,
               [0x00, 0x7C, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'a': 0x00, 'h': 0x12},
               desc='Move H to A'),

    # MOV D,L — 5T/1M
    TimingCase(12, 'mov_d_l', 0x55, 5, 1,
               [0x00, 0x55, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'d': 0x00, 'l': 0x34},
               desc='Move L to D'),

    # INR A — 5T/1M
    TimingCase(13, 'inr_a',   0x3C, 5, 1,
               [0x00, 0x3C, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'a': 0x7F},
               desc='Increment A'),

    # DCR B — 5T/1M
    TimingCase(14, 'dcr_b',   0x05, 5, 1,
               [0x00, 0x05, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'b': 0x01},
               desc='Decrement B'),

    # INR D — 5T/1M
    TimingCase(15, 'inr_d',   0x14, 5, 1,
               [0x00, 0x14, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'d': 0x00},
               desc='Increment D'),

    # DCR L — 5T/1M
    TimingCase(16, 'dcr_l',   0x2D, 5, 1,
               [0x00, 0x2D, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'l': 0x00},
               desc='Decrement L'),

    # INX D — 5T/1M (DE=0xFFFF → 0x0000)
    TimingCase(17, 'inx_d',   0x13, 5, 1,
               [0x00, 0x13, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'d': 0xFF, 'e': 0xFF},
               desc='Increment DE'),

    # DCX H — 5T/1M (HL=0x0100 → 0x00FF)
    TimingCase(18, 'dcx_h',   0x2B, 5, 1,
               [0x00, 0x2B, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'h': 0x01, 'l': 0x00},
               desc='Decrement HL'),

    # PCHL — 5T/1M  HL=0x0301 → PC=0x0301 (PCHL 自身にジャンプ)
    TimingCase(19, 'pchl',    0xE9, 5, 1,
               [0x00, 0xE9, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'h': 0x03, 'l': 0x01},
               desc='Jump to Address in HL'),
]

# ── Phase C — T7M2: 即値・M アドレス命令 ─────────────────────────────────────
_C: list[TimingCase] = [
    # MVI A,$FF — 7T/2M  ファイル名にレジスタ+値を含む
    TimingCase(20, 'mvi_a_ff', 0x3E, 7, 2,
               [0x00, 0x3E, 0xFF, 0x76],
               SIG_STD, '16x', 34,
               desc='Move Immediate $FF to A'),

    # MVI B,$42 — 7T/2M
    TimingCase(21, 'mvi_b_42', 0x06, 7, 2,
               [0x00, 0x06, 0x42, 0x76],
               SIG_STD, '16x', 34,
               desc='Move Immediate $42 to B'),

    # ADI $10 — 7T/2M  A=0x05+0x10=0x15
    TimingCase(22, 'adi_10',   0xC6, 7, 2,
               [0x00, 0xC6, 0x10, 0x76],
               SIG_STD, '16x', 34,
               setup_regs={'a': 0x05},
               desc='Add Immediate $10 to A'),

    # ACI $10 — 7T/2M  A=0x05+0x10+CY
    TimingCase(23, 'aci_10',   0xCE, 7, 2,
               [0x00, 0xCE, 0x10, 0x76],
               SIG_STD, '16x', 34,
               setup_regs={'a': 0x05},
               desc='Add Immediate $10 to A with Carry'),

    # SUI $03 — 7T/2M  A=0x0A-0x03=0x07
    TimingCase(24, 'sui_03',   0xD6, 7, 2,
               [0x00, 0xD6, 0x03, 0x76],
               SIG_STD, '16x', 34,
               setup_regs={'a': 0x0A},
               desc='Subtract Immediate $03 from A'),

    # ANI $0F — 7T/2M  A=0xFF & 0x0F=0x0F
    TimingCase(25, 'ani_0f',   0xE6, 7, 2,
               [0x00, 0xE6, 0x0F, 0x76],
               SIG_STD, '16x', 34,
               setup_regs={'a': 0xFF},
               desc='AND Immediate $0F with A'),

    # ORI $0F — 7T/2M  A=0x00 | 0x0F=0x0F
    TimingCase(26, 'ori_0f',   0xF6, 7, 2,
               [0x00, 0xF6, 0x0F, 0x76],
               SIG_STD, '16x', 34,
               setup_regs={'a': 0x00},
               desc='OR Immediate $0F with A'),

    # CPI $05 — 7T/2M  A=0x05, 比較 → Z=1
    TimingCase(27, 'cpi_05',   0xFE, 7, 2,
               [0x00, 0xFE, 0x05, 0x76],
               SIG_STD, '16x', 34,
               setup_regs={'a': 0x05},
               desc='Compare Immediate $05 with A'),

    # MOV A,M — 7T/2M  HL→0x0350: 0xABを読む
    TimingCase(28, 'mov_a_m',  0x7E, 7, 2,
               [0x00, 0x7E, 0x76],
               SIG_STD_MEM, '16x', 34,
               setup_regs={'h': 0x03, 'l': 0x50},
               setup_mem={0x0350: [0xAB]},
               desc='Move Memory (HL) to A'),

    # MOV M,A — 7T/2M  A=0xCD を (HL=0x0350) に書く
    TimingCase(29, 'mov_m_a',  0x77, 7, 2,
               [0x00, 0x77, 0x76],
               SIG_STD_MEM, '16x', 34,
               setup_regs={'a': 0xCD, 'h': 0x03, 'l': 0x50},
               desc='Move A to Memory (HL)'),
]

# ── Phase D — レジスタペア: T5M1 / T10M1 (DAD) ──────────────────────────────
_D: list[TimingCase] = [
    # INX SP — 5T/1M  SP=0x03FF → 0x0400
    TimingCase(30, 'inx_sp',   0x33, 5, 1,
               [0x00, 0x33, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'sp': 0x03FF},
               desc='Increment SP'),

    # DCX SP — 5T/1M  SP=0x0400 → 0x03FF
    TimingCase(31, 'dcx_sp',   0x3B, 5, 1,
               [0x00, 0x3B, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'sp': 0x0400},
               desc='Decrement SP'),

    # DAD B — 10T/1M  HL=0x0100+BC=0x0010 → HL=0x0110
    TimingCase(32, 'dad_b',    0x09, 10, 1,
               [0x00, 0x09, 0x76],
               SIG_STD, '16x', 40,
               setup_regs={'h': 0x01, 'l': 0x00, 'b': 0x00, 'c': 0x10},
               desc='Add BC to HL'),

    # DAD D — 10T/1M  HL=0x0100+DE=0x0020 → HL=0x0120
    TimingCase(33, 'dad_d',    0x19, 10, 1,
               [0x00, 0x19, 0x76],
               SIG_STD, '16x', 40,
               setup_regs={'h': 0x01, 'l': 0x00, 'd': 0x00, 'e': 0x20},
               desc='Add DE to HL'),

    # DAD SP — 10T/1M  HL=0x0100+SP=0x0010 → HL=0x0110
    TimingCase(34, 'dad_sp',   0x39, 10, 1,
               [0x00, 0x39, 0x76],
               SIG_STD, '16x', 40,
               setup_regs={'h': 0x01, 'l': 0x00, 'sp': 0x0010},
               desc='Add SP to HL'),
]

# ── Phase E — T10M3: LXI / JMP / RET / POP ──────────────────────────────────
_E: list[TimingCase] = [
    # LXI B,$1234 — 10T/3M
    TimingCase(35, 'lxi_b_1234', 0x01, 10, 3,
               [0x00, 0x01, 0x34, 0x12, 0x76],
               SIG_STD, '16x', 40,
               desc='Load Immediate $1234 to BC'),

    # LXI H,$0350 — 10T/3M
    TimingCase(36, 'lxi_h_0350', 0x21, 10, 3,
               [0x00, 0x21, 0x50, 0x03, 0x76],
               SIG_STD, '16x', 40,
               desc='Load Immediate $0350 to HL'),

    # LXI SP,$0400 — 10T/3M
    TimingCase(37, 'lxi_sp_0400', 0x31, 10, 3,
               [0x00, 0x31, 0x00, 0x04, 0x76],
               SIG_STD, '16x', 40,
               desc='Load Immediate $0400 to SP'),

    # JMP $0301 — 10T/3M  自分自身にジャンプ（セルフループ）
    TimingCase(38, 'jmp_0301',  0xC3, 10, 3,
               [0x00, 0xC3, 0x01, 0x03, 0x76],
               SIG_STD, '16x', 40,
               desc='Unconditional Jump'),

    # RET — 10T/3M  スタックから 0x0308 を取り出して戻る
    TimingCase(39, 'ret',       0xC9, 10, 3,
               [0x00, 0xC9, 0x76],
               SIG_STD_MEM, '16x', 40,
               setup_regs={'sp': 0x0400},
               setup_mem={0x0400: [0x08, 0x03], 0x0308: [0x76]},
               desc='Return from Subroutine'),

    # POP B — 10T/3M  スタックから BC を取り出す
    TimingCase(40, 'pop_b',     0xC1, 10, 3,
               [0x00, 0xC1, 0x76],
               SIG_STD_MEM, '16x', 40,
               setup_regs={'sp': 0x03FE},
               setup_mem={0x03FE: [0x34, 0x12]},
               desc='Pop BC from Stack'),
]

# ── Phase F — T10M3_mem: INR M / DCR M ───────────────────────────────────────
_F: list[TimingCase] = [
    # INR M — 10T/3M  (HL=0x0350): 0x00 → 0x01
    TimingCase(41, 'inr_m',     0x34, 10, 3,
               [0x00, 0x34, 0x76],
               SIG_STD_MEM, '16x', 40,
               setup_regs={'h': 0x03, 'l': 0x50},
               setup_mem={0x0350: [0x00]},
               desc='Increment Memory (HL)'),

    # DCR M — 10T/3M  (HL=0x0350): 0x01 → 0x00
    TimingCase(42, 'dcr_m',     0x35, 10, 3,
               [0x00, 0x35, 0x76],
               SIG_STD_MEM, '16x', 40,
               setup_regs={'h': 0x03, 'l': 0x50},
               setup_mem={0x0350: [0x01]},
               desc='Decrement Memory (HL)'),
]

# ── Phase G — T11M3: PUSH / RST / Ccc 不成立 ─────────────────────────────────
_G: list[TimingCase] = [
    # PUSH B — 11T/3M
    TimingCase(43, 'push_b',    0xC5, 11, 3,
               [0x00, 0xC5, 0x76],
               SIG_STD_MEM, '16x', 42,
               setup_regs={'b': 0x12, 'c': 0x34, 'sp': 0x0400},
               desc='Push BC onto Stack'),

    # PUSH PSW — 11T/3M  A と F レジスタをプッシュ
    TimingCase(44, 'push_psw',  0xF5, 11, 3,
               [0x00, 0xF5, 0x76],
               SIG_STD_MEM, '16x', 42,
               setup_regs={'a': 0xAB, 'sp': 0x0400},
               desc='Push AF (PSW) onto Stack'),

    # RST 0 — 11T/3M  0x0000 に HLT
    TimingCase(45, 'rst_0',     0xC7, 11, 3,
               [0x00, 0xC7, 0x76],
               SIG_STD_MEM, '16x', 42,
               setup_regs={'sp': 0x0400},
               setup_mem={0x0000: [0x76]},
               desc='Restart: Call $0000'),

    # RST 7 — 11T/3M  0x0038 に HLT
    TimingCase(46, 'rst_7',     0xFF, 11, 3,
               [0x00, 0xFF, 0x76],
               SIG_STD_MEM, '16x', 42,
               setup_regs={'sp': 0x0400},
               setup_mem={0x0038: [0x76]},
               desc='Restart: Call $0038'),

    # CNZ 不成立 — 11T/3M  XRA A → Z=1; CNZ 条件(Z=0)不成立
    # code: NOP, XRA A, CNZ $0308, HLT@$0305
    TimingCase(47, 'cnz_nt',    0xC4, 11, 3,
               [0x00, 0xAF, 0xC4, 0x08, 0x03, 0x76],
               SIG_STD, '16x', 42,
               setup_regs={'sp': 0x0400},
               desc='Call if Not Zero (not taken, Z=1)'),

    # CNC 不成立 — 11T/3M  STC → CY=1; CNC 条件(CY=0)不成立
    # code: NOP, STC, CNC $0308, HLT@$0305
    TimingCase(48, 'cnc_nt',    0xD4, 11, 3,
               [0x00, 0x37, 0xD4, 0x08, 0x03, 0x76],
               SIG_STD, '16x', 42,
               setup_regs={'sp': 0x0400},
               desc='Call if No Carry (not taken, CY=1)'),
]

# ── Phase H — T13M4: STA / LDA ───────────────────────────────────────────────
_H: list[TimingCase] = [
    # STA $0350 — 13T/4M  A=0xAB を書く
    TimingCase(49, 'sta_0350',  0x32, 13, 4,
               [0x00, 0x32, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '16x', 46,
               setup_regs={'a': 0xAB},
               desc='Store A to $0350'),

    # LDA $0350 — 13T/4M  0xCD を A に読む
    TimingCase(50, 'lda_0350',  0x3A, 13, 4,
               [0x00, 0x3A, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '16x', 46,
               setup_mem={0x0350: [0xCD]},
               desc='Load A from $0350'),
]

# ── Phase I — T16M5: SHLD / LHLD (8x 必須) ───────────────────────────────────
_I: list[TimingCase] = [
    # SHLD $0350 — 16T/5M  HL を書く
    TimingCase(51, 'shld_0350', 0x22, 16, 5,
               [0x00, 0x22, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '8x', 52,
               setup_regs={'h': 0x12, 'l': 0x34},
               desc='Store HL to $0350'),

    # LHLD $0350 — 16T/5M  HL に読む
    TimingCase(52, 'lhld_0350', 0x2A, 16, 5,
               [0x00, 0x2A, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '8x', 52,
               setup_mem={0x0350: [0x34, 0x12]},
               desc='Load HL from $0350'),
]

# ── Phase J — T17M5: CALL / Ccc 成立 (8x 必須) ───────────────────────────────
_J: list[TimingCase] = [
    # CALL $0350 — 17T/5M  0x0350 に HLT
    TimingCase(53, 'call_0350', 0xCD, 17, 5,
               [0x00, 0xCD, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '8x', 54,
               setup_regs={'sp': 0x0400},
               setup_mem={0x0350: [0x76]},
               desc='Call $0350'),

    # CNZ 成立 — 17T/5M  MVI A,1 → Z=0; CNZ 条件(Z=0)成立
    # code: NOP, MVI A,1, CNZ $0350, HLT
    TimingCase(54, 'cnz_taken', 0xC4, 17, 5,
               [0x00, 0x3E, 0x01, 0xC4, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '8x', 54,
               setup_regs={'sp': 0x0400},
               setup_mem={0x0350: [0x76]},
               desc='Call if Not Zero (taken, Z=0)'),

    # CZ 成立 — 17T/5M  XRA A → Z=1; CZ 条件(Z=1)成立
    # code: NOP, XRA A, CZ $0350, HLT
    TimingCase(55, 'cz_taken',  0xCC, 17, 5,
               [0x00, 0xAF, 0xCC, 0x50, 0x03, 0x76],
               SIG_STD_MEM, '8x', 54,
               setup_regs={'sp': 0x0400},
               setup_mem={0x0350: [0x76]},
               desc='Call if Zero (taken, Z=1)'),
]

# ── Phase K — T18M5: XTHL (8x 必須) ─────────────────────────────────────────
_K: list[TimingCase] = [
    # XTHL — 18T/5M  HL=0x1234, (SP)=0x5678 → HL=0x5678
    TimingCase(56, 'xthl',      0xE3, 18, 5,
               [0x00, 0xE3, 0x76],
               SIG_STD_MEM, '8x', 56,
               setup_regs={'h': 0x12, 'l': 0x34, 'sp': 0x03FE},
               setup_mem={0x03FE: [0x78, 0x56]},
               desc='Exchange HL with Top of Stack'),
]

# ── Phase L — Jcc: 10T/3M (taken / not-taken) ────────────────────────────────
# Intel 8080: Jcc は成立・不成立とも常に 10T/3M（アドレスバイトは常に読む）
_L: list[TimingCase] = [
    # JNZ 成立 — MVI A,1 → Z=0; JNZ $0306 → taken
    # code: NOP, MVI A,1, JNZ $0306, HLT@$0305, HLT@$0306
    TimingCase(57, 'jnz_taken', 0xC2, 10, 3,
               [0x00, 0x3E, 0x01, 0xC2, 0x06, 0x03, 0x76, 0x76],
               SIG_STD, '16x', 40,
               desc='Jump if Not Zero (taken, Z=0)'),

    # JNZ 不成立 — XRA A → Z=1; JNZ $0306 → not taken → 次の HLT へ
    # code: NOP, XRA A, JNZ $0306, HLT@$0305, HLT@$0306
    TimingCase(58, 'jnz_nt',    0xC2, 10, 3,
               [0x00, 0xAF, 0xC2, 0x06, 0x03, 0x76, 0x76],
               SIG_STD, '16x', 40,
               desc='Jump if Not Zero (not taken, Z=1)'),

    # JZ 成立 — XRA A → Z=1; JZ $0306 → taken
    TimingCase(59, 'jz_taken',  0xCA, 10, 3,
               [0x00, 0xAF, 0xCA, 0x06, 0x03, 0x76, 0x76],
               SIG_STD, '16x', 40,
               desc='Jump if Zero (taken, Z=1)'),

    # JC 成立 — STC → CY=1; JC $0306 → taken
    TimingCase(60, 'jc_taken',  0xDA, 10, 3,
               [0x00, 0x37, 0xDA, 0x06, 0x03, 0x76, 0x76],
               SIG_STD, '16x', 40,
               desc='Jump if Carry (taken, CY=1)'),

    # JP 成立 — MVI A,$7F → S=0; JP $0307 → taken
    TimingCase(61, 'jp_taken',  0xF2, 10, 3,
               [0x00, 0x3E, 0x7F, 0xF2, 0x07, 0x03, 0x76, 0x76],
               SIG_STD, '16x', 40,
               desc='Jump if Plus (taken, S=0)'),

    # JM 成立 — MVI A,$80 → S=1; JM $0307 → taken
    TimingCase(62, 'jm_taken',  0xFA, 10, 3,
               [0x00, 0x3E, 0x80, 0xFA, 0x07, 0x03, 0x76, 0x76],
               SIG_STD, '16x', 40,
               desc='Jump if Minus (taken, S=1)'),
]

# ── Phase M — Rcc 不成立: T5M1 ───────────────────────────────────────────────
_M: list[TimingCase] = [
    # RNZ 不成立 — XRA A → Z=1; RNZ 条件(Z=0)不成立 → 5T/1M
    TimingCase(63, 'rnz_nt',    0xC0, 5, 1,
               [0x00, 0xAF, 0xC0, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'sp': 0x0400},
               desc='Return if Not Zero (not taken, Z=1)'),

    # RZ 不成立 — MVI A,1 → Z=0; RZ 条件(Z=1)不成立 → 5T/1M
    TimingCase(64, 'rz_nt',     0xC8, 5, 1,
               [0x00, 0x3E, 0x01, 0xC8, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'sp': 0x0400},
               desc='Return if Zero (not taken, Z=0)'),

    # RNC 不成立 — STC → CY=1; RNC 条件(CY=0)不成立 → 5T/1M
    TimingCase(65, 'rnc_nt',    0xD0, 5, 1,
               [0x00, 0x37, 0xD0, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'sp': 0x0400},
               desc='Return if No Carry (not taken, CY=1)'),

    # RC 不成立 — XRA A → CY=0; RC 条件(CY=1)不成立 → 5T/1M
    TimingCase(66, 'rc_nt',     0xD8, 5, 1,
               [0x00, 0xAF, 0xD8, 0x76],
               SIG_STD, '16x', 30,
               setup_regs={'sp': 0x0400},
               desc='Return if Carry (not taken, CY=0)'),
]

# ── Phase N — T10M3: IN / OUT ─────────────────────────────────────────────────
_N: list[TimingCase] = [
    # OUT port=01h — 10T/3M  A=0xAB を port 1 に出力
    TimingCase(67, 'out_port01', 0xD3, 10, 3,
               [0x00, 0xD3, 0x01, 0x76],
               SIG_STD_IO, '16x', 40,
               setup_regs={'a': 0xAB},
               desc='Output A to Port $01'),

    # IN port=01h — 10T/3M  port 1 から A に入力
    TimingCase(68, 'in_port01',  0xDB, 10, 3,
               [0x00, 0xDB, 0x01, 0x76],
               SIG_STD_IO, '16x', 40,
               desc='Input from Port $01 to A'),

    # OUT port=FFh — 10T/3M  A=0xFF を port $FF に出力
    TimingCase(69, 'out_portff', 0xD3, 10, 3,
               [0x00, 0xD3, 0xFF, 0x76],
               SIG_STD_IO, '16x', 40,
               setup_regs={'a': 0xFF},
               desc='Output A to Port $FF'),
]

# ── Phase O — HLT: 特殊 (T4M1 + HALT サイクル繰り返し) ─────────────────────
_O: list[TimingCase] = [
    # HLT — 4T/1M  M1 フェッチ後に HALT バスサイクルが繰り返す
    TimingCase(70, 'hlt',       0x76, 4, 1,
               [0x00, 0x76],
               SIG_STD, '16x', 28,
               desc='Halt — CPU Waits for Interrupt'),
]

# ── Phase P — T7M2: STAX / LDAX ──────────────────────────────────────────────
_P: list[TimingCase] = [
    # STAX B — 7T/2M  A=0xAB を (BC=0x0360) に書く
    TimingCase(71, 'stax_b',    0x02, 7, 2,
               [0x00, 0x02, 0x76],
               SIG_STD_MEM, '16x', 34,
               setup_regs={'a': 0xAB, 'b': 0x03, 'c': 0x60},
               desc='Store A to Address in BC'),

    # LDAX D — 7T/2M  (DE=0x0370) から A に読む
    TimingCase(72, 'ldax_d',    0x1A, 7, 2,
               [0x00, 0x1A, 0x76],
               SIG_STD_MEM, '16x', 34,
               setup_regs={'d': 0x03, 'e': 0x70},
               setup_mem={0x0370: [0xCD]},
               desc='Load A from Address in DE'),
]

# ── 全ケースリスト ────────────────────────────────────────────────────────────
TIMING_CASES: list[TimingCase] = (
    _A + _B + _C + _D + _E + _F + _G + _H + _I + _J + _K + _L + _M + _N + _O + _P
)
assert len(TIMING_CASES) == 73, f"期待 73 ケース、実際 {len(TIMING_CASES)} ケース"


# ── フィクスチャ ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def loaded_page(browser, base_url: str) -> Page:
    """モジュールスコープ: WASM 起動済みページ（73 ケース共有）。"""
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(base_url)
    page.wait_for_function("workerReady === true", timeout=30_000)
    page.wait_for_function(
        "window._sftTerm !== null && window._sftTerm !== undefined",
        timeout=10_000,
    )
    yield page
    ctx.close()


@pytest.fixture(scope="module")
def sim(loaded_page: Page) -> SimAPI:
    return SimAPI(loaded_page)


# ── テスト実行ヘルパー ─────────────────────────────────────────────────────────

def _run_case(sim: SimAPI, tc: TimingCase) -> None:
    """1 ケースを実行してスクリーンショットを保存する。

    実行フロー:
    1. CP/M をリセットして BIOS CONIN ループに入るまで待つ
    2. step_instr() で次の命令境界（M1 T1）まで正確に前進
    3. その時点の PC (bios_pc) を読み取り、そこに JMP 0x0300 を書き込む
       → CPU は M1 T2 でオペコード 0xC3 を読んで 0x0300 にジャンプする
    4. CONIN ループ入口 0xF2DC にも JMP 0x0300 を書き込む（保険）
       → bios_pc が CONIN ループ外（例: 0xF2E2）の場合でも
         CPU が次に 0xF2DC を通過したとき 0x0300 へ到達できる
    5. 0x0300 にテストコードを配置してトリガーを設定
    6. run() で再開 → JMP → テスト命令 → トリガー発火
    """
    # 1. CP/M リセット（running:true で起動 → BIOS CONIN ループへ）
    sim.reset()
    time.sleep(0.5)

    # 2. 停止して命令境界まで前進
    #    pause() 直後は任意の T ステートで止まっている。
    #    step_instr() が次の M1 SYNC 立ち上がりエッジまで正確に進める。
    #    戻り時: ring_frozen=true、CPU は bios_pc の M1 T1 で停止。
    sim.pause()
    time.sleep(0.1)
    sim.step_instr()
    time.sleep(0.1)   # Worker が step_instr() を完了するまで待つ

    # 3. 現在の PC を読み取る（JMP の書き込み先 = bios_pc）
    regs = sim.await_get_regs()
    bios_pc: int = regs['pc']

    # 4. bios_pc に JMP 0x0300 を植える
    #    CPU は M1 T1 で止まっており、T2 でこの 0xC3 を読んで JMP を解釈する。
    #    sim_poke() は C++ RAM と Verilator RTL RAM の両方を更新するため即時有効。
    sim.write_mem(bios_pc, [0xC3, 0x00, 0x03])   # JMP 0x0300

    # 4a. CONIN ループ入口にも JMP 0x0300 を植える（保険）
    #     step_instr() が CONIN ループ外のアドレス（例: 0xF2E2）を返した場合、
    #     bios_pc への JMP 書き込みが効かないことがある。
    #     その場合でも CPU が次に CONIN ループ入口 0xF2DC を通過したとき
    #     0x0300 へリダイレクトされることを保証する。
    sim.write_mem(0xF2DC, [0xC3, 0x00, 0x03])   # JMP 0x0300 at CONIN loop entry

    # 5. レジスタ設定（F は set_regs 不可 → code 内の命令で設定）
    if tc.setup_regs:
        sim.set_regs(**tc.setup_regs)

    # 6. テストコードを 0x0300 に書き込む
    sim.write_mem(0x0300, tc.code)

    # 7. 追加メモリ設定（オペランド・スタック・割り込みベクタ等）
    for addr, data in tc.setup_mem.items():
        sim.write_mem(addr, data)

    # 8. トリガー設定（テスト命令の M1 フェッチで発火）
    #    clear_trigger() → reset_trigger_state() により ring_frozen も解除される。
    sim.clear_trigger()
    sim.set_trigger(type='instr', opc=tc.opc)
    sim.set_post_delay(tc.post_delay)

    # 9. シミュレーション再開
    #    CPU は bios_pc の M1 T1 → JMP 0x0300 を解釈 → 0x0300 へジャンプ
    #    → NOP (pre-context) → テスト命令 → トリガー発火
    sim.run()

    # 10. トリガー発火待ち（la._trigHead が更新されるのを 30 秒間ポーリング）
    sim.await_wait_trigger(30_000)

    # 11. 停止・安定待ち（post_delay 分の ring buffer 収集が完了するまで）
    sim.pause()
    time.sleep(0.15)

    # 12. LA 表示設定（全レジスタ + 命令固有信号）
    sim.show_signals(*tc.signals)
    sim.set_zoom(tc.zoom)
    time.sleep(0.2)
    sim.goto_trigger()
    time.sleep(0.3)   # RAF 更新を待つ

    # 13. スクリーンショット保存（タイトルバー付き）
    _SS_DIR.mkdir(parents=True, exist_ok=True)
    sim.screenshot_canvas_to_file(
        _SS_DIR / tc.filename,
        title=tc.title,
    )


# ── パラメータ化テスト ─────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "tc",
    TIMING_CASES,
    ids=[f"{tc.seq:02d}_{tc.mnemonic}" for tc in TIMING_CASES],
)
def test_timing_screenshot(sim: SimAPI, tc: TimingCase) -> None:
    """1 命令のタイミング図スクリーンショットを撮る。"""
    _run_case(sim, tc)

    # トリガー発火確認（サニティチェック）
    assert sim.trig_fired, (
        f"[{tc.seq:02d} {tc.mnemonic}] トリガーが発火しなかった"
    )
    assert sim.trig_head >= 0, (
        f"[{tc.seq:02d} {tc.mnemonic}] trig_head が -1"
    )
