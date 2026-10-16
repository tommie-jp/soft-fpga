"""Apple-1 Integer BASIC に対する HIL テスト (apple1 ファームウェア)。

wozmon から E000R で BASIC を起動し、PRINT と PEEK/POKE の結果を確認する。
"""
from __future__ import annotations

FIRMWARE = "apple1"

BASIC_BOOT_TIMEOUT = 10.0


def send(dut, text: str) -> None:
    dut.write(text.encode("ascii"))


def start_basic(dut, expect) -> None:
    """E000R で BASIC を起動する。

    BASIC のプロンプト `>` は改行で終わらないので、行単位の readline では待てない。
    wozmon が E000 を処理したこと ("E000: 4C") を確認してから次を送る。
    """
    send(dut, "E000R\r")
    expect(dut, r"^E000: 4C$", timeout=BASIC_BOOT_TIMEOUT)


def test_print_arithmetic(apple1, expect):
    """PRINT 2+2 が 4 を返す。"""
    start_basic(apple1, expect)
    send(apple1, "PRINT 2+2\r")
    line = expect(apple1, r"^4$", timeout=BASIC_BOOT_TIMEOUT)
    assert line == "4"


def test_poke_and_peek_roundtrip(apple1, expect):
    """POKE で書いた値を PEEK で読み戻せる。"""
    start_basic(apple1, expect)
    send(apple1, "POKE 3000,85\r")
    send(apple1, "PRINT PEEK(3000)\r")
    line = expect(apple1, r"^85$", timeout=BASIC_BOOT_TIMEOUT)
    assert line == "85"
