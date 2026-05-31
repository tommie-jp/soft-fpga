#!/usr/bin/env python3
"""
check-gallery-links.py — ローカル HTML が参照する URL を GitHub Pages でチェック

ローカルの HTML ファイルを読み込み、href / src 属性に含まれる URL を
GitHub Pages 上で HEAD リクエストして存在確認する。

デプロイ後に「ローカルで生成した index.html が参照する PNG 等が
正しく公開されているか」を検証する用途を想定。

Usage:
    python3 check-gallery-links.py <html_file> <page_url>

引数:
    html_file  検査対象のローカル HTML ファイルパス
    page_url   そのファイルに対応する GitHub Pages 上の URL
               (例: https://foo.github.io/repo/test/ss/8080/index.html)

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


def extract_links(html, page_url, base_host):
    """ローカル HTML から同一オリジンのリンクを収集する。"""
    links = set()
    for val in re.findall(r'(?:href|src)=["\']([^"\']*)["\']', html):
        if not val or any(val.startswith(p) for p in SKIP_PREFIXES):
            continue
        # クエリ・フラグメントを除いたパスのみチェック（クエリは JS で処理）
        path = val.split("?")[0].split("#")[0]
        if not path:
            continue
        full = urljoin(page_url, path)
        if urlparse(full).netloc == base_host:
            links.add(full)
    return links


def check_url(url):
    """HTTP ステータスコードを返す。HEAD が 405 なら GET で再試行。"""
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
    if len(sys.argv) < 3:
        print(f"使い方: {sys.argv[0]} <html_file> <page_url>", file=sys.stderr)
        return 1

    html_file = sys.argv[1]
    page_url  = sys.argv[2]
    base_host = urlparse(page_url).netloc
    # 相対 URL 解決のベース（page_url のディレクトリ部分）
    page_dir  = page_url.rsplit("/", 1)[0] + "/"

    try:
        html = open(html_file, encoding="utf-8").read()
    except OSError as e:
        print(f"ファイル読み込み失敗: {html_file} — {e}", file=sys.stderr)
        return 1

    links = extract_links(html, page_url, base_host)
    if not links:
        info("チェック対象リンクなし")
        return 0

    info(f"{len(links)} 件をチェック中 ({html_file})")
    print()

    broken = 0
    for url in sorted(links):
        rel = url[len(page_dir):] if url.startswith(page_dir) else url
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
