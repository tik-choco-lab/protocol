# tc-storage の localStorage キー

mistlib 使用: あり(`tc-storage/src/storage/mistStorage.ts` ほか、`storage_add`/`storage_get` でファイル本文をCID保存)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-storage-settings-v1` | `AppSettings`(下記) | tc-storage | tc-storage | tc-storage/src/storage/localSettings.ts:13 |
| `tc-storage-room-id-v1` | `string` | tc-storage | tc-storage | tc-storage/src/storage/localSettings.ts:14 |
| `tc-storage-node-id-v1` | `string` | tc-storage | tc-storage, **tc-chat (クロスアプリ読み取り、テストで存在確認のみ)** | tc-storage/src/storage/localSettings.ts:37,79-82 |
| `tc-storage-did-identity-v1` | DID identity レコード(下記)、ローカル優先のミラーキー | tc-storage | tc-storage | tc-storage/src/crypto/didIdentity.ts:17 |
| `tc-shared-did-identity-cid-v1` | `string`(共有 identity レコードの mistlib CID) | tc-storage(ローカルが正の場合に書き戻す), tc-chat, tc-vrm-viewer | tc-storage, tc-chat, tc-vrm-viewer | tc-storage/src/crypto/sharedDidIdentity.ts:32。詳細は [../did-identity.md](../did-identity.md) |
| `tc-storage-snapshot-v1` | `StorageSnapshot` | tc-storage | tc-storage | tc-storage/src/storage/localSnapshot.ts:4 |
| `tc-storage-folder-access-modes-v1` | フォルダアクセスモード `Record<string, mode>` | tc-storage | tc-storage | tc-storage/src/folder/folderAccess.ts:3 |
| `tc-storage-folder-keys-v1` | フォルダ暗号鍵 `Record<string, string>` | tc-storage | tc-storage | tc-storage/src/crypto/folderKeys.ts:5 |
| `tc-storage-file-share-keys-v1` | ファイル共有鍵 `Record<string, string>` | tc-storage | tc-storage | tc-storage/src/crypto/fileShareKeys.ts:4 |
| `tc-storage-folder-sync-peers-v1` | `FolderSyncPeers` | tc-storage | tc-storage | tc-storage/src/folder/folderPeers.ts:3 |
| `tc-storage-pending-shares-v1` | 保留中の共有一覧(配列、最大件数あり) | tc-storage | tc-storage | tc-storage/src/share/pendingShares.ts:5 |
| `tc-storage-import-keys-v1` | インポート鍵 `Record<string, string>` | tc-storage | tc-storage | tc-storage/src/share/pendingShares.ts:6 |
| `tc-storage-browser-sort-mode-v1` | `string`(ソートモード) | tc-storage | tc-storage | tc-storage/src/app/appUtils.ts:8 |
| `tc-storage-browser-view-mode-v1` | `'grid' \| 'list'` | tc-storage | tc-storage | tc-storage/src/app/appUtils.ts:9,184 |

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
