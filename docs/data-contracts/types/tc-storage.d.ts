// tc-storage の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-storage.md

/**
 * キー: "tc-storage-did-identity-v1" (ローカルミラー。tc-storage はこれを正として
 * "tc-shared-did-identity-cid-v1" 経由で他アプリと収束する。docs/did-identity.md 参照)
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

/** キー: "tc-storage-node-id-v1" */
export type NodeId = string;

/** キー: "tc-storage-browser-view-mode-v1" */
export type BrowserViewMode = "grid" | "list";
