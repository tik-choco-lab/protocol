# tc-vrsns2 の localStorage キー

mistlib 使用: あり。tc-vrsns2 は tc-vrm-viewer と同様、**identity/プロフィール永続化を
localStorage ではなく mistlib の OPFS ストレージ(CID)に委譲**し、localStorage は CID
ポインタのみを持つという同じ方式を取る(`tc-vrsns2/src/profile/sharedStorage.ts`,
`tc-vrsns2/src/profile/didIdentity.ts`, `tc-vrsns2/src/profile/sharedProfile.ts`)。ただし
mistlib は1ページにつき MistNode を1つしか持てないため、`src/lib/mistNode.ts` の
`ensureMistNode()` にノード生成を一元化している点は tc-vrm-viewer から変わっている。

簡易カタログ(DID/プロフィールの共有キーと、ざっと grep して見つかった自アプリキーのみ。
深い監査はしていない)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-shared-did-identity-cid-v1` | `string`(mistlib storage 上の identity レコードの **CID**) | tc-storage, tc-chat, tc-vrm-viewer, tc-news, tc-vrsns2(共有ストアが空の場合に昇格) | tc-storage, tc-chat, tc-vrm-viewer, tc-news, tc-vrsns2 | tc-vrsns2/src/profile/didIdentity.ts:39(`sharedIdentityCidKey`)。詳細は [../did-identity.md](../did-identity.md) |
| `tc-vrsns2-did-identity-v1` | DID identity レコードのローカルミラー(mistlib 未対応環境向けフォールバック) | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/profile/didIdentity.ts:40(`localMirrorKey`) |
| `tc-shared-profile-cid-v1` | `string`(mistlib storage 上の `SharedProfileRecord` の **CID**) | tc-vrsns2(他アプリも同名キーを使えば共有可能) | tc-vrsns2 | tc-vrsns2/src/profile/sharedProfile.ts:46(`profileCidKey`) |
| `tc-shared-profile-v1` | `SharedProfileRecord`(表示名・アバター・DID。mistlib 未対応環境向けフォールバックの完全な JSON コピー) | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/profile/sharedProfile.ts:47(`profileFallbackKey`) |
| `tc-vrsns2:profile-v1` | `LocalProfile`(表示名・アクセントカラー・アバターCID) | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/profile/localProfile.ts:19 |
| `tc-vrsns2:room-v1` | 最後に参加したルームID | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/profile/localProfile.ts:20 |
| `tc-vrsns2:locale` | UIロケール | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/i18n/index.ts:69 |
| `tc-vrsns2:catalog:avatars-v1` | アバターカタログ(`CatalogItem[]`、CIDで参照) | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/storage/catalog.ts:18 |
| `tc-vrsns2:catalog:worlds-v1` | ワールドカタログ(`CatalogItem[]`、CIDで参照) | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/storage/catalog.ts:19 |
| `tc-vrsns2:catalog:objects-v1` | オブジェクトカタログ(`CatalogItem[]`、CIDで参照) | tc-vrsns2 | tc-vrsns2 | tc-vrsns2/src/storage/catalog.ts:20 |
| `tc-storage-snapshot-v1` | tc-storage の `StorageSnapshot`(フォルダ/ファイル一覧) | tc-storage | **tc-vrsns2(クロスアプリ読み取り、読み取り専用)** | tc-vrsns2/src/interop/tcStorageFiles.ts:46。tc-storage に保存済みのVRMアバターをCIDで再アップロードなしに読み込むための一覧取得のみに使う |

## 設計メモ(ソースコードのコメントより)

- `tc-shared-did-identity-cid-v1` は意図的にアプリ名プレフィックスを付けない共有キー。
  tc-vrm-viewer がこの方式の参照実装であり、tc-storage・tc-chat・tc-news・tc-vrsns2 が
  同じ共有キーを介して収束するよう実装済み。5アプリの照合ロジックの優先順位の違い
  (tc-storage のみローカル優先)を含む統一仕様は [../did-identity.md](../did-identity.md)
  を参照。
- 初回ロード時、mistlib storage に identity が無ければ、このアプリの旧キー→他の
  既知の tc-* キー(`tc-storage-did-identity-v1`, `tc-chat-did-identity-v1`,
  `tc-vrm-viewer-did-identity-v1`)の順にフォールバックしてマイグレーションを試みる
  (`legacyLocalStorageKeys`、`tc-vrsns2/src/profile/didIdentity.ts:42`)。
- Ed25519/did:key の暗号処理自体は tc-storage の実装を verbatim コピーしたもの
  (ファイル冒頭コメントに明記)。
- `tc-shared-profile-v1`/`tc-shared-profile-cid-v1` も同じ設計(mistlib CID ポインタ +
  localStorage フォールバックの完全コピー)を採る、DID とは別の共有プロフィール
  (表示名+アバター+DID)の仕組み。ファイル冒頭コメント([sharedProfile.ts](../../../../tc-vrsns2/src/profile/sharedProfile.ts))に詳細あり。

## 特記事項

- DID 永続化の統一仕様(共有キー方式、優先順位ポリシー、収束の仕組み)は
  [../did-identity.md](../did-identity.md) にまとめている。
- ローカル専用キーはおおむね `tc-vrsns2:<name>` 規約(コロン区切り)。DID identity の
  ローカルミラーのみ `tc-vrsns2-did-identity-v1`(ハイフン区切り + `v1` サフィックス)
  という例外的な命名だが、これは他アプリ(tc-storage/tc-chat/tc-vrm-viewer/tc-news)の
  ローカルミラーキー命名に揃えたもの。
- `tc-storage-snapshot-v1` の読み取りは常に防御的パース([../conventions.md](../conventions.md)
  の「クロスアプリ読み取りの原則」通り)で、壊れている・存在しない場合は空リストにフォール
  バックする(例外を投げない)。
- mistlib のノードID(`tc-vrsns2:node-id`)はタブ単位の識別子であり、複数タブが衝突しない
  よう意図的に `sessionStorage` に置かれている(`tc-vrsns2/src/lib/mistNode.ts:14`)。
  localStorage ではないため上表には含めていない。
- 上記は grep による簡易カタログであり、深い監査はしていない。
