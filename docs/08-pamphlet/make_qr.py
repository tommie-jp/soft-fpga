#!/usr/bin/env python3
"""パンフレット用の QR コード PNG を qr/ に書き出す。

URL の置き場は pamphlet.html の 1 か所だけ。QR 画像を包む
`<a href="URL"><img class="qr" src="qr/名前.png" ...>` から、名前と URL を読み取る。
URL を変えるときは pamphlet.html の href だけを直す。
"""
import re
import sys
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_M

HERE = Path(__file__).resolve().parent
HTML = HERE / "pamphlet.html"
OUT_DIR = HERE / "qr"
BOX_SIZE = 12  # 1 モジュールの画素数。印刷で 22 mm 以上になるよう大きめに取る
BORDER = 2  # 周囲の余白（モジュール数）。白地の上に載せるので最小限

QR_LINK = re.compile(r'<a href="([^"]+)"><img class="qr" src="qr/([A-Za-z0-9_-]+)\.png"')


def read_targets(html: str) -> dict[str, str]:
    """HTML から {QR 名: URL} を取り出す。同じ QR が複数あって URL が食い違えば失敗する。"""
    targets: dict[str, str] = {}
    for url, name in QR_LINK.findall(html):
        if targets.setdefault(name, url) != url:
            raise ValueError(f"qr/{name}.png の URL が食い違っています: {targets[name]} と {url}")
    return targets


def main() -> int:
    targets = read_targets(HTML.read_text(encoding="utf-8"))
    if not targets:
        print(f"{HTML.name} に QR の <a><img class=\"qr\"> が見つかりません", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(exist_ok=True)
    for name, url in targets.items():
        qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=BOX_SIZE, border=BORDER)
        qr.add_data(url)
        qr.make(fit=True)
        path = OUT_DIR / f"{name}.png"
        qr.make_image(fill_color="black", back_color="white").save(path)
        print(f"{path.name}: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
