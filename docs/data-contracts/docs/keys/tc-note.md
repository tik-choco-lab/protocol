# tc-note の localStorage キー

mistlib 使用: あり(`tc-note/src/lib/mistlib.ts`、`storage_add`/`storage_get` でノート本文をCID保存)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-note:index` | `NoteMeta[]`(下記) | tc-note | tc-note | tc-note/src/lib/mistlib.ts:12,37-50 |
| `tc-note:folders` | `Folder[]`(下記) | tc-note | tc-note | tc-note/src/lib/mistlib.ts:13,55-63 |
| `tc-note:node-id` | `string`(mistlib ノードID) | tc-note | tc-note | tc-note/src/lib/mistlib.ts:14,67-70 |
| `tc-note:llm-settings` | `{ embeddingModel: string \| null; connection: "api" \| "network"; providerModeEnabled: boolean }`(下記) | tc-note | tc-note | tc-note/src/lib/llmSettings.ts:23-31 |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm | tc-note/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-note:collab-user` | コラボ用ユーザー情報 | tc-note | tc-note | tc-note/src/hooks/useCollab.ts:13 |
| `tc-shared-ocr-markdown-index-v1` | `SharedRecord`(共有バス、[../SHARED_BUS.md](../SHARED_BUS.md)参照) | tc-pdf-viewer | **tc-note (読み取り専用)**, tc-pdf-viewer | tc-note/src/lib/importDocument.ts; tc-pdf-viewer/src/services/storage.js |
| `mist_ocr_markdown_index` | `Record<string, string \| { content: string }>`(ファイル名→CID or 本文) | tc-pdf-viewer | **tc-note (読み取り専用、フォールバック)**, tc-pdf-viewer | tc-note/src/lib/importDocument.ts:10; tc-pdf-viewer/src/services/storage.js |
| `mist_translated_markdown_index` | `Record<string, Record<string, string>>`(ファイル名→言語→CID) | tc-pdf-viewer | **tc-note (読み取り専用)**, tc-pdf-viewer | tc-note/src/lib/importDocument.ts:11; tc-pdf-viewer/src/services/storage.js |
| `tc-translate-history-v1` | `TranslationHistoryEntry[]` | tc-note (読み取り専用, インポート機能), tc-translate | tc-translate | tc-note/src/lib/importTranslations.ts:9 |
| `tc-shared-note-article-v1` | `SharedRecord`(`meta` は `NoteArticleMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-note, tc-news | **tc-chat(クロスアプリ読み取り)** | tc-note/src/lib/shareArticle.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `note-article` トピック |
| `tc-shared-storage-drive-inbox-v1` | `SharedRecord`(`meta` は `{ items: DriveInboxItem[] }`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-note | **tc-storage(クロスアプリ読み取り)** | tc-note/src/lib/storageDriveInbox.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `storage-drive-inbox` トピック |
| `tc-shared-note-doc-index-v1` | `SharedRecord`(`meta` は `{ notes: NoteDocIndexEntry[] }`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-note | **tc-storage(クロスアプリ読み取り)** | tc-note/src/lib/noteDocExport.ts。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `note-doc-index` トピック |

## NoteMeta

```ts
interface NoteMeta {
  id: string;
  title: string;
  cid: string | null;       // mistlib storage_add の CID。null は未保存
  updatedAt: number;
  favorite: boolean;
  preview: string;           // 本文の短いプレーンテキストスニペット(一覧表示・検索用)
  folderId: string | null;   // null = 未分類
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;   // null = トップレベル
  roomId?: string | null;    // このフォルダ内の全ノートが共有するコラボルームID
}
```

## LlmSettings

```ts
type LlmConnection = "api" | "network";

interface LlmSettings {
  embeddingModel: string | null;      // 未配線(将来のembedding用途向けに保持のみ)
  connection: LlmConnection;          // チャットパネルの接続経路
  providerModeEnabled: boolean;       // trueならAI Networkルームへprovider役として応答
}
```

`providers`/`activeProviderId`/`llmModel`/`networkRoomId` は
`tc-shared-llm-config-v1` へ一度だけ移行済み(下記特記事項参照)で、この型からは消えている。

## 特記事項

- **共有LLM設定(`tc-shared-llm-config-v1`)への移行**: 旧 `tc-note:llm-settings` が直接保持していた
  `providers`/`activeProviderId`/`llmModel`/`networkRoomId` は、`tc-note/src/lib/llmSettings.ts` の
  `migrateLegacyRecord` により初回読み込み時に一度だけ共有キーへ移行される(`ensureProvider`/
  `ensurePreset` で merge-never-delete、`defaultPresetId`/`network.roomId` は空のときのみ設定)。
  移行後、このキーには `embeddingModel`/`connection`/`providerModeEnabled` のみが残る。tc-note は
  `defaultPresetId` のみを参照する**単一プリセット消費者**であり、tc-pdf-viewer の `taskPresetIds`
  や tc-news の役割別 preset のような機能別 presetId マップは持たない。契約の詳細は
  [../llm-config.md](../llm-config.md)。
- **キー名衝突**: `tc-note/src/lib/importTranslations.ts` の `HISTORY_KEY` が
  `"tc-translate-history-v1"` というハードコード文字列で、tc-translate が同じ用途で
  使っているキー(`tc-translate/src/constants.ts` の `historyStorageKey`)と**完全一致**して
  いる。tc-note はこのキーを読み取り専用のインポート機能として使っており、意図的に
  tc-translate のスキーマへ依存しているとみられるが、tc-translate 側でスキーマが変わると
  tc-note のインポートが壊れるリスクがある。要調整。
- `mist_ocr_markdown_index` / `mist_translated_markdown_index` は tc-pdf-viewer の
  レガシー命名規約(`mist_*`、アプリ名プレフィックスなし)を持つキーを tc-note が
  クロスアプリで読んでいる代表例。
- `mist_ocr_markdown_index` の読み取りは共有バス(`tc-note/src/lib/sharedBus.ts`)経由に
  最小移行済み: `readShared("ocr-markdown-index")` を先に試し、レコードが無い/不正な場合に
  のみ `mist_ocr_markdown_index` を直接読む。`subscribePdfViewerDocumentsChanged`
  (`importDocument.ts`)で更新通知も購読できる。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)。
- `tc-shared-note-article-v1` は tc-note のノートを tc-chat のボードへ「記事」として
  取り込むための共有バストピック(`note-article`)。書き手は tc-note の
  `shareArticle.ts`(`shareNoteAsArticle`)に加え、tc-news の `chatShare.ts`
  (`publishArticleToChat`)も同トピックへ書き込む。両者の `meta` の違い(インライン本文の
  扱い)を含む契約の詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック:
  `note-article`」を参照。
- **`tc-shared-storage-drive-inbox-v1`** はノートにドロップされたファイルを tc-storage の
  ドライブへ複製するための共有バストピック(`storage-drive-inbox`)。tc-note
  (`storageDriveInbox.ts`)がファイルごとに使い捨ての AES-256-GCM 鍵で暗号化し、ciphertext を
  mistlib の CID として、鍵/IV/チェックサムをメタデータとしてバスに乗せる。tc-storage の
  localStorage キーを直接読み書きすることはなく、連携はこのトピック経由のみ。詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `storage-drive-inbox`」を参照。
- **`tc-shared-note-doc-index-v1`** はノート本体を tc-storage のドライブへ複製するための
  共有バストピック(`note-doc-index`)。tc-note(`noteDocExport.ts`)がノートの保存/削除/復元の
  たびにデバウンス発行し、CIDを持つノートを更新日時降順で直近500件まで、毎回まるごと
  再発行する。ノート本文は `saveNote` の時点で既に平文のまま mistlib OPFS に保存済みのため
  (`storage-drive-inbox` と異なり)追加の暗号化は行わない。ノート削除はインデックスから
  除外されるのみで、tc-storage 側の既存コピーには伝播しない(v1)。詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) の「既存トピック: `note-doc-index`」を参照。
