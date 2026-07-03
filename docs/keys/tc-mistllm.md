# tc-mistllm の localStorage キー

mistlib 使用: あり(`tc-mistllm/src/lib/node.ts`、`tc-mistllm/src/lib/provider.ts`。ただし
grep では `storage_add`/`storage_get` の直接呼び出しは確認できず、mistlib のノード/P2P機能
のみ使用している可能性が高い。要追加調査)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-mistllm:settings` | LLM プロバイダ設定 | tc-mistllm | tc-mistllm | tc-mistllm/src/lib/storage.ts:14,26-36 |
| `tc-mistllm:nodeId` | `string`(mistlib ノードID) | tc-mistllm | tc-mistllm | tc-mistllm/src/lib/node.ts:14,17-20 |

## 特記事項

- キー命名は `tc-mistllm:<name>` (コロン区切り、tc-note/tc-chat と同系統)。
- 他アプリからの読み取りは確認されなかった(自己完結型)。
- P2P ネットワーク越しの JSON ワイヤプロトコル(localStorage とは別レイヤー)の仕様は
  [docs/mistllm-wire.md](../mistllm-wire.md) を参照。
