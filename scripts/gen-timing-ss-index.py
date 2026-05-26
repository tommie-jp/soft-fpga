#!/usr/bin/env python3
"""gen-timing-ss-index.py — test/ss/8080/index.html と viewer.html を生成する。

test/ss/8080/timing-*/ ディレクトリを走査してタイミング図ギャラリーを作成する。
_test-8080-timing-ss.sh から自動呼び出しされるが、単独実行も可。

使い方:
    python3 scripts/gen-timing-ss-index.py
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from datetime import datetime

# ── パス定義 ─────────────────────────────────────────────────────────────────
PROJECT_ROOT = pathlib.Path(__file__).parent.parent
SS_8080_DIR  = PROJECT_ROOT / "test" / "ss" / "8080"
OUTPUT_HTML  = SS_8080_DIR / "index.html"
VIEWER_HTML  = SS_8080_DIR / "viewer.html"

# timing-YYYY-MM-DD-HHMM という名前のディレクトリを走査
_RUN_PAT = re.compile(r"^timing-(\d{4}-\d{2}-\d{2}-\d{4})$")


def _format_ts(raw: str) -> str:
    """'2026-05-26-1634' → '2026-05-26 16:34'"""
    try:
        dt = datetime.strptime(raw, "%Y-%m-%d-%H%M")
        return dt.strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return raw


def _label(filename: str) -> str:
    """'00-nop.png' → '00 NOP'"""
    stem = pathlib.Path(filename).stem   # '00-nop'
    parts = stem.split("-", 1)
    seq  = parts[0]
    mnem = parts[1].upper().replace("-", " ") if len(parts) > 1 else ""
    return f"{seq} {mnem}"


def collect_runs() -> list[tuple[str, str, list[str]]]:
    """(ts_raw, ts_label, [png_filename, ...]) のリスト（新しい順）を返す。"""
    runs: list[tuple[str, str, list[str]]] = []
    if not SS_8080_DIR.is_dir():
        return runs

    for d in sorted(SS_8080_DIR.iterdir(), reverse=True):
        m = _RUN_PAT.match(d.name)
        if not m or not d.is_dir():
            continue
        ts_raw = m.group(1)
        pngs = sorted(p.name for p in d.glob("*.png"))
        if pngs:
            runs.append((ts_raw, _format_ts(ts_raw), pngs))
    return runs


# ── viewer.html ───────────────────────────────────────────────────────────────

_VIEWER_CSS = """\
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #111;
  color: #eee;
  font-family: monospace;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 3カラムグリッド: 左ボタン | 中央ドロップダウン | 右ボタン+リンク */
#bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0;
  padding: 5px 10px;
  background: #1e1e1e;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}
.bar-left  { display: flex; align-items: center; gap: 6px; }
.bar-center { display: flex; align-items: center; justify-content: center; gap: 6px; }
.bar-right  { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
#bar button {
  font-size: 16px;
  padding: 2px 10px;
  background: #333;
  border: 1px solid #555;
  color: #ccc;
  cursor: pointer;
  font-family: monospace;
  border-radius: 3px;
  line-height: 1.4;
}
#bar button:hover:not(:disabled) { background: #444; color: #fff; }
#bar button:disabled { opacity: .3; cursor: default; }
#case-sel {
  font-family: monospace;
  font-size: 13px;
  background: #2a2a2a;
  color: #eee;
  border: 1px solid #555;
  border-radius: 3px;
  padding: 3px 6px;
  cursor: pointer;
  min-width: 180px;
  max-width: 360px;
}
#case-sel:focus { outline: 1px solid #777; }
#counter { font-size: 11px; color: #555; white-space: nowrap; }
.bar-link {
  font-size: 11px;
  color: #666;
  text-decoration: none;
  padding: 2px 7px;
  border: 1px solid #444;
  border-radius: 3px;
  white-space: nowrap;
}
.bar-link:hover { color: #aaa; border-color: #666; }
#img-wrap {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
  background: #111;
  padding: 4px;
}
#main-img { max-width: 100%; display: block; }
"""

_VIEWER_JS = r"""
const DATA = /*DATA_JSON*/;

