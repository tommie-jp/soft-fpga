#!/usr/bin/env python3
"""smoke_cpm_boot.py — CP/M シミュレーターの A> プロンプト確認スクリプト。

GitHub Pages 等のリモート URL に対して Playwright で接続し、
CP/M が正常に起動して "A>" プロンプトが表示されることを確認する。
ブラウザのコンソールエラー・ネットワーク失敗も収集して報告する。

使い方:
    python3 scripts/smoke_cpm_boot.py <url> [timeout_sec]

引数:
    url          確認対象の URL（index.html ページ）
    timeout_sec  A> 待ちのタイムアウト秒数（デフォルト: 60）

終了コード:
    0 = A> が表示され、コンソールエラーなし
    1 = タイムアウト / コンソールエラーあり / その他エラー
    2 = playwright 未インストール（スキップ扱い）
"""

import sys
import time
from dataclasses import dataclass, field

try:
    from playwright.sync_api import ConsoleMessage, Request, sync_playwright
except ImportError:
    print("ERROR: playwright がインストールされていません", file=sys.stderr)
    print("  .venv/bin/pip install playwright", file=sys.stderr)
    print("  .venv/bin/playwright install chromium", file=sys.stderr)
    sys.exit(2)

# ── 定数 ─────────────────────────────────────────────────────────────────────
DEFAULT_TIMEOUT_SEC  = 60
WORKER_READY_TIMEOUT = 60_000   # ms: WASM ダウンロード待ち
XTERM_INIT_TIMEOUT   = 15_000   # ms: xterm.js 初期化待ち
POLL_INTERVAL_SEC    = 0.5

# xterm.js バッファ全テキストを返す JS スニペット
_GET_TERM_JS = """\
() => {
    if (!window._sftTerm) return '';
    const buf = window._sftTerm.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        lines.push(line ? line.translateToString().trimEnd() : '');
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\\n');
}"""


@dataclass
class BrowserIssues:
    """ブラウザセッション中に収集したコンソールエラーとネットワーク失敗。"""
    console_errors:   list[str] = field(default_factory=list)
    network_failures: list[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return bool(self.console_errors or self.network_failures)

    def report(self) -> None:
        """収集した問題を標準出力に出力する。"""
        if not self.has_errors:
            print("  ✓ コンソールエラー: なし")
            return

        total = len(self.console_errors) + len(self.network_failures)
        print(f"  ✗ ブラウザエラー {total} 件:")
        for msg in self.network_failures:
            print(f"    [net]     {msg}")
        for msg in self.console_errors:
            print(f"    [console] {msg}")


def check_cpm_prompt(url: str, timeout_sec: int) -> tuple[bool, BrowserIssues]:
    """CP/M A> プロンプトを確認する。

    Returns:
        (prompt_ok, issues): A> が表示されたか、収集したブラウザ問題
    """
    issues = BrowserIssues()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx     = browser.new_context()
        page    = ctx.new_page()

        # ── コンソールエラー収集 ──────────────────────────────────────────
        def _on_console(msg: ConsoleMessage) -> None:
            if msg.type == "error":
                issues.console_errors.append(msg.text)

        # ── ネットワーク失敗収集（404 など）──────────────────────────────
        # net::ERR_ABORTED はブラウザが自分でキャンセルした（teardown 時など）偽陽性のため除外する。
        def _on_request_failed(req: Request) -> None:
            failure = req.failure or "unknown"
            if "ERR_ABORTED" in failure:
                return
            issues.network_failures.append(f"{req.url}  [{failure}]")

        page.on("console",       _on_console)
        page.on("requestfailed", _on_request_failed)

        try:
            page.goto(url)

            # Worker 準備完了を待つ（WASM ダウンロード込み）
            page.wait_for_function("workerReady === true",
                                   timeout=WORKER_READY_TIMEOUT)
            # xterm.js 初期化を待つ
            page.wait_for_function(
                "window._sftTerm !== null && window._sftTerm !== undefined",
                timeout=XTERM_INIT_TIMEOUT,
            )

            # A> プロンプト待ちループ
            deadline = time.monotonic() + timeout_sec
            start    = time.monotonic()
            while time.monotonic() < deadline:
                text = page.evaluate(_GET_TERM_JS)
                if "A>" in text:
                    elapsed = time.monotonic() - start
                    print(f"  ✓ A> プロンプト確認 ({elapsed:.1f}s)")
                    return True, issues
                time.sleep(POLL_INTERVAL_SEC)

            # タイムアウト
            elapsed      = time.monotonic() - start
            term_snippet = page.evaluate(_GET_TERM_JS)[-200:].replace("\n", " | ")
            print(f"  ✗ タイムアウト ({elapsed:.0f}s)", file=sys.stderr)
            print(f"    ターミナル末尾: {term_snippet!r}", file=sys.stderr)
            return False, issues

        except Exception as e:
            print(f"  エラー: {e}", file=sys.stderr)
            return False, issues
        finally:
            ctx.close()
            browser.close()


def main() -> int:
    if len(sys.argv) < 2:
        print(f"使い方: {sys.argv[0]} <url> [timeout_sec]", file=sys.stderr)
        return 1

    url         = sys.argv[1]
    timeout_sec = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_TIMEOUT_SEC

    print(f"  URL: {url}")
    print(f"  タイムアウト: {timeout_sec}s")

    prompt_ok, issues = check_cpm_prompt(url, timeout_sec)
    issues.report()

    if not prompt_ok:
        return 1
    if issues.has_errors:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
