"""
04-6502 Apple-I ブラウザ(Wasm)統合テスト
Playwright + headless Chromium で WozMon / BASIC の動作を検証する。

WozMon コマンド仕様 (Apple-1 Woz Monitor):
  <addr>          : 1バイト読み出し → "<addr>: <byte>"
  <addr>.<end>    : 範囲ダンプ     → 複数行
  <addr>: <bytes> : バイト書き込み
  <addr>R         : アドレスから実行 (Run)

注意: コード実行テストでは BRK ベクタ($0000)ループを避けるため、
     末尾を JMP $FF00 (WozMon 復帰) にしたコードを使用する。

実行方法:
  pytest verif/web/ -v [--base-url http://localhost:8080/...]
"""

import time

import pytest
from playwright.sync_api import Page

STEP_CYCLES = 50000
BOOT_TIMEOUT = 10.0
CMD_TIMEOUT = 15.0

_GET_TERM_JS = """() => {
    if (!window._sftTerm) return '';
    const buf = window._sftTerm.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        lines.push(line ? line.translateToString().trimEnd() : '');
    }
    // 末尾の空行は除くが途中の空行は保持して term_len の基準を安定させる
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\\n');
}"""


def term_text(page: Page) -> str:
    return page.evaluate(_GET_TERM_JS)


def term_len(page: Page) -> int:
    return len(term_text(page))


def wait_for(page: Page, needle: str, timeout: float = CMD_TIMEOUT) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if needle in term_text(page):
            return True
        time.sleep(0.15)
    return False


