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

## 特記事項

- `tc-chat-did-identity-v1`(ローカルミラー)は `tc-storage-did-identity-v1` と型は同じだが
  独立したキー。`tc-chat/src/crypto/didIdentity.test.ts:65-66` はこの2つの**ローカルミラー**
  キーが独立であることを確認しているが、`ensureSharedDidIdentity()` は共有キー
  `tc-shared-did-identity-cid-v1` 経由で tc-storage・tc-vrm-viewer と同じ DID に収束する
  (tc-chat は共有ストアを正として採用する側)。詳細は [../did-identity.md](../did-identity.md)、
  [tc-storage.md](tc-storage.md) の特記事項も参照。
- `tc-chat/src/interop/tcStorageFiles.ts` は tc-storage が mistlib storage に保存した
  ファイル(CID経由)を tc-chat から参照するためのクロスアプリ連携コード。localStorage の
  直接読み取りではなく、CID(コンテンツアドレス)を仲介してのファイル共有。
- 大半のキーが `tc-chat:` プレフィックス(コロン区切り)で統一されており、命名規約が
  比較的一貫している数少ないアプリ。
