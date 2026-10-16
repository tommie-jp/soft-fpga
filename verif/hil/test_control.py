"""Apple-1 の実行制御コマンド (Ctrl-] の後の 1 文字) に対する HIL テスト (apple1 ファームウェア)。

    n  次の命令だけ進めて止まる（ステップ実行）
    g  実速に戻す
    c  固定クロック 10 kHz
    i  ビルド情報 (+XI)
    b  実効クロックの実測値 (+XB)
"""
from __future__ import annotations

import time

FIRMWARE = "apple1"

ESC = b"\x1d"  # Ctrl-]


def command(dut, letter: str) -> None:
    dut.write(ESC + letter.encode("ascii"))


def test_step_mode_holds_output_until_go(apple1, expect):
    """ステップ中は CPU が止まるので、打ったキーは表示されない。g で実速に戻ると出る。"""
    command(apple1, "n")
    time.sleep(0.3)  # 1 命令だけ進んで止まるのを待つ
    apple1.reset_input_buffer()

    apple1.write(b"A")
    time.sleep(0.5)
    held = apple1.read(apple1.in_waiting or 0)
    assert held == b"", f"ステップ中なのに出力があった: {held!r}"

    command(apple1, "g")
    apple1.write(b"\r")
    line = expect(apple1, r"^A$", timeout=5.0)
    assert line == "A"


def test_fixed_clock_still_echoes_keys(apple1, expect):
    """固定クロック (10 kHz) でも入力が処理され、実速より遅いだけで動く。"""
    command(apple1, "c")
    apple1.write(b"A\r")
    line = expect(apple1, r"^A$", timeout=10.0)
    assert line == "A"
    command(apple1, "g")


def test_unknown_command_is_reported(apple1, expect):
    """未知のコマンドはエラー行で知らせる（Apple-1 には何も送らない）。"""
    command(apple1, "z")
    line = expect(apple1, r"^\+ERR ", timeout=5.0)
    assert "0x7A" in line, f"コマンド番号が出ていない: {line!r}"


def test_id_reports_build_info(apple1, expect):
    """i でビルド情報（プラットフォームと git hash）が読める。"""
    command(apple1, "i")
    line = expect(apple1, r"^\+XI ", timeout=5.0)
    assert "pf=rp2350" in line, f"pf=rp2350 を期待: {line!r}"
    assert "git=" in line, f"git= を期待: {line!r}"


def test_bench_reports_effective_clock(apple1, expect):
    """b で実効クロックが出る。実速で少し回してから問い合わせる。"""
    time.sleep(1.0)
    command(apple1, "b")
    line = expect(apple1, r"^\+XB ", timeout=5.0)
    assert "clk=" in line and "MHz" in line, f"clk=...MHz を期待: {line!r}"
