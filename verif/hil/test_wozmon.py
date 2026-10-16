"""Apple-1 の wozmon に対する HIL テスト (apple1 ファームウェア)。

Debug Probe の UART ブリッジ (または Pico の USB-CDC) 越しに、実機のコンソールから
wozmon を操作する。各テストの前に Ctrl-] r でリセットし、プロンプトから始める。
"""
from __future__ import annotations

FIRMWARE = "apple1"

# wozmon ROM の先頭 8 バイト (CLD; CLI; LDY #$7F; STY $D012; LDA #$A7)
WOZMON_HEAD = "D8 58 A0 7F 8C 12 D0 A9"


def send(dut, text: str) -> None:
    dut.write(text.encode("ascii"))


def test_reset_shows_prompt(apple1):
    """リセット後に wozmon のプロンプトが出る（apple1 フィクスチャが待って確認済み）。"""
    assert apple1.is_open


def test_examine_reads_wozmon_rom(apple1, expect):
    """FF00.FF07 で ROM の先頭 8 バイトが読める（単独アドレスは 1 バイトだけ表示される）。"""
    send(apple1, "FF00.FF07\r")
    line = expect(apple1, r"^FF00: ", timeout=5.0)
    assert line == f"FF00: {WOZMON_HEAD}", f"ROM の内容が違う: {line!r}"


def test_write_then_read_back_memory(apple1, expect):
    """300 番地に書いた 5 バイトを範囲指定で読み戻せる。"""
    send(apple1, "300: A9 55 8D 00 03\r")
    send(apple1, "300.304\r")
    # 書き込み直後に wozmon が直前の内容 ("0300: 00") を 1 行出すので、A9 で始まる行を待つ。
    line = expect(apple1, r"^0300: A9", timeout=5.0)
    assert line == "0300: A9 55 8D 00 03", f"書いた内容と違う: {line!r}"


def test_run_program_stores_value(apple1, expect):
    """LDA #$55 / STA $0400 / JMP $FF1F を R で実行し、0400 に 55 が書かれる。"""
    send(apple1, "300: A9 55 8D 00 04 4C 1F FF\r")
    send(apple1, "300R\r")
    send(apple1, "400\r")
    line = expect(apple1, r"^0400: ", timeout=5.0)
    assert line == "0400: 55", f"実行結果が違う: {line!r}"
