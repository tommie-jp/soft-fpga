#!/usr/bin/env python3
"""COOP/COEP ヘッダー付き HTTP サーバー（SharedArrayBuffer 有効化）"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class COEPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy',   'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # アクセスログ抑制


print(f'http://localhost:{PORT}/  (COOP/COEP 有効 — SharedArrayBuffer OK)')
http.server.test(HandlerClass=COEPHandler, port=PORT, bind='0.0.0.0')
