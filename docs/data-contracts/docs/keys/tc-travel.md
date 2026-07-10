# tc-travel の localStorage キー

mistlib 使用: あり(`tc-travel/src/lib/mistNode.ts`。P2Pルーム参加とドライブ/キャラクター
バンドルのCID保存に使う)

簡易カタログ(共有バス経由のクロスアプリ連携と、ざっと grep して見つかった自アプリキーのみ。
深い監査はしていない)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-shared-folder-export-v1` | `SharedRecord`(`meta` は `FolderExportMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-pdf-viewer, **tc-travel(2人目の書き手)** | **tc-storage(クロスアプリ読み取り)** | tc-travel/src/lib/drive/export.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。両書き手の違い・単一レコード上書きの扱いは [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `folder-export`」を参照 |
| `tc-shared-drive-index-v1` | `SharedRecord`(`meta` は `DriveIndexMeta`) | tc-storage | **tc-travel(クロスアプリ読み取り)** | tc-travel/src/lib/drive/reader.ts。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `drive-index`」 |
| `tc-shared-character-index-v1` | `SharedRecord`(`meta` は `CharacterIndexMeta`) | tc-town | **tc-travel(クロスアプリ読み取り)** | tc-travel/src/lib/town/characterIndex.ts。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `character-index`」 |
| `tc-travel:driveExport` | `FolderExportState`(エクスポート状態。旧キー `tc-travel:tcStorageExport` からの移行あり) | tc-travel | tc-travel | tc-travel/src/lib/drive/export.ts:15,17 |
| `tc-travel:cards` | ワールドブラグカード | tc-travel | tc-travel | tc-travel/src/lib/cards.ts:10 |
| `tc-travel:celebLedger` | お祝いイベントの既読管理 | tc-travel | tc-travel | tc-travel/src/lib/celebrate.ts:98 |
| `tc-travel:profile` | 個人プロフィール | tc-travel | tc-travel | tc-travel/src/lib/personal.ts:10 |
| `tc-travel:joinedRooms` | 参加済みルーム一覧 | tc-travel | tc-travel | tc-travel/src/lib/personal.ts:11 |
| `tc-travel:streak` | 連続参加ストリーク | tc-travel | tc-travel | tc-travel/src/lib/personal.ts:12 |
| `tc-travel:journey` | 旅の記録 | tc-travel | tc-travel | tc-travel/src/lib/personal.ts:13 |
| `tc-travel:aiCompanion` | `{ roomId: string; model?: string; voice?: string; persona?: string; ttsEnabled: boolean }`(`AiCompanionSettings`) | tc-travel | tc-travel | tc-travel/src/lib/ai/aiSettings.ts:18-25 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。tc-travelは`network.roomId`のみ利用。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-travel/src/lib/drive/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-travel:nodeId` | mistlib ノードID | tc-travel | tc-travel | tc-travel/src/lib/mistNode.ts:12 |
| `tc-travel:onboarding-done` | オンボーディング完了フラグ | tc-travel | tc-travel | tc-travel/src/lib/onboarding.ts:8 |
| `tc-travel:language` | UI言語設定 | tc-travel | tc-travel | tc-travel/src/lib/i18n.ts:31 |
| `tc-travel:familyVrmAdoptChecked` | ファミリーVRM自動採用チェック済みフラグ | tc-travel | tc-travel | tc-travel/src/lib/familyVrm.ts:16 |
| `tc-travel:solo:pins`, `tc-travel:solo:photos`, `tc-travel:solo:diary` | ソロプレイの思い出(ピン/写真/日記) | tc-travel | tc-travel | tc-travel/src/lib/local/localMemories.ts:19-21 |
| `tc-travel:admin2:resolved` | 市区町村レベルの位置解決キャッシュ | tc-travel | tc-travel | tc-travel/src/lib/geo/municipalResolver.ts:327 |

## 共有バス参加 (sharedBus)

tc-travel は [../SHARED_BUS.md](../SHARED_BUS.md) の汎用共有バス(`tc-shared-<topic>-v1` +
BroadcastChannel `tc-shared-bus-v1`)を vendor コピーしている
(`tc-travel/src/lib/drive/sharedBus.ts`)。参加しているトピック:

- **`folder-export`(書き手、2人目)**: `tc-travel/src/lib/drive/export.ts` が暗号化
  `FolderBundle` を mistlib の `storage_add` でCID化し、
  `publishShared("folder-export", folderCid, meta)` を呼ぶ。最初の書き手 tc-pdf-viewer との
  スキーマの同一性・単一レコード上書きの扱いは [../SHARED_BUS.md](../SHARED_BUS.md) の
  「既存トピック: `folder-export`」を参照。
- **`drive-index`(読み手)**: `tc-travel/src/lib/drive/reader.ts` の `listDriveFiles()`。
  tc-storage が公開するファイル一覧を読み、VRMインポート等に使う。
- **`character-index`(読み手)**: `tc-travel/src/lib/town/characterIndex.ts` の
  `loadTownCharacters()`/`subscribeTownCharacters()`。tc-town のキャラクターをVRMコンパニオン
  + AIペルソナとして取り込む。

## 特記事項

- **`tc-shared-llm-config-v1` の限定利用**: tc-travel は7参加アプリの1つだが、provider/preset/
  defaultPresetId/tts/stt は使わない(AIコンパニオンの接続情報自体は `tc-travel:aiCompanion` の
  `roomId`/`model`/`voice`/`persona` がローカルに持つ)。使うのは `network.roomId` のみで、
  `tc-travel/src/lib/ai/aiSettings.ts` の `resolveAiRoomId()` がローカルの `roomId`(非空なら
  優先)→共有 `network.roomId` の順にフォールバックして実効ルームを決める。また
  `loadAiSettings()`/`saveAiSettings()` はローカル `roomId` が非空かつ共有側が未設定なら
  `seedSharedRoomId()` で共有キーへ片方向シード書き込みする(merge-never-delete、
  共有側が既に設定済みなら上書きしない)。
- ローカル専用キーはおおむね `tc-travel:<name>` 規約(コロン区切り)。
- `tc-travel:driveExport` は旧キー `tc-travel:tcStorageExport` からの移行を持つ
  (`src/lib/drive/export.ts:17` の `LEGACY_STATE_KEY`)。
- 上記は grep による簡易カタログであり、深い監査はしていない。
