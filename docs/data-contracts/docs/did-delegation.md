# DID 委譲チェーン v1

[did-identity.md](did-identity.md) の共有 DID は「同一オリジンに閉じた1つの did:key」であり、
別ブラウザ・別マシン・dev環境(別ポート)では別 DID になるため「同一人物」を表現できない。

この文書は、**恒久的な本人ID(root)がデバイス/オリジン鍵(leaf)へ署名で委譲する**ことで
オリジン境界を越えて同一ユーザーを識別する仕組みを定める。

- チェーン深さは **1 固定**(root → leaf のみ。sub-delegation なし)。
- root 鍵の custodian は **mistl**(推奨)。mistl を持たないユーザーは委譲なしで
  従来どおり leaf がそのまま本人IDとして扱われる。
- **失効リストは持たない**。委譲は `exp` 付きの短命とし、再発行で回す。
- 検証側は**後方互換**: 委譲が添付されていなければ従来どおり `fromId` の署名だけを検証する。

正典実装は `@tik-choco/mistai/identity`(mistai リポジトリ `src/identity/`)と
mistl の `src/identity/delegation.rs` / `src/identity/pairing.rs`。
アプリは自前で再実装せず、必ずこのどちらかを使う。

## 共有キー

| キー | ストレージ | 所有者 | スキーマ |
|---|---|---|---|
| `tc-shared-did-delegation-v1` | localStorage(アプリ名プレフィックスなし) | 共同所有(全 tc-* アプリ) | `DelegationV1` の JSON 文字列 |

`tc-shared-llm-config-v1` と同じ「共同所有・ロックなし・last-write-wins」パターン。
CID 間接参照(`tc-shared-did-identity-cid-v1` 方式)は使わない ―― 委譲レコードは数百バイトで、
mistlib 未初期化でも読めることに価値があるため、値を直接 localStorage に置く。

値が壊れている・期限切れ・`leaf` がこのオリジンの DID と一致しない場合、読み手は
**キーを消さずに単に無視する**(別デバイス/別 leaf 向けの委譲を上書きしないため)。

## DelegationV1

```ts
type DelegationV1 = {
  v: 1
  root: string   // did:key(root 鍵の DID。本人の恒久ID)
  leaf: string   // did:key(委譲先。ブラウザ側の従来 identity)
  iat: string    // 発行時刻
  exp: string    // 有効期限
  sig: string    // root 鍵による署名
}
```

### 時刻形式

`iat` / `exp` は **RFC 3339 UTC・ミリ秒精度・`Z` サフィックス固定**
(例 `2026-07-28T04:05:06.789Z`)。JS の `Date#toISOString()` の出力形式そのもの。
Rust 側は `Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)` が同じ形式を出す。
`+00:00` オフセット形式や秒精度は**発行してはならない**(検証側は寛容にパースしてよい)。

### 署名

- 署名対象は `sig` を除いたオブジェクトの **stableStringify**(キーソート・`undefined` 除去の
  決定的 JSON)。キーがソートされる結果、対象文字列は常に
  `{"exp":...,"iat":...,"leaf":...,"root":...,"v":1}` の順になる。
- stableStringify の規約は [global-articles-wire.md](global-articles-wire.md) の `wireSign` と同一
  (除外するキー名だけが `signature` ではなく `sig`)。
- 署名は payload の **UTF-8 バイト列**に対する Ed25519、**パディングなし base64url** で符号化。
  `wireSign` の `signature` と同じ符号化。

### 検証規則

`verifyDelegation(delegation, { now, leaf? })` は以下をすべて満たすときのみ真:

1. `v === 1`、`root` / `leaf` / `iat` / `exp` / `sig` がすべて文字列。
2. `root` と `leaf` が well-formed な Ed25519 `did:key`(`0xed01` multicodec)。
3. `root !== leaf`(自己委譲は無意味なので拒否)。
4. `iat` / `exp` がパース可能で `iat < exp`。
5. `exp - iat <= 400日`(サニティ上限。無期限委譲の防止)。
6. `iat - 5分 <= now <= exp + 5分`(クロックスキュー許容 5 分)。
7. `sig` が `root` の鍵で検証できる。
8. `leaf` が指定された場合は `delegation.leaf === leaf`。

推奨 TTL は 60 日(範囲 1〜365 日)。漏洩時は委譲を再発行せず期限切れを待ち、leaf をローテーションする。

