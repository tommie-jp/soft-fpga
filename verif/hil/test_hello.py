"""Phase 0 の HIL smoke test (apple1_hello ファームウェア)。

ファームウェアが起動してコンソール (UART / USB-CDC) でバイトを往復できることと、
`XI` 応答でビルド情報が読めることを確認する。

    - 送った行がそのままエコーされる
    - XI がプラットフォームと git hash を含む 1 行で応答する
    - 無入力時に余分なバイトが出てこない
"""
from __future__ import annotations

import time


def test_echo_roundtrip(dut, expect):
    """送った行がエコーで戻る。"""
    dut.reset_input_buffer()
    dut.write(b"hello\r\n")
    line = expect(dut, r"^hello$", timeout=5.0)
    assert line == "hello"


def test_xi_reports_build_info(dut, expect):
    """XI がプラットフォーム・Flash / SRAM 使用量・git hash を返す。"""
    dut.reset_input_buffer()
    dut.write(b"XI\r\n")
    line = expect(dut, r"^\+XI ", timeout=5.0)
    assert "pf=rp2350" in line, f"pf=rp2350 を期待: {line!r}"
    assert "git=" in line, f"git= を期待: {line!r}"


def test_idle_console_is_quiet(dut):
    """無入力時に不審な余分バイトが出てこない (0.5 s 採取して空)。"""
    dut.reset_input_buffer()
    time.sleep(0.5)
    leftover = dut.read(dut.in_waiting or 0)
    assert not leftover, f"アイドル時に余分なバイト: {leftover!r}"
