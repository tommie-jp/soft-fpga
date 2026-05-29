"""
06-8080 CP/M WASM ブラウザ統合テスト
Playwright + headless Chromium で以下を検証する:
  - CP/M 起動テスト (A> プロンプト)
  - 8080EX1 実行テスト (全命令テスト合格)
  - Logic Analyzer テスト (キャンバス描画・Freeze/Thaw・LA ON/OFF・ズーム)
  - WASM FS テスト (ファイル書き込み・一覧表示・テキストエディタ開閉)

実行方法:
  pytest verif/web/test_8080.py -v \\
    --base-url http://localhost:8080/examples/06-8080/web/index.html
"""

import pathlib
import time

import pytest
from playwright.sync_api import Page

from sim_api import SimAPI

# スクリーンショット保存ディレクトリ
# このファイルは verif/web/test_8080.py なので .parent.parent.parent がプロジェクトルート。
# CWD に依存しない絶対パスにすることで、どこから pytest を実行しても同じ場所に保存される。
_SS_DIR = pathlib.Path(__file__).parent.parent.parent / "test" / "ss"

# スクリーンショット時に LA へ表示する全レジスタ信号 ID（LA_SIGNALS_ALL の id 値順）
_ALL_REGS = (
    'pc', 'sp',
    'acc', 'reg_f',
    'reg_b', 'reg_c', 'reg_d', 'reg_e', 'reg_h', 'reg_l',
)

# タイムアウト定数
BOOT_TIMEOUT = 25.0    # CP/M 起動・A> 待ち (秒)
CMD_TIMEOUT = 30.0     # 通常コマンド応答 (秒)
EX1_TIMEOUT = 360.0    # 8080EX1 完了待ち (最大 6 分)

# xterm.js バッファからテキストを取り出す JS スニペット (window._sftTerm 使用)
_GET_TERM_JS = """() => {
    if (!window._sftTerm) return '';
    const buf = window._sftTerm.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        lines.push(line ? line.translateToString().trimEnd() : '');
    }
    // 末尾の空行は除く
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\\n');
}"""


# ── ヘルパー関数 ──────────────────────────────────────────────────────────────

def term_text(page: Page) -> str:
    """現在のターミナル全テキストを返す。"""
    return page.evaluate(_GET_TERM_JS)


def term_len(page: Page) -> int:
    return len(term_text(page))


def wait_for(page: Page, needle: str, timeout: float = CMD_TIMEOUT) -> bool:
    """ターミナルに needle が現れるまで待つ。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if needle in term_text(page):
            return True
        time.sleep(0.2)
    return False


def wait_for_new(page: Page, needle: str, prev_len: int,
                 timeout: float = CMD_TIMEOUT) -> bool:
    """prev_len 以降のテキストに needle が現れるまで待つ。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        txt = term_text(page)
        if needle in txt[prev_len:]:
            return True
        time.sleep(0.2)
    return False


def send_cmd(page: Page, cmd: str) -> None:
    """xterm.js の hidden textarea に cmd を入力して Enter を押す。"""
    tb = page.get_by_role("textbox", name="Terminal input")
    tb.fill(cmd)
    tb.press("Enter")


# ── フィクスチャ ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def sim(loaded_page: Page) -> SimAPI:
    """``window.sim`` の Python ラッパー。loaded_page と同じライフサイクル。"""
    return SimAPI(loaded_page)


@pytest.fixture(scope="module")
def loaded_page(browser, base_url: str) -> Page:
    """モジュール内で共有する WASM ロード済みページ。

    worker から 'ready' メッセージが届いて workerReady == true になり、
    initUI() 内で window._sftTerm が設定されるまで待つ。
    """
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(base_url)
    # Worker 準備完了を待つ
    page.wait_for_function("workerReady === true", timeout=30_000)
    # xterm.js ターミナルが初期化されるまで待つ
    page.wait_for_function(
        "window._sftTerm !== null && window._sftTerm !== undefined",
        timeout=10_000,
    )
    yield page
    ctx.close()


# ── CP/M 起動テスト ───────────────────────────────────────────────────────────

