#!/usr/bin/env python3
"""
04-6502 Apple-I 手動確認用 HTTP サーバー（Ctrl+C で停止）
Cache-Control: no-cache ヘッダーを付与し、古い sim.wasm がキャッシュされないようにする。
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


os.chdir(ROOT)
print(f"HTTP サーバー起動中 (ポート {PORT}) — Ctrl+C で停止")
print(f"URL: http://localhost:{PORT}/index.html")
HTTPServer(("", PORT), NoCacheHandler).serve_forever()
