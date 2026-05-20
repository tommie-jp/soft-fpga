# 05. GitHub Pages デプロイ手順

`scripts/deploy-gh-pages.sh` を使って、各エグザンプルの WASM シミュレータを
`gh-pages` ブランチへデプロイし GitHub Pages で公開する。

## 1. コマンド

リポジトリルートから実行する。

```bash
# 特定のエグザンプルだけビルドしてデプロイ（通常はこれ）
scripts/deploy-gh-pages.sh 01        # 二進カウンタ
scripts/deploy-gh-pages.sh 02        # 信号機 FSM
scripts/deploy-gh-pages.sh 03        # UART
scripts/deploy-gh-pages.sh 04        # 6502 / Apple-I
scripts/deploy-gh-pages.sh 06        # 8080 / CP/M 2.2

# ビルド済みの WASM をそのままデプロイ（ビルドをスキップ）
scripts/deploy-gh-pages.sh --no-build 06

# 全エグザンプルをビルドしてデプロイ
scripts/deploy-gh-pages.sh
```

## 2. スクリプトの動作

`scripts/deploy-gh-pages.sh` は以下を順に行う。

### 2.1 ビルド（`--no-build` でスキップ）

各エグザンプルのビルドスクリプトを実行し `web/sim.js` / `sim.wasm` を生成する。

| ID | ビルドスクリプト |
|----|----------------|
| 01 | `scripts/build-wasm.sh` |
| 02 | `scripts/build-wasm-02.sh` |
| 03 | `scripts/build-wasm-03.sh` |
| 04 | `scripts/build-wasm.sh` |
| 05 | `scripts/build-wasm.sh` |
| 06 | `scripts/build-wasm-06.sh` |

### 2.2 ワークツリー準備

`/tmp/soft-fpga-gh-pages` に `gh-pages` ブランチをチェックアウトする。

- `gh-pages` がリモートに存在する → `git fetch origin gh-pages:gh-pages`
- 存在しない → 孤立ブランチを作成して `git push -u origin gh-pages`

### 2.3 ファイルコピー

| コピー元 | コピー先（gh-pages ブランチ） |
|---------|--------------------------|
| `web/index.html`（ルート目次ページ） | `/index.html` |
| `examples/01-counter/web/{index.html,sim.js,sim.wasm,*.png,*.svg}` | `/01-counter/` |
| `examples/02-traffic-fsm/web/{index.html,sim.js,sim.wasm,*.png,*.svg}` | `/02-traffic-fsm/` |
| `examples/03-uart/web/{index.html,sim.js,sim.wasm,*.png,*.svg}` | `/03-uart/` |
| `examples/04-6502/web/{index.html,sim.js,sim.wasm,*.png,*.svg}` | `/04-6502/` |
| `examples/05-dormann/web/{index.html,sim.js,sim.wasm,*.png,*.svg}` | `/05-dormann/` |
| `examples/06-8080/web/{index.html,sim.js,sim.wasm,*.png,*.svg}` | `/06-8080/` |

### 2.4 コミット & プッシュ

差分がなければ何もしない。変更がある場合は
`git commit -m "deploy: update simulator pages"` してプッシュする。

## 3. 公開 URL

| エグザンプル | URL |
|------------|-----|
| ルート目次 | [https://tommie-jp.github.io/soft-fpga/](https://tommie-jp.github.io/soft-fpga/) |
| 01 — 二進カウンタ | [https://tommie-jp.github.io/soft-fpga/01-counter/](https://tommie-jp.github.io/soft-fpga/01-counter/) |
| 02 — 信号機 FSM | [https://tommie-jp.github.io/soft-fpga/02-traffic-fsm/](https://tommie-jp.github.io/soft-fpga/02-traffic-fsm/) |
| 03 — UART | [https://tommie-jp.github.io/soft-fpga/03-uart/](https://tommie-jp.github.io/soft-fpga/03-uart/) |
| 04 — 6502 / Apple-I | [https://tommie-jp.github.io/soft-fpga/04-6502/](https://tommie-jp.github.io/soft-fpga/04-6502/) |
| 05 — Dormann テスト | [https://tommie-jp.github.io/soft-fpga/05-dormann/](https://tommie-jp.github.io/soft-fpga/05-dormann/) |
| 06 — 8080 / CP/M 2.2 | [https://tommie-jp.github.io/soft-fpga/06-8080/](https://tommie-jp.github.io/soft-fpga/06-8080/) |

デプロイ完了時にスクリプトが該当 URL を出力する。

## 4. GitHub Pages の設定（初回のみ）

### 4.1 gh CLI のインストール

GitHub CLI (`gh`) を使うと Pages の有効化をコマンドラインで完結できる。

#### Ubuntu / Debian (WSL2 含む)

```bash
sudo apt update && sudo apt install gh
```

#### macOS

```bash
brew install gh
```

インストール後、GitHub アカウントで認証する。

```bash
gh auth login
# → GitHub.com / HTTPS or SSH / ブラウザ認証 の順に選択
```

### 4.2 Pages を有効化する

#### gh CLI を使う場合（推奨）

```bash
gh api repos/{owner}/{repo}/pages \
  --method POST \
  --field "source[branch]=gh-pages" \
  --field "source[path]=/"
```

`{owner}` と `{repo}` はリポジトリに合わせて置き換える（例: `tommie-jp/soft-fpga`）。

#### ブラウザで設定する場合

1. GitHub のリポジトリページを開き **Settings** → **Pages** に移動する
2. **Source** を **Deploy from a branch** に設定する
3. **Branch** に `gh-pages` / `/ (root)` を選択して **Save** する

> `gh-pages` ブランチがまだ存在しない場合、`deploy-gh-pages.sh` の初回実行時に
> 孤立ブランチとして自動作成・プッシュされる。
> プッシュ後に上記の設定を行えばよい。

## 5. 前提条件

- **ビルド時** — `em++` が PATH に通っているか `~/emsdk/emsdk_env.sh` が存在すること
- **デプロイ時** — `origin` への push 権限があること（`gh auth login` 済みであること）

## 6. 関連ドキュメント

- [04-docker-ビルド手順.md](04-docker-ビルド手順.md) — Docker によるビルド環境
- [06-8080/13-テスト手順.md](06-8080/13-テスト手順.md) — ローカルでの WASM テスト（`doStart.sh`）
