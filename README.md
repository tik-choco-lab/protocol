# Protocol

tik-choco 系プロジェクトのプロトコル定義を扱うリポジトリ。

- ネットワーク/メッセージプロトコルの定義・生成ツール(TUI, Go): `cmd/`, `internal/`
- アプリ間データ共有契約(localStorage/OPFS)の仕様: [docs/data-contracts/](docs/data-contracts/README.md)

## Web サイト

<https://tik-choco-lab.github.io/protocol/>

`index.html` はビルド不要の単一ページで、`main` への push 時に
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) が
リポジトリをそのまま GitHub Pages へ配信する。提供するものは3つ:

- **概要** — 共有契約とアプリ別カタログの一覧。Markdown はページ内でレンダリングする
- **キーカタログ** — 全アプリの localStorage キーを1つに束ねた横断ビュー。
  同じキーが複数アプリのカタログに現れる場合は1行にまとまり、書き手・読み手・
  定義元をまとめて確認できる(個々のドキュメントには無い視点)
- **パケット定義** — `output/strict/` のバイナリプロトコル定義

### site-index.json の再生成

ページのナビゲーション・キーカタログ・検索インデックスは `site-index.json` から
読み込む。**`docs/data-contracts/` 配下や `output/strict/manifest.json` を編集したら
再生成してコミットすること**:

```sh
node scripts/gen-site-index.mjs           # 生成
node scripts/gen-site-index.mjs --check    # 古ければ非ゼロ終了(CI 向け)
```

### ローカルで確認する

`file://` では `fetch` がブロックされるため静的サーバー経由で開く:

```sh
npx serve .          # または: python -m http.server
```
