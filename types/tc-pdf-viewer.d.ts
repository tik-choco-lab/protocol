// tc-pdf-viewer の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-pdf-viewer.md

/** キー: "mist_files_index" */
export interface MistFileEntry {
  name: string;
  cid: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
}
export type MistFilesIndex = MistFileEntry[];

/** キー: "mist_ocr_markdown_index" */
export type OcrMarkdownIndex = Record<string, string | { content: string }>;

/** キー: "mist_translated_markdown_index" */
export type TranslatedMarkdownIndex = Record<string, Record<string, string>>;

/** キー: "mist_last_lang" */
export type LastLang = string;

/** キー: "mist_last_pdf" */
export type LastPdf = string;

/** キー: "ai_settings" (フィールドは tc-pdf-viewer/src/services/ai.js の DEFAULT_SETTINGS を参照) */
export interface AiSettings {
  [key: string]: unknown;
}
