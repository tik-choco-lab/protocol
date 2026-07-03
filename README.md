# tc-protocol

`tik-choco` 配下のアプリ群(tc-note, tc-pdf-viewer, tc-storage, tc-chat, tc-translate,
tc-mistllm, tc-vrm-viewer, tc-home)が暗黙に共有している「同一オリジンでのデータ共有」契約を
明文化するための仕様リポジトリです。

## 目的

これらのアプリは同一ドメインのサブパス(例 `tik-choco.github.io/<app>/`)で配信され、
ブラウザの `localStorage` と `mistlib` の OPFS バックエンド(コンテンツアドレス型ストア、
`storage_add` / `storage_get`)をオリジン単位で共有します。アプリ間連携は主に
「相手アプリの localStorage キーとスキーマを直接読む」方式で実現されています
(例: tc-note が tc-pdf-viewer の `mist_ocr_markdown_index` を読む)。

この暗黙の契約はコードを読まないと分からず、キー名の衝突やスキーマ変更による破壊が
起きやすいため、本リポジトリでキー一覧・スキーマ・命名規約・進化ルールを記録します。

## 共有モデル

- **localStorage**: オリジン単位で共有される同期ストレージ。各アプリは自分のキーに加え、
  他アプリのキーを直接 `getItem`/`setItem` することがある。
- **OPFS (mistlib 経由)**: `mistlib` の `storage_add`/`storage_get` はコンテンツアドレス
  (CID)型のバイトストアで、内部的に OPFS を使う。同一オリジンであれば mistlib を使う
  どのアプリからも同じ CID で同じデータを読み書きできる。
- **開発環境の注意**: dev サーバーは通常アプリごとに別ポート(`localhost:5173` など)で
  動くため、**別オリジン扱いとなり localStorage/OPFS は共有されない**。クロスアプリ連携の
  動作確認は、本番同様に同一オリジンの単一サブパス配信(または同一ポートでのビルド済み
  静的ホスティング)で行うこと。

## 原則: ランタイム依存禁止

このリポジトリは **npm パッケージとして各アプリから import されることを意図していません**。
以前 `file:` 依存の `tc-interop` パッケージを作って運用しようとしたが、モノレポでない
複数リポジトリ構成では `file:` 依存がビルド・デプロイ時に壊れやすく、廃止した経緯があります。

tc-protocol はあくまで**仕様ドキュメントと参照用の型定義**のみを提供します。各アプリは
必要なキー・スキーマをこのドキュメントを見ながら自分のコード内に直接実装してください
(`types/` の `.d.ts` はコピー&参照用であり、依存関係としては import しません)。

## バージョニング方針

- キー単位でスキーマを破壊的に変更する場合は、**新しいキー名を使う**か、値に
  `version` フィールドを追加してアプリ側で分岐する。
- 既存キーの値の意味を変えずにフィールドを追加する場合(後方互換)は同じキーのままでよい。
- 詳細は [docs/conventions.md](docs/conventions.md) を参照。

## ドキュメント構成

- [docs/keys/](docs/keys/) : アプリごとの localStorage キーカタログ
- [docs/conventions.md](docs/conventions.md) : 命名規約・スキーマ進化ルール・クロスアプリ読み取りの原則
- [types/](types/) : 各アプリの値スキーマの TypeScript 型定義(参照用)
