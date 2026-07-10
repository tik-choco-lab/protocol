# tc-pdf-viewer の localStorage キー

mistlib 使用: あり(`tc-pdf-viewer/src/lib/mistlib/`、`storage_add`/`storage_get` で PDF/Markdown 本文をCID保存)

すべてレガシー命名(`mist_*` プレフィックス、アプリ名なし)。新規キーはこの規約に従わない
(`docs/conventions.md` 参照)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `mist_files_index` | `{ name, cid, folder, createdAt, updatedAt }[]` | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/storage.js:9-24 |
| `mist_custom_folders` | フォルダ一覧(未詳細調査) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/storage.js |
| `mist_ocr_markdown_index` | `Record<string, string \| { content: string }>`(ファイル名→CID or 本文) | tc-pdf-viewer | tc-pdf-viewer, **tc-note (クロスアプリ読み取り)** | tc-pdf-viewer/src/services/storage.js:26-32 |
| `mist_translated_markdown_index` | `Record<string, Record<string, string>>`(ファイル名→言語→CID) | tc-pdf-viewer | tc-pdf-viewer, **tc-note (クロスアプリ読み取り)** | tc-pdf-viewer/src/services/storage.js:34-40 |
| `mist_explanations_index` | 未詳細調査(AI 解説キャッシュとみられる) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/mist.js |
| `mist_last_lang` | `string`(最後に使用した翻訳言語) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/mist.js |
| `mist_last_pdf` | `string`(最後に開いた PDF の識別子) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/mist.js |
| `tc-pdf-viewer-ai-settings-v1` | `{ backend: 'http' \| 'mistllm'; networkProviderEnabled: boolean; taskPresetIds: { explain, translate, chat, ocr }; promptTemplate: string; targetLanguages: string[] }`(下記) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/ai.js:32-46 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/AI Networkルーム。tts/stt不使用。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-pdf-viewer/src/services/llmConfig.js。詳細は [../llm-config.md](../llm-config.md) |
| `tc-shared-folder-export-v1` | `SharedRecord`(`meta` は `FolderExportMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-pdf-viewer, **tc-travel(2人目の書き手)** | **tc-storage(クロスアプリ読み取り)** | tc-pdf-viewer/src/services/driveExport.js。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `folder-export` トピック |

## tc-pdf-viewer-ai-settings-v1 (概要)

`getAiSettings()`/`saveAiSettings()`/`normalizeAiSettings()` (tc-pdf-viewer/src/services/ai.js)
で正規化される。接続情報(baseUrl/apiKey/model)は `tc-shared-llm-config-v1` へ移った後なので、
このキーが持つのは「どの task にどの preset を使うか」(`taskPresetIds`、AI_TASKS =
`['explain', 'translate', 'chat', 'ocr']` のタスク別プリセット参照。空文字は
`resolvePreset` のフォールバックで `defaultPresetId` に従う)と、バックエンド選択・プロンプト
テンプレート・翻訳先言語一覧といった純粋にアプリローカルなプリファレンスのみ。
`getSharedLlmConfig`/`resolveTaskTarget` 等の共有キーアクセサは同じ `ai.js` が
`./llmConfig.js` 経由で提供する。詳細フィールドは
`tc-pdf-viewer/src/services/ai.js` の `DEFAULT_SETTINGS`/`normalizeAiSettings` を参照。

## 特記事項

- **`ai_settings`(レガシー、廃止)は `tc-pdf-viewer-ai-settings-v1` + 共有キーへ一度だけ移行**:
  旧 `ai_settings`(baseUrl/apiKey/タスク別モデル名を1レコードで保持)は
  `tc-pdf-viewer/src/services/ai.js` の `migrateLegacyAiSettings()` が起動時に検出し、
  登録済みの各 baseUrl を `ensureProvider` で、タスクごとにモデルが設定済みならその組を
  `ensurePreset` で `tc-shared-llm-config-v1` へ追加した上で(merge-never-delete、
  一度も編集されていない既定の OpenAI エントリはノイズとしてスキップ)、タスク→新しい
  presetId のマッピングを `tc-pdf-viewer-ai-settings-v1` へ書き込み、最後に
  `localStorage.removeItem('ai_settings')` で旧キーを削除する(read-then-removeItem の
  一度きりの移行、以後 `ai_settings` は存在しない)。旧 `mistllmRoomId` は共有キーの
  `network.roomId` へ(空のときのみ)移行される。
- tc-pdf-viewer は `tc-shared-llm-config-v1` の provider/preset/defaultPresetId/`network.roomId`
  を読み書きするが、tts/stt は使わない(OCR/翻訳/チャット/解説はすべてテキスト系タスクの
  ため)。`taskPresetIds` は「アプリローカル層の指針」([../llm-config.md](../llm-config.md))
  が挙げるタスク別プリセット参照の実例。
- `mist_ocr_markdown_index` の値は CID 文字列と `{ content: string }` オブジェクトの
  **両方の形式が存在する**(tc-note 側の importDocument.ts が両方をハンドリングしている
  ことから、CID → 本文の移行が進行中/混在している可能性が高い)。新規キー読み取り実装は
  両方の形式に対して防御的にパースすること。
- キー名が汎用的(`mist_*`)でアプリ名を含まないため、他の mistlib 系アプリが将来
  同名キーを使うと衝突するリスクがある。新規キーは `tc-<app>:<name>` 規約に従うこと。
- `mist_ocr_markdown_index` の書き込み(`saveOcrMarkdownIndex`)は、共有バス
  (`src/services/sharedBus.js`)のトピック `ocr-markdown-index` へも publish するように
  なった。`tc-shared-ocr-markdown-index-v1` にインデックス全体のスナップショットを含む
  レコードを書き、BroadcastChannel で購読者(tc-note)に通知する。詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) を参照。`mist_ocr_markdown_index` 自体は
  後方互換のため引き続き残る。
- **`tc-shared-folder-export-v1`** は暗号化フォルダバンドルを任意のドライブ実装アプリへ
  エクスポートするための共有バストピック(`folder-export`)。書き手は tc-pdf-viewer の
  `driveExport.js`(`FOLDER_EXPORT_TOPIC`)に加え、tc-travel の `src/lib/drive/export.ts` も
  同トピックへ書き込む(2人目の書き手)。単一レコードのため後発行が前発行を上書きする点を
  含む契約の詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック:
  `folder-export`」を参照。
