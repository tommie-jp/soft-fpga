"""pdp11asm.py — Minimal PDP-11 assembler (Unix V6 as 構文サブセット)

対応構文:
  . = <octal_addr>      ロケーションカウンタ設定
  <label>:              ラベル定義（named と 1: などのローカルラベル）
  <octal_word>          生ワード値の直接埋め込み（データ領域）
  nop / halt            特殊命令
  clr/com/inc/dec/neg/adc/sbc/tst/ror/rol/asr/asl/sxt/swab/mfps/mtps  単項
  clrb/comb/incb/decb/negb/adcb/sbcb/tstb/rorb/rolb/asrb/aslb/movb/cmpb  バイト
  mov/cmp/bit/bic/bis/add/sub/xor    双項
  mul/div/ash/ashc src, Rn           EIS（乗除算・シフト）
  br/bne/beq/bge/blt/bgt/ble/bhi/blos/bcc/bcs/bvc/bvs  分岐
  jsr rN, label         サブルーチン呼び出し
  rts rN                サブルーチンリターン
  jmp (rN)              ジャンプ（間接）
  sob rN, label         デクリメントブランチ
  mov $n, rN            即値（$は 8進）

すべての数値は 8 進数（Unix V6 as 準拠）。コメントは / または ;。
"""
from __future__ import annotations

import re
from typing import NamedTuple

# ── レジスタ番号 ────────────────────────────────────────────────────────────
_REG: dict[str, int] = {
    'r0': 0, 'r1': 1, 'r2': 2, 'r3': 3, 'r4': 4, 'r5': 5,
    'sp': 6, 'r6': 6, 'pc': 7, 'r7': 7,
}

# ── オペランドエンコード ─────────────────────────────────────────────────────
def _enc_operand(s: str, pc_of_extra: int, labels: dict[str, int]) -> tuple[int, list[int]]:
    """オペランド文字列を (6bit_spec, extra_words) にエンコードする。

    pc_of_extra: このオペランドの extra word が置かれるバイトアドレス
    """
    s = s.strip()

    # レジスタ直接: r0 .. r5, sp, pc
    if s in _REG:
        return _REG[s], []

    # 即値: $n または $label（ラベルの絶対アドレスを即値として使う）
    if s.startswith('$') and '(' not in s:
        label_or_num = s[1:]
        try:
            val = int(label_or_num, 8)
        except ValueError:
            if label_or_num not in labels:
                raise ValueError(f"Undefined label in immediate: {label_or_num!r}")
            val = labels[label_or_num]
        return 0o27, [val & 0xFFFF]

    # 絶対アドレス: *$n
    if s.startswith('*$'):
        return 0o37, [int(s[2:], 8) & 0xFFFF]

    # 自動インクリメント: (rN)+
    m = re.fullmatch(r'\((\w+)\)\+', s)
    if m:
        r = _REG[m.group(1)]
        return 0o20 | r, []

    # 自動デクリメント: -(rN)
    m = re.fullmatch(r'-\((\w+)\)', s)
    if m:
        r = _REG[m.group(1)]
        return 0o40 | r, []

    # 間接: (rN)
    m = re.fullmatch(r'\((\w+)\)', s)
    if m:
        r = _REG[m.group(1)]
        return 0o10 | r, []

    # インデックス: n(rN)  ← n は 8 進
    m = re.fullmatch(r'([0-9]+)\((\w+)\)', s)
    if m:
        offset = int(m.group(1), 8)
        r = _REG[m.group(2)]
        return 0o60 | r, [offset & 0xFFFF]

    # ラベル（PC 相対）: mode 6 R7
    if s in labels:
        target = labels[s]
        # extra word が置かれた後の PC
        next_pc = pc_of_extra + 2
        offset = (target - next_pc) & 0xFFFF
        return 0o67, [offset]

    raise ValueError(f"Unknown operand: {s!r}")


