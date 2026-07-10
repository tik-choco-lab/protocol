# 規約

## 新規キーの命名規約

- 新規キーは **`tc-<app>:<name>`** 形式(コロン区切り、`tc-note`/`tc-chat`/`tc-mistllm` が
  概ねこの規約に従っている)を推奨する。
- 既存の `mist_*`(tc-pdf-viewer)、`tc-<app>-<name>-v1`(tc-storage/tc-translate/tc-home、
  ハイフン区切り+version サフィックス)はレガシーとして**現状維持**する。リネームによる
  クロスアプリ読み取りの破壊を避けるため、既存キーは移行しない。
- スキーマを破壊的に変更しない限り、既存キーのままフィールド追加は可能(下記「スキーマ進化
  ルール」参照)。
- アプリを横断して共有することを意図した「共有キー」(例: `tc-shared-did-identity-cid-v1`)は、
  あえてアプリ名プレフィックスを付けず `tc-shared-<name>` 形式にする。現状この方式は
  DID identity で tc-storage・tc-chat・tc-vrm-viewer・tc-news の4アプリが採用しており、
  仕様は [docs/did-identity.md](did-identity.md) を参照。新たに真の共有データを設計する場合は
  この方式を検討すること。

## スキーマ進化ルール

1. **後方互換な変更**(フィールド追加、optional 化)は同じキーのままでよい。読み手は
   未知フィールドを無視し、欠落フィールドにはデフォルト値を当てる実装にすること。
2. **破壊的な変更**(型変更、必須フィールド削除、意味変更)は以下のいずれかを取る:
   - 新しいキー名を使う(例: `tc-storage-settings-v1` → `tc-storage-settings-v2`)。
   - 値に `version` フィールドを持たせ、読み手がバージョンごとに分岐する。
3. **旧形式フォールバックの例**: tc-pdf-viewer の `mist_ocr_markdown_index` は値が
   CID 文字列(旧形式)と `{ content: string }` オブジェクト(新形式)の両方で存在する
   ([docs/keys/tc-pdf-viewer.md](keys/tc-pdf-viewer.md) 参照)。移行期間中は
   両方の形式をハンドリングするパーサーを書き、片方に決め打ちしないこと。tc-note の
   `importDocument.ts` がこのパターンの実装例。

## クロスアプリ読み取りの原則

- **読み手が防御的にパースする**。他アプリのキーを読む場合、`JSON.parse` は必ず
  try/catch し、フィールドの型を検証してからデフォルト値にフォールバックすること
  (書き手側のスキーマ変更で壊れることを前提にする)。
- **書き手は他アプリを知らない**。あるアプリのキーを別アプリが読んでいても、書き手側の
  実装はそれを意識せず自分のドメインのためだけにスキーマを進化させてよい。クロスアプリ
  読み取りの互換性維持は読み手側の責務。
- クロスアプリで読まれているキーがあれば、書き手アプリの `docs/keys/<app>.md` にその旨
  (読み手アプリ名)を明記する。本リポジトリ調査で判明している既知のクロスアプリ読み取り:
  - tc-note → tc-pdf-viewer: `mist_ocr_markdown_index`, `mist_translated_markdown_index`
  - tc-note → tc-translate: `tc-translate-history-v1`(キー名がハードコードで衝突・共有)
  - tc-storage ⇄ tc-chat ⇄ tc-vrm-viewer ⇄ tc-news: DID identity は `tc-shared-did-identity-cid-v1`
    経由で共有される(各アプリのローカルミラーキーは独立だが最終的に同一DIDへ収束する)。
    詳細は [docs/did-identity.md](did-identity.md) 参照。
  - tc-pdf-viewer → tc-note: OCR Markdown インデックスは `mist_ocr_markdown_index` の直接
    クロスアプリ読み取りに加え、汎用共有バス `sharedBus`(`tc-shared-<topic>-v1` +
    BroadcastChannel `tc-shared-bus-v1`)のトピック `ocr-markdown-index` 経由でも共有される。
    tc-note / tc-storage / tc-pdf-viewer の3アプリに同一契約の `sharedBus` モジュールが
    vendor コピーされている。詳細は [docs/SHARED_BUS.md](SHARED_BUS.md) 参照。

## 開発時の注意(再掲)

dev サーバーはアプリごとに別ポートで動くため localStorage/OPFS は共有されない。
クロスアプリ連携を確認する際は、本番相当の同一オリジン配信で行うこと(README.md 参照)。
