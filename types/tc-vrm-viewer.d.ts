// tc-vrm-viewer の localStorage 値スキーマ(参照用)。
// このファイルは import せず、実装時にコピー&参照すること。
// 出典: docs/keys/tc-vrm-viewer.md

/**
 * キー: "tc-shared-did-identity-cid-v1"
 * アプリ名プレフィックスなしの共有キー。値は localStorage/mistlib storage 上の
 * DID identity レコードの CID(コンテンツアドレス)であり、identity 本体ではない。
 */
export type SharedDidIdentityCid = string;

/** キー: "tc-vrm-viewer-did-identity-v1" (mistlib 未対応環境向けローカルミラー) */
export interface DidIdentity {
  did: string;
  method: "did:key";
  keyType: "Ed25519";
  publicKeyMultibase: string;
  createdAt: string;
  privateKeyPkcs8: string;
}
