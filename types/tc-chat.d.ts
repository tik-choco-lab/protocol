// tc-chat の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-chat.md

/** キー: "tc-chat:node-id" */
export type ChatNodeId = string;

/** キー: "tc-chat:messages:<roomId>" (プレフィックス連結キー) */
export interface ChatMessage {
  [key: string]: unknown;
}
export type ChatMessages = ChatMessage[];

/** キー: "tc-chat:project-posts:<roomId>" (プレフィックス連結キー) */
export interface ProjectPost {
  [key: string]: unknown;
}
export type ProjectPosts = ProjectPost[];

/** キー: "tc-chat:rooms" */
export interface Room {
  [key: string]: unknown;
}
export type Rooms = Room[];

/** キー: "tc-chat:username" */
export type Username = string;

/** キー: "tc-chat:board-view-mode" */
export type BoardViewMode = "board" | "timeline";

/**
 * キー: "tc-chat-did-identity-v1" (共有ストア優先のローカルミラー。
 * "tc-shared-did-identity-cid-v1" 経由で tc-storage/tc-vrm-viewer と同一DIDに収束する。
 * docs/did-identity.md 参照)
 */
export interface PublicDidIdentity {
  did: string;
  method: "did:key";
  keyType: "Ed25519";
  publicKeyMultibase: string;
  createdAt: string;
}

/** キー: "tc-shared-did-identity-cid-v1" (アプリ名プレフィックスなしの共有キー。値は CID) */
export type SharedDidIdentityCid = string;
