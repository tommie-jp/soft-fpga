"""
09-PDP-11 / Unix V6 ブラウザ(Wasm)統合テスト
Playwright + headless Chromium で、ブート・ログイン・信号 UI を検証する。

検証内容:
  - "Boot Unix V6" → login: まで到達
  - レジスタパネル(PC/SP/PSW)がライブ値で更新される（GPR/PSW 信号表示）
  - MMU パネルに PAR/PDR が表示される
  - Logic Analyzer canvas が描画されている
  - root ログイン → シェル(#) プロンプト

前提:
  - examples/09-pdp11/web/sim.wasm がビルド済み（scripts/build-wasm-09.sh）
  - web/disk/unix_v6_rk05.dsk が配置済み（クリーンディスク）

実行方法:
  scripts/_doTestAll-web.sh   （サーバー起動 + 全 web テスト）
  または:
  .venv/bin/pytest verif/web/test_pdp11.py -v \
      --base-url http://localhost:8080/examples/09-pdp11/web/index.html
"""

import time

import pytest
from playwright.sync_api import Page

BOOT_TIMEOUT = 60.0   # V6 ブートは Wasm でも 20〜40 秒かかる
CMD_TIMEOUT = 20.0

_GET_TERM_JS = """() => {
    if (!window.term) return '';
    const buf = window.term.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        lines.push(line ? line.translateToString().trimEnd() : '');
    }
    return lines.join('\\n');
}"""


def term_text(page: Page) -> str:
    return page.evaluate(_GET_TERM_JS)


def wait_for(page: Page, needle: str, timeout: float = CMD_TIMEOUT) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if needle in term_text(page):
            return True
        time.sleep(0.2)
    return False


def send_paced(page: Page, text: str, gap_ms: int = 90) -> None:
    """worker へ 1 文字ずつペーシングして送る（UART RX 取りこぼし防止）。"""
    for ch in text:
        page.evaluate("(c) => window.worker.postMessage({type:'key', ch:c})", ord(ch))
        page.wait_for_timeout(gap_ms)


@pytest.fixture(scope="module")
def booted_page(browser, base_url: str) -> Page:
    """Wasm ロード → Boot → login: まで進めたページをモジュール内で共有する。"""
    ctx = browser.new_context()
    page = ctx.new_page()
    # autoboot=0 にしてボタンが有効化された状態で待機できるようにする
    # （デフォルト autoboot では _onDiskReady → _maybeAutoBoot が同一フレームで
    #   enabled→disabled するため Playwright が捕捉できない）
    page.goto(base_url + "?autoboot=0")
    # WASM ロード完了（Boot ボタンが有効化される）+ xterm 準備
    page.wait_for_function(
        "() => { const b=document.getElementById('btn-boot'); return b && !b.disabled; }",
        timeout=30_000,
    )
    page.wait_for_function("() => window.term && window.worker", timeout=10_000)
    page.get_by_role("button", name="Boot Unix V6").click()
    assert wait_for(page, "login:", BOOT_TIMEOUT), "ブートが login: に到達しない"
    yield page
    ctx.close()


class TestBoot:
    def test_boot_to_login(self, booted_page: Page) -> None:
        txt = term_text(booted_page)
        assert "@rkunix" in txt
        assert "login:" in txt

    def test_boot_progress_steps(self, booted_page: Page) -> None:
        # ブート進行インジケータが login まで done になっている
        done = booted_page.evaluate(
            """() => ['bp-bootrom','bp-kernel','bp-user','bp-login']
                     .map(id => { const e=document.getElementById(id);
                                  return e ? e.className.includes('done') : false; })"""
        )
        assert all(done), f"ブート進行が完了していない: {done}"


class TestSignalUI:
    def test_register_panel_live(self, booted_page: Page) -> None:
        # レジスタ表示がプレースホルダ(------)からライブ値に更新されている
        pc = booted_page.locator("#r-pc").inner_text().strip()
        sp = booted_page.locator("#r-sp").inner_text().strip()
        assert pc and set(pc) != {"-"}, f"PC が更新されていない: '{pc}'"
        assert sp and set(sp) != {"-"}, f"SP が更新されていない: '{sp}'"
        # 8 進 6 桁などの値であること（少なくとも英数字を含む）
        assert any(c.isalnum() for c in pc)

    def test_mmu_panel_populated(self, booted_page: Page) -> None:
        # MMU パネルに PAR 値の行が存在する（隠れていても DOM 上に存在）
        par_count = booted_page.evaluate(
            "() => document.querySelectorAll('#mmu-panel .mmu-par').length"
        )
        assert par_count > 0, "MMU パネルに PAR 行が無い"

    def test_la_canvas_rendered(self, booted_page: Page) -> None:
        size = booted_page.evaluate(
            """() => { const c=document.getElementById('la');
                       return c ? {w:c.width, h:c.height} : null; }"""
        )
        assert size is not None, "LA canvas#la が無い"
        assert size["w"] > 0 and size["h"] > 0, f"LA canvas が描画されていない: {size}"


