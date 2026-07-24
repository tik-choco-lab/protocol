# tc-news の localStorage キー

mistlib 使用: あり(`tc-news/src/lib/mistClient.ts`。記事・翻訳ワイヤの本文を `storage_add`/
`storage_get` でCID保存し、P2Pルームで記事を配信する)。加えて `@tik-choco/mistai` ライブラリ
(vendor コピー)経由でAIネットワーク(LLMチャット・音声合成/認識)にも接続する
(詳細は [../mistllm-wire.md](../mistllm-wire.md))。

tc-news はノート/記事系トピックのパブリッシャーであり、グローバル記事配信ワイヤ
`tc-global-articles`(トピック本体は [../global-articles-wire.md](../global-articles-wire.md)
を参照)を実装する最初のアプリでもある。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-news:app-settings` | `AppSettings`(下記) | tc-news | tc-news | tc-news/src/lib/appSettings.ts:8 |
| `tc-news:provider-settings` | `{ ttsEnabled: boolean; networkConsumerEnabled: boolean; networkProviderEnabled: boolean; orchestratorPresetId: string; workerPresetId: string }`(`ProviderSettings`) | tc-news | tc-news | tc-news/src/lib/llmSettings.ts:34-45 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-news/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-news:feeds` | `FeedSource[]`(RSS/Atomフィード購読設定) | tc-news | tc-news | tc-news/src/lib/feedStore.ts:5 |
| `tc-news:feed-items` | `FeedItem[]`(取得済みフィード項目、上限500件) | tc-news | tc-news | tc-news/src/lib/feedStore.ts:6 |
| `tc-news:articles` | `NewsArticle[]`(自分が生成した記事、上限200件) | tc-news | tc-news | tc-news/src/lib/articleStore.ts:8 |
| `tc-news:programs` | `RadioProgram[]`(AI生成のラジオ番組、上限50件) | tc-news | tc-news | tc-news/src/lib/programStore.ts:8 |
| `tc-news:reactions` | `ReactionRecord[]`(受信した全リアクションのローカル集計、上限5000件) | tc-news | tc-news | tc-news/src/lib/reactionStore.ts:28 |
| `tc-news:translations` | `ArticleTranslation[]`(articleId×lang でキャッシュした翻訳、上限500件) | tc-news | tc-news | tc-news/src/lib/translationStore.ts:9 |
| `tc-news:muted-dids` | `string[]`(ミュートしたDID、上限200件) | tc-news | tc-news | tc-news/src/lib/muteStore.ts:6 |
| `tc-news:locale` | `string`(UIロケール) | tc-news | tc-news | tc-news/src/lib/i18n/index.tsx:17 |
| `tc-news:theme` | `'light' \| 'dark'` | tc-news | tc-news | tc-news/src/hooks/useTheme.ts:8 |
| `tc-news:link-previews` | OGPリンクプレビューのキャッシュ(URL→メタデータ) | tc-news | tc-news | tc-news/src/lib/linkPreview.ts:120 |
| `tc-news:page-extracts` | 本文抽出結果のキャッシュ(URL→抽出HTML、TTL付き) | tc-news | tc-news | tc-news/src/lib/pageExtract.ts:250 |
| `tc-news:evaluations` | 記事のLLM評価履歴(ローカル専用、P2Pで送信しない) | tc-news | tc-news | tc-news/src/lib/articleEvaluation.ts:76 |
| `tc-news:onboarding-done` | `"1"`(初回オンボーディング完了フラグ) | tc-news | tc-news | tc-news/src/lib/onboarding.ts:7 |
| `tc-news:node-id` | `string`(mistlib ノードID、UUID) | tc-news | tc-news | tc-news/src/lib/mistClient.ts:53。`@tik-choco/mistai` の `ConsumerClient` にも同じキーを渡し、ニュースルームとAIネットワークで同一ノードIDを使う |
| `tc-news:shared-seen-ids` | `string[]`(既読記事ID、上限500件) | tc-news | tc-news | tc-news/src/hooks/useUnreadShared.ts:10 |
| `tc-news:shared:<roomId>` | `NewsArticle[]`(ルームごとに受信した記事のキャッシュ、上限あり) | tc-news | tc-news | tc-news/src/lib/newsWire.ts:106,165-179 |
| `tc-news:shared-programs:<roomId>` | `RadioProgram[]`(ルームごとに受信した番組のキャッシュ) | tc-news | tc-news | tc-news/src/lib/newsWire.ts:108,225-239 |
| `tc-news:wirelog:<roomId>` | 署名済み `ArticleWire`/`TranslationWire` のログ(履歴同期のリプレイ用) | tc-news | tc-news | tc-news/src/lib/newsWire.ts:107,313-330。詳細は [../global-articles-wire.md](../global-articles-wire.md) の「履歴同期」 |
| `tc-news:reactionlog:<roomId>` | `ReactionWire` のログ(履歴同期のリプレイ用。記事/翻訳とは別ログ) | tc-news | tc-news | tc-news/src/lib/newsWire.ts:109,343-360 |
| `tc-news-did-identity-v1` | DID identity レコード(共有ストア優先のローカルミラー) | tc-news | tc-news | tc-news/src/crypto/didIdentity.ts:40 |
| `tc-shared-did-identity-cid-v1` | `string`(共有 identity レコードの mistlib CID) | tc-news(共有ストアが空の場合に昇格), tc-storage, tc-chat, tc-vrm-viewer | tc-storage, tc-chat, tc-vrm-viewer, tc-news | tc-news/src/crypto/didIdentity.ts:42。詳細は [../did-identity.md](../did-identity.md) |

