// tc-mistllm の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-mistllm.md

/** キー: "tc-mistllm:settings" */
export interface MistllmSettings {
  [key: string]: unknown;
}

/** キー: "tc-mistllm:nodeId" */
export type MistllmNodeId = string;
