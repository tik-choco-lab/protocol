# tc-books の localStorage キー

複式簿記の会計/家計簿アプリ。mistlib 使用: あり(暗号化バックアップバンドルの `storage_add` CID保存に使う)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-books:journal-v1` | 仕訳一覧 | tc-books | tc-books | tc-books本体(他worker実装中) |
| `tc-books:accounts-v1` | 勘定科目一覧 | tc-books | tc-books | tc-books本体(他worker実装中) |
| `tc-books:settings-v1` | アプリ設定 | tc-books | tc-books | tc-books本体(他worker実装中) |
| `tc-books:theme` | テーマ設定 | tc-books | tc-books | tc-books本体(他worker実装中) |
| `tc-books:node-id` | mistlib ノードID | tc-books | tc-books | tc-books本体(他worker実装中) |
| `tc-books:backup-publish-state-v1` | `{ v: 1; signature: string }`(バックアップバンドルの内容シグネチャ。タイムスタンプ相当を除いたSHA-256) | tc-books | tc-books | `books-backup` トピックの発行側変更検知用(無限churn防止)。契約対象外のアプリローカルキー |
| `tc-shared-books-backup-v1` | `SharedRecord`(`meta` は `BooksBackupMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-books | **tc-storage(クロスアプリ読み取り)** | 共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `books-backup` トピック |

## 共有バス参加 (sharedBus)

tc-books は [../SHARED_BUS.md](../SHARED_BUS.md) の汎用共有バス(`tc-shared-<topic>-v1` +
BroadcastChannel `tc-shared-bus-v1`)を vendor コピーしている(`tc-books/src/lib/sharedBus.ts`)。
参加しているトピック:

- **`books-backup`(書き手)**: 仕訳/勘定科目/アプリ設定の変更にデバウンス後追従して
  `publishShared("books-backup", "", meta)` を呼ぶ(起動時にも1回発行)。使い捨て
  AES-256-GCM鍵で暗号化したバックアップバンドルを mistlib の `storage_add` でCID化し、
  安定ID `tc-books-backup` に対する「生きているコピーは常に1つ」の単一レコード置換パターンを
  採る(`town-backup` と同型)。読み手(tc-storage)の挙動を含む詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `books-backup`」を参照。

## app-manifest

`publishes: ["books-backup"]`, `consumes: []`, `reads: []`([app-manifest.md](../app-manifest.md)参照)。

## 特記事項

- 本ドキュメントは tc-books のエコシステム契約登録(sharedBus / app-manifest / llm-config
  参加)のみを対象としており、tc-books アプリ本体の実装は別workerが進行中。ローカル専用キーの
  詳細スキーマ(仕訳・勘定科目の型など)はtc-books本体の実装確定後に追記すること。
