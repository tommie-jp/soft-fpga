#!/usr/bin/env python3
"""パンフレット用の QR コード PNG を qr/ に書き出す。URL を変えるときはここだけ直す。"""
import sys
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_M

# 出力名 → URL。パンフレット (pamphlet.html) の qr/<名前>.png と対応する。
QR_TARGETS = {
    "rup": "https://github.com/tommie-jp/reversi-uart-protocol",
    "softfpga": "https://tommie-jp.github.io/soft-fpga/",
    "qrnote": "https://qr-demo.tommie.jp",
    "fence": "https://tommie-jp.github.io/tommie-fence/",
    "profile": "https://github.com/tommie-jp",  # プロフィール README が表示されるページ
}

OUT_DIR = Path(__file__).resolve().parent / "qr"
BOX_SIZE = 12  # 1 モジュールの画素数。印刷で 22 mm 以上になるよう大きめに取る
BORDER = 2  # 周囲の余白（モジュール数）。白地の上に載せるので最小限


def main() -> int:
    OUT_DIR.mkdir(exist_ok=True)
    for name, url in QR_TARGETS.items():
        qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=BOX_SIZE, border=BORDER)
        qr.add_data(url)
        qr.make(fit=True)
        path = OUT_DIR / f"{name}.png"
        qr.make_image(fill_color="black", back_color="white").save(path)
        print(f"{path.name}: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