class TestCPMBoot:
    """CP/M が正常に起動して A> プロンプトが表示されることを確認する。"""

    def test_cpm_prompt(self, loaded_page: Page) -> None:
        """起動直後に CP/M プロンプト 'A>' が表示される。"""
        assert wait_for(loaded_page, "A>", BOOT_TIMEOUT), \
            "CP/M プロンプト 'A>' が表示されない"


# ── 8080EX1 実行テスト ────────────────────────────────────────────────────────

class TestCPM8080EX1:
    """WASM CP/M 上で 8080EX1 を実行して全命令テスト合格を確認する。"""

    def test_8080ex1_passes(self, loaded_page: Page) -> None:
        """8080EX1 を実行して 'Tests complete' まで正常終了し、ERROR がない。"""
        # リセットしてクリーンな A> から始める
        loaded_page.locator("#btn-reset").click()
        assert wait_for(loaded_page, "A>", BOOT_TIMEOUT), \
            "リセット後に A> プロンプトが得られない"

        prev = term_len(loaded_page)
        send_cmd(loaded_page, "8080EX1")

        # 8080EX1 は全命令をテストするため完了まで時間がかかる
        assert wait_for_new(loaded_page, "Tests complete", prev, EX1_TIMEOUT), \
            f"8080EX1: 'Tests complete' が {EX1_TIMEOUT}s 以内に表示されない"

        # 8080EX1 はテスト失敗時に "ERROR" を出力する
        new_text = term_text(loaded_page)[prev:]
        assert "ERROR" not in new_text, \
            f"8080EX1 にエラーあり:\n{new_text[:600]}"


# ── Logic Analyzer テスト ─────────────────────────────────────────────────────

