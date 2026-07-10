# tc-translate の localStorage キー

mistlib 使用: **なし**(grep で `mistlib`/`storage_add`/`storage_get`/OPFS への参照が
見つからなかった。設定・履歴はすべて localStorage 完結)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-translate-provider-settings-v1` | `{ connection: "api" \| "network"; networkProviderEnabled: boolean; visionPresetId: string }`(`LocalProviderSettings`) | tc-translate | tc-translate | tc-translate/src/constants.ts:3; src/lib/storage.ts:25-39 |
| `tc-translate-voice-settings-v1` | `Partial<LegacyVoiceSettings>`(レガシー) | tc-translate | tc-translate | tc-translate/src/constants.ts:5; src/lib/storage.ts:47 |
| `tc-translate-tts-settings-v1` | `{ engine: "api" \| "network" \| "browser" }`(`LocalTtsSettings`) | tc-translate | tc-translate | tc-translate/src/constants.ts:6; src/lib/storage.ts:45-58 |
| `tc-translate-stt-settings-v1` | `{ engine: "api" \| "network"; micDeviceId: string }`(`LocalSttSettings`) | tc-translate | tc-translate | tc-translate/src/constants.ts:7; src/lib/storage.ts:60-74 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-translate/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-translate-history-v1` | `TranslationHistoryEntry[]`(最大件数あり) | tc-translate | tc-translate, **tc-note (クロスアプリ読み取り、インポート機能)** | tc-translate/src/constants.ts:8; src/lib/storage.ts:147,169 |
| `tc-translate-target-language-v1` | `string`(言語コード) | tc-translate | tc-translate | tc-translate/src/constants.ts:9; src/lib/storage.ts:109-114 |
| `tc-translate-native-language-v1` | `string`(言語コード) | tc-translate | tc-translate | tc-translate/src/constants.ts:10; src/lib/storage.ts:118-123 |
| `tc-translate-mode-v1` | `string`(動作モード) | tc-translate | tc-translate | tc-translate/src/constants.ts:11; src/lib/storage.ts:127-132 |
| `tc-translate-mistllm-node-id-v1` | `string`(UUID) | tc-translate | tc-translate | tc-translate/src/lib/mistllm/node.ts:16-34。mistllm(P2P LLMネットワーク)ノードIDで、初回生成後 `localStorage` に永続化される。tc-translate 全体で使う機器識別子とは別物(mistllm 専用) |
| `tc-shared-translations-inbox-v1` | `SharedRecord`(`meta` は `{ v, count, items: TranslationInboxItem[] }`) | tc-translate | **tc-storage(クロスアプリ読み取り、ドライブへ取り込み)** | tc-translate/src/lib/shareToStorage.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `translations-inbox` トピック |

## 特記事項

- **共有LLM設定(`tc-shared-llm-config-v1`)への移行**: `baseUrl`/`apiKey`/`model`/`temperature`
  は元々 `tc-translate-provider-settings-v1`/`-tts-settings-v1`/`-stt-settings-v1` が持っていたが、
  `tc-translate/src/hooks/useSharedLlmConfig.ts` の一度きりの移行処理でこれら3キーの
  移行前の形から共有キーへ移され(merge-never-delete)、上記3キーには
  connection/トグル/エンジン選択などのローカル専用フィールドのみが残る。tc-translate は
  provider/preset/defaultPresetId/tts/stt/`network.roomId` をすべて読み書きするフル参加者。
  `visionPresetId` は「機能別プリセット参照」の実例で、画像入力を伴う翻訳(vision)専用に
  preset を固定したい場合に使い、通常のテキスト翻訳は `defaultPresetId` を使う
  (契約の「アプリローカル層の指針」参照、[../llm-config.md](../llm-config.md))。
- `tc-translate-history-v1` は tc-note が読み取り専用でインポートに使う
  クロスアプリキー。[tc-note.md](tc-note.md) の特記事項も参照。tc-translate 側で
  `TranslationHistoryEntry` の形を変える場合は tc-note の `importTranslations.ts` への
  影響を確認すること。
- `tc-shared-translations-inbox-v1` は共有バス経由で tc-storage に翻訳結果を
  「ファイルとして」流し込む。履歴が更新されるたびに Markdown 化した項目一覧を
  再発行し、tc-storage が未取込分を「TC Translate」フォルダへ取り込む。契約の詳細と
  `TranslationInboxItem` の形は [../SHARED_BUS.md](../SHARED_BUS.md) を参照。項目の形を
  変える場合は tc-storage の `appTranslationsInbox.ts` への影響を確認すること。
- 全キーが `tc-translate-<name>-v1` 規約(ハイフン区切り + version サフィックス)で
  統一されている。tc-storage と同じ命名パターン。
