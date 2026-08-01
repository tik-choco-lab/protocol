# Mist signaling namespace(mistSignaling)仕様

mistlib(mist-web-wrapper)の `MistNode` を構築する際に必須となった Nostr シグナリング設定
`inviteSalt`/`inviteCode` を、tik-choco ファミリー全アプリで**同一の値**に固定するための契約。
sharedBus/appManifest/llmConfig と同じ vendor 配布方式([reference/](../data-contracts/reference/)
参照実装 + `protocol/scripts/sync-vendored.mjs`)を採る。

## なぜ全アプリで同じ値が必要か

`inviteSalt`/`inviteCode` はピア発見の名前空間を決める値であり、mistlib はこの2値から
シグナリング用の秘密を導出してピア探索を行う。**この値が一致するピア同士しか出会えない。**

たとえば tc-chat と tc-news が同じ `roomId` を指定してルームへ参加しようとしても、
それぞれが異なる `inviteSalt`/`inviteCode` を渡していれば、シグナリング層では別の名前空間で
探索することになり、互いを発見できない。アプリ側には失敗ではなく「誰もいない空のルーム」に
見えるため、原因の特定が難しい。したがって tik-choco ファミリーの全アプリ(および mistl)は
**同一のペア**を使う必要がある。

## 確定値

```
inviteSalt = "tik-choco-v1"
inviteCode = "tik-choco-public-v1"
```

参照実装の `MIST_INVITE_SALT`/`MIST_INVITE_CODE`(下記「reference 実装」参照)。

## 秘密ではない

この2値は**認証情報ではない**。公開静的サイトの JS バンドルにそのまま載るため、誰でも読める
(閲覧すれば誰でも同じ値を使ってこの名前空間に参加できる)。これらは「ファミリーの discovery
トラフィックを他の無関係なデプロイと分離するための名前空間分離」であって、認可(誰の書き込み
/読み込みを信用するか)には関与しない。認可はワイヤレベルの DID 署名が担う
([did-identity.md](did-identity.md) 参照)。この2値をアクセス制御や真正性の判定に使わないこと
——llmConfig の `apiKey` と異なり、そもそも秘匿性を意図した値ですらない。

## 経緯: なぜ明示的な設定が必要になったか

mistlib には既定値 `inviteSalt = "nostr-sig-test-local-salt"` / `inviteCode = "dev-invite-001"`
が組み込まれている。この既定値は signaling spec 上、**ローカルリレーでの開発用**に予約された
値であり、本番の公開リレーで使うことを想定していない。しかし既定値のまま公開リレーに接続すると、
同じ既定値を使う他の無関係な全デプロイ(mistlib を使う別プロジェクト含む)と同一の名前空間に
同居してしまう。

これを受けて mist-web-wrapper は既定値の自動提供をやめ、`inviteSalt`/`inviteCode` を
**必須**にした(未設定のまま `new MistNode()` を呼ぶと throw する)。一方で**エンジン側
(wasm コア)は今も既定値を保持している**ため、web wrapper を経由しないネイティブ呼び出し側
(mistl)はこの必須化の恩恵を受けず、自分で明示的に値を設定しないと気づかずローカル開発用の
既定値のまま動いてしまう。

## 適用範囲

- **ブラウザアプリ12本**(下記「参加アプリ」参照): [reference/mistSignaling.ts](../reference/mistSignaling.ts)
  / [reference/mistSignaling.js](../reference/mistSignaling.js) を vendor コピーし、
  `mistSignalingConfig()` の戻り値をそのまま `new MistNode(id, config)` に渡す。
- **mistl**(OS常駐ネイティブデーモン): localStorage を持たないため本契約の vendor 配布の
  対象ではないが、Rust 側の `MistNode` 構築コードに同じ `inviteSalt`/`inviteCode` を
  ハードコードして設定する。llm-config.md の「関連実装: mistl」節と同様の関係。
- **tc-storage / tc-vrm-viewer**: mist-web-wrapper を使わず wasm モジュールを直接叩いており、
  vendor 先ディレクトリも `src/vendor/mistlib-wasm/` と他アプリ(`src/lib` 等)とは別構成。
  そのため `protocol/scripts/sync-vendored.mjs` の配布対象には含めず、個別に同じ値を設定する
  (別途対応)。