class TestLogicAnalyzer:
    """Logic Analyzer の描画・操作 UI を検証する。"""

    def test_canvas_visible(self, loaded_page: Page) -> None:
        """Logic Analyzer キャンバス (#la) が表示されている。"""
        la = loaded_page.locator("#la")
        assert la.is_visible(), "#la キャンバスが見えない"

    def test_canvas_has_content(self, loaded_page: Page) -> None:
        """キャンバスに描画がある (α チャンネルが 0 でないピクセルが存在する)。"""
        # シミュレーションが動いてから描画フレームが届くまで少し待つ
        time.sleep(1.0)
        has_pixels = loaded_page.evaluate("""() => {
            var c = document.getElementById('la');
            if (!c) return false;
            var ctx = c.getContext('2d');
            var img = ctx.getImageData(0, 0, c.width, c.height);
            var d   = img.data;
            for (var i = 3; i < d.length; i += 4) {
                if (d[i] > 0) return true;
            }
            return false;
        }""")
        assert has_pixels, "Logic Analyzer キャンバスに描画されていない"

    def test_freeze_thaw_toggle(self, loaded_page: Page) -> None:
        """❄ Freeze → ▶ Thaw → ❄ Freeze とトグルする。"""
        btn = loaded_page.locator("#btn-freeze")
        initial = btn.text_content()
        assert "Freeze" in initial, \
            f"初期テキストに 'Freeze' が含まれない: {initial!r}"

        # 凍結
        btn.click()
        time.sleep(0.3)
        after_freeze = btn.text_content()
        assert "Thaw" in after_freeze, \
            f"Freeze クリック後に 'Thaw' が表示されない: {after_freeze!r}"

        # 解除 (元に戻す)
        btn.click()
        time.sleep(0.3)
        restored = btn.text_content()
        assert "Freeze" in restored, \
            f"Thaw クリック後に 'Freeze' に戻らない: {restored!r}"

    def test_la_toggle(self, loaded_page: Page) -> None:
        """LA ON → LA OFF → LA ON とトグルする。"""
        btn = loaded_page.locator("#btn-la-toggle")
        initial = btn.text_content().strip()
        assert initial == "LA ON", \
            f"初期テキストが 'LA ON' でない: {initial!r}"

        # LA OFF に切り替え
        btn.click()
        time.sleep(0.3)
        after = btn.text_content().strip()
        assert after == "LA OFF", \
            f"クリック後に 'LA OFF' にならない: {after!r}"

        # LA ON に戻す
        btn.click()
        time.sleep(0.3)
        restored = btn.text_content().strip()
        assert restored == "LA ON", \
            f"再クリック後に 'LA ON' に戻らない: {restored!r}"

    def test_zoom_selector_present(self, loaded_page: Page) -> None:
        """ズームセレクタ (#la-zoom-sel) が表示されており複数の選択肢がある。"""
        sel = loaded_page.locator("#la-zoom-sel")
        assert sel.is_visible(), "#la-zoom-sel が見えない"
        opt_count = loaded_page.evaluate(
            "document.getElementById('la-zoom-sel').options.length"
        )
        assert opt_count > 1, \
            f"ズームセレクタの選択肢が少なすぎる: {opt_count}"

    def test_freeze_and_add_all_signals(self, loaded_page: Page) -> None:
        """Freeze → ＋ボタンで全信号を追加 → #la-toggles にチップ表示 → キャンバス描画確認。

        手順:
          1. Freeze ボタンを押して波形を固定する
          2. #la-toggles 内の ＋ ボタンをクリックしてピッカーを開く
          3. ピッカーが表示されていることを確認
          4. 未選択の全信号チェックボックスを一括チェック
          5. ピッカーを閉じる
          6. #la-toggles の ON チップ数が全信号数と一致することを確認
          7. キャンバスに描画ピクセルがあることを確認
          8. Thaw して元の状態に戻す
        """
        freeze_btn = loaded_page.locator("#btn-freeze")

        # 1. Freeze（まだ Freeze 状態でなければ押す）
        btn_text = freeze_btn.text_content() or ""
        if "Freeze" in btn_text and "Thaw" not in btn_text:
            freeze_btn.click()
            time.sleep(0.3)
        assert "Thaw" in (freeze_btn.text_content() or ""), \
            "Freeze ボタンをクリックしても Thaw 表示にならない"

        # 2. #la-toggles 内の ＋ ボタンをクリックしてピッカーを開く
        add_btn = loaded_page.locator("#la-toggles button").last
        add_btn.click()
        time.sleep(0.3)

        # 3. ピッカーが表示されていることを確認
        picker = loaded_page.locator("[id='_la_picker_la-toggles']")
        assert picker.is_visible(), "＋ クリックで信号ピッカーが開かない"

        # 4. 未選択の全信号チェックボックスを一括チェック（evaluate 内で変更イベントを発火）
        added_count = loaded_page.evaluate("""() => {
            var picker = document.getElementById('_la_picker_la-toggles');
            if (!picker) return 0;
            var count = 0;
            picker.querySelectorAll('input[data-pid]').forEach(function(cb) {
                if (!cb.checked) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                    count++;
                }
            });
            return count;
        }""")
        assert added_count > 0, "追加できる信号が 1 つもない（既に全信号が ON の可能性あり）"

        # 5. ピッカーを閉じる（display:none で非表示にする）
        loaded_page.evaluate(
            "var p = document.getElementById('_la_picker_la-toggles');"
            " if (p) p.style.display = 'none';"
        )
        time.sleep(0.3)

        # 6. #la-toggles の ON チップ数が全信号数以上であることを確認
        active_count = loaded_page.evaluate(
            "document.querySelectorAll('#la-toggles .sig-tog.on').length"
        )
        total_signals = loaded_page.evaluate(
            "typeof LA_SIGNALS_ALL !== 'undefined' ? LA_SIGNALS_ALL.length : 0"
        )
        assert total_signals > 0, "LA_SIGNALS_ALL が参照できない（JS グローバルが未定義）"
        assert active_count >= total_signals, (
            f"全信号チップが #la-toggles に表示されていない: ON={active_count} / 全 {total_signals}"
        )

        # 7. キャンバスに描画ピクセルがある（alpha > 0 のピクセルを探す）
        has_pixels = loaded_page.evaluate("""() => {
            var c = document.getElementById('la');
            if (!c) return false;
            var ctx = c.getContext('2d');
            var img = ctx.getImageData(0, 0, c.width, c.height);
            var d   = img.data;
            for (var i = 3; i < d.length; i += 4) {
                if (d[i] > 0) return true;
            }
            return false;
        }""")
        assert has_pixels, "全信号追加後もキャンバスに描画ピクセルがない"

        # 8. Thaw して元の状態に戻す
        if "Thaw" in (freeze_btn.text_content() or ""):
            freeze_btn.click()
            time.sleep(0.2)

    def test_trigger_fires_on_pc(self, loaded_page: Page, sim: SimAPI) -> None:
        """PC=0300 トリガー発火 → TRIG マーカー描画をブラウザ統合テストとして確認する。

        DDT を経由せず SimAPI で直接メモリ書き込み・PC 設定を行う。
        信号値の正しさは Vitest（ring buffer テスト）に委ね、ここではトリガー機構と
        キャンバス描画のみを検証する。
        """
        # 1. MVI A,$FF (3E FF) + HLT (76) を 0x0300 に書き込む
        sim.write_mem(0x0300, [0x3E, 0xFF, 0x76])

        # 2. PC=0300 でトリガーを設定してから実行開始
        sim.set_trigger(type="reg", regId=9, value=0x0300)
        sim.set_post_delay(100)
        sim.run_from(0x0300)

        # 3. トリガー発火を待つ（内部で JS Promise を解決）
        # タイムアウトは 60s（waitTrigger の JS 既定値と一致）。トリガーは runFrom(0x0300)
        # 直後の最初の M1 フェッチで発火するため通常 1〜2 秒だが、doTest.sh フルスイートでは
        # 直前の重いビルドステップで CPU が逼迫し worker のスケジューリングが遅れることがある。
        # 余裕を持たせて環境フレーキー（30s タイムアウト超過）を防ぐ。
        sim.await_wait_trigger(60_000)
        time.sleep(0.4)   # RAF が la._lastHeapu32 を更新するまで待つ

        # 4. 全レジスタ表示・ズーム 16x・TRIG 中央に設定してスクリーンショット
        sim.show_signals(*_ALL_REGS)
        sim.set_zoom('16x')
        time.sleep(0.2)
        sim.goto_trigger()
        time.sleep(0.3)

        # 5. TRIG マーカーの確認
        assert sim.trig_fired, "sim.trig_fired が False: TRIG マーカーが描画されていない"
        assert sim.trig_head >= 0, "sim.trig_head が無効 (-1)"

        # キャンバスに赤ピクセル（TRIG バッジ色 #dc0000 相当: R≥200, G<20, B<20, A>200）
        has_trig_pixel = loaded_page.evaluate("""() => {
            var c = document.getElementById('la');
            if (!c) return false;
            var ctx = c.getContext('2d');
            var img = ctx.getImageData(0, 0, c.width, c.height);
            var d   = img.data;
            for (var i = 0; i < d.length; i += 4) {
                if (d[i] >= 200 && d[i+1] < 20 && d[i+2] < 20 && d[i+3] > 200) return true;
            }
            return false;
        }""")
        assert has_trig_pixel, "キャンバスに TRIG マーカー（赤ピクセル）が見つからない"

        # 6. スクリーンショット保存（目視確認用）
        sim.screenshot_canvas_to_file(
            _SS_DIR / "la_trig_pc0300.png",
            title="test_trigger_fires_on_pc — PC=0x0300 トリガー発火確認 [16x]",
        )


