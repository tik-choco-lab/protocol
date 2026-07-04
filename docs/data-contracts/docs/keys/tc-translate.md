# tc-translate の localStorage キー

mistlib 使用: **なし**(grep で `mistlib`/`storage_add`/`storage_get`/OPFS への参照が
見つからなかった。設定・履歴はすべて localStorage 完結)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-translate-provider-settings-v1` | `Partial<ProviderSettings>` | tc-translate | tc-translate | tc-translate/src/constants.ts:3; src/lib/storage.ts:29,42 |
| `tc-translate-voice-settings-v1` | `Partial<LegacyVoiceSettings>`(レガシー) | tc-translate | tc-translate | tc-translate/src/constants.ts:5; src/lib/storage.ts:47 |
| `tc-translate-tts-settings-v1` | `Partial<TtsSettings> \| null` | tc-translate | tc-translate | tc-translate/src/constants.ts:6; src/lib/storage.ts:55,81 |
| `tc-translate-stt-settings-v1` | `Partial<SttSettings> \| null` | tc-translate | tc-translate | tc-translate/src/constants.ts:7; src/lib/storage.ts:86,105 |
| `tc-translate-history-v1` | `TranslationHistoryEntry[]`(最大件数あり) | tc-translate | tc-translate, **tc-note (クロスアプリ読み取り、インポート機能)** | tc-translate/src/constants.ts:8; src/lib/storage.ts:147,169 |
| `tc-translate-target-language-v1` | `string`(言語コード) | tc-translate | tc-translate | tc-translate/src/constants.ts:9; src/lib/storage.ts:109-114 |
| `tc-translate-native-language-v1` | `string`(言語コード) | tc-translate | tc-translate | tc-translate/src/constants.ts:10; src/lib/storage.ts:118-123 |
| `tc-translate-mode-v1` | `string`(動作モード) | tc-translate | tc-translate | tc-translate/src/constants.ts:11; src/lib/storage.ts:127-132 |
| `tc-translate-mistllm-node-id-v1` | `string`(UUID) | tc-translate | tc-translate | tc-translate/src/lib/mistllm/node.ts:16-34。mistllm(P2P LLMネットワーク)ノードIDで、初回生成後 `localStorage` に永続化される。tc-translate 全体で使う機器識別子とは別物(mistllm 専用) |

## 特記事項

- `tc-translate-history-v1` は tc-note が読み取り専用でインポートに使う
  クロスアプリキー。[tc-note.md](tc-note.md) の特記事項も参照。tc-translate 側で
  `TranslationHistoryEntry` の形を変える場合は tc-note の `importTranslations.ts` への
  影響を確認すること。
- 全キーが `tc-translate-<name>-v1` 規約(ハイフン区切り + version サフィックス)で
  統一されている。tc-storage と同じ命名パターン。
