# tc-note の localStorage キー

mistlib 使用: あり(`tc-note/src/lib/mistlib.ts`、`storage_add`/`storage_get` でノート本文をCID保存)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-note:index` | `NoteMeta[]`(下記) | tc-note | tc-note | tc-note/src/lib/mistlib.ts:12,37-50 |
| `tc-note:folders` | `Folder[]`(下記) | tc-note | tc-note | tc-note/src/lib/mistlib.ts:13,55-63 |
| `tc-note:node-id` | `string`(mistlib ノードID) | tc-note | tc-note | tc-note/src/lib/mistlib.ts:14,67-70 |
| `tc-note:llm-settings` | LLM プロバイダ設定(OpenAI API 互換) | tc-note | tc-note | tc-note/src/lib/llmSettings.ts:5 |
| `tc-note:collab-user` | コラボ用ユーザー情報 | tc-note | tc-note | tc-note/src/hooks/useCollab.ts:13 |
| `tc-shared-ocr-markdown-index-v1` | `SharedRecord`(共有バス、[../SHARED_BUS.md](../SHARED_BUS.md)参照) | tc-pdf-viewer | **tc-note (読み取り専用)**, tc-pdf-viewer | tc-note/src/lib/importDocument.ts; tc-pdf-viewer/src/services/storage.js |
| `mist_ocr_markdown_index` | `Record<string, string \| { content: string }>`(ファイル名→CID or 本文) | tc-pdf-viewer | **tc-note (読み取り専用、フォールバック)**, tc-pdf-viewer | tc-note/src/lib/importDocument.ts:10; tc-pdf-viewer/src/services/storage.js |
| `mist_translated_markdown_index` | `Record<string, Record<string, string>>`(ファイル名→言語→CID) | tc-pdf-viewer | **tc-note (読み取り専用)**, tc-pdf-viewer | tc-note/src/lib/importDocument.ts:11; tc-pdf-viewer/src/services/storage.js |
| `tc-translate-history-v1` | `TranslationHistoryEntry[]` | tc-note (読み取り専用, インポート機能), tc-translate | tc-translate | tc-note/src/lib/importTranslations.ts:9 |

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

## 特記事項

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