# ── CP/M DOCS ビューアテスト ──────────────────────────────────────────────────

class TestCPMDocs:
    """#docs-panel リンクから開く CP/M DOCS ビューア (#doc-modal) を検証する。

    openDoc(file) は fetch('docs/<file>') → marked.parse() → #doc-content.innerHTML
    の流れで非同期に動作する。#doc-modal は display:flex で表示される。
    """

    # テストで使用する文書（docs/ に存在し、想定される見出しテキストとセット）
    _DOC_FILE_1   = "12-CP_M-コマンドリファレンス.md"
    _DOC_LABEL_1  = "12 CP/M コマンドリファレンス"   # #docs-panel リンクテキスト
    _DOC_H1_1     = "CP/M コマンドリファレンス"       # 文書 H1 の一部

    _DOC_FILE_2   = "14-cpm-コマンド説明.md"
    _DOC_H1_2     = "cpm コマンド説明"               # 文書 H1 の一部

    def _open_doc(self, page: Page, label: str) -> None:
        """#docs-panel の指定ラベルリンクをクリックして #doc-modal が開くまで待つ。"""
        page.locator("#docs-panel").get_by_text(label, exact=False).click()
        page.locator("#doc-modal").wait_for(state="visible", timeout=8_000)

    def _wait_content(self, page: Page, needle: str, timeout: float = 8.0) -> bool:
        """#doc-content のテキストに needle が現れるまでポーリング待機する。"""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            txt = page.locator("#doc-content").inner_text()
            if needle in txt:
                return True
            time.sleep(0.2)
        return False

    def test_doc_opens_from_panel(self, loaded_page: Page) -> None:
        """#docs-panel のリンクをクリックすると #doc-modal が表示される。"""
        self._open_doc(loaded_page, self._DOC_LABEL_1)
        assert loaded_page.locator("#doc-modal").is_visible(), \
            "#doc-modal が表示されない"

    def test_doc_content_not_empty(self, loaded_page: Page) -> None:
        """#doc-content にテキストが描画されている (空でない)。"""
        # モーダルが閉じていれば再オープン
        if not loaded_page.locator("#doc-modal").is_visible():
            self._open_doc(loaded_page, self._DOC_LABEL_1)
        content_text = loaded_page.locator("#doc-content").inner_text()
        assert content_text.strip(), "#doc-content が空"

    def test_doc_content_has_expected_heading(self, loaded_page: Page) -> None:
        """表示された文書に想定の見出しテキストが含まれる。"""
        if not loaded_page.locator("#doc-modal").is_visible():
            self._open_doc(loaded_page, self._DOC_LABEL_1)
        assert self._wait_content(loaded_page, self._DOC_H1_1), \
            f"#doc-content に '{self._DOC_H1_1}' が見当たらない"

    def test_doc_select_changes_document(self, loaded_page: Page) -> None:
        """#doc-select で別の文書を選択すると #doc-content が切り替わる。"""
        if not loaded_page.locator("#doc-modal").is_visible():
            self._open_doc(loaded_page, self._DOC_LABEL_1)
        # セレクトボックスで doc 2 を選択
        loaded_page.locator("#doc-select").select_option(self._DOC_FILE_2)
        # 非同期 fetch が完了して H1 が現れるまで待つ
        assert self._wait_content(loaded_page, self._DOC_H1_2), \
            f"doc-select 変更後に '{self._DOC_H1_2}' が表示されない"

    def test_doc_close(self, loaded_page: Page) -> None:
        """✕ Close ボタンで #doc-modal が閉じる。"""
        if not loaded_page.locator("#doc-modal").is_visible():
            self._open_doc(loaded_page, self._DOC_LABEL_1)
        loaded_page.locator("#doc-close").click()
        time.sleep(0.3)
        assert not loaded_page.locator("#doc-modal").is_visible(), \
            "#doc-close クリック後も #doc-modal が閉じない"


