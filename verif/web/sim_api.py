"""sim_api.py — window.sim の Python ラッパー

Playwright ``page.evaluate()`` 経由で ``window.sim`` JS API を呼ぶ同期インターフェース。
JS 側の Promise は Playwright が自動解決するため、全メソッドは同期的に呼べる。

## 命名規則

- 通常メソッド (``run``, ``pause``, ``write_mem`` …):
  JS 側が同期（Promise を返さない）
- ``await_`` メソッド (``await_get_regs``, ``await_wait_trigger`` …):
  JS 側が非同期（Promise を返す）。Python からは同期的に呼べるが、
  「内部で await している」ことを名前で明示する。

## 使い方

::

    from sim_api import SimAPI

    sim = SimAPI(page)
    sim.reset()
    sim.write_mem(0x0300, [0x3E, 0xFF, 0x76])     # MVI A,$FF; HLT
    sim.set_trigger(type='reg', regId=9, value=0x0300)
    sim.set_post_delay(100)
    sim.run_from(0x0300)
    sim.await_wait_trigger(30_000)                 # トリガー待ち
    regs = sim.await_get_regs()                    # {'a': 0xFF, 'pc': 0x0302, ...}
    sim.screenshot_canvas_to_file("test/ss/la_after_trigger.png")
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from playwright.sync_api import Page


class SimAPI:
    """``window.sim`` の Python ラッパー。

    JS 側の ``window.sim`` オブジェクトを Python から操作するためのラッパー。
    Playwright ``page.evaluate()`` が Promise を自動解決するため、
    ``await_*`` メソッドも含めて全メソッドは同期的に呼べる。
    """

    def __init__(self, page: Page) -> None:
        self._page = page

    def _ev(self, js: str) -> Any:
        """JS 式を評価する。Promise は Playwright が自動解決する。"""
        return self._page.evaluate(js)

    # ── 実行制御 ──────────────────────────────────────────────────────────────

    def run(self) -> None:
        """シミュレーション再開。"""
        self._ev("() => sim.run()")

    def pause(self) -> None:
        """シミュレーション一時停止。"""
        self._ev("() => sim.pause()")

    def reset(self, preset: int | None = None) -> None:
        """CP/M リセット。preset 省略時は現在のプリセットを使用。"""
        if preset is None:
            self._ev("() => sim.reset()")
        else:
            self._ev(f"() => sim.reset({preset})")

    # ── キー入力 ──────────────────────────────────────────────────────────────

    def send_key(self, ch: int | str) -> None:
        """CP/M ターミナルに 1 文字送信（ASCII コード or 1 文字の文字列）。"""
        code = ord(ch[0]) if isinstance(ch, str) else int(ch)
        self._ev(f"() => sim.sendKey({code})")

    def send_string(self, s: str) -> None:
        r"""CP/M ターミナルに文字列送信。'\n' は CR(0x0D) に変換。"""
        self._ev(f"() => sim.sendString({json.dumps(s)})")

    # ── メモリ直接アクセス ────────────────────────────────────────────────────

    def write_mem(self, addr: int, data: list[int] | bytes) -> None:
        """指定アドレスにバイト列書き込み（DDT の S コマンド相当）。

        RAM と Verilator RTL RAM の両方を更新する。
        """
        payload = list(data) if not isinstance(data, list) else data
        self._ev(f"() => sim.writeMem({addr}, {json.dumps(payload)})")

    def await_read_mem(self, addr: int, length: int) -> bytes:
        """指定アドレスから length バイト読み出し（内部で JS Promise を解決）。"""
        result = self._ev(f"() => sim.readMem({addr}, {length})")
        return bytes(result)

    # ── レジスタ ──────────────────────────────────────────────────────────────

    def await_get_regs(self) -> dict[str, int]:
        """全レジスタ取得（内部で JS Promise を解決）。

        Returns:
            ``{'a': int, 'f': int, 'b': int, 'c': int, 'd': int,
            'e': int, 'h': int, 'l': int, 'sp': int, 'pc': int}``
        """
        return self._ev("() => sim.getRegs()")

    def set_regs(self, **regs: int) -> None:
        """レジスタを部分指定で設定。

        対応レジスタ: a, b, c, d, e, h, l, sp, pc, f (PSW フォーマット)

        例::

            sim.set_regs(a=0xAB, f=0x02, sp=0x0400, pc=0x0300)
        """
        self._ev(f"() => sim.setRegs({json.dumps(regs)})")

    def set_pc(self, addr: int) -> None:
        """PC レジスタのみ設定（実行開始しない。命令境界で呼ぶこと）。"""
        self._ev(f"() => sim.setPC({addr})")

    def run_from(self, addr: int) -> None:
        """PC を設定してシミュレーション開始（DDT の G コマンド相当）。"""
        self._ev(f"() => sim.runFrom({addr})")

    def step_instr(self) -> None:
        """1 命令実行して次の M1 フェッチ境界で停止（DDT の T コマンド相当）。

        戻り時は ring_frozen=true。続けてシミュレーションを再開する場合は
        ``thaw_ring()`` または ``clear_trigger()`` でフリーズを解除すること。
        """
        self._ev("() => sim.stepInstr()")

    def thaw_ring(self) -> None:
        """ring buffer のフリーズを解除する（step_instr() 後に必要）。

        ``clear_trigger()`` / ``set_trigger()`` でも内部的に自動解除されるため、
        それらを呼ぶ場合は本メソッドの明示呼び出しは不要。
        """
        self._ev("() => sim.thawRing()")

    # ── トリガー ──────────────────────────────────────────────────────────────

    def set_trigger(self, **opts: Any) -> None:
        """トリガーを設定する。opts は ``window.sim.setTrigger`` と同じキーワード引数。

        例::

            sim.set_trigger(type='reg',   regId=9, value=0x0300)   # PC=0x0300
            sim.set_trigger(type='instr', opc=0x76)                 # HLT 命令
            sim.set_trigger(type='edge',  word=0, bit=9, dir=0)     # SYNC 立ち上がり
            sim.set_trigger(type='io',    port=5)                   # port 5 I/O
            sim.set_trigger(type='call',  addr=0xCCCC)              # CALL 0CCCCh
            sim.set_trigger(type='ret')                             # RET 命令
        """
        self._ev(f"() => sim.setTrigger({json.dumps(opts)})")

    def clear_trigger(self) -> None:
        """トリガーを解除する。"""
        self._ev("() => sim.clearTrigger()")

    def set_post_delay(self, n: int) -> None:
        """トリガー後にリングバッファへ記録を続けるサンプル数を設定。"""
        self._ev(f"() => sim.setPostDelay({n})")

    def set_mem_watch(self, slot: int, addr: int) -> None:
        """MemWatch スロット (0/1/2) に監視アドレスを設定する。

        設定すると ring buffer Word 6 の対応バイトに毎クロック RAM[addr] が記録される。
        addr=-1 でそのスロットを無効化。
        """
        self._ev(f"() => sim.setMemWatch({slot}, {addr})")

    def clear_mem_watch(self, slot: int) -> None:
        """MemWatch スロットを無効化する（addr=-1 と等価）。"""
        self._ev(f"() => sim.setMemWatch({slot}, -1)")

    def await_wait_trigger(self, timeout_ms: int = 30_000) -> dict[str, int]:
        """トリガーが発火するまで待機（内部で JS Promise を解決）。

        Args:
            timeout_ms: タイムアウト（ミリ秒）。デフォルト 30 秒。

        Returns:
            ``{'trigHead': int}`` — トリガー発火位置（ring buffer 絶対インデックス）

        Raises:
            PlaywrightError: タイムアウト時
        """
        return self._ev(f"() => sim.waitTrigger({timeout_ms})")

    # ── ring buffer 読み取り ──────────────────────────────────────────────────

    def read_sample(self, signal_id: str, offset: int = 0) -> int | None:
        """トリガー位置から offset サンプル離れた信号値を返す。

        Args:
            signal_id: LA_SIGNALS_ALL の id (``'addr'``, ``'dbus'``, ``'ir'``,
                ``'acc'``, ``'reg_b'``, ``'pc'`` など)
            offset: ``0`` =トリガー発火サンプル, ``+n`` =後方, ``-n`` =前方

        Returns:
            信号値 (``int``) またはトリガー未発火・不明シグナル時は ``None``
        """
        return self._ev(f"() => sim.readSample({json.dumps(signal_id)}, {offset})")

    # ── 信号メタデータ ────────────────────────────────────────────────────────

    def get_signals(self) -> list[dict]:
        """Logic Analyzer で参照・設定できる全信号のメタデータ一覧を返す。

        各エントリ::

            {'id': str, 'label': str, 'word': int, 'bit': int,
             'width': int, 'type': str, 'writable': bool}

        ``writable=True`` の信号は ``set_regs()`` / ``write_mem()`` で設定できる。
        """
        return self._ev("() => sim.getSignals()")

    # ── Logic Analyzer 表示操作 ──────────────────────────────────────────────

    def show_signals(self, *signal_ids: str) -> None:
        """指定シグナルを Logic Analyzer に表示する（他シグナルの表示状態は変えない）。

        LA 内部の ``_sigVisible`` dict を直接書き換えてキャンバスを再描画するため、
        UI ピッカーを経由せず即時反映される。

        Args:
            signal_ids: 表示したいシグナル ID（``LA_SIGNALS_ALL`` の ``id`` 値）。
                ``'acc'``, ``'reg_b'``, ``'pc'``, ``'sp'`` など。

        例::

            # 全レジスタを表示
            sim.show_signals('pc', 'sp', 'acc', 'reg_f',
                             'reg_b', 'reg_c', 'reg_d', 'reg_e',
                             'reg_h', 'reg_l')
        """
        ids_js = json.dumps(list(signal_ids))
        self._ev(f"""() => {{
            var la = window.la;
            if (!la) return;
            var ids = {ids_js};
            ids.forEach(function(id) {{ la._sigVisible[id] = true; }});
            la._updateCanvas();
        }}""")

    # ズーム倍率文字列 → #la-zoom-sel の option value
    _ZOOM_MAP: dict[str, str] = {
        '1/4x': '0', '1/2x': '1', '1x': '2', '2x': '3',
        '4x': '4', '8x': '5', '16x': '6', '32x': '7', '64x': '8',
    }

    def set_zoom(self, zoom: str | int) -> None:
        """Logic Analyzer のズーム倍率を設定する。

        Args:
            zoom: 倍率文字列 (``'8x'``, ``'16x'`` など) または
                  ``#la-zoom-sel`` の option value (``0``–``8`` の整数)

        例::

            sim.set_zoom('8x')   # 8 倍
            sim.set_zoom('16x')  # 16 倍
            sim.set_zoom(5)      # option value 直指定（= 8x）
        """
        val = self._ZOOM_MAP.get(str(zoom), str(zoom))
        self._page.locator('#la-zoom-sel').select_option(val)

    def goto_trigger(self) -> None:
        """トリガー発火位置をキャンバス中央に移動する。

        UI ボタン (#btn-goto-trig) の可視状態に依存せず、
        JS の ``la.gotoTrig()`` を直接呼ぶ。
        """
        self._ev("() => { if (window.la) window.la.gotoTrig(); }")

    # ── スクリーンショット ────────────────────────────────────────────────────

    def screenshot_canvas_to_file(
        self,
        path: str | Path,
        selector: str = "#la",
        title: str | None = None,
        title_height: int = 28,
    ) -> None:
        """Logic Analyzer キャンバスを PNG ファイルに保存する。

        存在しないディレクトリは自動作成する。
        ``title`` を指定すると、画像上部にダークバー＋タイトル文字列を追加する。
        DPR（devicePixelRatio）に対応しているため、高解像度ディスプレイでも
        タイトルが鮮明に描画される。Pillow など外部ライブラリは不要。

        Args:
            path:         保存先ファイルパス
            selector:     キャンバス要素の CSS セレクタ（デフォルト ``'#la'``）
            title:        画像上部に描くタイトル文字列。``None`` でタイトルなし。
            title_height: タイトルバーの高さ（CSS px）。デフォルト 28px。

        例::

            sim.screenshot_canvas_to_file(
                "test/ss/la_mvi.png",
                title="MVI A,$FF; HLT  — A=0xFF  PC=0x0302",
            )
        """
        if title is None:
            data_url: str = self._ev(
                f"() => sim.screenshotCanvas({json.dumps(selector)})"
            )
        else:
            data_url = self._ev(f"""() => {{
                var src = document.querySelector({json.dumps(selector)});
                if (!src) return null;
                var dpr = window.devicePixelRatio || 1;
                var barH  = Math.round({title_height} * dpr);
                var tmp   = document.createElement('canvas');
                tmp.width  = src.width;
                tmp.height = src.height + barH;
                var ctx = tmp.getContext('2d');
                // タイトルバー（ダーク背景）
                ctx.fillStyle = '#1a1a1e';
                ctx.fillRect(0, 0, tmp.width, barH);
                // タイトルテキスト（モノスペース・ライトグレー）
                var fs = Math.round(13 * dpr);
                ctx.font = 'bold ' + fs + 'px "Courier New", Courier, monospace';
                ctx.fillStyle = '#d4d4d8';
                ctx.fillText({json.dumps(title)}, Math.round(8 * dpr), Math.round(19 * dpr));
                // LA キャンバスを下に貼り付け
                ctx.drawImage(src, 0, barH);
                return tmp.toDataURL('image/png');
            }}""")
        _, b64 = data_url.split(",", 1)
        png = base64.b64decode(b64)
        dest = Path(path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(png)

    # ── 状態取得 (プロパティ) ─────────────────────────────────────────────────

    @property
    def trig_fired(self) -> bool:
        """トリガーが発火済みか。"""
        return bool(self._ev("() => sim.trigFired"))

    @property
    def trig_head(self) -> int:
        """トリガー発火位置（ring buffer 絶対インデックス）。未発火時は ``-1``。"""
        return int(self._ev("() => sim.trigHead"))

    @property
    def is_running(self) -> bool:
        """シミュレーションが実行中か。"""
        return bool(self._ev("() => sim.isRunning"))