# ── 命令エンコード表 ─────────────────────────────────────────────────────────
# 単項命令: (octal_base, is_byte)
_SINGLE: dict[str, tuple[int, bool]] = {
    'clr':  (0o005000, False), 'com':  (0o005100, False),
    'inc':  (0o005200, False), 'dec':  (0o005300, False),
    'neg':  (0o005400, False), 'adc':  (0o005500, False),
    'sbc':  (0o005600, False), 'tst':  (0o005700, False),
    'ror':  (0o006000, False), 'rol':  (0o006100, False),
    'asr':  (0o006200, False), 'asl':  (0o006300, False),
    'sxt':  (0o006700, False), 'swab': (0o000300, False),
    'mfps': (0o006700, False),  # alias for sxt in some docs, but actually different
    'clrb': (0o105000, True),  'comb': (0o105100, True),
    'incb': (0o105200, True),  'decb': (0o105300, True),
    'negb': (0o105400, True),  'adcb': (0o105500, True),
    'sbcb': (0o105600, True),  'tstb': (0o105700, True),
    'rorb': (0o106000, True),  'rolb': (0o106100, True),
    'asrb': (0o106200, True),  'aslb': (0o106300, True),
}
# 実際の mfps/mtps の修正（swab は別）
_SINGLE['mfps'] = (0o106700, False)  # MFPS = 106700 + dd
_SINGLE['mtps'] = (0o106400, False)  # MTPS = 106400 + ss
_SINGLE['swab'] = (0o000300, False)  # SWAB = 000300 + dd

# EIS 命令: `mnem src, Rn`  opcode base  (Rn in bits[8:6], src in bits[5:0])
_EIS: dict[str, int] = {
    'mul':  0o070000,   # MUL src, Rn  → Rn × src → Rn (hi), Rn+1 (lo)
    'div':  0o071000,   # DIV src, Rn  → Rn:Rn+1 ÷ src → Rn=商, Rn+1=余数
    'ash':  0o072000,   # ASH src, Rn  → Rn シフト (正=左, 負=右)
    'ashc': 0o073000,   # ASHC src, Rn → Rn:Rn+1 32ビットシフト
}

# 双項命令: opcode base
_DOUBLE: dict[str, int] = {
    'mov':  0o010000, 'cmp':  0o020000,
    'bit':  0o030000, 'bic':  0o040000,
    'bis':  0o050000, 'add':  0o060000,
    'sub':  0o160000, 'xor':  0o074000,
    'movb': 0o110000, 'cmpb': 0o120000,
    'bitb': 0o130000, 'bicb': 0o140000,
    'bisb': 0o150000,
}

# 分岐命令: base opcode
_BRANCH: dict[str, int] = {
    'br':   0o000400, 'bne':  0o001000, 'beq':  0o001400,
    'bge':  0o002000, 'blt':  0o002400, 'bgt':  0o003000,
    'ble':  0o003400, 'bpl':  0o100000, 'bmi':  0o100400,
    'bhi':  0o101000, 'blos': 0o101400, 'bvc':  0o102000,
    'bvs':  0o102400, 'bcc':  0o103000, 'bcs':  0o103400,
}


# ── アセンブラ本体 ────────────────────────────────────────────────────────────
class AssembledProgram(NamedTuple):
    words: dict[int, int]   # byte_addr -> 16-bit word
    start: int              # 最初の . = addr で設定されたアドレス


def assemble(source: str, default_base: int = 0o1000) -> AssembledProgram:
    """PDP-11 ソースを 2 パスでアセンブルして AssembledProgram を返す。

    Args:
        source:       Unix V6 as 構文のアセンブリソース文字列
        default_base: . = 指定がない場合のデフォルトベースアドレス（8 進）

    Returns:
        AssembledProgram(words, start)
    """
    lines = _preprocess(source)
    labels: dict[str, int] = {}
    # Pass 1: ラベルアドレスを収集
    _pass1(lines, default_base, labels)
    # Pass 2: コード生成
    words, start = _pass2(lines, default_base, labels)
    return AssembledProgram(words, start)