function label(filename) {
  const stem = filename.replace(/\.png$/, '');
  const m = stem.match(/^(\d+)-(.+)$/);
  if (!m) return stem;
  return m[1] + ' ' + m[2].toUpperCase().replace(/-/g, ' ');
}

const params  = new URLSearchParams(location.search);
let   runKey  = params.get('run') || '';
let   idx     = parseInt(params.get('i') || '0', 10);

const runs    = DATA.runs;
const runKeys = Object.keys(runs);

if (!runKey || !runs[runKey]) runKey = runKeys[0] || '';

function images() { return runs[runKey] || []; }

// ドロップダウンに全ケースを一度だけ列挙する
function populateSelect() {
  const sel  = document.getElementById('case-sel');
  sel.innerHTML = '';
  images().forEach((fn, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = label(fn);
    sel.appendChild(opt);
  });
}

function navigate(newIdx) {
  idx = Math.max(0, Math.min(images().length - 1, newIdx));
  render();
  history.replaceState(
    null, '',
    '?run=' + encodeURIComponent(runKey) + '&i=' + idx
  );
}

function render() {
  const imgs = images();
  const fn   = imgs[idx] || '';
  const src  = runKey + '/' + fn;
  document.getElementById('main-img').src = src;
  document.getElementById('case-sel').value = idx;
  document.getElementById('counter').textContent = (idx + 1) + ' / ' + imgs.length;
  document.getElementById('raw-link').href = src;
  document.getElementById('btn-ll').disabled = (idx === 0);
  document.getElementById('btn-l' ).disabled = (idx === 0);
  document.getElementById('btn-r' ).disabled = (idx === imgs.length - 1);
  document.getElementById('btn-rr').disabled = (idx === imgs.length - 1);
  document.title = '[' + (idx + 1) + '/' + imgs.length + '] ' + label(fn) + ' — 8080 Timing SS';
}

document.getElementById('btn-ll').addEventListener('click', () => navigate(0));
document.getElementById('btn-l' ).addEventListener('click', () => navigate(idx - 1));
document.getElementById('btn-r' ).addEventListener('click', () => navigate(idx + 1));
document.getElementById('btn-rr').addEventListener('click', () => navigate(images().length - 1));

// ドロップダウン選択でナビゲート（選択後フォーカスを外してキーボード操作を維持）
document.getElementById('case-sel').addEventListener('change', e => {
  navigate(parseInt(e.target.value, 10));
  e.target.blur();
});

// キーボードナビゲーション（select フォーカス中は無効化して干渉を避ける）
document.addEventListener('keydown', e => {
  if (document.activeElement === document.getElementById('case-sel')) return;
  if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { navigate(idx - 1); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { navigate(idx + 1); e.preventDefault(); }
  if (e.key === 'Home') { navigate(0);                e.preventDefault(); }
  if (e.key === 'End')  { navigate(images().length - 1); e.preventDefault(); }
});

populateSelect();
render();
"""


def generate_viewer(runs: list[tuple[str, str, list[str]]]) -> str:
    """viewer.html を生成する。DATA JSON を埋め込む。"""
    runs_dict: dict[str, list[str]] = {
        f"timing-{ts_raw}": pngs
        for ts_raw, _, pngs in runs
    }
    data_json = json.dumps({"runs": runs_dict}, ensure_ascii=False)
    js = _VIEWER_JS.replace("/*DATA_JSON*/", data_json)

    return f"""\
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>8080 Timing SS Viewer</title>
  <style>
{_VIEWER_CSS}  </style>
</head>
<body>
  <div id="bar">
    <!-- 左: 前ナビボタン -->
    <div class="bar-left">
      <button id="btn-ll" title="最初へ (Home)">&#x00AB;</button><!-- « -->
      <button id="btn-l"  title="前へ (← / PgUp)">&#x2039;</button><!-- ‹ -->
    </div>
    <!-- 中央: ドロップダウン + カウンター -->
    <div class="bar-center">
      <select id="case-sel" title="ケースを選択"></select>
      <span   id="counter"></span>
    </div>
    <!-- 右: 次ナビボタン + リンク -->
    <div class="bar-right">
      <button id="btn-r"  title="次へ (→ / PgDn)">&#x203A;</button><!-- › -->
      <button id="btn-rr" title="最後へ (End)">&#x00BB;</button><!-- » -->
      <a id="raw-link" class="bar-link" href="#" target="_blank" rel="noopener">PNG ↗</a>
      <a id="back-link" class="bar-link" href="index.html">▤ Gallery</a>
    </div>
  </div>
  <div id="img-wrap">
    <img id="main-img" alt="">
  </div>
<script>
{js}
</script>
</body>
</html>
"""


# ── index.html ────────────────────────────────────────────────────────────────

_CSS = """\
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: monospace;
  font-size: 13px;
  background: #f5f5f5;
  color: #111;
  padding: 16px 20px 40px;
}
h1 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #333;
}
h1 span { color: #888; font-weight: normal; font-size: 13px; }
details { margin-bottom: 20px; }
details[open] summary { margin-bottom: 10px; }
summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  padding: 4px 6px;
  background: #e0e0e0;
  border-radius: 4px;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}
