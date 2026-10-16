"""HIL テスト用 pytest フィクスチャ。

セッション単位で Debug Probe 経由のフラッシュ書き込みを 1 回だけ実行し、
各テストには `dut` (USB-CDC `serial.Serial`) と `expect` (行マッチヘルパ) を提供する。

CLI オプション:
    --elf PATH      書き込む ELF (既定: テストモジュールの FIRMWARE 変数が指す
                    firmware/build/<FIRMWARE>.elf。未指定なら apple1_hello)
    --port PORT     USB-CDC ポート (既定: /dev/ttyACM0)
    --baud BAUD     ボーレート (既定: 115200)
    --no-flash      フラッシュをスキップして実行中ファームに対してテストする

使い方:
    pytest verif/hil
    pytest verif/hil --no-flash --port /dev/ttyACM1
"""
from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path

import pytest
import serial

REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_DIR = REPO_ROOT / "firmware" / "build"
DEFAULT_FIRMWARE = "apple1_hello"
DEFAULT_PORT = "/dev/ttyACM0"
DEFAULT_BAUD = 115200


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--elf", default=None,
                     help="書き込む ELF (既定: モジュールの FIRMWARE 変数が指す ELF)")
    parser.addoption("--port", default=DEFAULT_PORT,
                     help="USB-CDC ポート (既定: /dev/ttyACM0)")
    parser.addoption("--baud", type=int, default=DEFAULT_BAUD,
                     help="ボーレート (既定: 115200)")
    parser.addoption("--no-flash", action="store_true",
                     help="既に書き込み済みのファームに対してテストする")


# 直前に書き込んだ ELF。同じ ELF のモジュールが続くときは書き込みを省く。
_last_flashed: list[Path] = []


@pytest.fixture(scope="module")
def elf_path(request: pytest.FixtureRequest, pytestconfig: pytest.Config) -> Path:
    """モジュールの `FIRMWARE` 変数 (例: "apple1") が指す ELF。--elf で上書きできる。"""
    override = pytestconfig.getoption("--elf")
    if override:
        p = Path(override)
    else:
        name = getattr(request.module, "FIRMWARE", DEFAULT_FIRMWARE)
        p = BUILD_DIR / f"{name}.elf"
    if not p.exists():
        pytest.skip(f"ELF が見つからない: {p}\n  scripts/build-pico.sh を先に実行")
    return p


@pytest.fixture(scope="module")
def flashed_firmware(pytestconfig: pytest.Config, elf_path: Path) -> Path:
    """Debug Probe 経由でフラッシュ。直前と同じ ELF なら省く。

    実行環境を判定して docker-in-docker を回避する:
        SFA_IN_CONTAINER=1 (test-hil コンテナ内): _flash-inner.sh を直接呼ぶ
        それ以外 (WSL2 ホスト直 pytest)         : flash.sh を呼ぶ (内部で docker run)
    """
    if pytestconfig.getoption("--no-flash"):
        return elf_path
    if _last_flashed and _last_flashed[-1] == elf_path:
        return elf_path

    if os.environ.get("SFA_IN_CONTAINER") == "1":
        flash = REPO_ROOT / "scripts" / "_flash-inner.sh"
    else:
        flash = REPO_ROOT / "scripts" / "flash.sh"
    subprocess.check_call([str(flash), str(elf_path)])
    # Pico がリセット後に CDC を再列挙し、ファームが起動するまで待つ。
    time.sleep(1.5)
    _last_flashed.append(elf_path)
    return elf_path


@pytest.fixture
def dut(pytestconfig: pytest.Config, flashed_firmware: Path):
    port = pytestconfig.getoption("--port")
    baud = pytestconfig.getoption("--baud")
    # CDC が現れるまで最大 3 秒リトライ
    last_err: Exception | None = None
    for _ in range(30):
        try:
            s = serial.Serial(port, baud, timeout=2.0)
            break
        except (serial.SerialException, OSError) as e:
            last_err = e
            time.sleep(0.1)
    else:
        raise RuntimeError(
            f"USB-CDC を開けない: {port}\n"
            f"  scripts/wsl-attach.sh で attach 済みか確認してください\n"
            f"  最後のエラー: {last_err}"
        )
    s.reset_input_buffer()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def expect():
    """`expect(dut, pattern, timeout=5.0)` で正規表現マッチ行を待つ。

    マッチした最初の行 (rstrip 済みデコード文字列) を返す。
    タイムアウト時は AssertionError。
    """
    def _expect(dut: serial.Serial, pattern: str, timeout: float = 5.0) -> str:
        rx = re.compile(pattern)
        deadline = time.monotonic() + timeout
        seen: list[str] = []
        while time.monotonic() < deadline:
            raw = dut.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="replace").rstrip()
            seen.append(line)
            if rx.search(line):
                return line
        raise AssertionError(
            f"パターン {pattern!r} が {timeout}s 以内に出現しなかった\n"
            f"  受信した行: {seen[-10:]!r}"
        )
    return _expect


@pytest.fixture
def apple1(dut: serial.Serial, expect):
    """Apple-1 をリセットし、wozmon のプロンプト `\\` が出るまで待ってから返す。

    リセットは Ctrl-] r。起動直後のプロンプトは接続前に流れてしまうので、毎回リセットする。
    """
    dut.reset_input_buffer()
    dut.write(b"\x1dr")
    expect(dut, r"^\\$", timeout=5.0)
    return dut
