#!/usr/bin/env python3
"""README 用のスクリーンショットと GIF を、公開ページから解像度 2 倍で作る。

公開中の GitHub Pages を headless Chromium (device_scale_factor=2) で開いて動かし、
フレームを撮って ffmpeg で GIF にする。静止画は 2 倍のまま使う。

前提:
    .venv/bin/pip install playwright && .venv/bin/playwright install chromium
    ffmpeg と ffprobe

使い方:
    .venv/bin/python3 scripts/gen-readme-ss.py                  # 全部を /tmp/soft-fpga-readme-ss に作る
    .venv/bin/python3 scripts/gen-readme-ss.py 02 06            # 02 と 06 だけ
    .venv/bin/python3 scripts/gen-readme-ss.py --install        # 作ったものを docs/img/ss に置く
    .venv/bin/python3 scripts/gen-readme-ss.py --base http://localhost:8000   # ローカルのサーバを撮る

出力 (docs/img/ss/):
    01 01-counter-demo.gif 01-counter.png
    02 traffic-fsm-demo.gif 02-traffic-fsm.png
    03 uart-demo.gif
    04 6502-demo.gif 04-6502-wozmon.png 04-6502-basic.png
    06 8080-cpm-demo.gif
    09 09-pdp11.png
    91 91-pong.png

終了コード: 0 = 成功、1 = 撮影結果が期待と違う、2 = playwright 未インストール、
            3 = Chromium 未インストール、4 = ffmpeg / ffprobe が見つからない
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from itertools import groupby
from pathlib import Path

try:
    from playwright.sync_api import Browser, ConsoleMessage, Page, sync_playwright
    from playwright.sync_api import Error as PlaywrightError
except ImportError:
    print("ERROR: playwright がインストールされていません", file=sys.stderr)
    print("  .venv/bin/pip install playwright && .venv/bin/playwright install chromium", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BASE = "https://tommie-jp.github.io/soft-fpga"
DEFAULT_OUT = Path("/tmp/soft-fpga-readme-ss")
INSTALL_DIR = ROOT / "docs" / "img" / "ss"
SCALE = 2                       # device_scale_factor
GIF_FILTER = (                  # 256 色・ディザなし: 文字の縁をにじませない
    "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];"
    "[b][p]paletteuse=dither=none:diff_mode=rectangle"
)
STILL_WOZMON_FRAME = 3          # 04: wozmon の応答 (E000: 4C) が出たフレーム (1 始まり)
TARGETS = ("01", "02", "03", "04", "06", "09", "91")

Clip = dict[str, float]


class CaptureError(RuntimeError):
    """撮影や組み立ての結果が期待と違うとき (黙って進めず、そこで止める)。"""


# ── 共通の道具 ─────────────────────────────────────────────────────────────

def _log_console_error(msg: ConsoleMessage) -> None:
    if msg.type == "error":
        print(f"    [console error] {msg.text}", file=sys.stderr)


@contextmanager
def new_page(browser: Browser, width: int, height: int) -> Iterator[Page]:
    """解像度 2 倍のページを開き、抜けるときに (例外のときも) コンテキストを閉じる。"""
    ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=SCALE)
    try:
        page = ctx.new_page()
        page.on("console", _log_console_error)
        yield page
    finally:
        ctx.close()


def shot(page: Page, path: Path, clip: Clip | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path), type="png", scale="device", clip=clip)


def frames(page: Page, out: Path, count: int, interval: float, clip: Clip,
           on_frame: Callable[[int], None] | None = None) -> list[Path]:
    """interval 秒ごとに count 枚撮る。撮影にかかった時間も含めて間隔を保つ。

    on_frame は 1 枚撮るたびに (0 始まりの番号で) 呼ばれる。
    """
    paths: list[Path] = []
    start = time.monotonic()
    for i in range(count):
        wait = start + i * interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        path = out / f"f{i + 1:02d}.png"
        shot(page, path, clip)
        paths.append(path)
        if on_frame:
            on_frame(i)
    return paths


def set_slider(page: Page, value: int) -> None:
    page.evaluate(
        """v => { const s = document.querySelector('input[type=range]');
                  s.value = v;
                  s.dispatchEvent(new Event('input', {bubbles: true}));
                  s.dispatchEvent(new Event('change', {bubbles: true})); }""",
        value,
    )


def type_line(page: Page, text: str) -> None:
    ta = page.locator("textarea.xterm-helper-textarea")
    ta.press_sequentially(text, delay=40)
    ta.press("Enter")


def terminal_rows(page: Page) -> list[str]:
    return page.evaluate(
        "() => [...document.querySelectorAll('.xterm-rows div')]"
        ".map(d => d.textContent.replace(/\\s+$/, '')).filter(Boolean)"
    )


def choose_us_keyboard(page: Page) -> None:
    """KBD の既定は JIS 表示。JIS のままだと "B:" が "B;" と入る。"""
    page.get_by_role("radio", name="US", exact=True).check()


def pick_frames_by_state(states: list[str]) -> list[int]:
    """状態が変わるごとに先頭を、3 コマ以上続く状態は真ん中も 1 枚選ぶ (0 始まりの添字)。"""
    picked: list[int] = []
    i = 0
    for _, run in groupby(states):
        n = len(list(run))
        picked.append(i)
        if n >= 3:
            picked.append(i + n // 2)
        i += n
    return picked


# ── ffmpeg ─────────────────────────────────────────────────────────────────

def run_tool(cmd: list[str]) -> str:
    """外部コマンドを実行して stdout を返す。失敗したら stderr つきで CaptureError にする。"""
    try:
        done = subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        raise CaptureError(f"{cmd[0]} が失敗した: {e.stderr.strip()}") from e
    return done.stdout


def run_ffmpeg(*args: str) -> None:
    run_tool(["ffmpeg", "-v", "error", "-y", *args])


def probe_size(path: Path) -> tuple[int, int]:
    w, h = run_tool(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                     "stream=width,height", "-of", "csv=p=0", str(path)]).strip().split(",")
    return int(w), int(h)


def make_gif(frame_paths: list[Path], fps: float, width: int, out: Path) -> None:
    """frame_paths を連番に並べ直して GIF にする (frame_paths の順が再生順)。"""
    seq = out.parent / f"seq-{out.stem}"
    seq.mkdir(parents=True, exist_ok=True)
    for old in seq.glob("*.png"):
        old.unlink()
    for n, src in enumerate(frame_paths, start=1):
        shutil.copyfile(src, seq / f"{n:02d}.png")
    run_ffmpeg("-framerate", str(fps), "-i", str(seq / "%02d.png"),
               "-vf", f"scale={width}:-1:flags=lanczos,{GIF_FILTER}", "-loop", "0", str(out))


def stack_vertically(top: Path, bottom: Path, out: Path, fill: str = "#222222") -> None:
    """top を fill 色で bottom と同じ幅まで広げて、上下につなぐ。"""
    top_w, top_h = probe_size(top)
    bottom_w, _ = probe_size(bottom)
    width = max(top_w, bottom_w)
    run_ffmpeg("-i", str(top), "-i", str(bottom), "-filter_complex",
               f"[0]pad={width}:{top_h}:0:0:color={fill}[t];[1]pad={width}:ih:0:0:color={fill}[b];[t][b]vstack",
               "-frames:v", "1", str(out))


# ── ページごとの撮影と組み立て ─────────────────────────────────────────────

def make_01(browser: Browser, base: str, out: Path) -> None:
    with new_page(browser, 1280, 800) as page:
        page.goto(f"{base}/01-counter/")
        time.sleep(3)
        page.get_by_role("button", name="Run", exact=True).click()
        time.sleep(3)
        paths = frames(page, out / "01", 8, 0.5, {"x": 20, "y": 85, "width": 1240, "height": 475})
        shot(page, out / "01-counter.png", {"x": 0, "y": 0, "width": 1280, "height": 600})
    make_gif(paths, 2, 1240, out / "01-counter-demo.gif")


def make_02(browser: Browser, base: str, out: Path) -> None:
    states: list[str] = []

    def read_state(page: Page) -> None:
        states.append(page.evaluate(
            "() => { const m = document.body.innerText.match(/State\\s*:\\s*(\\w+)/); return m ? m[1] : ''; }"))

    with new_page(browser, 1280, 900) as page:
        page.goto(f"{base}/02-traffic-fsm/")
        time.sleep(3)
        page.get_by_role("button", name="Run", exact=True).click()
        time.sleep(4)
        set_slider(page, 1)
        time.sleep(1)
        page.get_by_role("button", name="歩行者ボタン").click()
        paths = frames(page, out / "02", 22, 1.0, {"x": 0, "y": 0, "width": 1280, "height": 830},
                       on_frame=lambda _: read_state(page))
    print("    states:", " ".join(states))
    (out / "02").mkdir(parents=True, exist_ok=True)
    (out / "02" / "states.json").write_text(json.dumps(states))
    missing = {"RED", "GREEN", "YELLOW", "WALK"} - set(states)
    if missing:
        raise CaptureError(f"02: 状態 {sorted(missing)} が撮れていない (states={states})")
    picked = pick_frames_by_state(states)
    make_gif([paths[i] for i in picked], 1.5, 1240, out / "traffic-fsm-demo.gif")
    walk_mid = [i for i in picked if states[i] == "WALK"][-1]
    shutil.copyfile(paths[walk_mid], out / "02-traffic-fsm.png")


def make_03(browser: Browser, base: str, out: Path) -> None:
    with new_page(browser, 1280, 900) as page:
        page.goto(f"{base}/03-uart/")
        time.sleep(3)
        page.get_by_role("button", name="Run", exact=True).click()
        time.sleep(2)
        set_slider(page, 2)
        box = page.get_by_role("textbox").first
        box.fill("soft-FPGA")
        box.press("Enter")
        paths = frames(page, out / "03", 12, 1.0, {"x": 20, "y": 60, "width": 1240, "height": 700})
    make_gif(paths, 1.5, 1240, out / "uart-demo.gif")


def make_04(browser: Browser, base: str, out: Path) -> None:
    with new_page(browser, 1280, 900) as page:
        page.goto(f"{base}/04-6502/")
        time.sleep(5)
        page.get_by_role("button", name="Demo", exact=True).click()
        paths = frames(page, out / "04", 14, 1.2, {"x": 20, "y": 85, "width": 1240, "height": 745})
    make_gif(paths, 1.2, 1240, out / "6502-demo.gif")
    shutil.copyfile(paths[STILL_WOZMON_FRAME - 1], out / "04-6502-wozmon.png")
    shutil.copyfile(paths[-1], out / "04-6502-basic.png")


def make_06(browser: Browser, base: str, out: Path) -> None:
    clip = {"x": 20, "y": 340, "width": 1225, "height": 418}
    # (入力, 待つ秒数, 撮るか)。"B:" はドライブ切り替えだけなので次の DIR とまとめて 1 コマ
    steps = (("DIR", 2, True), ("B:", 1, False), ("DIR", 2, True), ("TYPE HELLO.C", 2, True),
             ("CC HELLO", 7, True), ("CLINK HELLO", 7, True), ("HELLO", 2, True))
    with new_page(browser, 1280, 1000) as page:
        page.goto(f"{base}/06-8080/")
        time.sleep(6)
        page.get_by_role("button", name="BDS C", exact=True).click()
        time.sleep(6)
        choose_us_keyboard(page)
        page.get_by_role("button", name="Run", exact=True).click()
        time.sleep(5)
        paths = [out / "06" / "f01.png"]
        shot(page, paths[0], clip)
        for text, wait, take in steps:
            type_line(page, text)
            time.sleep(wait)
            if take:
                paths.append(out / "06" / f"f{len(paths) + 1:02d}.png")
                shot(page, paths[-1], clip)
        rows = terminal_rows(page)
    if not any("Hello, CP/M!" in r for r in rows):
        raise CaptureError(f"06: Hello, CP/M! が出ていない (末尾: {rows[-6:]})")
    make_gif(paths, 1.2, 1225, out / "8080-cpm-demo.gif")


def make_09(browser: Browser, base: str, out: Path) -> None:
    with new_page(browser, 1280, 1400) as page:
        page.goto(f"{base}/examples/09-pdp11/web/")
        # 進捗バッジにも "login:" があるので、端末 (.xterm-rows) の中だけを見る
        page.wait_for_function(
            "() => [...document.querySelectorAll('.xterm-rows div')].some(d => /login:/.test(d.textContent))",
            timeout=180000)
        time.sleep(2)
        choose_us_keyboard(page)
        for bid in ("btn-regs-collapse", "btn-mmu-collapse", "btn-la-collapse"):
            page.evaluate(f"document.getElementById('{bid}').click()")
        for cmd, wait in (("root", 5), ("who", 3), ("ls -l", 5), ("ps -ag", 12)):
            page.evaluate("s => window.sim.sendString(s)", cmd + "\n")
            time.sleep(wait)
        rows = terminal_rows(page)
        if not any(r.startswith("TTY") and "COMMAND" in r for r in rows):
            raise CaptureError(f"09: ps -ag の出力が出ていない (末尾: {rows[-8:]})")
        shot(page, out / "09-pdp11.png", {"x": 5, "y": 5, "width": 1260, "height": 1305})


def make_91(browser: Browser, base: str, out: Path) -> None:
    with new_page(browser, 1280, 1700) as page:
        page.goto(f"{base}/91-pong/")
        time.sleep(10)
        game = page.locator("#game").bounding_box()
        la = page.locator("#la-root").bounding_box()
        if not game or not la:
            raise CaptureError("91: #game か #la-root が見つからない")
        shot(page, out / "91" / "game.png", {"x": 5, "y": game["y"] - 4,
                                             "width": game["width"] + 10, "height": game["height"] + 8})
        shot(page, out / "91" / "la.png", {"x": 5, "y": la["y"] - 2, "width": 1260, "height": la["height"] + 4})
    stack_vertically(out / "91" / "game.png", out / "91" / "la.png", out / "91-pong.png")


MAKERS: dict[str, Callable[[Browser, str, Path], None]] = {
    "01": make_01, "02": make_02, "03": make_03, "04": make_04, "06": make_06, "09": make_09, "91": make_91}
OUTPUTS: dict[str, tuple[str, ...]] = {
    "01": ("01-counter-demo.gif", "01-counter.png"),
    "02": ("traffic-fsm-demo.gif", "02-traffic-fsm.png"),
    "03": ("uart-demo.gif",),
    "04": ("6502-demo.gif", "04-6502-wozmon.png", "04-6502-basic.png"),
    "06": ("8080-cpm-demo.gif",),
    "09": ("09-pdp11.png",),
    "91": ("91-pong.png",)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="README 用のスクリーンショットと GIF を 2 倍解像度で作る")
    parser.add_argument("targets", nargs="*", metavar="ID",
                        help=f"対象 ({' '.join(TARGETS)})。省略すると全部")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"出力先 (既定 {DEFAULT_OUT})")
    parser.add_argument("--base", default=DEFAULT_BASE, help="撮る先の URL (既定は GitHub Pages)")
    parser.add_argument("--install", action="store_true", help="作ったものを docs/img/ss に置く")
    args = parser.parse_args()
    unknown = [t for t in args.targets if t not in TARGETS]
    if unknown:
        parser.error(f"不明な対象: {' '.join(unknown)} (選べるのは {' '.join(TARGETS)})")
    args.targets = list(dict.fromkeys(args.targets)) or list(TARGETS)
    args.base = args.base.rstrip("/")
    return args


def capture(targets: list[str], base: str, out: Path) -> int:
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True)
        except PlaywrightError as e:
            if "Executable doesn't exist" not in str(e):
                raise
            print("ERROR: Playwright の Chromium がインストールされていません", file=sys.stderr)
            print("  .venv/bin/playwright install chromium", file=sys.stderr)
            return 3
        try:
            for t in targets:
                print(f"[{t}]")
                MAKERS[t](browser, base, out)
        except CaptureError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 1
        finally:
            browser.close()
    return 0


def main() -> int:
    args = parse_args()
    missing_tools = [t for t in ("ffmpeg", "ffprobe") if not shutil.which(t)]
    if missing_tools:
        print(f"ERROR: {' '.join(missing_tools)} が見つかりません (撮影の前に止めます)", file=sys.stderr)
        return 4
    args.out.mkdir(parents=True, exist_ok=True)

    code = capture(args.targets, args.base, args.out)
    if code:
        return code

    made = [args.out / name for t in args.targets for name in OUTPUTS[t]]
    absent = [p for p in made if not p.exists()]
    if absent:
        print(f"ERROR: できているはずの画像が無い: {[str(p) for p in absent]}", file=sys.stderr)
        return 1
    for path in made:
        print(f"  {path.stat().st_size // 1024:5d} KB  {path}")
    if args.install:
        INSTALL_DIR.mkdir(parents=True, exist_ok=True)
        for path in made:
            shutil.copyfile(path, INSTALL_DIR / path.name)
        print(f"{len(made)} 枚を {INSTALL_DIR} に置いた")
    return 0


if __name__ == "__main__":
    sys.exit(main())