## `relays` が空である理由

参照実装が返す `signaling.nostr.relays` は意図的に空配列にしてある。空にしておくと mistlib が
既定のリレーリスト(`https://data.tik-choco.com/server/relays.json`)を取得して使うため、
リレー集合をアプリごとのバンドルに焼き込まずに済む。リレー構成の変更(追加・退役)を
各アプリの再ビルド・再デプロイなしに反映できる。

## tc-vrsns2 の名前空間統合(済)

tc-vrsns2 はかつて独自の `inviteSalt = "tc-vrsns2-v1"` / `inviteCode = "tc-vrsns2-public-v1"`
を持っており、他の tc-* アプリのピアからは相互に発見できなかった。既存ピアとの接続が一度切れる
ことを承知のうえで family 共通値へ統合済み(`src/lib/mistNode.ts` のローカル定数を撤去し、
vendor された `mistSignaling.ts` を参照する形に変更)。

移行前のビルドを開いたままのクライアントは旧名前空間に留まるため、新旧で相互に発見できない。
これは意図した一度きりの断絶であり、双方が新しいビルドを読み込めば解消する。

## 参加アプリ

- tc-note
- tc-translate
- tc-chat
- tc-news
- tc-town
- tc-travel
- tc-mistllm
- tc-books
- tc-lingo
- tc-home
- tc-presenter
- tc-vrsns2

## reference 実装 / vendor 運用

sharedBus.ts / appManifest.ts / llmConfig.ts と同様、単一の npm パッケージとして共有せず、
各参加アプリに同一契約のファイルを vendor コピーする(理由は [README.md](../README.md) の
「原則: ランタイム依存禁止」参照)。参照実装は
[reference/mistSignaling.ts](../reference/mistSignaling.ts) /
[reference/mistSignaling.js](../reference/mistSignaling.js)。配布先・言語(TS/JS)は
`protocol/scripts/sync-vendored.mjs` の `APPS` テーブル(`mistSignaling: true` のエントリ)を
参照。appManifest.ts/llmConfig.ts と同様、`APP_NAME` のような置換対象の定数を持たないため、
vendored コピーは全アプリでバイト同一になる。

## 公開API

```ts
const MIST_INVITE_SALT: string; // "tik-choco-v1"
const MIST_INVITE_CODE: string; // "tik-choco-public-v1"

type MistSignalingConfig = {
  signaling: {
    mode: "nostr";
    nostr: {
      relays: string[];
      discoveryKind: number;
      messageKind: number;
      ttlSeconds: number;
      inviteSalt: string;
      inviteCode: string;
    };
  };
};

function mistSignalingConfig(): MistSignalingConfig;
```

呼び出し側は `new MistNode(id, mistSignalingConfig())` のように、戻り値をそのまま
mist-web-wrapper の `MistNode` コンストラクタへ渡す(トップレベルに他の設定と併せた
オブジェクトを構築する場合は `...mistSignalingConfig()` でスプレッドする)。
`discoveryKind`/`messageKind`/`ttlSeconds` は wrapper 自身の既定値をそのまま値として
書き出したものであり、上流のデフォルトが将来変わってもこのファミリーのトラフィックが
無自覚に移動しないようにするための固定化。

## appManifest への記載について

`mistSignaling` は特定アプリが所有する localStorage キーを持たない(そもそも localStorage を
一切使わない、定数とファクトリ関数のみのモジュール)ため、
[app-manifest.md](app-manifest.md) が定める `AppManifestV1.reads`/`publishes`/`consumes` の
いずれの対象にもならない。

## keys カタログへの記載について

[docs/keys/](keys/) は各アプリの localStorage キーカタログである。本契約は localStorage
キーを一切増やさない(定数値をそのまま `MistNode` コンストラクタに渡すだけ)ため、
keys カタログの更新は不要。

## バージョニング方針

[llm-config.md](llm-config.md)/[app-manifest.md](app-manifest.md) と同じ方針。`inviteSalt`/
`inviteCode` の値そのものを変更する場合はファミリー全体の名前空間移行を意味するため、
`docs/mist-signaling.md` の「確定値」節を更新のうえ、全参加アプリへの反映を協調して行うこと
(片方だけ更新すると即座に相互に発見できなくなる)。