# ── COPY / PASTE ボタンテスト ─────────────────────────────────────────────────

class TestCopyPaste:
    """ターミナル上部の COPY / PASTE ボタンを検証する。

    navigator.clipboard API はブラウザ権限が必要なため、このクラスでは
    clipboard-read / clipboard-write 権限を付与した専用 BrowserContext
    (cp_page fixture) を使用する。loaded_page とは独立したページ。
    """

    @pytest.fixture(scope="class")
    def cp_page(self, browser, base_url: str):
        """クリップボード権限付き BrowserContext で 8080 ページをロードする。"""
        ctx = browser.new_context(
            permissions=["clipboard-read", "clipboard-write"]
        )
        page = ctx.new_page()
        page.goto(base_url)
        page.wait_for_function("workerReady === true", timeout=30_000)
        page.wait_for_function(
            "window._sftTerm !== null && window._sftTerm !== undefined",
            timeout=10_000,
        )
        # A> プロンプト待ち
        deadline = time.monotonic() + BOOT_TIMEOUT
        while time.monotonic() < deadline:
            if "A>" in page.evaluate(_GET_TERM_JS):
                break
            time.sleep(0.3)
        yield page
        ctx.close()

    # ── ボタン存在確認 ──────────────────────────────────────────────────────────

    def test_copy_button_visible(self, cp_page: Page) -> None:
        """COPY ボタン (#btn-copy) が表示されている。"""
        assert cp_page.locator("#btn-copy").is_visible(), "#btn-copy が見えない"

    def test_paste_button_visible(self, cp_page: Page) -> None:
        """PASTE ボタン (#btn-paste) が表示されている。"""
        assert cp_page.locator("#btn-paste").is_visible(), "#btn-paste が見えない"

    # ── COPY テスト ─────────────────────────────────────────────────────────────

    def test_copy_puts_selection_in_clipboard(self, cp_page: Page) -> None:
        """xterm.js の選択テキストを COPY するとクリップボードに入る。"""
        # 全選択
        cp_page.evaluate("window._sftTerm.selectAll()")
        time.sleep(0.1)
        selection = cp_page.evaluate("window._sftTerm.getSelection()")
        assert selection, "xterm.js でテキストが選択されていない"

        cp_page.locator("#btn-copy").click()
        time.sleep(0.4)  # clipboard.writeText + _flashBtn が完了するのを待つ

        # クリップボードに選択テキストが入っているか確認
        clipboard_text = cp_page.evaluate("() => navigator.clipboard.readText()")
        assert clipboard_text, "COPY 後クリップボードが空"
        assert "A>" in clipboard_text, \
            f"クリップボードに 'A>' が含まれない: {clipboard_text[:120]!r}"

    def test_copy_clears_selection(self, cp_page: Page) -> None:
        """COPY 成功後に xterm.js の選択が解除される。"""
        # 選択 → COPY
        cp_page.evaluate("window._sftTerm.selectAll()")
        time.sleep(0.1)
        cp_page.locator("#btn-copy").click()
        time.sleep(0.4)

        sel_after = cp_page.evaluate("window._sftTerm.getSelection()")
        assert not sel_after, f"COPY 後も選択テキストが残っている: {sel_after!r}"

    # ── PASTE テスト ────────────────────────────────────────────────────────────

    def test_paste_sends_clipboard_to_terminal(self, cp_page: Page) -> None:
        """クリップボードのテキストを PASTE するとターミナルへ送信される。

        _doPaste() は '\\n' → '\\r' (Enter) に変換するため、
        クリップボードに 'DIR\\n' をセットすると CP/M の DIR コマンドが実行される。
        """
        assert wait_for(cp_page, "A>", BOOT_TIMEOUT), \
            "PASTE テスト前に A> プロンプトがない"

        # クリップボードに DIR + 改行をセット
        cp_page.evaluate("() => navigator.clipboard.writeText('DIR\\n')")
        time.sleep(0.1)

        prev = term_len(cp_page)
        cp_page.locator("#btn-paste").click()

        # _doPaste が DIR\r を送信 → CP/M DIR コマンドが実行される
        # ディスクに .COM ファイルが存在するのでファイル名が出る
        assert wait_for_new(cp_page, "COM", prev, CMD_TIMEOUT), \
            "PASTE 後に DIR コマンドの出力 (.COM ファイル名) が現れない"