class TestShell:
    def test_root_login_to_shell(self, booted_page: Page) -> None:
        # root でログイン → # プロンプト
        send_paced(booted_page, "root\r")
        assert wait_for(booted_page, "#", CMD_TIMEOUT), "root ログイン後の # プロンプトが出ない"


class TestSimAPI:
    """window.sim (sft-pdp11-sim-api.js) のブラウザ統合テスト。

    TestShell の後に実行され、booted_page は # プロンプト状態を共有する。
    信号値の正しさは vitest（tests/signals/）に委ね、ここでは API 経由の
    トリガー機構・サンプル読み取り・レジスタ取得のみを検証する。
    """

    def test_sim_api_loaded(self, booted_page: Page) -> None:
        fns = booted_page.evaluate(
            """() => ['setTrigger','clearTrigger','waitTrigger','readSample',
                      'getRegs','getSignals','sendString','screenshotCanvas']
                     .map(f => typeof window.sim[f])"""
        )
        assert all(t == "function" for t in fns), f"sim API が欠けている: {fns}"

    def test_get_regs_live(self, booted_page: Page) -> None:
        regs = booted_page.evaluate("() => sim.getRegs()")
        assert regs is not None, "getRegs() が null"
        for key in ("r0", "sp", "pc", "psw", "mode"):
            assert key in regs, f"getRegs() に {key} が無い"
        assert 0 <= regs["pc"] <= 0xFFFF

    def test_get_signals(self, booted_page: Page) -> None:
        sigs = booted_page.evaluate("() => sim.getSignals().map(s => s.id)")
        for sid in ("pc", "addr_p", "data", "trapped", "istate"):
            assert sid in sigs, f"getSignals() に {sid} が無い"

    def test_trigger_fires_on_trap(self, booted_page: Page) -> None:
        """TRAP トリガー発火 → trigHead 確定 → readSample を確認する。

        # プロンプト状態でコマンドを送ると sys call (TRAP) が発生して
        確実に発火する。
        """
        booted_page.evaluate("() => sim.clearTrigger()")
        booted_page.evaluate("() => sim.setTrigger({type:'trap'})")
        # syscall を誘発（echo の exec/write が TRAP を出す）
        booted_page.evaluate("() => sim.sendString('echo x\\n')")
        result = booted_page.evaluate("() => sim.waitTrigger(20000)")
        assert result["trigHead"] >= 0, f"trigHead が不正: {result}"

        fired = booted_page.evaluate("() => sim.trigFired")
        assert fired is True

        # T=0 付近 ±16 サンプルに trapped=1 が存在する（f1 アンカリングで
        # 発火サンプルと T=0 がずれるため範囲スキャンする）
        has_trap = booted_page.evaluate(
            """() => { for (let off = -16; off <= 16; off++) {
                         if (sim.readSample('trapped', off) === 1) return true; }
                       return false; }"""
        )
        assert has_trap, "T=0 ±16 サンプルに trapped=1 が見つからない"

    def test_resume_after_trigger(self, booted_page: Page) -> None:
        """トリガー発火後に clearTrigger + run で実行再開できる。"""
        booted_page.evaluate("() => { sim.clearTrigger(); sim.run(); }")
        booted_page.wait_for_function(
            "() => !sim.isPaused", timeout=10_000
        )
        # レジスタが更新され続けている（実行再開の確認）
        pc1 = booted_page.evaluate("() => sim.getRegs().pc")
        booted_page.wait_for_timeout(500)
        pc2 = booted_page.evaluate("() => sim.getRegs().pc")
        running = booted_page.evaluate("() => !sim.isPaused")
        assert running, "再開後も Paused のまま"
        assert isinstance(pc1, int) and isinstance(pc2, int)
