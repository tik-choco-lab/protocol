# tc-storage の localStorage キー

mistlib 使用: あり(`tc-storage/src/storage/mistStorage.ts` ほか、`storage_add`/`storage_get` でファイル本文をCID保存)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-storage-settings-v1` | `AppSettings`(下記) | tc-storage | tc-storage | tc-storage/src/storage/localSettings.ts:13 |
| `tc-storage-room-id-v1` | `string` | tc-storage | tc-storage | tc-storage/src/storage/localSettings.ts:14 |
| `tc-storage-node-id-v1` | `string` | tc-storage | tc-storage | tc-storage/src/storage/localSettings.ts:39,68-73 |
| `tc-storage-did-identity-v1` | DID identity レコード(下記)、ローカル優先のミラーキー | tc-storage | tc-storage | tc-storage/src/crypto/didIdentity.ts:17 |
| `tc-shared-did-identity-cid-v1` | `string`(共有 identity レコードの mistlib CID) | tc-storage(ローカルが正の場合に書き戻す), tc-chat, tc-vrm-viewer, tc-news, tc-vrsns2 | tc-storage, tc-chat, tc-vrm-viewer, tc-news, tc-vrsns2 | tc-storage/src/crypto/sharedDidIdentity.ts:32。詳細は [../did-identity.md](../did-identity.md) |
| `tc-storage-snapshot-v1` | `StorageSnapshot` | tc-storage | tc-storage, **tc-chat, tc-vrsns2 (クロスアプリ読み取り専用)** | tc-storage/src/storage/localSnapshot.ts:4; tc-chat/src/interop/tcStorageFiles.ts:42,68-101; tc-vrsns2/src/interop/tcStorageFiles.ts:46 |
| `tc-storage-folder-access-modes-v1` | フォルダアクセスモード `Record<string, mode>` | tc-storage | tc-storage | tc-storage/src/folder/folderAccess.ts:3 |
| `tc-storage-folder-keys-v1` | フォルダ暗号鍵 `Record<string, string>` | tc-storage | tc-storage | tc-storage/src/crypto/folderKeys.ts:5 |
| `tc-storage-file-share-keys-v1` | ファイル共有鍵 `Record<string, string>` | tc-storage | tc-storage | tc-storage/src/crypto/fileShareKeys.ts:4 |
| `tc-storage-folder-sync-peers-v1` | `FolderSyncPeers` | tc-storage | tc-storage | tc-storage/src/folder/folderPeers.ts:3 |
| `tc-storage-pending-shares-v1` | 保留中の共有一覧(配列、最大件数あり) | tc-storage | tc-storage | tc-storage/src/share/pendingShares.ts:5 |
| `tc-storage-import-keys-v1` | インポート鍵 `Record<string, string>` | tc-storage | tc-storage | tc-storage/src/share/pendingShares.ts:6 |
| `tc-storage-browser-sort-mode-v1` | `string`(ソートモード) | tc-storage | tc-storage | tc-storage/src/app/appUtils.ts:8 |
| `tc-storage-browser-view-mode-v1` | `'grid' \| 'list'` | tc-storage | tc-storage | tc-storage/src/app/appUtils.ts:9,184 |
| `tc-storage-translate-imported-v1` | `string[]`(取込済みの翻訳項目ID、上限あり) | tc-storage | tc-storage | tc-storage/src/app/appTranslationsInbox.ts。共有バス `translations-inbox`(tc-translate 発行)から取り込んだ項目の冪等化用。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) |
| `tc-storage-drive-inbox-imported-v1` | `string[]`(取込済みのdrive-inboxアイテムID、上限1000件) | tc-storage | tc-storage | tc-storage/src/app/appDriveInbox.ts。共有バス `storage-drive-inbox`(tc-note 発行)から取り込んだ項目の冪等化用。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) |
| `tc-shared-note-doc-index-v1` | `SharedRecord`(`meta` は `{ notes: NoteDocIndexEntry[] }`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-note | **tc-storage(クロスアプリ読み取り)** | tc-storage/src/app/appNoteDocInbox.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `note-doc-index` トピック |
| `tc-storage-note-doc-imported-v1` | `{ v: 1, entries: Record<noteId, { cid: string; fileId: string }> }`(上限1000件) | tc-storage | tc-storage | tc-storage/src/app/appNoteDocInbox.ts。共有バス `note-doc-index`(tc-note 発行)から取り込んだノートのCID/ファイルID対応。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) |
| `tc-shared-town-backup-v1` | `SharedRecord`(`meta` は `TownBackupMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-town | **tc-storage(クロスアプリ読み取り)** | tc-storage/src/app/appTownBackupInbox.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `town-backup` トピック |
| `tc-storage-town-backup-imported-v1` | `{ v: 1, entries: Record<id, { checksum: string; fileId: string }> }` | tc-storage | tc-storage | tc-storage/src/app/appTownBackupInbox.ts。共有バス `town-backup`(tc-town 発行)から取り込んだバックアップの冪等化用(id `tc-town-backup` 固定、checksum/ファイルID対応で「生きているコピーは常に1つ」を維持)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) |
| `tc-shared-books-backup-v1` | `SharedRecord`(`meta` は `BooksBackupMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-books | **tc-storage(クロスアプリ読み取り)** | tc-storage/src/app/appBooksBackupInbox.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `books-backup` トピック |
| `tc-storage-books-backup-imported-v1` | `{ v: 1, entries: Record<id, { checksum: string; fileId: string }> }` | tc-storage | tc-storage | tc-storage/src/app/appBooksBackupInbox.ts。共有バス `books-backup`(tc-books 発行)から取り込んだバックアップの冪等化用(id `tc-books-backup` 固定、checksum/ファイルID対応で「生きているコピーは常に1つ」を維持)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) |
| `tc-shared-pdf-viewer-inbox-v1` | `SharedRecord`(`meta.items` は `FileHandoffItem[]`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | **tc-storage** | tc-pdf-viewer(クロスアプリ読み取り) | tc-storage/src/storage/fileHandoff.ts:16-21,94-129(`publishFileHandoff`); tc-storage/src/app/appFileHandoffActions.ts:24-37(`sendFileToApp`)。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `pdf-viewer-inbox` トピック |

## AppSettings

```ts
type AppSettings = {
  roomId: string
  nodeId: string
  identity: PublicDidIdentity | null
  autoConnect: boolean
  profileName: string
  avatarUrl: string
  avatarFileId: string
}
```

## PublicDidIdentity (did:key, Ed25519)

`tc-storage/src/crypto/didIdentity.ts` が正典実装。tc-chat・tc-vrm-viewer にも
verbatim コピーが存在する(下記参照)。

```ts
type PublicDidIdentity = {
  did: string
  method: 'did:key'
  keyType: 'Ed25519'
  publicKeyMultibase: string
  createdAt: string
}
```

## 特記事項

- **DID identity は共有キーで統一済み**: `tc-shared-did-identity-cid-v1`(アプリ名なし)を
  介して tc-storage・tc-chat・tc-vrm-viewer が同一の DID に収束する。Ed25519/did:key の
  暗号処理自体は `tc-storage/src/crypto/didIdentity.ts` が正典実装で、他アプリは verbatim
  コピーを持つ。tc-storage だけは起動同期パスの都合でローカルミラー
  (`tc-storage-did-identity-v1`)を正として共有ストアへ書き戻す非対称なポリシーを取る。
  詳細な照合ロジックと収束の仕組みは [../did-identity.md](../did-identity.md) を参照。
- tc-storage は mistlib storage を主データストア(ファイル本文の CID 保存)として使い、
  localStorage は設定・メタデータ・鍵材料に限定している。
- **クロスアプリ受信(translations-inbox)**: 共有バスの `translations-inbox` トピック
  (tc-translate 発行)を購読し、未取込の翻訳を「TC Translate」フォルダへ通常のアップロード
  フローで取り込む(`src/app/appTranslationsInbox.ts`)。取込済み ID は
  `tc-storage-translate-imported-v1` に記録して冪等化する。契約詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md)。
- **クロスアプリ受信(storage-drive-inbox)**: 共有バスの `storage-drive-inbox` トピック
  (tc-note 発行)を購読し、未取込のファイルを「tc-noteから追加」フォルダへ通常のアップロード
  フローで取り込む(`src/app/appDriveInbox.ts`)。各アイテムは tc-note 側で暗号化された状態で
  届くため、`storage_get` 後に AES-GCM 復号・SHA-256 チェックサム照合してから取り込む。
  取込済み ID は `tc-storage-drive-inbox-imported-v1` に記録して冪等化する。契約詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md)。tc-note は tc-storage の localStorage キーを
  直接読み書きしない(連携はこのトピック経由のみ)。
- **クロスアプリ受信(note-doc-index)**: 共有バスの `note-doc-index` トピック(tc-note発行)を
  購読し、`src/app/appNoteDocInbox.ts` が各エントリを `<タイトル>.md`(サニタイズ、フォールバック
  「無題」)としてルート直下の専用フォルダ「tc-noteのノート」へ取り込む。ノートIDごとに
  「生きているコピーは常に1つ」で、同じノートが新しいCIDで再発行された(編集された)場合は
  前回取り込んだファイルを置き換える。取込状態(ノートID→CID/ファイルIDの対応)は
  `tc-storage-note-doc-imported-v1`(上限1000件)に記録し、ユーザーが取り込み済みファイルを
  削除した場合、同じCIDは再取込しない。tc-note でのノート削除は伝播しない(v1): インデックスから
  エントリが外れるだけで、tc-storage は既存コピーを保持し続ける。ノート本文は暗号化されず
  平文CIDのまま届く(tc-note の `saveNote` が保存時点で既に平文で mistlib に保存しているため、
  `storage-drive-inbox` と異なり暗号化の必要がない)。契約詳細は [../SHARED_BUS.md](../SHARED_BUS.md)。
- **クロスアプリ受信(town-backup)**: 共有バスの `town-backup` トピック(tc-town発行)を購読し、
  `src/app/appTownBackupInbox.ts` が tc-town の全体バックアップ(`tc-town-backup.json`)を
  ルート直下の専用フォルダ「TC Town」へ取り込む。安定ID `tc-town-backup` に対し「生きている
  コピーは常に1つ」を維持し、同じIDが新しいchecksum/CIDで再発行されれば前回ファイルを
  置き換える。`storage-drive-inbox` と同様、各アイテムは tc-town 側で使い捨てAES-256-GCM鍵に
  より暗号化された状態で届くため、`storage_get` 後に復号・SHA-256チェックサム照合してから
  取り込む。取込済み状態は `tc-storage-town-backup-imported-v1`(id→checksum/fileId対応)に
  記録して冪等化する。一時的な解決失敗(mistロード・`storage_get`失敗)は取込済みマークを
  つけず再試行、恒久的な失敗(復号エラー・チェックサム不一致)は恒久的に取込済み扱いとする
  (`storage-drive-inbox` と同じ分類)。契約詳細は [../SHARED_BUS.md](../SHARED_BUS.md)。
- **クロスアプリ受信(books-backup)**: 共有バスの `books-backup` トピック(tc-books発行)を購読し、
  `src/app/appBooksBackupInbox.ts` が tc-books の帳簿バックアップ(`tc-books-backup.json`)を
  ルート直下の専用フォルダ「TC Books」へ取り込む。安定ID `tc-books-backup` に対し「生きている
  コピーは常に1つ」を維持し、同じIDが新しいchecksum/CIDで再発行されれば前回ファイルを
  置き換える。`town-backup` と同様、各アイテムは tc-books 側で使い捨てAES-256-GCM鍵により
  暗号化された状態で届くため、`storage_get` 後に復号・SHA-256チェックサム照合してから
  取り込む。取込済み状態は `tc-storage-books-backup-imported-v1`(id→checksum/fileId対応)に
  記録して冪等化する。一時的な解決失敗(mistロード・`storage_get`失敗)は取込済みマークを
  つけず再試行、恒久的な失敗(復号エラー・チェックサム不一致)は恒久的に取込済み扱いとする
  (`town-backup` と同じ分類)。契約詳細は [../SHARED_BUS.md](../SHARED_BUS.md)。
- **クロスアプリ送信(pdf-viewer-inbox)**: `src/storage/fileHandoff.ts` の
  `publishFileHandoff`(`src/app/appFileHandoffActions.ts` の `sendFileToApp` から、ファイル
  プレビューの「送信」操作で明示的に呼ばれる)が、ファイルを使い捨てAES-256-GCM鍵で暗号化して
  `storage_add_pinned` でCID化し、共有バスの `pdf-viewer-inbox` トピックへ
  `publishShared("pdf-viewer-inbox", "", { items })` で発行する。直近50件(`maxHandoffItems`)を
  ローリングリストとして毎回まるごと再発行する(`storage-drive-inbox` 等の受信系トピックと
  同じ発行方式だが、こちらは tc-storage が書き手・tc-pdf-viewer が読み手という逆方向)。
  同じ `fileHandoff.ts` は `note-inbox`(tc-note向け、テキスト/Markdown ファイルの引き渡し)
  トピックも同一ワイヤ形式で発行し、tc-note の `src/lib/noteInbox.ts` が読み手(冪等キー
  `tc-note-inbox-imported-v1`)。契約詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の
  「既存トピック: `pdf-viewer-inbox`」を参照(`note-inbox` は読み替えで同契約)。
- **`tc-storage-snapshot-v1` の直接クロスアプリ読み取り**: tc-chat がドロップ済みファイルを
  CID 添付できるよう、`tc-chat/src/interop/tcStorageFiles.ts` がこのキーを `getItem` で
  直接読む(読み取り専用、tc-chat は一切書き込まない)。ソフトデリート済み・未アップロード
  (`lastCid`/`lastShareCid` 無し)のファイルは除外し、実際に添付するのは `lastCid` の
  mistlib CID であって、スナップショットの内容そのものではない。tc-vrsns2 も同型の
  `tc-vrsns2/src/interop/tcStorageFiles.ts` で同じ読み取り専用アクセスを行う。
