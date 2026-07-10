# tc-chat の localStorage キー

mistlib 使用: あり(`tc-chat/src/lib/mistClient.ts`、`tc-chat/src/interop/tcStorageFiles.ts` で tc-storage のファイルを CID 経由参照)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-chat:node-id` | `string`(mistlib ノードID) | tc-chat | tc-chat | tc-chat/src/lib/mistClient.ts:28,31-34 |
| `tc-chat:messages:<roomId>` | `ChatMessage[]`(プレフィックス+ルームID) | tc-chat | tc-chat | tc-chat/src/lib/chatStore.ts:48,58-70 |
| `tc-chat:project-posts:<roomId>` | `ProjectPost[]`(プレフィックス+ルームID) | tc-chat | tc-chat | tc-chat/src/lib/chatStore.ts:49,83-95 |
| `tc-chat:rooms` | `Room[]` | tc-chat | tc-chat | tc-chat/src/lib/chatStore.ts:50,116-124 |
| `tc-chat:username` | `string` | tc-chat | tc-chat | tc-chat/src/lib/chatStore.ts:51,142-146 |
| `tc-chat:board-view-mode` | `'board' \| 'timeline'` | tc-chat | tc-chat | tc-chat/src/lib/chatStore.ts:52,107-111 |
| `tc-chat-did-identity-v1` | DID identity レコード(共有ストア優先のローカルミラー) | tc-chat | tc-chat | tc-chat/src/crypto/didIdentity.ts:40 |
| `tc-shared-did-identity-cid-v1` | `string`(共有 identity レコードの mistlib CID) | tc-chat(共有ストアが空の場合に昇格), tc-storage, tc-vrm-viewer | tc-storage, tc-chat, tc-vrm-viewer | tc-chat/src/crypto/didIdentity.ts:42。詳細は [../did-identity.md](../did-identity.md) |
| `tc-storage-snapshot-v1` | `StorageSnapshot`(tc-storage 側の型。詳細は [tc-storage.md](tc-storage.md)) | tc-storage | tc-storage, **tc-chat (クロスアプリ読み取り専用)** | tc-chat/src/interop/tcStorageFiles.ts:42,68-101。tc-chat は書き込まない |
| `tc-chat-note-article-consumed-v1` | `string`(取込/既読済みレコードの `updatedAt`) | tc-chat | tc-chat | tc-chat/src/hooks/useNoteArticleImport.ts:13。共有バス `note-article`(tc-note/tc-news 発行、[tc-note.md](tc-note.md) 参照)の未取込ゲーティング用。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) |

## 特記事項

- `tc-chat-did-identity-v1`(ローカルミラー)は `tc-storage-did-identity-v1` と型は同じだが
  独立したキー。`tc-chat/src/crypto/didIdentity.test.ts:65-66` はこの2つの**ローカルミラー**
  キーが独立であることを確認しているが、`ensureSharedDidIdentity()` は共有キー
  `tc-shared-did-identity-cid-v1` 経由で tc-storage・tc-vrm-viewer と同じ DID に収束する
  (tc-chat は共有ストアを正として採用する側)。詳細は [../did-identity.md](../did-identity.md)、
  [tc-storage.md](tc-storage.md) の特記事項も参照。
- `tc-chat/src/interop/tcStorageFiles.ts` は tc-storage のファイル一覧を tc-chat から
  参照するためのクロスアプリ連携コード。`tc-storage-snapshot-v1` を `getItem` で直接読み、
  ソフトデリート済み・未アップロードのファイルを除いた一覧を得る。実際に添付されるのは
  各ファイルの `lastCid`(無ければ `lastShareCid`)が指す mistlib CID の中身であり、
  スナップショット自体の値は「どのファイルが添付可能か」を知るための一覧取得にのみ使う
  (tc-chat はこのキーへ一切書き込まない)。
- 大半のキーが `tc-chat:` プレフィックス(コロン区切り)で統一されており、命名規約が
  比較的一貫している数少ないアプリ。
- `tc-chat/src/hooks/useNoteArticleImport.ts` は共有バスのトピック `note-article`
  (書き手: tc-note, tc-news)を `readShared`/`subscribeShared` 経由で購読し、ボード
  composer に取り込みチップを表示する。取込済み(またはチップを閉じた)レコードの
  `updatedAt` を `tc-chat-note-article-consumed-v1` に保存して再表示を防ぐ。詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `note-article`」を参照。
