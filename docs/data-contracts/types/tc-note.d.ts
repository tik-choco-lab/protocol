// tc-note の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-note.md

/** キー: "tc-note:index" */
export interface NoteMeta {
  id: string;
  title: string;
  cid: string | null;
  updatedAt: number;
  favorite: boolean;
  preview: string;
  folderId: string | null;
}

/** キー: "tc-note:folders" */
export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  roomId?: string | null;
}

/** キー: "tc-note:node-id" */
export type NoteNodeId = string;

/** キー: "mist_ocr_markdown_index" (tc-pdf-viewer が書き、tc-note が読む) */
export type OcrMarkdownIndex = Record<string, string | { content: string }>;

/** キー: "mist_translated_markdown_index" (tc-pdf-viewer が書き、tc-note が読む) */
export type TranslatedMarkdownIndex = Record<string, Record<string, string>>;
