# tc-vrm-viewer の localStorage キー

mistlib 使用: あり。tc-vrm-viewer は他アプリと異なり、**identity 永続化を localStorage
ではなく mistlib の OPFS ストレージ(CID)に委譲**し、localStorage は CID ポインタのみを
持つという独自方式を取る(`tc-vrm-viewer/src/profile/sharedStorage.ts`,
`tc-vrm-viewer/src/profile/didIdentity.ts`)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-shared-did-identity-cid-v1` | `string`(mistlib storage 上の identity レコードの **CID**) | tc-vrm-viewer(他アプリが同名キーを使えば共有可能) | tc-vrm-viewer | tc-vrm-viewer/src/profile/didIdentity.ts:27前後(`sharedIdentityCidKey`) |
| `tc-vrm-viewer-did-identity-v1` | DID identity レコードのローカルミラー(mistlib 未対応環境向けフォールバック) | tc-vrm-viewer | tc-vrm-viewer | tc-vrm-viewer/src/profile/didIdentity.ts(`localMirrorKey`) |

## 設計メモ(ソースコードのコメントより)

- `tc-shared-did-identity-cid-v1` は**意図的にアプリ名プレフィックスを付けない共有キー**。
  同一オリジンにデプロイされた全 tc-* アプリがこのキーを使えば同じ DID に収束する設計だが、
  現状これを実装しているのは tc-vrm-viewer のみ。tc-storage・tc-chat は各々の
  `tc-<app>-did-identity-v1` に生の identity を保存する別方式のままで、**3アプリ間で
  DID 永続化方式が統一されていない**([tc-storage.md](tc-storage.md) の特記事項も参照)。
- 初回ロード時、mistlib storage に identity が無ければ、このアプリの旧キー→他の
  既知の tc-* キーの順にフォールバックしてマイグレーションを試みる(ソースコメントより。
  実装詳細は `tc-vrm-viewer/src/profile/didIdentity.ts` 参照)。
- Ed25519/did:key の暗号処理自体は tc-storage の実装を verbatim コピーしたもの
  (ファイル冒頭コメントに明記)。

## 特記事項

- DID 永続化方式の統一(共有CIDポインタ方式への一本化 or 現状維持の明文化)は
  今後の課題として `docs/conventions.md` にも記載。
