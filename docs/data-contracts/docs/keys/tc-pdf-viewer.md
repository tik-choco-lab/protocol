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
| `ai_settings` | AI 設定(下記) | tc-pdf-viewer | tc-pdf-viewer | tc-pdf-viewer/src/services/ai.js:127-154 |
| `tc-shared-folder-export-v1` | `SharedRecord`(`meta` は `FolderExportMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | tc-pdf-viewer, **tc-travel(2人目の書き手)** | **tc-storage(クロスアプリ読み取り)** | tc-pdf-viewer/src/services/driveExport.js。共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `folder-export` トピック |

## ai_settings (概要)

`getAiSettings()`/`saveAiSettings()`/`normalizeAiSettings()` (tc-pdf-viewer/src/services/ai.js)
で正規化される。ベース URL・API キー・モデル選択などプロバイダ設定を保持。詳細フィールドは
`tc-pdf-viewer/src/services/ai.js` の `DEFAULT_SETTINGS`/`normalizeAiSettings` を参照。

## 特記事項

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