## ワイヤへの添付と送信者の解決

署名付きワイヤ(`tc-chat:post` / `tc-news:article` / …)は optional フィールド
`delegation?: DelegationV1` を持てる。

### 送信側

`delegation` は**署名の前に**ワイヤへ入れる。`wireSign` はフィールドホワイトリストを持たず
`signature` 以外の全フィールドを署名対象にするため、委譲も自動的に署名で保護される
(第三者が委譲を差し替え・剥奪すると署名が壊れる)。旧実装の検証側も、知らないフィールドを
含めて stableStringify するだけなので**そのまま検証が通る**。

### 受信側

```
1. 従来どおり fromId(= leaf)の署名を検証。失敗なら破棄。
2. delegation が無ければ、送信者は fromId。終了(従来動作)。
3. delegation.leaf !== fromId なら **委譲だけ無視**(メッセージ自体は fromId 名義で有効)。
4. verifyDelegation に失敗したら **委譲だけ無視**(同上)。
5. すべて通れば送信者を root に帰属させる。表示・信頼判断・同一人物判定は root 基準。
```

解決結果の型:

```ts
type ResolvedSender = {
  id: string        // 同一人物判定に使うID: 委譲が有効なら root、そうでなければ leaf
  leaf: string      // 常に wire.fromId
  root?: string     // 委譲が有効なときのみ
  delegated: boolean
}
```

「委譲が壊れていてもメッセージは leaf 名義で有効」という縮退が重要 ―― 委譲の期限切れが
メッセージの消失に化けてはならない。

## root 鍵の保持

root custodian としての mistl は、「常駐して web app 群の永続性を代行する」という
mistl 全体の位置付けの identity 面での現れである。

| 保持者 | 保存場所 | 備考 |
|---|---|---|
| mistl(推奨) | `<data_dir>/identity/`(PKCS8) | 既存の identity 機構をそのまま root に使う |
| ブラウザのみ | 現行の共有 DID がそのまま root | 委譲なし。チェーン導入前と完全に同じ動作 |

mistl には tc-storage 互換の暗号化エンベロープ(AES-256-GCM + PBKDF2-SHA256 210k、
`identity::crypto`)があるため、root 鍵の持ち出し・バックアップはこの形式で行う。

## 発行経路

### 経路A: ペアリング(mistlib ルーム経由、推奨)

mistl の localhost HTTP API は CORS ヘッダを一切返さない設計(`x-mistl-ui: 1` 必須 +
Host 検証)なので、`tik-choco.github.io` のブラウザから直接は叩けない。
一方 mistl もブラウザアプリも mistlib ノードになれるため、**使い捨てルームでの
ペアリング**が最も摩擦の少ない経路になる。

```
mistl:    mistl key pair --ttl 60d
          → ペアリングコード XXXX-XXXX-XXXX-XXXX を表示、導出ルームに join して待機
ブラウザ:  コードを入力 → 同じルームに join → leaf DID を送る
mistl:    コード由来の MAC を検証 → DelegationV1 を署名して返す → セッション終了
ブラウザ:  MAC と署名を検証 → tc-shared-did-delegation-v1 に保存
```

#### ペアリングコード

- アルファベット: `0123456789ABCDEFGHJKMNPQRSTVWXYZ`(32文字。Crockford base32 から
  紛らわしい `I` `L` `O` `U` を除いたもの)。
- コードは**16文字**。16 個の暗号論的乱数バイトから `alphabet[byte & 0x1f]` で生成する
  (32 が 256 を割り切るので一様)。エントロピー 80 ビット。
- 表示は `XXXX-XXXX-XXXX-XXXX`。ハイフンは表示のみで、正規化で除去される。
- **正規化**(入力を受け取った側が必ず適用): 大文字化 → `I`/`L` を `1` に、`O` を `0` に
  置換 → アルファベット外の文字をすべて除去。結果がちょうど16文字でなければ不正なコード。

#### 導出

`code` は正規化済み16文字。`sha256` の出力は生の32バイト。

| 導出物 | 定義 |
|---|---|
| ルームID | `"tc-did-pair-" + hexLower(sha256("tc-did-pair-v1\|room\|" + code)).slice(0, 32)` |
| MAC鍵 | `sha256("tc-did-pair-v1\|mac\|" + code)`(生32バイト) |

ルームIDがコード由来なので、**コードを知らない者はルームを見つけられない**。

#### メッセージ

