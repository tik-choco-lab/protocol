# tc-translate の localStorage キー

mistlib 使用: **あり**(`src/lib/mistStorage.ts` 経由。AI Network(`lib/mistllm/`)用の
`MistNode` とは独立に、wasm の `storage_add`/`storage_get`(OPFSバックエンドのCIDストア)
だけを薄くラップしたモジュールで、履歴本文の永続化に使う)

## mistlib storage の使い方(履歴の二層構造)

`tc-translate-history-v1` の各エントリ(`PersistedHistoryItem`)は「軽量な索引情報 + 重い本文
へのCIDポインタ」の二層構造になっている。保存(`lib/storage.ts` の `saveHistory`)のたびに、
`sourceText`/`translations`/`proofread`/`explanation` をまとめた `HistoryItemBody` を
`storageAddJson` でCID化し、そのCIDを `bodyCid` として localStorage 側のエントリに持たせる
(本文自体は localStorage に入れない)。読み込み(`loadHistory`)は `bodyCid` があれば
`storageGetJson` で解決し、無い場合(`storage_add` が失敗した環境、またはこの移行より前に
保存された旧エントリ)は `sourceText`/`translations`/`proofread`/`explanation` が localStorage
側にそのままインラインで乗っている旧形式にフォールバックする(dual-read)。旧形式のまま
読み込まれたエントリは、次回保存時に自動でCID化側へ移行される(ベストエフォート、
一括バックフィルは行わない)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-translate-provider-settings-v1` | `{ connection: "api" \| "network"; networkProviderEnabled: boolean; visionPresetId: string }`(`LocalProviderSettings`) | tc-translate | tc-translate | tc-translate/src/constants.ts:3; src/lib/storage.ts:25-39 |
| `tc-translate-voice-settings-v1` | `Partial<LegacyVoiceSettings>`(レガシー) | tc-translate | tc-translate | tc-translate/src/constants.ts:5; src/lib/storage.ts:47 |
| `tc-translate-tts-settings-v1` | `{ engine: "api" \| "network" \| "browser" }`(`LocalTtsSettings`) | tc-translate | tc-translate | tc-translate/src/constants.ts:6; src/lib/storage.ts:45-58 |
| `tc-translate-stt-settings-v1` | `{ engine: "api" \| "network"; micDeviceId: string }`(`LocalSttSettings`) | tc-translate | tc-translate | tc-translate/src/constants.ts:7; src/lib/storage.ts:60-74 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-translate/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-translate-history-v1` | `PersistedHistoryItem[]`(最大件数あり。各エントリは索引情報 + `bodyCid`。上記「mistlib storage の使い方」参照) | tc-translate | tc-translate, **tc-note (クロスアプリ読み取り、インポート機能)** | tc-translate/src/constants.ts:8; src/lib/storage.ts:382,448; src/types.ts:198 |
| `tc-translate-target-language-v1` | `string`(言語コード) | tc-translate | tc-translate | tc-translate/src/constants.ts:9; src/lib/storage.ts:109-114 |
| `tc-translate-native-language-v1` | `string`(言語コード) | tc-translate | tc-translate | tc-translate/src/constants.ts:10; src/lib/storage.ts:118-123 |
| `tc-translate-mode-v1` | `string`(動作モード) | tc-translate | tc-translate | tc-translate/src/constants.ts:11; src/lib/storage.ts:127-132 |
| `tc-translate-mistllm-node-id-v1` | `string`(UUID) | tc-translate | tc-translate | tc-translate/src/lib/mistllm/node.ts:16-34。mistllm(P2P LLMネットワーク)ノードIDで、初回生成後 `localStorage` に永続化される。tc-translate 全体で使う機器識別子とは別物(mistllm 専用) |
| `tc-shared-translations-inbox-v1` | `SharedRecord`(`meta` は `{ v, count, items: TranslationInboxItem[] }`) | tc-translate | **tc-storage(クロスアプリ読み取り、ドライブへ取り込み)** | tc-translate/src/lib/shareToStorage.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `translations-inbox` トピック |
| `tc-shared-lingo-card-inbox-v1` | `SharedRecord`(`meta` は `LingoCardInboxMeta`) | tc-translate | **tc-lingo(クロスアプリ読み取り、SRSカード候補化)** | tc-translate/src/lib/shareToLingo.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `lingo-card-inbox` トピック |

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
  クロスアプリキー。[tc-note.md](tc-note.md) の特記事項も参照。tc-note 側
  (`src/lib/importTranslations.ts`)は `bodyCid` を `storage_get` で解決する経路と、旧形式
  (`sourcePreview`/インライン欠落時のフォールバック)の両方をハンドリング済みで、上記
  「mistlib storage の使い方」の二層構造を認識している。tc-translate 側で
  `PersistedHistoryItem`/`HistoryItemBody` の形を変える場合は tc-note の
  `importTranslations.ts` への影響を確認すること。
- `tc-shared-translations-inbox-v1` は共有バス経由で tc-storage に翻訳結果を
  「ファイルとして」流し込む。履歴が更新されるたびに Markdown 化した項目一覧を
  再発行し、tc-storage が未取込分を「TC Translate」フォルダへ取り込む。契約の詳細と
  `TranslationInboxItem` の形は [../SHARED_BUS.md](../SHARED_BUS.md) を参照。項目の形を
  変える場合は tc-storage の `appTranslationsInbox.ts` への影響を確認すること。
- `tc-shared-lingo-card-inbox-v1` は共有バス経由で tc-lingo へ翻訳/解説履歴をSRSカード候補
  として送る。`HistoryPanel.tsx` の「Lingoへ送る」ボタンによる明示送信で、
  `translations-inbox` と異なり自動発行ではない。本文(`LingoCardPayloadV1`)は
  `translations-inbox` のMarkdownインラインとは異なり mistlib の `storage_add` で別途CID化
  される。契約の詳細と `LingoCardInboxItem`/`LingoCardPayloadV1` の形は
  [../SHARED_BUS.md](../SHARED_BUS.md) の `lingo-card-inbox` トピックを参照。
- 全キーが `tc-translate-<name>-v1` 規約(ハイフン区切り + version サフィックス)で
  統一されている。tc-storage と同じ命名パターン。
