#!/usr/bin/env python3
"""
check-pdp11-links.py — 09-pdp11 WASM index.html のローカルリンク切れチェック

デプロイ前にローカルファイルシステムで以下を検証する:
  1. index.html の <script src> / <link href> ローカルファイルの存在
  2. sim-worker.js の importScripts 参照ファイルの存在
  3. fetch() で参照するディスクイメージの存在
  4. docs-panel の openDoc() 参照 .md ファイルの存在
  5. js/sft-pdp11-docs.js の PDP11_DOC_LIST 参照 .md ファイルの存在
  6. 一貫性チェック: docs-panel と PDP11_DOC_LIST の差分

Usage:
    python3 scripts/check-pdp11-links.py [web_root]

    web_root: 省略時は examples/09-pdp11/web（スクリプトの位置から自動算出）

Exit codes:
    0 - エラーなし（警告のみは 0）
    1 - ファイル不在または不整合あり
"""

import os
import re
import sys

# ── ANSI カラー ────────────────────────────────────────────────────────────────
GREEN  = '\033[0;32m'
RED    = '\033[0;31m'
YELLOW = '\033[0;33m'
CYAN   = '\033[0;36m'
RESET  = '\033[0m'


def ok(msg):   print(f"    {GREEN}✓{RESET}  {msg}")
def fail(msg): print(f"    {RED}✗{RESET}  {msg}")
def warn(msg): print(f"    {YELLOW}⚠{RESET}  {msg}")
def info(msg): print(f"    {msg}")
def section(title): print(f"\n  {CYAN}── {title}{RESET}")


def resolve(web_root: str, path: str) -> str:
    """web_root 相対パスを絶対パスに解決する（../ も処理）。"""
    return os.path.normpath(os.path.join(web_root, path))


def check_file(web_root: str, rel_path: str, label: str = "") -> bool:
    """ファイルの存在を確認して結果を表示。True = 存在する。"""
    abs_path = resolve(web_root, rel_path)
    display = label or rel_path
    if os.path.isfile(abs_path):
        ok(display)
        return True
    else:
        fail(f"{display}  → {abs_path}")
        return False


def main() -> int:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root  = os.path.dirname(script_dir)

    if len(sys.argv) >= 2:
        web_root = os.path.abspath(sys.argv[1])
    else:
        web_root = os.path.join(repo_root, "examples", "09-pdp11", "web")

    index_html  = os.path.join(web_root, "index.html")
    worker_js   = os.path.join(web_root, "sim-worker.js")
    docs_js     = os.path.join(web_root, "js", "sft-pdp11-docs.js")

    print(f"  web_root: {web_root}")

    # ── ファイルの存在を前提チェック ─────────────────────────────────────────
    for path, label in [(index_html, "index.html"), (worker_js, "sim-worker.js"), (docs_js, "js/sft-pdp11-docs.js")]:
        if not os.path.isfile(path):
            print(f"{RED}✗ 前提ファイルが見つかりません: {path}{RESET}", file=sys.stderr)
            return 1

    html    = open(index_html,  encoding="utf-8").read()
    worker  = open(worker_js,   encoding="utf-8").read()
    docs_js_src = open(docs_js, encoding="utf-8").read()

    errors = 0

    # ════════════════════════════════════════════════════════════════════════
    # 1. index.html のローカル JS / CSS 参照
    # ════════════════════════════════════════════════════════════════════════
    section("1. index.html — <script src> / <link href> ローカルファイル")
    for attr_val in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', html):
        if attr_val.startswith("http") or attr_val.startswith("#") or \
           attr_val.startswith("javascript") or attr_val.startswith("data:"):
            continue
        if not check_file(web_root, attr_val):
            errors += 1

    # ════════════════════════════════════════════════════════════════════════
    # 2. sim-worker.js の importScripts
    # ════════════════════════════════════════════════════════════════════════
    section("2. sim-worker.js — importScripts")
    for m in re.findall(r"importScripts\('([^']+)'\)", worker):
        if not check_file(web_root, m):
            errors += 1

    # ════════════════════════════════════════════════════════════════════════
    # 3. fetch() で参照するリソース
    # ════════════════════════════════════════════════════════════════════════
    section("3. index.html — fetch() 参照リソース")
    for m in re.findall(r"fetch\('([^']+)'", html):
        if not check_file(web_root, m):
            errors += 1

    # ════════════════════════════════════════════════════════════════════════
    # 4. docs-panel の openDoc() 参照
    # ════════════════════════════════════════════════════════════════════════
    section("4. index.html — docs-panel openDoc() 参照 .md ファイル")
    panel_files: list[str] = re.findall(r"openDoc\('([^']+\.md)'", html)
    for md in panel_files:
        if not check_file(web_root, f"docs/{md}", md):
            errors += 1

    # ════════════════════════════════════════════════════════════════════════
    # 5. PDP11_DOC_LIST 参照
    # ════════════════════════════════════════════════════════════════════════
    section("5. sft-pdp11-docs.js — PDP11_DOC_LIST 参照 .md ファイル")
    doclist_files: list[str] = re.findall(r"file:\s*'([^']+\.md)'", docs_js_src)
    for md in doclist_files:
        if not check_file(web_root, f"docs/{md}", md):
            errors += 1

    # ════════════════════════════════════════════════════════════════════════
    # 6. 一貫性チェック: docs-panel ↔ PDP11_DOC_LIST
    # ════════════════════════════════════════════════════════════════════════
    section("6. 一貫性チェック: docs-panel ↔ PDP11_DOC_LIST")
    panel_set   = set(panel_files)
    doclist_set = set(doclist_files)

    only_in_list  = doclist_set - panel_set   # リストにあるがパネルにない
    only_in_panel = panel_set - doclist_set   # パネルにあるがリストにない

    if not only_in_list and not only_in_panel:
        ok("docs-panel と PDP11_DOC_LIST が一致しています")
    else:
        for md in sorted(only_in_list):
            warn(f"PDP11_DOC_LIST のみ（docs-panel にリンクなし）: {md}")
            errors += 1
        for md in sorted(only_in_panel):
            warn(f"docs-panel のみ（PDP11_DOC_LIST に未登録）: {md}")
            errors += 1

    # ════════════════════════════════════════════════════════════════════════
    # 結果サマリ
    # ════════════════════════════════════════════════════════════════════════
    print()
    if errors:
        info(f"{RED}{errors} 件のエラー{RESET}")
        return 1
    else:
        info(f"{GREEN}リンク切れ・不整合なし ✓{RESET}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
