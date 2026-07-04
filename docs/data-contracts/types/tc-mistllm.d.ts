// tc-mistllm の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-mistllm.md

/** キー: "tc-mistllm:settings" */
export interface MistllmSettings {
  [key: string]: unknown;
}

/** キー: "tc-mistllm:nodeId" */
export type MistllmNodeId = string;

// --- P2P ワイヤプロトコル(参照用)。出典: docs/mistllm-wire.md ---
// 実装上の正: tc-mistllm/src/lib/protocol.ts, tc-mistllm/cli/src/protocol.rs

export interface MistllmChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MistllmLlmRequestMsg {
  v: 1;
  type: "llm_request";
  id: string;
  messages: MistllmChatMessage[];
  model?: string;
}

export interface MistllmLlmResponseChunkMsg {
  v: 1;
  type: "llm_response_chunk";
  id: string;
  delta: string;
  /** 0-based, per-request, monotonically increasing. Absent means legacy/unordered delivery. */
  seq?: number;
}

export interface MistllmLlmResponseDoneMsg {
  v: 1;
  type: "llm_response_done";
  id: string;
  /** Authoritative full text; takes precedence over concatenated chunks when present. */
  content?: string;
}

export interface MistllmLlmErrorMsg {
  v: 1;
  type: "llm_error";
  id: string;
  message: string;
}

export interface MistllmProviderHelloMsg {
  v: 1;
  type: "provider_hello";
}

export interface MistllmConsumerHelloMsg {
  v: 1;
  type: "consumer_hello";
}

export type MistllmProtocolMessage =
  | MistllmLlmRequestMsg
  | MistllmLlmResponseChunkMsg
  | MistllmLlmResponseDoneMsg
  | MistllmLlmErrorMsg
  | MistllmProviderHelloMsg
  | MistllmConsumerHelloMsg;