def words_at(prog: AssembledProgram, addr: int, count: int | None = None) -> list[int]:
    """アドレス addr から連続したワードのリストを返す（穴は 0 埋め）。"""
    if count is None:
        addrs = sorted(prog.words)
        if not addrs:
            return []
        end = max(addrs) + 2
        count = (end - addr) // 2
    return [prog.words.get(addr + i * 2, 0) for i in range(count)]


# ── 前処理（コメント除去・行正規化）────────────────────────────────────────
def _preprocess(source: str) -> list[str]:
    result = []
    for raw in source.splitlines():
        # コメント除去（/ または ; 以降）
        line = re.sub(r'[/;].*', '', raw).strip()
        if line:
            result.append(line)
    return result


# ── Pass 1: ラベル収集 ───────────────────────────────────────────────────────
def _pass1(lines: list[str], default_base: int, labels: dict[str, int]) -> None:
    loc = default_base
    local_1: list[int] = []   # '1:' ラベルのアドレスリスト

    for raw in lines:
        line = raw

        # . = addr
        m = re.match(r'\.\s*=\s*([0-7]+)', line)
        if m:
            loc = int(m.group(1), 8)
            continue

        # ラベルを全て剥がす（複数可: "done: 1: br 1b"）
        while True:
            m = re.match(r'^(\d+):\s*(.*)', line)
            if m:
                local_1.append(loc)
                line = m.group(2).strip()
                continue
            m = re.match(r'^([a-zA-Z_]\w*):\s*(.*)', line)
            if m:
                labels[m.group(1)] = loc
                line = m.group(2).strip()
                continue
            break

        if not line:
            continue

        # 命令サイズを計算（loc を進める）
        loc += _inst_size(line, labels) * 2

    # ローカルラベル '1' の代表アドレスを記録
    if local_1:
        labels['__local_1__'] = local_1[-1]  # 最後の 1: を使う（1b 解決用）


# ── Pass 2: コード生成 ───────────────────────────────────────────────────────
def _pass2(
    lines: list[str], default_base: int, labels: dict[str, int]
) -> tuple[dict[int, int], int]:
    words: dict[int, int] = {}
    loc = default_base
    start = default_base
    first = True
    local_1_addrs: list[int] = []   # '1:' のアドレス群（pass2 で実際に解決）

    def emit(w: int) -> None:
        nonlocal loc
        words[loc] = w & 0xFFFF
        loc += 2

    for raw in lines:
        line = raw

        # . = addr
        m = re.match(r'\.\s*=\s*([0-7]+)', line)
        if m:
            loc = int(m.group(1), 8)
            if first:
                start = loc
                first = False
            continue

        if first:
            start = loc
            first = False

        # ラベルを全て剥がす（複数可: "done: 1: br 1b"）
        while True:
            m = re.match(r'^(\d+):\s*(.*)', line)
            if m:
                local_1_addrs.append(loc)
                labels['__local_1_cur__'] = loc
                line = m.group(2).strip()
                continue
            m = re.match(r'^([a-zA-Z_]\w*):\s*(.*)', line)
            if m:
                labels[m.group(1)] = loc
                line = m.group(2).strip()
                continue
            break

        if not line:
            continue

        # ---- 生ワード（データ行: 8 進数のみ） ----
        if re.fullmatch(r'[0-7]+', line):
            emit(int(line, 8))
            continue

        # ---- 命令 ----
        _emit_instr(line, loc, labels, local_1_addrs, emit)

    return words, start