JSON を UTF-8 バイト列にして mistlib の raw メッセージとして**ルームへブロードキャスト**する
(mistlib はブロードキャストを送信者自身へループバックしないので、2ピアなら双方向
ブロードキャストで足りる)。`DELIVERY_RELIABLE`。

```ts
type PairRequest = {
  v: 1
  type: 'tc-did-pair:request'
  leaf: string     // ブラウザ側の did:key
  nonce: string    // 32桁の小文字hex(16バイト乱数)
  app: string      // 'tc-storage' 等。ログ/確認表示用
  mac: string
}

type PairResponse = {
  v: 1
  type: 'tc-did-pair:response'
  nonce: string            // リクエストの nonce をそのまま返す
  delegation: DelegationV1
  mac: string
}

type PairError = {
  v: 1
  type: 'tc-did-pair:error'
  nonce: string
  code: 'expired' | 'rejected' | 'internal'
  message: string
  mac: string
}
```

`mac` = `base64url_nopad(HMAC-SHA256(MAC鍵, utf8(stableStringify(メッセージから mac を除いたもの))))`。

- リクエストの MAC は「送り手がコードを知っている」ことを証明する。これが無いと、
  ルームに紛れ込んだ第三者が自分の leaf への委譲を騙し取れる。
- レスポンスの MAC は「返してきたのがコードを表示した本人の mistl だ」ことを証明する。
- 双方とも **MAC 検証に失敗したメッセージは黙って捨てる**(エラーも返さない)。

#### タイミングと寿命

| 項目 | 既定値 |
|---|---|
| ペアリングセッションの寿命 | 5 分(`mistl key pair --timeout`) |
| ブラウザ側のリクエスト再送間隔 | 3 秒(相手の join が遅れることがあるため) |
| ブラウザ側の全体タイムアウト | 60 秒 |

セッションは**ワンショット**: mistl は委譲を1件発行したらルームを離脱してコードを無効化する。
タイムアウト時も同様に離脱する。

### 経路B: 手動転送(コピペ / QR)

mistlib を使わない・使えない場合のフォールバック。

```
mistl key delegate --leaf did:key:z... --ttl 60d
→ DelegationV1 の JSON を標準出力
```

ユーザーがブラウザ側アプリに貼り付け、アプリが `tc-shared-did-delegation-v1` へ保存する。

## 移行

既存の tc-storage DID は nodeId・共有リンク署名に使われ「顔が知られている」ため、
**既存 DID を root に昇格**させるのが基本方針:

1. ブラウザから既存 identity を暗号化エンベロープでエクスポート(tc-storage に既存機能)。
2. mistl にインポートして root にする。
3. ブラウザ側は新しい leaf 鍵を生成し、root から委譲を受ける。
4. ブラウザの nodeId は leaf DID に変わる(nodeId は元来デバイス単位の識別子なので許容)。

mistl を使わないユーザーは何もしなくてよい(手順 0 件、現行動作のまま)。

## 非採用案

- **ハッシュチェーン**: 個人 identity の紐付けに必要なのは「root がこの leaf を認めた」という
  **認可**であって、順序づけられた改ざん検知ではない。署名1本で足りる。
- **生鍵のコピー同期**(mistl とブラウザで同じ秘密鍵を持つ): 全ブラウザ文脈に root 鍵が
  露出し、デバイス単位の切り離しもできない。委譲の利点が全部消える。
- **ブロックチェーン**: 個人 identity の委譲に全体合意は不要。
- **UCAN フル実装**(capability・多段委譲): 現時点の用途(送信者の本人性)に対して過剰。
  スキーマに `v` があるので、必要になってから拡張する。
- **mistl の localhost API に CORS を開ける**: `tik-choco.github.io` を許可オリジンに
  加えれば経路Aは不要になるが、その瞬間から任意のページが CSRF 的に daemon を叩ける
  余地を作る(現在の「CORS ヘッダを返さない」設計はこれを構造的に防いでいる)。
  ペアリングのために恒久的な穴を開けるのは割に合わない。

## 未決事項

- [ ] leaf の粒度: 現状はオリジン単位(既存の共有 DID をそのまま leaf に流用)。
      デバイス単位まで割るかは未定。
- [ ] `scope` フィールド(アプリ名等での用途制限)の要否。v1 では持たない。
- [ ] tc-storage 共有リンクの署名を root 帰属にするかどうか(リンク検証側の対応範囲)。
