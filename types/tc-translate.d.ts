// tc-translate の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-translate.md

/** キー: "tc-translate-provider-settings-v1" */
export interface ProviderSettings {
  [key: string]: unknown;
}

/** キー: "tc-translate-tts-settings-v1" */
export interface TtsSettings {
  [key: string]: unknown;
}

/** キー: "tc-translate-stt-settings-v1" */
export interface SttSettings {
  [key: string]: unknown;
}

/** キー: "tc-translate-history-v1" (tc-note が読み取り専用でインポートに使う) */
export interface TranslationHistoryEntry {
  [key: string]: unknown;
}
export type TranslationHistory = TranslationHistoryEntry[];

/** キー: "tc-translate-target-language-v1" / "tc-translate-native-language-v1" */
export type LanguageCode = string;

/** キー: "tc-translate-mode-v1" */
export type TranslateMode = string;
