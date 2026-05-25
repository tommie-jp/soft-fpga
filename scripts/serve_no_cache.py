#!/usr/bin/env python3
"""serve_no_cache.py — Cache-Control: no-cache を付ける開発用 HTTP サーバー。

使い方:
    python3 scripts/serve_no_cache.py [port] [directory]

デフォルト: ポート 8080、ディレクトリはスクリプトの親ディレクトリ（リポジトリ root）。
"""

import functools
import http.server
import sys
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """全レスポンスに Cache-Control: no-cache を付与するハンドラー。"""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:  # noqa: D102
        # GET/HEAD 以外（ブラウザ起動確認の HEAD も含む）のみ表示してログを絞る
        if args and str(args[0]).startswith(("GET", "POST")):
            super().log_message(fmt, *args)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    directory = sys.argv[2] if len(sys.argv) > 2 else str(Path(__file__).parent.parent)
    handler = functools.partial(NoCacheHandler, directory=directory)
    http.server.test(HandlerClass=handler, port=port)


if __name__ == "__main__":
    main()
