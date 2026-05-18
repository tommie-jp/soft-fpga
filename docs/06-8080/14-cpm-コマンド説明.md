# 14. cpm コマンド説明

`examples/06-8080/build/cpm` — Intel 8080 / CP/M 2.2 soft-FPGA シミュレータ。

## 1. 書式

```text
cpm [動作モードフラグ] [ファイル指定オプション]
```

動作モードフラグを省略すると**対話型 CP/M** として起動する。

## 2. 動作モードフラグ

| フラグ | 説明 |
|--------|------|
| `-h`, `--help` | ヘルプを表示して終了 |
| `--test` | ハーネス内蔵スモークテスト (`MVI+OUT+HLT`) |
| `--boot-test` | CP/M ブートテスト（`A>` プロンプト検出で合否判定） |
| `--run-test <file>` | ベアメタルバイナリをロードして実行し P/F 判定 |
| `--bare-test <file>` | ベアメタルバイナリを長時間タイムアウトで実行 |
| `--exec <cmd>` | CP/M を起動してコマンドを実行し、出力を stdout に表示 |

### `--test`

CP/M なしで vm80a 単体動作を確認する最小テスト。

```bash
cpm --test
# → [test] sim_test: 2 bytes out (Hi)   exit 0 = PASS
```

### `--boot-test`

BIOS → CCP+BDOS の起動シーケンスを検証する。`A>` プロンプトが出れば exit 0。

```bash
cpm --boot-test
# → A>
# → --- CP/M boot: OK (A> found) ---   exit 0 = PASS
```

### `--run-test <file>`

ベアメタルバイナリ（CP/M 不要）を `0x0000` にロードして実行する。
`P`（PASS）と `F`（FAIL）の個数で合否を判定する。最大 200 万サイクル実行。

```bash
cpm --run-test test/test_all.bin
# → PPPPPPPPPPPPPPPPPPPP
# → --- 20 group(s) tested: ALL PASS ---   exit 0 = PASS
```

### `--bare-test <file>`

`--run-test` の長時間版。最大 200 億サイクル、無出力タイムアウト 2 億サイクル。
「Tests complete」または「Press a key」が現れれば正常終了と判定する。

```bash
cpm --bare-test prog.bin
```

### `--exec <cmd>`

CP/M を起動してプロンプト待ち後、コマンドを送信して出力を表示する。
「Tests complete」が現れれば exit 0、タイムアウトなら exit 1。

```bash
cpm --exec 8080EX1   # CPU エクササイザ実行
cpm --exec DIR       # DIR の出力を表示（出力確認用）
```

## 3. ファイル指定オプション

省略時はバイナリの配置場所から自動解決する（どのディレクトリから実行しても動作する）。

| オプション | 既定値（バイナリ基準） | 説明 |
|-----------|----------------------|------|
| `--bios <path>` | `../sw/cpm/bios/bios.bin` | BIOS バイナリ |
| `--cpm <path>` | `../rom/cpm22.bin` | CCP+BDOS バイナリ |
| `--disk <path>` | `../sw/cpm/disks/cpm22.dsk` | DSK イメージ |

## 4. 使用例

```bash
# 対話型 CP/M（終了は Ctrl+C）
cpm

# テストを順番に実行
cpm --test
cpm --boot-test
cpm --run-test test/test_all.bin
cpm --exec 8080EX1

# 別のディスクイメージを指定して起動
cpm --disk /path/to/other.dsk

# 別ディレクトリからでも動作する
/path/to/build/cpm --boot-test
```

## 5. 終了コード

| 終了コード | 意味 |
|-----------|------|
| `0` | PASS / 正常終了 |
| `1` | FAIL / エラー / タイムアウト |

## 6. 参考

- [13-テスト手順.md](13-テスト手順.md) — 各テストモードの期待出力
- [10-テスト仕様書.md](10-テスト仕様書.md) — テスト設計の詳細
