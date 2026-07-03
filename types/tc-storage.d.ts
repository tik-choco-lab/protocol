// tc-storage の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-storage.md

/** キー: "tc-storage-did-identity-v1" ("tc-chat-did-identity-v1" と型は同じだが別値) */
export interface PublicDidIdentity {
  did: string;
  method: "did:key";
  keyType: "Ed25519";
  publicKeyMultibase: string;
  createdAt: string;
}

/** キー: "tc-storage-settings-v1" */
export interface AppSettings {
  roomId: string;
  nodeId: string;
  identity: PublicDidIdentity | null;
  autoConnect: boolean;
  profileName: string;
  avatarUrl: string;
  avatarFileId: string;
}

/** キー: "tc-storage-room-id-v1" */
export type RoomId = string;

/** キー: "tc-storage-node-id-v1" (tc-chat から存在確認のみされる) */
export type NodeId = string;

/** キー: "tc-storage-browser-view-mode-v1" */
export type BrowserViewMode = "grid" | "list";
