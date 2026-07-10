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
- **`tc-storage-snapshot-v1` の直接クロスアプリ読み取り**: tc-chat がドロップ済みファイルを
  CID 添付できるよう、`tc-chat/src/interop/tcStorageFiles.ts` がこのキーを `getItem` で
  直接読む(読み取り専用、tc-chat は一切書き込まない)。ソフトデリート済み・未アップロード
  (`lastCid`/`lastShareCid` 無し)のファイルは除外し、実際に添付するのは `lastCid` の
  mistlib CID であって、スナップショットの内容そのものではない。tc-vrsns2 も同型の
  `tc-vrsns2/src/interop/tcStorageFiles.ts` で同じ読み取り専用アクセスを行う。