summary::-webkit-details-marker { display: none; }
summary .arrow { font-size: 10px; color: #666; }
summary .count { font-weight: normal; font-size: 12px; color: #666; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}
.card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: box-shadow .15s;
}
.card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.card img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  object-position: left center;
  display: block;
  background: #222;
}
.card .lbl {
  font-size: 11px;
  padding: 3px 6px;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty { color: #aaa; font-style: italic; padding: 12px; }
"""


def _run_section(
    ts_raw: str,
    ts_label: str,
    pngs: list[str],
    open_: bool,
) -> str:
    dir_rel  = f"timing-{ts_raw}"
    run_key  = dir_rel
    count    = len(pngs)
    open_attr = " open" if open_ else ""

    cards = "\n".join(
        f'      <a class="card" href="viewer.html?run={run_key}&i={i}" '
        f'title="{_label(p)}">\n'
        f'        <img src="{dir_rel}/{p}" loading="lazy" alt="{_label(p)}">\n'
        f'        <span class="lbl">{_label(p)}</span>\n'
        f'      </a>'
        for i, p in enumerate(pngs)
    )

    return (
        f'  <details{open_attr}>\n'
        f'    <summary>'
        f'<span class="arrow">▶</span>'
        f' {ts_label}'
        f' <span class="count">({count} cases)</span>'
        f'</summary>\n'
        f'    <div class="grid">\n'
        f'{cards}\n'
        f'    </div>\n'
        f'  </details>'
    )


def generate_index(runs: list[tuple[str, str, list[str]]]) -> str:
    total = sum(len(pngs) for _, _, pngs in runs)
    now   = datetime.now().strftime("%Y-%m-%d %H:%M")

    if runs:
        sections = "\n\n".join(
            _run_section(ts_raw, ts_label, pngs, open_=(i == 0))
            for i, (ts_raw, ts_label, pngs) in enumerate(runs)
        )
        body = sections
    else:
        body = (
            '  <p class="empty">スクリーンショットがありません。<br>'
            'doTest.sh --timing-ss を実行してください。</p>'
        )

    return f"""\
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Intel 8080 Timing SS Gallery</title>
  <style>
{_CSS}  </style>
</head>
<body>
  <h1>Intel 8080 Timing Diagrams
    <span>— {len(runs)} run(s) / {total} cases &nbsp;|&nbsp; generated {now}</span>
  </h1>

{body}
</body>
</html>
"""


def main() -> None:
    runs = collect_runs()

    OUTPUT_HTML.write_text(generate_index(runs), encoding="utf-8")
    print(f"index.html 生成: {OUTPUT_HTML}")

    VIEWER_HTML.write_text(generate_viewer(runs), encoding="utf-8")
    print(f"viewer.html 生成: {VIEWER_HTML}")

    print(f"  {len(runs)} run(s) / {sum(len(p) for _, _, p in runs)} cases")


if __name__ == "__main__":
    main()
