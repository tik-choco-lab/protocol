# DID identity の統一仕様

tc-storage / tc-chat / tc-vrm-viewer / tc-news が共有する DID(did:key, Ed25519)を、単一の identity に
収束させるための仕様。[docs/keys/tc-storage.md](keys/tc-storage.md) の「DID identity 実装の
重複」で指摘していた不統一は、この共有キー方式によって解消されている。

## 共有キー

| キー | ストレージ | スキーマ |
|---|---|---|
| `tc-shared-did-identity-cid-v1` | localStorage(アプリ名プレフィックスなし) | `string`。値は identity レコード JSON を mistlib storage(`storage_add`)に保存した際の CID |

CID が指す identity レコード自体は mistlib の OPFS バックエンドに保存され、以下の共通スキーマを持つ:

```ts
type DidIdentity = {
  did: string
  method: 'did:key'
  keyType: 'Ed25519'
  publicKeyMultibase: string
  privateKeyPkcs8: string
  createdAt: string
}
```

## 各アプリのローカルミラーキー

共有CIDの読み書きに失敗した場合や mistlib 未初期化時のフォールバックとして、各アプリは
自分専用のローカルミラーキーに同じスキーマの identity を保持する。

| アプリ | ローカルミラーキー |
|---|---|
| tc-storage | `tc-storage-did-identity-v1` |
| tc-chat | `tc-chat-did-identity-v1` |
| tc-vrm-viewer | `tc-vrm-viewer-did-identity-v1` |
| tc-news | `tc-news-did-identity-v1` |

## 優先順位ポリシー(アプリ間で非対称)

4アプリの照合ロジックは同一ではない。**tc-storage だけがローカル優先**で、他は共有優先。

- **tc-storage**(`src/crypto/sharedDidIdentity.ts` の `reconcileSharedDidIdentity`):
  ローカルミラーが正。ローカルが存在すればそれを返し、共有ストアと食い違う(または空)場合は
  共有ストアへ書き戻す。ローカルが無く共有ストアがあれば、それを採用してローカルへミラーする。
  両方無ければ `undefined`(呼び出し元が新規生成する)。
  - ローカル優先である理由: tc-storage は自身の nodeId を mistlib 初期化より前に
    **同期的に**必要とする(`localSettings.ts`/`p2p.ts`)。そのため起動時に読むのは常に
    ローカルミラー(`didIdentity.ts`)であり、この関数は mistlib 初期化後に走る
    ベストエフォートの事後照合に過ぎない。
- **tc-chat**(`src/crypto/didIdentity.ts` の `ensureSharedDidIdentity`):
  共有ストアが正。共有ストアに identity があればそれを採用し、ローカルミラーを上書きする。
  無ければローカルの既存 identity(あれば)、なければ新規生成した identity を共有ストアへ
  書き込み、ローカルミラーにも保存する。
- **tc-vrm-viewer**(`src/profile/didIdentity.ts` の `ensureSharedDidIdentity`、参照実装):
  共有ストアが正。共有ストアにあればそれを採用してローカルミラーを更新する。無ければ、
  自アプリの旧ローカルキー→他の既知 tc-* アプリの旧ローカルキー
  (`tc-storage-did-identity-v1`, `tc-chat-did-identity-v1`)の順にフォールバックして
  マイグレーションを試み、それも無ければ新規生成する。結果を共有ストア・ローカルミラー両方に
  保存する。
- **tc-news**(`src/crypto/didIdentity.ts` の `ensureSharedDidIdentity`): tc-chat/
  tc-vrm-viewer と同じ「共有ストアが正」方針。共有ストア(`tc-shared-did-identity-cid-v1`
  経由)に identity があればそれを採用してローカルミラー(`tc-news-did-identity-v1`)を
  上書きし、無ければローカルの既存 identity(あれば)、なければ新規生成した identity を
  共有ストアへ書き込み、ローカルミラーにも保存する。暗号処理自体は tc-storage の実装を
  verbatim コピーしたものだが、ローカルミラーキーだけはアプリごとに独立している点は
  他アプリと同様。

### 収束の結果

tc-storage は自分のローカル identity を正として共有ストアへ書き戻す唯一のアプリであり、
tc-chat・tc-vrm-viewer・tc-news は共有ストアを正として自分のローカルを上書きする。したがって
**定常状態では全アプリが tc-storage の DID に収束する**(tc-storage が最初に起動して
共有ストアへ書き込むか、他アプリが先に生成した identity を tc-storage が後から自分の
ローカルで上書きするかに関わらず、最終的には tc-storage のローカル identity が優先される)。

## 用途

- **tc-storage**: DID が P2P の nodeId、および共有リンクの署名鍵として使われる
  (`tc-storage-did-identity-v1` は起動同期パスの都合上ローカル優先が必須)。
- **tc-chat / tc-vrm-viewer / tc-news**: 共有 DID をそのままアイデンティティとして使い、
  ローカルはあくまでミラー/フォールバック。

## 照合の失敗耐性

すべての照合ロジックはベストエフォートであり、mistlib storage への読み書き失敗・CID解決失敗
・JSON不正などが起きてもアプリの起動や動作を止めない(try/catch でローカルのみの動作に
フォールバックする、または直前の状態を返す)。

## 実装箇所

- tc-storage: `src/crypto/sharedDidIdentity.ts`(`reconcileSharedDidIdentity`)
- tc-chat: `src/crypto/didIdentity.ts`(`ensureSharedDidIdentity`)
- tc-vrm-viewer: `src/profile/didIdentity.ts`(`ensureSharedDidIdentity`、参照実装)
- tc-news: `src/crypto/didIdentity.ts`(`ensureSharedDidIdentity`)

Ed25519/did:key の暗号処理自体(鍵生成・base58btc エンコード・署名/検証)は4アプリとも
tc-storage の実装を verbatim コピーしたもの([docs/keys/tc-storage.md](keys/tc-storage.md) 参照)。
