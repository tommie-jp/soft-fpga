#!/usr/bin/env python3
"""パンフレット PDF に作者などのメタデータを書き込む（Chrome の印刷では入らないため後付けする）。

使い方: set_pdf_meta.py <PDF>   （PDF を上書きする。リンク注釈はそのまま残る）
"""
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

AUTHOR = "tommie.jp"
SUBJECT = "自作CPUオセロ大会2（2026-11-28）配布資料"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    path = Path(argv[1])
    writer = PdfWriter(clone_from=PdfReader(path))
    writer.add_metadata({"/Author": AUTHOR, "/Subject": SUBJECT})
    tmp = path.with_suffix(".pdf.tmp")
    with tmp.open("wb") as f:
        writer.write(f)
    tmp.replace(path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