def wait_for_new(page: Page, needle: str, prev_len: int, timeout: float = CMD_TIMEOUT) -> bool:
    """prev_len 以降に needle が現れるまで待つ。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        txt = term_text(page)
        if needle in txt[prev_len:]:
            return True
        time.sleep(0.15)
    return False


def send_cmd(page: Page, cmd: str) -> None:
    tb = page.get_by_role("textbox", name="Terminal input")
    tb.fill(cmd)
    tb.press("Enter")


def set_speed(page: Page, val: int = STEP_CYCLES) -> None:
    # .value 設定だけでは input イベントが発火しないブラウザがあるため、
    # イベントも明示的に dispatch する。ただし JS の loop() は毎フレーム
    # .value を直接読むので、実際には .value の設定だけで動作する。
    page.evaluate(
        """(v) => {
            const el = document.getElementById('speed');
            el.value = v;
            el.dispatchEvent(new Event('input'));
        }""",
        val,
    )


def reset_sim(page: Page) -> bool:
    """Reset + Run して WozMon プロンプトを待つ。"""
    page.get_by_role("button", name="Reset").click()
    time.sleep(0.3)
    page.get_by_role("button", name="Run").click()
    time.sleep(0.3)
    return wait_for(page, "\\", 10.0)


# ── フィクスチャ ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def loaded_page(browser, base_url: str) -> Page:
    """モジュール内で共有する Wasm ロード済みページ。"""
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(base_url)
    page.wait_for_function(
        "typeof Module !== 'undefined' && typeof Module._sim_init === 'function'",
        timeout=20_000,
    )
    page.wait_for_function(
        "window._sftTerm !== null && window._sftTerm !== undefined",
        timeout=10_000,
    )
    set_speed(page)
    yield page
    ctx.close()


# ── WozMon テスト: 読み出し系 ────────────────────────────────────────────────

class TestWozMonRead:
    def test_boot_prompt(self, loaded_page: Page) -> None:
        assert wait_for(loaded_page, "\\", BOOT_TIMEOUT), \
            "起動プロンプト '\\' が表示されない"

    def test_ff00_single_read(self, loaded_page: Page) -> None:
        assert wait_for(loaded_page, "\\", BOOT_TIMEOUT)
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "FF00")
        assert wait_for_new(loaded_page, "FF00: D8", prev), \
            "FF00 → FF00: D8 が出ない"

    def test_ff00_range_dump_first_line(self, loaded_page: Page) -> None:
        assert wait_for(loaded_page, "\\", BOOT_TIMEOUT)
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "FF00.FF0F")
        assert wait_for_new(loaded_page, "FF00: D8 58 A0 7F 8C 12 D0 A9", prev), \
            "FF00.FF0F → 先頭行が一致しない"

    def test_ff00_range_dump_second_line(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "FF00.FF0F")
        assert wait_for_new(loaded_page, "FF08: A7 8D 11 D0 8D 13 D0 C9", prev), \
            "FF00.FF0F → 次行が一致しない"


# ── WozMon テスト: 書き込み・読み戻し ───────────────────────────────────────

class TestWozMonWrite:
    def test_write_echo(self, loaded_page: Page) -> None:
        assert reset_sim(loaded_page), "リセット後プロンプトが出ない"
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0300: A9 55 4C 00 03")
        assert wait_for_new(loaded_page, "0300:", prev), \
            "0300: 書き込みエコーが出ない"

    def test_write_readback(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0300.0304")
        assert wait_for_new(loaded_page, "0300: A9 55 4C 00 03", prev), \
            "0300.0304 → 読み戻し値が一致しない"

    def test_overwrite_and_dump(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0300: A9 55 85 00 A9 AA 85 01 00")
        assert wait_for_new(loaded_page, "0300:", prev), \
            "上書き書き込みエコーが出ない"
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0300.0308")
        assert wait_for_new(loaded_page, "0300: A9 55 85 00 A9 AA 85 01", prev), \
            "0300.0308 → ダンプ値が一致しない"
        assert wait_for_new(loaded_page, "0308: 00", prev), \
            "0300.0308 → 0308: 00 が出ない"

    def test_zero_page_dump(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0000.00FF")
        assert wait_for_new(loaded_page, "0000: 00 00 00 00 00 00 00 00", prev), \
            "0000.00FF → 先頭行が all-zeros でない"
        assert wait_for_new(loaded_page, "00F8: 00 00 00 00 00 00 00 00", prev), \
            "0000.00FF → 末尾行が all-zeros でない"


# ── WozMon テスト: コード実行 ────────────────────────────────────────────────

class TestWozMonExec:
    def test_exec_and_return_to_wozmon(self, loaded_page: Page) -> None:
        assert reset_sim(loaded_page), "リセット後プロンプトが出ない"
        # LDA #$55, STA $00, LDA #$AA, STA $01, JMP $FF00
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0300: A9 55 85 00 A9 AA 85 01 4C 00 FF")
        wait_for_new(loaded_page, "0300:", prev, timeout=5.0)
        time.sleep(0.5)

        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0300R")
        assert wait_for_new(loaded_page, "\\", prev, timeout=10.0), \
            "0300R → JMP $FF00 で WozMon に復帰しない"

    def test_exec_zp0_result(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0000")
        assert wait_for_new(loaded_page, "0000: 55", prev), \
            "0300R 実行後 $00 = 55 でない"

    def test_exec_zp1_result(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "0001")
        assert wait_for_new(loaded_page, "0001: AA", prev), \
            "0300R 実行後 $01 = AA でない"

    def test_basic_rom_loaded(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "E000")
        assert wait_for_new(loaded_page, "E000: 4C", prev), \
            "E000 → E000: 4C (BASIC ROM ロード済み確認) が出ない"


# ── BASIC テスト ─────────────────────────────────────────────────────────────

class TestBasic:
    @pytest.fixture(autouse=True)
    def _reset_before_each(self, loaded_page: Page) -> None:
        assert reset_sim(loaded_page), "リセット後プロンプトが出ない"

    def test_basic_prompt(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "E000R")
        assert wait_for_new(loaded_page, ">", prev, CMD_TIMEOUT), \
            "E000R → BASIC プロンプト '>' が出ない"

    def test_print_arithmetic(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "E000R")
        assert wait_for_new(loaded_page, ">", prev, CMD_TIMEOUT), \
            "BASIC プロンプトが出ない"
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "PRINT 1+1")
        assert wait_for_new(loaded_page, "2", prev, 10.0), \
            "PRINT 1+1 → 2 が出ない"

    def test_for_next_loop(self, loaded_page: Page) -> None:
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "E000R")
        assert wait_for_new(loaded_page, ">", prev, CMD_TIMEOUT), \
            "BASIC プロンプトが出ない"
        prev = term_len(loaded_page)
        send_cmd(loaded_page, "FOR I=1 TO 3: PRINT I: NEXT I")
        assert wait_for_new(loaded_page, "3", prev, 15.0), \
            "FOR I=1 TO 3 → 3 が出力されない"
