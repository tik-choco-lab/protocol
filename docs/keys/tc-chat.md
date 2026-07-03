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
| `tc-chat-did-identity-v1` | DID identity レコード(tc-storage と同型、but 別インスタンス) | tc-chat | tc-chat | tc-chat/src/crypto/didIdentity.ts:27 |

## 特記事項

- `tc-chat-did-identity-v1` は `tc-storage-did-identity-v1` と型は同じだが**別キー・別値**。
  `tc-chat/src/crypto/didIdentity.test.ts:65-66` でこの2キーが独立であることをテストで
  明示的に確認している(意図的な分離)。詳細は [tc-storage.md](tc-storage.md) の特記事項参照。
- `tc-chat/src/interop/tcStorageFiles.ts` は tc-storage が mistlib storage に保存した
  ファイル(CID経由)を tc-chat から参照するためのクロスアプリ連携コード。localStorage の
  直接読み取りではなく、CID(コンテンツアドレス)を仲介してのファイル共有。
- 大半のキーが `tc-chat:` プレフィックス(コロン区切り)で統一されており、命名規約が
  比較的一貫している数少ないアプリ。