def _emit_instr(
    line: str,
    cur_loc: int,
    labels: dict[str, int],
    local_1_addrs: list[int],
    emit: object,  # Callable[[int], None]
) -> None:
    """1 命令をエミットする。cur_loc は命令の先頭バイトアドレス。"""
    tokens = line.split(None, 1)
    mnem = tokens[0].lower()
    rest = tokens[1].strip() if len(tokens) > 1 else ''

    # ---- NOP / HALT ----
    if mnem == 'nop':
        emit(0o000240)
        return
    if mnem == 'halt':
        emit(0o000000)
        return
    if mnem == 'wait':
        emit(0o000001)
        return
    if mnem == 'rti':
        emit(0o000002)
        return
    if mnem == 'iot':
        emit(0o000004)
        return
    if mnem == 'rtt':
        emit(0o000006)
        return
    if mnem == 'reset':
        emit(0o000005)
        return

    # ---- RTS rN ----
    if mnem == 'rts':
        r = _REG[rest.strip()]
        emit(0o000200 | r)
        return

    # ---- JMP operand ----
    if mnem == 'jmp':
        spec, extra = _enc_operand(rest, cur_loc + 2, labels)
        emit(0o000100 | spec)
        for w in extra:
            emit(w)
        return

    # ---- JSR rN, label ----
    if mnem == 'jsr':
        parts = [p.strip() for p in rest.split(',', 1)]
        r = _REG[parts[0]]
        # JSR dest: opcode + dest operand. dest = PC-relative mode6 R7
        # Opcode word: 0o004R67 where R=link reg, 67=mode6 PC
        spec, extra = _enc_operand(parts[1], cur_loc + 4, labels)
        emit((0o004000) | (r << 6) | spec)
        for w in extra:
            emit(w)
        return

    # ---- SOB rN, label ----
    if mnem == 'sob':
        parts = [p.strip() for p in rest.split(',', 1)]
        r = _REG[parts[0]]
        label = parts[1].strip()
        # 1b 解決
        if label == '1b':
            target = _resolve_1b(local_1_addrs, cur_loc)
        else:
            target = labels[label]
        # SOB: opcode=0o077, reg, 6-bit positive offset (backward)
        # PC after SOB fetch = cur_loc + 2
        # target = (cur_loc + 2) - 2*offset  =>  offset = (cur_loc + 2 - target) / 2
        offset = (cur_loc + 2 - target) // 2
        if not (1 <= offset <= 63):
            raise ValueError(f"SOB offset out of range: {offset} for {label!r}")
        emit(0o077000 | (r << 6) | offset)
        return

    # ---- 分岐命令 ----
    if mnem in _BRANCH:
        label = rest.strip()
        if label == '1b':
            target = _resolve_1b(local_1_addrs, cur_loc)
        elif label == '1f':
            target = _resolve_1f(local_1_addrs, cur_loc)
        else:
            target = labels[label]
        # PC after fetch = cur_loc + 2
        offset = (target - (cur_loc + 2)) // 2
        if not (-128 <= offset <= 127):
            raise ValueError(f"Branch offset out of range: {offset} for {label!r}")
        emit(_BRANCH[mnem] | (offset & 0xFF))
        return

    # ---- 単項命令 ----
    if mnem in _SINGLE:
        base, _ = _SINGLE[mnem]
        spec, extra = _enc_operand(rest, cur_loc + 2, labels)
        emit(base | spec)
        for w in extra:
            emit(w)
        return

    # ---- 双項命令 ----
    if mnem in _DOUBLE:
        parts = [p.strip() for p in rest.split(',', 1)]
        src_spec, src_extra = _enc_operand(parts[0], cur_loc + 2, labels)
        dst_off = cur_loc + 2 + len(src_extra) * 2
        dst_spec, dst_extra = _enc_operand(parts[1], dst_off, labels)
        emit(_DOUBLE[mnem] | (src_spec << 6) | dst_spec)
        for w in src_extra:
            emit(w)
        for w in dst_extra:
            emit(w)
        return

    # ---- EIS 命令: mul/div/ash/ashc src, Rn ----
    if mnem in _EIS:
        parts = [p.strip() for p in rest.split(',', 1)]
        src_spec, src_extra = _enc_operand(parts[0], cur_loc + 2, labels)
        r = _REG[parts[1].strip()]
        emit(_EIS[mnem] | (r << 6) | src_spec)
        for w in src_extra:
            emit(w)
        return

    raise ValueError(f"Unknown mnemonic: {mnem!r} in {line!r}")


