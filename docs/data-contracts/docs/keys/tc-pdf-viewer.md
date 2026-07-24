# tc-pdf-viewer の localStorage キー

mistlib 使用: あり(`tc-pdf-viewer/src/lib/mistlib/`、`storage_add`/`storage_get` で PDF/Markdown 本文をCID保存)

すべてレガシー命名(`mist_*` プレフィックス、アプリ名なし)。新規キーはこの規約に従わない
(`docs/conventions.md` 参照)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `mist_files_index` | `{ name, cid, folder, createdAt, updatedAt }[]` | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/storage.js:9-24 |
| `mist_custom_folders` | `string[]`(フォルダ名の配列。ユーザーが手動追加した空フォルダを保持するリストで、`mist_files_index` の各エントリの `folder` 由来のフォルダ名と合算して表示する) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/components/sidebar/sidebarUtils.js:79-82; App.jsx:181-186 |
| `mist_ocr_markdown_index` | `Record<pdfName, string \| { content: string } \| { cid: string, updatedAt: number, summary?: string, summaryUpdatedAt?: number }>`(ファイル名→本文。3形式が dual-read 対象で混在する。詳細は下記特記事項) | tc-pdf-viewer | tc-pdf-viewer, **tc-note (クロスアプリ読み取り)** | tc-pdf-viewer/src/services/storage.js:26-32,220-234,236-257 |
| `mist_translated_markdown_index` | `Record<pdfName, Record<lang, string \| { content: string } \| { cid: string, updatedAt: number }>>`(ファイル名→言語→本文。`mist_ocr_markdown_index` と同じ3形式が dual-read 対象で混在する) | tc-pdf-viewer | tc-pdf-viewer, **tc-note (クロスアプリ読み取り)** | tc-pdf-viewer/src/services/storage.js:71-79,282-299,301-322 |
| `mist_explanations_index` | `Record<string, string>`(キーは選択テキストの生文字列(ハッシュ化なし)、値はAI解説本文の mistlib CID) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/storage.js:187-218 |
| `mist_last_lang` | `string`(最後に使用した翻訳言語) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/mist.js |
| `mist_last_pdf` | `string`(最後に開いた PDF の識別子) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/mist.js |
| `tc-pdf-viewer-ai-settings-v1` | `{ backend: 'http' \| 'mistllm'; networkProviderEnabled: boolean; taskPresetIds: { explain, translate, chat, ocr }; promptTemplate: string; targetLanguages: string[] }`(下記) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/ai.js:32-46 |
| `ai_settings`(レガシー、廃止) | baseUrl/apiKey/タスク別モデル名を1レコードで保持する旧形式(下記特記事項参照) | (旧)tc-pdf-viewer | tc-pdf-viewer(起動時に検出して移行後 `removeItem`) | tc-pdf-viewer/src/services/ai.js:33,150-163 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/AI Networkルーム。tts/stt不使用。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-pdf-viewer/src/services/llmConfig.js。詳細は [../llm-config.md](../llm-config.md) |
| `tc-shared-folder-export-v1` | `SharedRecord`(`meta` は `FolderExportMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-pdf-viewer, **tc-travel(2人目の書き手)** | **tc-storage(クロスアプリ読み取り)** | tc-pdf-viewer/src/services/driveExport.js。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `folder-export` トピック |
| `tc-shared-ocr-markdown-index-v1` | `SharedRecord`(`meta.index` に `mist_ocr_markdown_index` のスナップショットを含む。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-pdf-viewer | **tc-note (クロスアプリ読み取り)**, tc-pdf-viewer | tc-pdf-viewer/src/services/storage.js:46-68(`saveOcrMarkdownIndex`)。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `ocr-markdown-index` トピック |
| `tc-pdf-viewer-chat-index-v1` | `Record<pdfName, { cid: string, updatedAt: number }>`(PDFごとのAIチャット履歴のCIDポインタ。本文はmistlib CIDストア) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/storage.js:398-432(`saveChatMessages`),434-474(`loadChatMessages`) |
| `mist_chat_<pdfName>`(レガシー、動的キー) | メッセージ配列インライン | (旧)tc-pdf-viewer | tc-pdf-viewer(移行元。読み取り時に `tc-pdf-viewer-chat-index-v1` へ一度きり移行後 `removeItem`) | tc-pdf-viewer/src/services/storage.js:399,450-473 |
| `tc-pdf-viewer-drive-export-v1` | `DriveExportState`(`folderId`/`passphrase`/`folder`/`subfolders`/`files`/`sources`/`lastPublishedCid`。下記参照) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/driveExport.js:19,36-45 |
| `tc-pdf-viewer-inbox-imported-v1` | `{ v: 1, ids: string[] }`(上限1000件) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/storageHandoffInbox.js:39-40,85-105。`pdf-viewer-inbox` トピック取り込みの冪等キー |
| `tc-pdf-viewer-mistllm-node-id-v1` | `string`(UUID。表示用 mistllm nodeId) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/mist.js:17,37-43 |
| `tc-pdf-viewer-device-id` | `string`(UUID。mistlib ノードの wire identity) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/utils/device.js:1-10 |
| `tc-pdf-onboarding-done` | `'1'`(オンボーディング完了フラグ。キー名がアプリ名短縮 `tc-pdf` の独自形式である点に注意) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/onboarding.js:1-17 |
| `tc-pdf-theme` | `'dark' \| 'light'`(テーマ。同じく `tc-pdf` 短縮命名) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/hooks/useTheme.js:3 |
| `tc-app-manifest:tc-pdf-viewer` | `AppManifestV1`(アプリマニフェスト。詳細は [../app-manifest.md](../app-manifest.md)) | tc-pdf-viewer | (他アプリからの読み取り専用参照を想定) | tc-pdf-viewer/src/services/appManifest.js; main.jsx:18-24 |
| `tc-shared-pdf-viewer-inbox-v1` | `SharedRecord`(`meta.items` は `FileHandoffItem[]`: `{ id, name, mimeType, size, checksum, cid, key, iv, addedAt }[]`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | **tc-storage** | tc-pdf-viewer(クロスアプリ読み取り) | tc-pdf-viewer/src/services/storageHandoffInbox.js:37,51-79; App.jsx:852-881。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `pdf-viewer-inbox` トピック |

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

## DriveExportState (tc-pdf-viewer-drive-export-v1)

`folder-export` トピック(下記参照)へ公開する前段として、フォルダ/ファイルの
`FolderRecord`/`FileRecord`(本文抜き)とパスフレーズをローカルに永続化しておく exporter の
内部状態。再エクスポート時に変更のあったフィールドだけへ新しい LWW スタンプを打つための
ベースラインとして使う。`localStorage` への書き込みに失敗した場合(容量超過・プライベート
ブラウジング等)は、同一セッション内ではメモリ上のミラーで代用する。

```ts
interface DriveExportState {
  folderId: string;                 // root FolderRecord id
  passphrase: string;               // 全バンドルの暗号鍵
  folder: object;                   // root FolderRecord(作成時に一度だけスタンプ)
  subfolders: object[];             // tc-pdf-viewer のフォルダごとに1つの FolderRecord
  files: object[];                  // PDFごとに1つの FileRecord(本文は抜いてある)
  sources: Record<string, string>;  // fileRecordId -> 変換元の pdf-viewer CID(内容変更検知用)
  lastPublishedCid?: string;        // 直近に公開した FolderBundle のCID
}
```

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
- **`mist_ocr_markdown_index` / `mist_translated_markdown_index` は3形式が dual-read 対象として
  混在する**:
  1. **最古の形式**: エントリ自体が裸のCID文字列(`string`)。
  2. **旧形式**: `{ content: string }` インラインオブジェクト(本文をそのまま持つ)。
  3. **現行形式**: `{ cid: string, updatedAt: number, summary?: string, summaryUpdatedAt?: number }`
     (OCR側)/ `{ cid: string, updatedAt: number }`(翻訳側)。書き手は `saveOcrMarkdown`/
     `saveOcrMarkdownSummary`/`saveTranslatedMarkdown`(`src/services/storage.js`)。

  **新規書き込みは常に現行形式**(`content` フィールドは書かない。既存の `content` は
  `undefined` を代入して `JSON.stringify` 時に落とす)。`content` を伴う旧2形式は読み取り専用の
  レガシー互換としてのみ存続し、`getOcrMarkdown`/`getTranslatedMarkdown` の dual-read
  (`content` があればそれを使い、無ければ `cid` を解決。エントリ自体が文字列ならそれを `cid`
  として扱う)が両方をハンドリングする。加えて起動時に `migrateMarkdownIndexesToCid()`
  (`storage.js:338-387`、App.jsx:176-178 から呼ばれる)が `content` を持ち `cid` を持たない
  エントリを一度きりでCID化して現行形式へ正規化する(裸CID文字列は既にCIDなので、この
  マイグレーション対象には含まれない — dual-read パーサー側でそのまま解決される)。
  新規キー読み取り実装は3形式すべてに対して防御的にパースすること。
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
- **`tc-pdf-viewer-chat-index-v1`(PDFごとのAIチャット履歴)**: チャット全文は無制限に
  成長しうるため、OCR/翻訳インデックスと同じく localStorage には小さなCIDポインタだけを
  持ち、メッセージ配列自体は mistlib の `storage_add`/`storage_get` でCID化する
  (`storage.js:389-397` のコメント参照。vendor 済みmistlibビルドがまだ `storage_kv_set/get`
  KVを公開していないため、同じ「ポインタ index + storage_add/get」パターンを流用している)。
  旧 `mist_chat_<pdfName>`(PDF名ごとの動的キー、メッセージ配列をインライン保持)からの
  dual-read もサポートし、`loadChatMessages` が旧キーを見つけた場合は読み取った内容を
  そのまま返しつつバックグラウンドで `saveChatMessages` を呼んで一度きりCIDストアへ移行し、
  成功時に旧キーを `removeItem` する。
- **`tc-shared-pdf-viewer-inbox-v1`(tc-storageからのファイルハンドオフ)**: tc-storage の
  ファイルプレビューで「tc-pdf-viewer で開く」を選んだ際、ファイルをその場で使い捨ての
  AES-256-GCM鍵で暗号化し、ciphertextを mistlib CIDとして、鍵/IV/チェックサムをメタデータと
  してバスに乗せる、共有バスの `pdf-viewer-inbox` トピック(書き手: tc-storage、読み手:
  tc-pdf-viewer)。`storageHandoffInbox.js` がマウント時に1回 `readShared` し、以後
  `subscribeShared` で購読する。各アイテムを `storage_get` → AES-GCM復号 → SHA-256
  チェックサム照合の順に処理し、一致した平文だけを通常の `savePdf()` パスで専用フォルダ
  「tc-storageから追加」へ取り込む。取込済みIDは `tc-pdf-viewer-inbox-imported-v1`
  (上限1000件)に記録して冪等化する。一時的な解決失敗(mist初期化・`storage_get`失敗)は
  取込済みマークをつけず再試行、恒久的な失敗(復号エラー・チェックサム不一致・PDF以外の
  ファイル)は恒久的に取込済み扱いとする。インポート直後は一覧を再取得し、直近取り込んだ
  PDFを自動で開く(App.jsx:846-881)。契約の詳細は [../SHARED_BUS.md](../SHARED_BUS.md)
  の「既存トピック: `pdf-viewer-inbox`」を参照。
