#!/usr/bin/env python3
"""
check-broken-links.py — GitHub Pages の内部リンク切れチェック

Usage:
    python3 check-broken-links.py <base_url>

Exit codes:
    0 - リンク切れなし
    1 - リンク切れあり
"""

import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlparse

GREEN = '\033[0;32m'
RED   = '\033[0;31m'
RESET = '\033[0m'

HEADERS = {"Cache-Control": "no-cache", "User-Agent": "soft-fpga-link-checker/1.0"}

SKIP_PREFIXES = ("#", "javascript:", "mailto:", "data:")


def ok(msg):   print(f"    {GREEN}✓{RESET}  {msg}")
def fail(msg): print(f"    {RED}✗{RESET}  {msg}")
def info(msg): print(f"    {msg}")


def fetch_links(page_url, base_host):
    """HTML ページから同一オリジンのリンクを抽出する。"""
    try:
        req = urllib.request.Request(page_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        info(f"取得失敗: {page_url} — {e}")
        return []

    links = []
    for val in re.findall(r'(?:href|src)=["\']([^"\']*)["\']', html):
        if not val or any(val.startswith(p) for p in SKIP_PREFIXES):
            continue
        full = urljoin(page_url, val).split("#")[0]
        parsed = urlparse(full)
        if parsed.scheme in ("http", "https") and parsed.netloc == base_host:
            links.append(full)
    return links


def check_url(url):
    """URL の HTTP ステータスコードを返す。HEAD が 405 なら GET で再試行。"""
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code == 405:
                continue
            return e.code
        except Exception:
            return 0
    return 0


def main():
    if len(sys.argv) < 2:
        print(f"使い方: {sys.argv[0]} <base_url>", file=sys.stderr)
        return 1

    base_url = sys.argv[1].rstrip("/")
    base_host = urlparse(base_url).netloc

    seed_pages = [
        base_url + "/",
        base_url + "/examples/06-8080/web/",
        base_url + "/test/ss/8080/index.html",   # ギャラリー: PNG リンクを確認
        base_url + "/test/ss/8080/viewer.html",  # ビューワー: image-viewer.{css,js} を確認
    ]

    all_links = set()
    for page in seed_pages:
        found = fetch_links(page, base_host)
        all_links.update(found)
        info(f"{len(found)} リンクを抽出: {page}")

    if not all_links:
        info("チェック対象リンクなし")
        return 0

    info(f"合計 {len(all_links)} 件をチェック中...")
    print()

    broken = 0
    for url in sorted(all_links):
        rel = url[len(base_url):] or "/"
        code = check_url(url)
        if code == 200:
            ok(f"{code}  {rel}")
        else:
            fail(f"{code}  {rel}")
            broken += 1

    print()
    if broken:
        info(f"{RED}{broken} 件のリンク切れ{RESET}")
        return 1
    else:
        info(f"{GREEN}リンク切れなし ✓{RESET}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