# ── WASM FS テスト ────────────────────────────────────────────────────────────

class TestWasmFS:
    """WASM FS パネルの表示・ファイル操作・テキストエディタを検証する。"""

    # テストで使うファイル名
    _TEST_FILENAME = "PLAYTEST.TXT"
    _TEST_CONTENT  = "Hello from Playwright - WASM FS test\n"

    def _write_test_file(self, page: Page) -> None:
        """workerRequest で WASM FS にテストファイルを書き込み、FS リストを更新する。"""
        page.evaluate("""async ([name, text]) => {
            var enc   = new TextEncoder();
            var bytes = enc.encode(text);
            var buf   = bytes.buffer.slice(0);
            await workerRequest({ type: 'writeFS', name: name, data: buf }, [buf]);
            await updateFSList();
        }""", [self._TEST_FILENAME, self._TEST_CONTENT])
        # DOM 更新が反映されるまで待つ
        time.sleep(0.5)

    def test_fs_panel_visible(self, loaded_page: Page) -> None:
        """WASM FS パネル (#fs-panel) が表示されている。"""
        panel = loaded_page.locator("#fs-panel")
        assert panel.is_visible(), "#fs-panel が見えない"

    def test_fs_panel_header(self, loaded_page: Page) -> None:
        """WASM FS パネルに 'WASM FS' テキストが含まれる。"""
        panel_text = loaded_page.locator("#fs-panel").inner_text()
        assert "WASM FS" in panel_text, \
            f"パネルに 'WASM FS' テキストがない: {panel_text[:100]!r}"

    def test_fs_save_button(self, loaded_page: Page) -> None:
        """Save FS ボタン (#btn-save-fs) が表示されている。"""
        btn = loaded_page.locator("#btn-save-fs")
        assert btn.is_visible(), "#btn-save-fs が見えない"

    def test_fs_list_create_and_show(self, loaded_page: Page) -> None:
        """ファイルを WASM FS に書き込むとリストに表示される。"""
        self._write_test_file(loaded_page)
        row = loaded_page.locator(f'.fs-row[data-name="{self._TEST_FILENAME}"]')
        row.wait_for(state="visible", timeout=5_000)
        assert row.is_visible(), \
            f"{self._TEST_FILENAME} が #fs-list に表示されない"

    def test_fs_row_filename_text(self, loaded_page: Page) -> None:
        """FS 行の .fs-name にファイル名が表示される。"""
        # 前テストで書き込み済みのはずだが、念のため確認
        row = loaded_page.locator(f'.fs-row[data-name="{self._TEST_FILENAME}"]')
        row.wait_for(state="visible", timeout=5_000)
        name_text = row.locator(".fs-name").inner_text()
        assert self._TEST_FILENAME in name_text, \
            f".fs-name に {self._TEST_FILENAME} が表示されない: {name_text!r}"

    def test_editor_opens_on_txt_click(self, loaded_page: Page) -> None:
        """テキストファイル行をクリックするとエディタモーダルが開く。"""
        # ファイルが存在しない場合は再作成
        row = loaded_page.locator(f'.fs-row[data-name="{self._TEST_FILENAME}"]')
        if not row.is_visible():
            self._write_test_file(loaded_page)
            row.wait_for(state="visible", timeout=5_000)

        row.click()
        modal = loaded_page.locator("#editor-modal")
        modal.wait_for(state="visible", timeout=8_000)
        assert modal.is_visible(), "エディタモーダルが開かない"

        # ツールバーにファイル名が表示される
        fname = loaded_page.locator("#editor-filename").inner_text()
        assert self._TEST_FILENAME in fname, \
            f"エディタのファイル名が {self._TEST_FILENAME} でない: {fname!r}"

    def test_editor_type_and_delete(self, loaded_page: Page) -> None:
        """エディタでキーボード入力→内容確認→Backspace 削除→確認を行う。"""
        modal = loaded_page.locator("#editor-modal")

        # エディタが開いていない場合は開く
        if not modal.is_visible():
            row = loaded_page.locator(f'.fs-row[data-name="{self._TEST_FILENAME}"]')
            if not row.is_visible():
                self._write_test_file(loaded_page)
                row.wait_for(state="visible", timeout=5_000)
            row.click()
            modal.wait_for(state="visible", timeout=8_000)

        TYPED = "PLAYWRIGHT_INPUT"

        # Monaco エリアをクリックしてフォーカス取得
        loaded_page.locator("#editor-cm").click()
        time.sleep(0.2)

        # 文末へ移動してテキスト入力
        # insert_text を使う（type() は環境のキーレイアウト依存で '_' が '-' に化けるため）
        loaded_page.keyboard.press("Control+End")
        loaded_page.keyboard.insert_text(TYPED)
        time.sleep(0.3)  # Monaco がモデルへ反映するのを待つ

        # --- 入力後: TYPED が getValue() に含まれることを確認 ---
        after_type = loaded_page.evaluate(
            "window._editor && window._editor.editor"
            " ? window._editor.editor.getValue() : ''"
        )
        assert TYPED in after_type, \
            f"入力後、'{TYPED}' がエディタ内容に見当たらない:\n{after_type!r}"

        # Backspace で入力した文字を 1 文字ずつ削除
        for _ in range(len(TYPED)):
            loaded_page.keyboard.press("Backspace")
        time.sleep(0.3)

        # --- 削除後: TYPED が消えていることを確認 ---
        after_delete = loaded_page.evaluate(
            "window._editor && window._editor.editor"
            " ? window._editor.editor.getValue() : ''"
        )
        assert TYPED not in after_delete, \
            f"削除後も '{TYPED}' が残っている:\n{after_delete!r}"

    def test_editor_close(self, loaded_page: Page) -> None:
        """✕ Close ボタンでエディタモーダルが閉じる。"""
        modal = loaded_page.locator("#editor-modal")

        # モーダルが開いていなければ再度開く
        if not modal.is_visible():
            row = loaded_page.locator(f'.fs-row[data-name="{self._TEST_FILENAME}"]')
            if not row.is_visible():
                self._write_test_file(loaded_page)
                row.wait_for(state="visible", timeout=5_000)
            row.click()
            modal.wait_for(state="visible", timeout=8_000)

        loaded_page.locator("#editor-close").click()
        time.sleep(0.4)
        assert not modal.is_visible(), \
            "✕ Close クリック後もエディタモーダルが閉じない"


