# tc-town の localStorage キー

mistlib 使用: あり(`tc-town/src/lib/mistClient.ts`。カタログのP2P配信/CID保存に使う)

簡易カタログ(共有バス経由のクロスアプリ連携と、ざっと grep して見つかった自アプリキーのみ。
深い監査はしていない)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-shared-character-index-v1` | `SharedRecord`(`meta` は `CharacterIndexMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-town | **tc-travel(クロスアプリ読み取り)** | tc-town/src/lib/characterIndexPublisher.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `character-index` トピック |
| `tc-town:app-settings` | アプリ設定 | tc-town | tc-town | tc-town/src/lib/appSettings.ts:5 |
| `tc-town:provider-settings` | `{ networkConsumerEnabled: boolean; networkProviderEnabled: boolean; sttSilenceDuration: number }`(`ProviderSettings`) | tc-town | tc-town | tc-town/src/lib/llmSettings.ts:23-29 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-town/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-town:characters` | キャラクター一覧 | tc-town | tc-town | tc-town/src/lib/characterStorage.ts:18 |
| `tc-town:worlds` | ワールド一覧 | tc-town | tc-town | tc-town/src/lib/worlds.ts:9 |
| `tc-town:conversations` | 会話セッション | tc-town | tc-town | tc-town/src/lib/conversation.ts:74 |
| `tc-town:evaluations` | 評価履歴 | tc-town | tc-town | tc-town/src/lib/evaluation.ts:100 |
| `tc-town:character-evaluations` | キャラクター単位の評価 | tc-town | tc-town | tc-town/src/lib/characterEvaluation.ts:90 |
| `tc-town:catalog-published-v1` | 自分が公開したカタログエントリ | tc-town | tc-town | tc-town/src/lib/catalogStore.ts:18 |
| `tc-town:catalog-directory-v1` | ネットワークから学習した公開カタログ一覧 | tc-town | tc-town | tc-town/src/lib/catalogStore.ts:19 |
| `tc-town:catalog-wirelog-v1` | 署名済みカタログワイヤのログ(履歴同期用) | tc-town | tc-town | tc-town/src/lib/catalogStore.ts:20 |
| `tc-town:catalog-profile-v1` | 公開エントリの著者表示名 | tc-town | tc-town | tc-town/src/lib/catalogStore.ts:21 |
| `tc-town:vrm-cid-cache-v1` | VRMチェックサム→mistlib CID キャッシュ | tc-town | tc-town | tc-town/src/lib/characterIndexPublisher.ts:23 |
| `tc-town:onboarding-done` | オンボーディング完了フラグ | tc-town | tc-town | tc-town/src/lib/onboarding.ts:7 |
| `tc-town:publish-prompt-dismissed-v1` | 公開プロンプト却下フラグ | tc-town | tc-town | tc-town/src/views/CharactersView.tsx:99 |
| `tc-town:settings-tab` | 設定画面の選択タブ | tc-town | tc-town | tc-town/src/views/SettingsView.tsx:269 |
| `tc-town-did-identity-v1` | DID identity レコード(ローカルミラー) | tc-town | tc-town | tc-town/src/crypto/didIdentity.ts:40 |
| `tc-town-mistai-node-id-v1` | mistlib ノードID | tc-town | tc-town | tc-town/src/lib/mistClient.ts:66 |

## 共有バス参加 (sharedBus)

tc-town は [../SHARED_BUS.md](../SHARED_BUS.md) の汎用共有バス(`tc-shared-<topic>-v1` +
BroadcastChannel `tc-shared-bus-v1`)を vendor コピーしている(`tc-town/src/lib/sharedBus.ts`)。
参加しているトピック:

- **`character-index`(書き手)**: キャラクター/ワールドの変更にデバウンス後追従して、
  `tc-town/src/lib/characterIndexPublisher.ts` が
  `publishShared("character-index", "", meta)` を呼ぶ。読み手(tc-travel)の挙動を含む詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `character-index`」を参照。

## 特記事項

- **共有LLM設定(`tc-shared-llm-config-v1`)への移行**: 接続情報・モデル設定・TTS/STT・AI Network
  ルームは元々 `tc-town:provider-settings` の `profiles`/`tts`/`stt`/`networkRoomId`/
  `defaultProfileId` が直接持っていたが、`tc-town/src/lib/llmSettings.ts` の
  `migrateLegacyProviderSettingsToShared()` が起動時に旧形状(`profiles` 配列の存在で検出)を
  一度だけ検出し、`ensureProvider`/`ensurePreset` で(id を保持したまま)共有キーへ追加、
  `defaultPresetId`/`tts`/`stt`/`network.roomId` は空のときのみ設定(merge-never-delete、
  一度も編集されていない既定プロファイルはノイズとしてスキップ)した上で
  `tc-town:provider-settings` を新しい縮小形状で再保存する。`sttSilenceDuration`(音声通話の
  発話終端検出の無音長)は契約上 `VoiceConfigV1` の対象外の**アプリローカル項目**として明示的に
  残る。
- **`tc-town:characters` の `Character.llmProfileId`**: フィールド名は移行前の
  `LlmProfile.id` を指していた頃のまま温存されているが、移行後は `ModelPresetV1.id`
  (`tc-shared-llm-config-v1` の preset)を指すようになった。これは「アプリローカル層の指針」
  ([../llm-config.md](../llm-config.md))が挙げるキャラクターごとの preset 参照の実例で、
  キャラID→`presetId` のマッピングをキャラクターレコード自体に埋め込む形で実装されている。
- ローカル専用キーはおおむね `tc-town:<name>` 規約(コロン区切り)。DID identity と
  mistlib ノードIDのみ `tc-town-<name>-v1` 例外(他アプリのローカルミラーキー命名に揃えたもの)。
- 上記は grep による簡易カタログであり、`mist-*` 等の他モジュールが持つ可能性のある
  追加キーまでは深追いしていない。