def _inst_size(line: str, labels: dict[str, int]) -> int:
    """命令のワード数（extra words 込み）を返す。ラベルは空 dict で OK。"""
    tokens = line.split(None, 1)
    mnem = tokens[0].lower()
    rest = tokens[1].strip() if len(tokens) > 1 else ''

    if re.fullmatch(r'[0-7]+', line):
        return 1  # 生ワード

    if mnem in ('nop', 'halt', 'wait', 'rti', 'iot', 'rtt', 'reset', 'rts'):
        return 1
    if mnem == 'jmp':
        return 1 + _operand_extra_words(rest)
    if mnem == 'jsr':
        parts = rest.split(',', 1)
        return 2 + _operand_extra_words(parts[1].strip() if len(parts) > 1 else '')
    if mnem == 'sob':
        return 1
    if mnem in _BRANCH:
        return 1
    if mnem in _SINGLE:
        return 1 + _operand_extra_words(rest)
    if mnem in _DOUBLE:
        parts = [p.strip() for p in rest.split(',', 1)]
        return 1 + _operand_extra_words(parts[0]) + (
            _operand_extra_words(parts[1]) if len(parts) > 1 else 0
        )
    if mnem in _EIS:
        parts = rest.split(',', 1)
        return 1 + _operand_extra_words(parts[0].strip())
    return 1  # unknown → 1 ワードとして扱う


def _operand_extra_words(s: str) -> int:
    """オペランドが必要とする extra words 数（即値・インデックス）。"""
    s = s.strip()
    if s.startswith('$') or s.startswith('*$'):
        return 1
    if re.fullmatch(r'-?\d+\(\w+\)', s):
        return 1
    # ラベル参照（名前付き）= PC-relative → 1 extra word
    if re.fullmatch(r'[a-zA-Z_]\w*', s) and s not in _REG:
        return 1
    return 0


def _resolve_1b(addrs: list[int], cur_loc: int) -> int:
    """1b = cur_loc より前の最近の 1: を返す。"""
    candidates = [a for a in addrs if a <= cur_loc]
    if not candidates:
        raise ValueError("No '1:' label before current location")
    return candidates[-1]


def _resolve_1f(addrs: list[int], cur_loc: int) -> int:
    """1f = cur_loc より後の最近の 1: を返す。"""
    candidates = [a for a in addrs if a > cur_loc]
    if not candidates:
        raise ValueError("No '1:' label after current location")
    return candidates[0]


# ── セルフテスト ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    tests = [
        (". = 01000\nnop\n1: br 1b\n", 0o1000, [0o000240, 0o000777]),
        (". = 01000\nclr r1\n1: br 1b\n", 0o1000, [0o005001, 0o000777]),
        (". = 01000\nmov $5, r1\n1: br 1b\n", 0o1000, [0o012701, 0o000005, 0o000777]),
        (". = 01000\nmov r0, r1\n1: br 1b\n", 0o1000, [0o010001, 0o000777]),
        (". = 01000\nmov $5, r0\nmov $5, r1\ncmp r0, r1\n1: br 1b\n", 0o1000,
         [0o012700, 0o000005, 0o012701, 0o000005, 0o020001, 0o000777]),
        # Branch: bne done - BNE(0o001000) + offset 1 = 0o001001
        (""". = 01000
clr r0
bne done
nop
done: 1: br 1b
""", 0o1000, [0o005000, 0o001001, 0o000240, 0o000777]),
        # SOB with named label
        (""". = 01000
mov $2, r1
loop: sob r1, loop
1: br 1b
""", 0o1000, [0o012701, 0o000002, 0o077101, 0o000777]),
    ]

    errors = 0
    for src, base, expected in tests:
        prog = assemble(src, base)
        got = words_at(prog, base, len(expected))
        if got != expected:
            print(f"FAIL:\n  src={src.strip()!r}")
            print(f"  expected: {[oct(w) for w in expected]}")
            print(f"  got:      {[oct(w) for w in got]}")
            errors += 1
        else:
            print(f"OK: {[oct(w) for w in got]}")

    if errors == 0:
        print(f"\nAll {len(tests)} tests passed.")
    else:
        print(f"\n{errors} test(s) FAILED.")
