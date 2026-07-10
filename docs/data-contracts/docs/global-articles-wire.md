# グローバル記事配信ワイヤ(`tc-global-articles`)

tik-choco ファミリーのアプリが「誰でも読める記事フィード」を1つの mistlib ルームで
共有するための契約。tc-news が最初の実装であり、以下は tc-news の
`src/lib/newsWire.ts` / `src/hooks/useNewsRoom.ts` / `src/lib/globalArticlesReader.ts`
から起こした仕様。実装が正、本ドキュメントはそれに追従する。

記事本体(`tc-news:article`)に加えて、記事の翻訳結果を配信する
`tc-news:translation` ワイヤも同じルーム/署名/履歴同期の仕組みに乗る(詳細は
「ワイヤ形状: `tc-news:translation`」参照)。

記事本体を含む個々のアプリ内ルーム共有の仕様(プライベートルームでの配信・履歴同期の
詳細)はこのドキュメントの範囲外。ここではファミリー全体が乗り入れる **well-known な
グローバルルーム**に限定して記述する。

## ルーム

- ルームID(mistlib swarm topic)は生の文字列 **`tc-global-articles`**。派生・難読化された
  チャンネルIDではなく、この文字列そのものが swarm topic になる(他アプリの通常ルームと
  同じ仕組み)。
- tc-news では `src/lib/newsWire.ts` の `GLOBAL_ARTICLES_ROOM_ID` 定数として公開されている。
  ファミリー他アプリはこの定数値をそのまま `joinRoomAsync("tc-global-articles")` に渡せば
  同じ swarm へ参加できる(npm パッケージとしては配布しない — [SHARED_BUS.md](SHARED_BUS.md)
  と同様、値をコピーして各アプリのコードに埋め込む)。
- 個人のプライベートルーム(tc-news の既定 `roomId: "tc-news"` など)と並走する。同一クライアントが
  自分のプライベートルームとグローバルルームの両方に同時 join することを想定した設計。

## ワイヤ形状: `tc-news:article`

mistlib の `sendMessage` でルームへブロードキャストされる JSON オブジェクト。

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `type` | `"tc-news:article"` | 必須 | メッセージ種別 |
| `id` | `string` | 必須 | 記事ID(`NewsArticle.id`) |
| `fromId` | `string`(did:key) | 必須 | 送信者DID。署名の検証鍵でもある |
| `fromName` | `string` | 必須 | 送信者の表示名 |
| `timestamp` | `number` | 必須 | 送信時刻(epoch ms) |
| `cid` | `string` | 必須 | 記事本体JSON(下記「本文」参照)の mistlib CID |
| `signature` | `string` | 必須 | `signature` を除く全フィールドに対する署名(下記「署名」参照) |
| `fromApp` | `string` | 任意 | 発行元アプリ名。tc-news は常に `"tc-news"` を送る。将来 tc-note 等が同じグローバルルームへ書き込む場合はそのアプリ名(例 `"tc-note"`)を入れる |

`fromApp` は後方互換のための optional フィールド。存在しない wire(旧クライアント発行分)は
「発行元アプリ不明」として扱い、拒否はしない。受信側は `typeof fromApp === "string"` の
ときだけ値を採用し、それ以外の型であればフィールドごと無視する(`isArticleWire` /
`isArticleWirePayload` 型ガードは `fromApp` を要求しない)。

## 署名

署名方式は tc-storage/tc-chat 系と同じ `wireSign`(tc-news では `src/lib/wireSign.ts` に
ポート済み): `signature` を除く**全フィールドをキー順に安定化した JSON 文字列**に対して
送信者の DID identity で署名し、受信側は `fromId` を検証鍵として同じ文字列を検証する。
フィールドを列挙するホワイトリスト方式ではないため、`fromApp` のような optional
フィールドも(存在すれば)自動的に署名対象へ含まれる — ワイヤに新フィールドを追加しても
署名ロジック自体の変更は不要。

## 本文

`cid` が指すのは、`storage_add` で保存された **`NewsArticle` の JSON 全体**(tc-news
`src/types.ts` 参照)。

```ts
interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;       // リード文(1〜2文)
  body: string;           // markdown本文
  tags: string[];
  sourceLinks: { title: string; url: string }[];
  authorDid: string;      // 著者DID。ワイヤの fromId と一致するはず(下記「受信検証」参照)
  authorName: string;
  createdAt: number;      // epoch ms
  cid?: string;           // ルーム共有時に設定される(自己参照)
  shared?: boolean;
  origin?: string;        // 受信記事を自分の記事として保存したときの取得元ルームID
  lang?: string;          // 生成時のUIロケール(未設定は言語不明)
}
```

### 受信検証

受信側は以下の順で検証してから記事として採用する(いずれか失敗すれば黙って破棄し、
UIには出さない):

1. 型ガードで `tc-news:article` の必須フィールドが揃っているか確認する。
2. `verifyWire(wire)` で署名を検証する。
3. `storage_get(wire.cid)` で本文JSONを取得し、`NewsArticle` の必須フィールドが揃っているかを
   防御的にパースする(未知フィールドは無視、欠落は既定値)。
4. **`authorDid === wire.fromId`** を確認する。本文中の著者DIDとワイヤの署名者DIDが一致しない
   場合は「他人の記事に自分の署名を載せて配信」を意味するため破棄する。

## ワイヤ形状: `tc-news:translation`

