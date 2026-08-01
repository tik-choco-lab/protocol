# tc-mistllm の localStorage キー

mistlib 使用: あり(`tc-mistllm/src/lib/node.ts`、`tc-mistllm/src/lib/provider.ts`。ただし
grep では `storage_add`/`storage_get` の直接呼び出しは確認できず、mistlib のノード/P2P機能
のみ使用している可能性が高い。要追加調査)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-mistllm:settings` | `{ role: 'provider' \| 'consumer'; roomId: string }`(`Settings`) | tc-mistllm | tc-mistllm | tc-mistllm/src/lib/storage.ts:24-34 |
| `tc-mistllm:nodeId` | `string`(mistlib ノードID) | tc-mistllm | tc-mistllm | tc-mistllm/src/lib/node.ts:14,17-20 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-mistllm/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |

## 特記事項

- **共有LLM設定(`tc-shared-llm-config-v1`)への移行**: `baseUrl`/`apiKey`/`model` は元々
  `tc-mistllm:settings` が直接持っていたが、`tc-mistllm/src/lib/storage.ts` の
  `migrateLegacySettings()` が起動時に旧フィールドの存在を検出して一度だけ共有キーへ
  一方向移行し(`ensureProvider`/`ensurePreset`、`defaultPresetId`/`network.roomId` は空の
  ときのみ設定)、以後 `tc-mistllm:settings` には `role`/`roomId` のみが残る。
- **Settings 画面は明示編集時に `defaultPresetId` を常に更新する特例**:
  tc-mistllm が実際に読み書きするのは provider/preset/defaultPresetId/`network.roomId` まで
  (`src/components/Settings.tsx`・`src/lib/storage.ts`)。tts/stt は他アプリ同様
  `loadLlmConfig`/`saveLlmConfig` を通せば透過的に読み書きされるが、tc-mistllm 自身に
  tts/stt を編集・利用する機能はない(`resolveVoice` の呼び出しは無い)。
  `src/components/Settings.tsx` の `commitProvider()` はユーザーがこの画面で接続情報を明示的に
  編集するたびに `ensureProvider`/`ensurePreset` した上で `config.defaultPresetId` を無条件に
  上書きする。これはマイグレーション規則の「現在値が空のときのみ設定する」原則とは意図的に
  異なる — tc-mistllm の Settings 画面は「共有デフォルト接続の専用エディタ」という役割を
  担っており、一度きりの移行とは別に、ユーザーが明示的に行う恒常的な編集操作として扱われる
  ([../llm-config.md](../llm-config.md) 参照)。
- キー命名は `tc-mistllm:<name>` (コロン区切り、tc-note/tc-chat と同系統)。
- `tc-mistllm:settings`/`tc-mistllm:nodeId` について他アプリからの読み取りは確認されなかった
  (自己完結型)。`tc-shared-llm-config-v1` は co-owned な共有キーなので、当然7参加アプリ全員が
  読み書きする。
- P2P ネットワーク越しの JSON ワイヤプロトコル(localStorage とは別レイヤー)の仕様は
  [docs/mistllm-wire.md](../mistllm-wire.md) を参照。
