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
  tc-vrm-viewer がこの方式の参照実装(canonical shared implementation)であり、
  tc-storage・tc-chat も同じ共有キーを介して収束するよう実装済み。3アプリの照合ロジックの
  優先順位の違い(tc-storage のみローカル優先)を含む統一仕様は
  [../did-identity.md](../did-identity.md) を参照。
- 初回ロード時、mistlib storage に identity が無ければ、このアプリの旧キー→他の
  既知の tc-* キー(`tc-storage-did-identity-v1`, `tc-chat-did-identity-v1`)の順に
  フォールバックしてマイグレーションを試みる(`legacyLocalStorageKeys`、
  `tc-vrm-viewer/src/profile/didIdentity.ts:42`)。
- Ed25519/did:key の暗号処理自体は tc-storage の実装を verbatim コピーしたもの
  (ファイル冒頭コメントに明記)。

## VRMモデルライブラリ共有(IndexedDB)

localStorage キーではないが、tc-town・tc-travel と直接共有するクロスアプリストアとして
ここに記載する。tc-vrm-viewer は自分のVRMモデルライブラリ(インポート済み `.vrm` 一式)を
ブラウザネイティブの IndexedDB(データベース名 `tc-vrm-viewer`、バージョン `1`、オブジェクト
ストア `models`、keyPath `id`)に保存しており、**canonical owner**(スキーマ本家)として
`src/storage/library.ts`(`addModelToLibrary`/`listLibraryModels`/`removeModelFromLibrary`)・
`src/storage/domain.ts`(`FileRecord` 定義)で読み書きする。

同一オリジンの tc-town(書き手 + 読み手、`src/vrm/library.ts`)・tc-travel(読み手専用、
`src/lib/town/vrmResolve.ts`)がこの同じ DB/ストアへ直接アクセスする。スキーマ・重複排除
(`checksum` によるクロスアプリ同一性判定)・運用ルールの詳細は
[../vrm-model-library.md](../vrm-model-library.md) を参照。

## 特記事項

- DID 永続化の統一仕様(共有キー方式、優先順位ポリシー、収束の仕組み)は
  [../did-identity.md](../did-identity.md) にまとめている。
- VRMモデルライブラリ(IndexedDB)共有の統一仕様は [../vrm-model-library.md](../vrm-model-library.md)
  にまとめている。
