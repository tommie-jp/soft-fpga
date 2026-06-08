#!/usr/bin/env python3
"""
check-md-links.py — docs/**/*.md 内のリンク切れを GitHub Pages で検証（デプロイ後）

MD ファイル中の Markdown リンク [text](url) と HTML href="url" を収集し、
web ビューワーのベース URL から URL を解決して HTTP HEAD でチェックする。

対象: .html / .png / .jpg / .gif （ソースコードファイルはスキップ）
同一オリジン（github.io）のリンクのみ検証する。

Usage:
    python3 check-md-links.py --docs-dir <dir> --web-base <url>

例:
    python3 scripts/check-md-links.py \\
        --docs-dir docs/09-PDP11 \\
        --web-base https://tommie-jp.github.io/soft-fpga/examples/09-pdp11/web/

Exit codes:
    0 - リンク切れなし
    1 - リンク切れあり
"""

import argparse
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

GREEN  = '\033[0;32m'
RED    = '\033[0;31m'
RESET  = '\033[0m'

HEADERS = {"Cache-Control": "no-cache", "User-Agent": "soft-fpga-md-link-checker/1.0"}

CHECK_EXTS = {'.html', '.png', '.jpg', '.jpeg', '.gif', '.webp'}
SKIP_EXTS  = {
    '.cpp', '.c', '.h', '.v', '.vhd', '.py', '.mjs', '.js',
    '.ts', '.sh', '.dsk', '.txt', '.json', '.yaml', '.yml',
    '.md', '.s', '.asm', '.hex',
}


def extract_links(md_text: str) -> list[str]:
    links: list[str] = []
    for m in re.finditer(r'\[(?:[^\]]*)\]\(([^)]+)\)', md_text):
        links.append(m.group(1).split('#')[0].split('?')[0])
    for m in re.finditer(r'href=["\']([^"\']+)["\']', md_text):
        links.append(m.group(1).split('#')[0].split('?')[0])
    for m in re.finditer(r'src=["\']([^"\']+)["\']', md_text):
        links.append(m.group(1).split('#')[0].split('?')[0])
    return links


def should_check(url: str) -> bool:
    if not url:
        return False
    if any(url.startswith(p) for p in ('#', 'javascript:', 'mailto:', 'data:')):
        return False
    ext = Path(urlparse(url).path).suffix.lower()
    if ext in SKIP_EXTS:
        return False
    return ext in CHECK_EXTS


def check_url(url: str, retries: int = 3, retry_delay: float = 5.0) -> int:
    """HTTP ステータスコードを返す。200 以外なら retries 回リトライする。"""
    code = 0
    for attempt in range(retries):
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(url, method=method, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return resp.status
            except urllib.error.HTTPError as e:
                if method == "HEAD" and e.code == 405:
                    continue
                code = e.code
                break
            except Exception:
                code = 0
                break
        else:
            code = 0
        if code == 200:
            return 200
        if attempt < retries - 1:
            time.sleep(retry_delay)
    return code


def main() -> int:
    ap = argparse.ArgumentParser(description='MD ファイルのリンク切れを GitHub Pages で検証')
    ap.add_argument('--docs-dir', required=True, help='MD ファイルが入ったディレクトリ')
    ap.add_argument('--web-base', required=True,
                    help='ブラウザが MD を表示するときのベース URL（末尾 / 必須）')
    ap.add_argument('--retries', type=int,   default=3,   help='リトライ回数（デフォルト 3）')
    ap.add_argument('--delay',   type=float, default=5.0, help='リトライ間隔 秒（デフォルト 5）')
    args = ap.parse_args()

    docs_dir = Path(args.docs_dir)
    web_base = args.web_base if args.web_base.endswith('/') else args.web_base + '/'
    base_host = urlparse(web_base).netloc

    md_files = sorted(docs_dir.glob('*.md'))
    if not md_files:
        print(f"MD ファイルが見つかりません: {docs_dir}", file=sys.stderr)
        return 1

    # URL → 参照元ファイル名のセット
    link_sources: dict[str, set[str]] = {}
    for md_path in md_files:
        text = md_path.read_text(encoding='utf-8')
        for raw in extract_links(text):
            if not should_check(raw):
                continue
            if raw.startswith('http://') or raw.startswith('https://'):
                if urlparse(raw).netloc != base_host:
                    continue
                abs_url = raw
            else:
                abs_url = urljoin(web_base, raw)
                if urlparse(abs_url).netloc != base_host:
                    continue
            link_sources.setdefault(abs_url, set()).add(md_path.name)

    if not link_sources:
        print("  チェック対象リンクなし")
        return 0

    print(f"  {len(link_sources)} 件をチェック中 ({len(md_files)} 個の MD ファイル)")
    print()

    broken = 0
    for abs_url in sorted(link_sources):
        src_files = ', '.join(sorted(link_sources[abs_url]))
        code = check_url(abs_url, retries=args.retries, retry_delay=args.delay)
        rel = abs_url[abs_url.index(base_host) + len(base_host):]
        if code == 200:
            print(f"    {GREEN}✓{RESET}  {code}  {rel}")
        else:
            print(f"    {RED}✗{RESET}  {code}  {rel}  ← {src_files}")
            broken += 1

    print()
    if broken:
        print(f"  {RED}{broken} 件のリンク切れ{RESET}")
        return 1
    print(f"  {GREEN}リンク切れなし ✓{RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