# ── sim API テスト ────────────────────────────────────────────────────────────


class TestSimAPI:
    """window.sim API の直接テスト。

    DDT を経由せず SimAPI でメモリ書き込み・PC 設定・レジスタ読み取りを行い、
    CPU の実行結果を検証する。
    """

    def test_mvi_a_ff(self, sim: SimAPI) -> None:
        """MVI A,$FF; HLT を sim API で実行し、A レジスタが 0xFF になることを確認する。

        手順:
          1. 前テストのトリガー残留をクリア
          2. 0x0300 に MVI A,$FF (3E FF) + HLT (76) を書き込む
          3. HLT 命令フェッチ (opc=0x76) でトリガーを設定（MVI 完了後に発火）
          4. 0x0300 から実行開始
          5. トリガー発火（HLT 到達）を待ち、即座に一時停止
          6. A レジスタが 0xFF であることを確認
        """
        # 1. 前テストの残留トリガーを解除
        sim.clear_trigger()

        # 2. コード配置: MVI A,$FF (3E FF) → HLT (76)
        sim.write_mem(0x0300, [0x3E, 0xFF, 0x76])

        # 3. HLT フェッチでトリガー設定（MVI A,$FF 実行完了後に発火）
        sim.set_trigger(type="instr", opc=0x76)
        sim.set_post_delay(10)

        # 4. 0x0300 から実行開始
        sim.run_from(0x0300)

        # 5. HLT 到達を待ち（最大 10 秒）、停止して状態を安定させる
        sim.await_wait_trigger(10_000)
        sim.pause()
        time.sleep(0.15)

        # 6. レジスタ検証
        regs = sim.await_get_regs()
        assert regs["a"] == 0xFF, (
            f"MVI A,$FF 実行後の A レジスタが 0xFF でない: 0x{regs['a']:02X}"
        )

        # スクリーンショット保存（全レジスタ表示・16x ズーム・TRIG 中央）
        sim.show_signals(*_ALL_REGS)
        sim.set_zoom('16x')
        time.sleep(0.2)
        sim.goto_trigger()
        time.sleep(0.3)
        a_val = regs["a"]
        pc_val = regs["pc"]
        sim.screenshot_canvas_to_file(
            _SS_DIR / "sim_api_mvi_a_ff.png",
            title=f"test_mvi_a_ff — MVI A,$FF; HLT  A=0x{a_val:02X}  PC=0x{pc_val:04X} [16x]",
        )