## AppSettings

```ts
interface AppSettings {
  theme: "light" | "dark";
  userName: string;
  roomId: string;           // 既定 "tc-news"(プライベートルーム。グローバルルームとは別)
  corsProxy: string;
  refreshIntervalMin: number;
  autoGenerate: boolean;
  globalShare: boolean;     // 既定 true。false ならグローバルルームへの新規記事の自動配信を行わない
  showMediaPreviews: boolean;
}
```

## 共有バス参加 (sharedBus)

tc-news は [../SHARED_BUS.md](../SHARED_BUS.md) の汎用共有バス(`tc-shared-<topic>-v1` +
BroadcastChannel `tc-shared-bus-v1`)を vendor コピーしている
(`tc-news/src/lib/sharedBus.ts`)。参加しているトピック:

- **`note-article`(書き手)**: 生成した記事をユーザーが明示的に tc-chat へ送るとき、
  `tc-news/src/lib/chatShare.ts` の `publishArticleToChat` が
  `publishShared("note-article", cid, meta)` を呼ぶ。詳細(メタ形状・tc-note との違い・
  読み手 tc-chat の挙動)は [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック:
  `note-article`」を参照。

## グローバル記事配信ワイヤ

ファミリー全体が乗り入れる well-known な `tc-global-articles` ルーム(記事の署名・配信・
履歴同期・転送)の仕様は本ドキュメントの範囲外。
[../global-articles-wire.md](../global-articles-wire.md) を参照。上記の
`tc-news:shared:<roomId>` / `tc-news:wirelog:<roomId>` はこのグローバルルームと
tc-news 既定のプライベートルーム(`roomId: "tc-news"`)の両方で共通して使われる
(ルームIDをキーの一部にしているため、両ルーム分が独立して保持される)。

## 特記事項

- **共有LLM設定(`tc-shared-llm-config-v1`)への移行**: 接続情報(baseUrl/apiKey)とモデル設定
  (model/temperature/reasoningEffort)は元々 `tc-news:provider-settings` の `profiles`(複数
  プロファイル)配列と `tts` オブジェクトが直接持っていたが、`tc-news/src/lib/llmSettings.ts`
  の `migrateLegacySettings()` が起動時に旧形状(`profiles` の存在で検出)を一度だけ検出し、
  各プロファイルを `ensureProvider`/`ensurePreset` で(id を保持したまま)共有キーへ追加、
  `defaultPresetId`/`tts`/`network.roomId` は空のときのみ設定(merge-never-delete)した上で
  `tc-news:provider-settings` を新しい縮小形状(`ttsEnabled`/`networkConsumerEnabled`/
  `networkProviderEnabled`/`orchestratorPresetId`/`workerPresetId`)で再保存する。この移行に
  伴い、旧 `LlmProfile`/`TtsSettings` 型はコードベースから削除済み。
- `orchestratorPresetId`/`workerPresetId` は「アプリローカル層の指針」
  ([../llm-config.md](../llm-config.md))が挙げる役割別プリセット参照の実例で、編集部生成の
  orchestrator/worker それぞれに使う preset を指す。空文字は `resolvePreset` のフォールバック
  で `defaultPresetId` に従う。
- tc-news は `tc-shared-llm-config-v1` の provider/preset/defaultPresetId/tts/`network.roomId`
  を読み書きするフル参加者。TTS は `lib/tts.ts` が `resolveVoice(config, "tts")` で解決する
  (`ttsEnabled` が false ならブラウザ内蔵TTSにフォールバック)。stt は使わない。
- 全ローカル専用キーが `tc-news:<name>` 規約(コロン区切り)で統一されている
  ([../conventions.md](../conventions.md) が推奨する新規キー規約)。
- DID identity のみ `tc-news-did-identity-v1`(ハイフン区切り + `v1` サフィックス)という
  例外的な命名だが、これは他アプリ(tc-storage/tc-chat/tc-vrm-viewer)のローカルミラーキー
  ([../did-identity.md](../did-identity.md) 参照)と同じ命名パターンに揃えたもの。
  `ensureSharedDidIdentity()` の照合ロジックは tc-chat/tc-vrm-viewer と同じ
  「共有ストアが正」方針を取る。
- `tc-news:evaluations` / `tc-news:reactions` / `tc-news:translations` はいずれも
  「JSON.parse を try/catch し、フィールドごとに型検証してから既定値にフォールバックする」
  同一の防御的パース方針を取る([../conventions.md](../conventions.md) の
  「クロスアプリ読み取りの原則」と同じ姿勢を自アプリ内の全ストアにも適用している)。
- 既定のRSSフィードは同梱しない(フィードはユーザーが自分で登録する)。
