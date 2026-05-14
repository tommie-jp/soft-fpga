"""
共通定数: 各テストモジュールから EXAMPLES_DIR を参照するためのヘルパー。
"""
from pathlib import Path

EXAMPLES_DIR = Path(__file__).parent.parent.parent / "examples"