記事の翻訳結果を1件配信するワイヤ。「記事を毎回LLMで翻訳し直すのは無駄」という
動機から、articleId×lang(翻訳先ロケール)ごとに一度だけ翻訳し、結果をルームで
共有して他ピアが再利用できるようにする。`tc-news:article` とは別の独立したワイヤ
種別であり、記事本体を書き換えるものではない(記事はcontent-addressedで不変)。

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `type` | `"tc-news:translation"` | 必須 | メッセージ種別 |
| `id` | `string` | 必須 | 翻訳レコードの一意id(article.id ではない) |
| `articleId` | `string` | 必須 | 翻訳対象の `NewsArticle.id` |
| `lang` | `string` | 必須 | 翻訳先ロケール(tc-news `src/lib/i18n` の Locale値、例 `"en"`) |
| `fromId` | `string`(did:key) | 必須 | 翻訳者DID。署名の検証鍵でもある(記事の著者DIDである必要はない) |
| `fromName` | `string` | 必須 | 翻訳者の表示名 |
| `timestamp` | `number` | 必須 | 送信時刻(epoch ms) |
| `cid` | `string` | 必須 | 翻訳本体JSON(下記)の mistlib CID |
| `signature` | `string` | 必須 | `tc-news:article` と同じ wireSign 方式の署名 |
| `fromApp` | `string` | 任意 | 発行元アプリ名 |

`cid` が指すのは、`storage_add` で保存された以下の JSON:

```ts
interface TranslationPayload {
  articleId: string;
  lang: string;
  title: string;
  excerpt: string;
  body: string; // markdown、article.body と同じ構造を維持した翻訳
}
```

### 受信検証・デデュープ

- 型ガードで必須フィールドが揃っているか確認し、`verifyWire(wire)` で署名を検証する。
- `storage_get(wire.cid)` した本体の `articleId`/`lang` がワイヤのものと一致しない場合は破棄する
  (`tc-news:article` の authorDid 一致チェックに相当する整合性チェック)。
- 同一 articleId×lang の翻訳は「まだローカルに無ければ採用」でデデュープする(先着優先)。複数ピアが
  同時に翻訳して複数の wire が飛んでも、各ピアは最初に受け取った1件だけを採用しLLM呼び出しの
  重複を避ける。
- 記事本体と異なり、翻訳者DID(`fromId`)が記事の著者DIDと一致する必要はない — 誰でも既存記事を
  翻訳して共有できる。

## 履歴同期

新規参加者は join 後にワンショットで `tc-news:history-request` をルームへブロードキャストする。

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `type` | `"tc-news:history-request"` | 必須 | メッセージ種別 |
| `fromId` | `string`(did:key) | 必須 | リクエスト送信者DID |
| `timestamp` | `number` | 必須 | 送信時刻(epoch ms) |

- 既存ピアはそれぞれ自分のローカル wireLog(`tc-news:wirelog:tc-global-articles`。
  ローカルストレージのキー形式は tc-news `src/lib/newsWire.ts` の
  `WIRE_LOG_KEY_PREFIX + roomId` 参照)を、リクエスト送信者宛てに `sendMessage` で
  リプレイする。wireLog は `tc-news:article`/`tc-news:translation` を区別せず同じ
  ログに積まれるため、1回の history-request で両方まとめてリプレイされる。
- **スロットル**: 同一 `fromId` からの history-request は、ピアごとに 60 秒に1回しか
  リプレイしない(再接続の繰り返しなどでリプレイの嵐が起きるのを防ぐ)。
- リプレイされる wire は署名済みなので、受信側はそれぞれの wire 種別に応じた通常の
  受信パス(上記「受信検証」)を通す。

## 転送(forward)

グローバルルームは「誰かが明示的に転送した記事」だけが流れる想定(プライベートルームの
記事が自動でグローバルへ流出するわけではない)。転送は**受信済みの署名済み wire を
一切改変せず**グローバルルームへ再送する操作であり、署名の再生成は行わない。

- 転送元は自分の DID で署名し直すのではなく、元の `fromId`/`signature` をそのまま保持した
  `ArticleWire` を再送する。これにより受信側は「誰が最初にこの記事を発行したか」を
  常に検証可能なまま保つ(中継者になりすまされない)。
- 転送前に `verifyWire` で署名を再検証し、失敗すれば転送しない。
- 転送に成功したら、グローバルルームの wireLog(`appendWireLog(GLOBAL_ARTICLES_ROOM_ID, wire)`)
  にも記録する。これにより転送者自身も次の history-request に対してこの記事をリプレイできる
  ようになる。
- 参考実装: tc-news `src/lib/globalArticlesReader.ts` の `forwardWireToGlobal` /
  `forwardArticleToGlobal`。前者は wire を直接受け取って転送し、後者は記事IDと転送元
  ルームIDから wireLog を引いて前者を呼ぶ(SharedView の「グローバルへ転送」操作から
  使われる)。

## 書き手・読み手

- **書き手**: tc-news(記事を作成したユーザーがグローバルルームへ配信するとき、または
  他ユーザーの記事をプライベートルームからグローバルルームへ転送するとき)。設定
  `AppSettings.globalShare`(既定 `true`)が `false` のユーザーは新規記事の自動配信を
  行わない(転送操作自体は別途明示的な操作なので `globalShare` の影響を受けない)。
- **読み手**: tc-news(グローバルルームタブ)。将来的に tc-note 等が同じルームへ
  記事を書き込む/読み込む場合は、`fromApp` を見てアプリごとの表示分岐(アイコンなど)に
  使ってよい — ワイヤ形状自体はアプリ非依存なので、どのアプリからでも同じ検証ロジックで
  読める。

## バージョニング方針

- [conventions.md](conventions.md) のスキーマ進化ルールに準じる。`fromApp` のような
  optional フィールド追加は非破壊的変更であり、ワイヤ種別(`type` の値)は変えない。
- `ArticleWire` の必須フィールドの型変更・削除など真に破壊的な変更を行う場合は、
  `type` の値自体を変える(例 `"tc-news:article"` → `"tc-news:article-v2"`)ことを検討する。
