# 共有バス(sharedBus)仕様

tc-note / tc-storage / tc-pdf-viewer / tc-travel が同一オリジンで動く前提を活かし、「CID ポインタを
localStorage に置き、BroadcastChannel で変更を通知する」共有バスを提供する仕様。
`tc-shared-did-identity-cid-v1`([docs/did-identity.md](did-identity.md))で既に使われていた
「OPFS に実データ → localStorage にCIDポインタ」パターンを、任意のトピックで再利用できる
汎用モジュールとして切り出したもの。

## 設計方針

- **バス自体は mistlib に依存しない**。実データを OPFS(`mistlib-blocks`)へ保存して CID を
  得るのは呼び出し側の責務。バスは「ポインタ(CID)+ 変更通知」だけを扱う疎結合設計。
- **署名なし・同一オリジンを信頼境界とする**。localStorage/BroadcastChannel は同一オリジン
  内でのみ到達するため、悪意あるオリジンからの偽装は想定していない。中身の型ガードは
  「壊れたデータで例外を出さない」ためのものであり、セキュリティ境界ではない。
- **公開APIは3関数のみ**: `publishShared(topic, cid, meta)` / `readShared(topic)` /
  `subscribeShared(topic, callback)`。

## キー命名規約

- localStorage キー: **`tc-shared-<topic>-v1`**(`<topic>` はケバブケースの短い識別子。
  例: `ocr-markdown-index`)。既存の [docs/conventions.md](conventions.md) にある
  「真の共有キーはアプリ名プレフィックスを付けず `tc-shared-<name>` 形式にする」方針を
  そのまま踏襲する。
- BroadcastChannel 名: **`tc-shared-bus-v1`**(全トピック共通の単一チャンネル。
  トピックはメッセージの `topic` フィールドで区別する)。

## localStorage 契約(`tc-shared-<topic>-v1` の値)

```ts
interface SharedRecord {
  /** mistlib storage_add の CID。トピックがまだCID化されていない場合は "" */
  cid: string;
  /** トピックごとの自由形式メタデータ */
  meta: Record<string, unknown>;
  /** ISO 8601 文字列 */
  updatedAt: string;
  /** 発行元アプリ */
  from: "tc-note" | "tc-storage" | "tc-pdf-viewer" | "tc-travel";
}
```

## BroadcastChannel メッセージ契約(`tc-shared-bus-v1`)

```ts
interface SharedBusMessage {
  v: 1;
  type: "updated";
  topic: string;
  cid: string;
  from: "tc-note" | "tc-storage" | "tc-pdf-viewer" | "tc-travel";
  updatedAt: string;
}
```

`from` への値の追加(アプリ参加)は後方互換な変更として扱う。受信側の型ガードは
`typeof from === "string"` で検証しており、未知のアプリ名を拒否しない。

受信側は型ガード関数(`isSharedBusMessage`)で形状を検証してから使うこと。

## 同一タブ内通知について

BroadcastChannel は送信元自身のタブには配送されない。そのため `publishShared` は
localStorage 書き込み・BroadcastChannel 送信に加えて、`window` に対して
`tc-shared-bus-local-update` という CustomEvent(`detail` は `SharedBusMessage` と同形)を
同期的に dispatch する。`subscribeShared` はこの CustomEvent・BroadcastChannel・
`storage` イベント(他タブ向けのフォールバック/補完)の3経路すべてを購読し、
`readShared(topic)` を呼び直してコールバックに渡す。同一トピックについて複数経路から
通知が重複することがあるが、コールバックは冪等(常に最新の `readShared` 結果を渡す)なので
実害はない。

## 公開API

```ts
function publishShared(topic: string, cid: string, meta: Record<string, unknown>): void;
function readShared(topic: string): SharedRecord | null;
function subscribeShared(topic: string, callback: (record: SharedRecord) => void): () => void; // 戻り値は購読解除関数
```

- `readShared` は例外を投げない。キー不在・JSON不正・スキーマ不一致はすべて `null` を返す。
- `from` はモジュール内で固定(vendor先アプリごとに定数として埋め込む)ため、
  `publishShared` の引数には含まれない。

## ファイル配置

各アプリに同一契約のファイルを vendor コピーする(単一の npm パッケージとして共有はしない。
理由は [README.md](../README.md) の「原則: ランタイム依存禁止」を参照)。

| アプリ | パス | 実装言語 |
|---|---|---|
| tc-note | `tc-note/src/lib/sharedBus.ts` | TypeScript |
| tc-storage | `tc-storage/src/storage/sharedBus.ts` | TypeScript |
| tc-pdf-viewer | `tc-pdf-viewer/src/services/sharedBus.js` | JavaScript(JSDoc型注釈) |
| tc-travel | `tc-travel/src/lib/tcstorage/sharedBus.ts` | TypeScript |

3ファイルは `APP_NAME` 定数(vendor 先アプリ名)以外、実装をできる限り同一に保つ。
編集する場合は3ファイルすべてに反映すること。各ファイル冒頭のヘッダコメントに
この同期義務と契約バージョンを明記してある。

## 既存トピック: `ocr-markdown-index`

tc-pdf-viewer の OCR Markdown インデックス(レガシーキー `mist_ocr_markdown_index`、
[docs/keys/tc-pdf-viewer.md](keys/tc-pdf-viewer.md) 参照)を最小移行した最初のトピック。

- **書き手**: tc-pdf-viewer(`src/services/storage.js` の `saveOcrMarkdownIndex`)。
  `mist_ocr_markdown_index` への書き込みと同時に `publishShared("ocr-markdown-index", "", meta)`
  を呼ぶ。
- **設計判断**: このインデックスは mistlib の `storage_add` でCID化されていない
  (本文がそのまま localStorage に入っている)ため、`cid` は `""` 固定とし、
  `meta` にインデックス全体のスナップショット(`meta.index`)と、由来を示す
  `meta.legacyKey: "mist_ocr_markdown_index"` を入れる。これにより `readShared` 単独で
  内容が読めるが、レガシーキーへの書き込みと二重にデータを持つ(ストレージ使用量は
  実質2倍になる)トレードオフを受け入れている。トピックを真にCID化したくなった場合は
  破壊的変更として `ocr-markdown-index-v2` に切り出すこと。
- **読み手**: tc-note(`src/lib/importDocument.ts` の `readOcrIndex`)。
  `readShared("ocr-markdown-index")` を最初に試し、`meta.index` が使える形なら
  それを使う。レコードが無い/不正な場合(バスを実装していない古い tc-pdf-viewer
  ビルドなど)は、従来どおり `mist_ocr_markdown_index` を直接読むフォールバックに落ちる。
  加えて `subscribePdfViewerDocumentsChanged` 経由でこのトピックを購読し、
  インポートピッカー(`Sidebar.tsx`)を開いている間、更新があれば一覧を再取得する。
- **レガシーキーの扱い**: `mist_ocr_markdown_index` / `mist_translated_markdown_index` は
  後方互換のため削除しない。翻訳インデックス(`mist_translated_markdown_index`)は
  今回は共有バスへ移行していない(直接読み取りのまま)。

## 既存トピック: `travel-export`

tc-travel の旅写真を tc-storage のワークスペースへ受け渡すトピック。
詳細仕様は `tc-travel/docs/INTEGRATION.md` を正とする。

- **書き手**: tc-travel。写真を tc-storage ネイティブ形式(AES-GCM 暗号化
  FileBundle / FolderBundle、`protocol` 外だが tc-storage `src/storage/domain.ts` が正)で
  mistlib storage に保存し、FolderBundle の CID を `cid` に載せて publish する。
- **`meta`**: `{ folderId, folderName, passphrase, fileCount, exportedAt }`。
  フォルダ鍵(passphrase)を meta で受け渡す。同一オリジン localStorage を信頼境界と
  する本仕様の方針(署名なし)と同等のリスクモデルであることに注意。
- **読み手**: tc-storage。起動時 `readShared` + `subscribeShared` で受信し、
  取込済み CID を `tc-storage-travel-import-cid-v1` に記録して重複取込をスキップ。
  取込は既存の FolderBundle 受入機構(per-field LWW マージ)を再利用する。
- **前提**: 両アプリの vendored mistlib-wasm ビルドが同一であること
  (OPFS ブロックフォーマット互換の保証)。canonical build の更新時は
  ファミリー全アプリで揃えること。

## バージョニング方針

- 契約を破壊的に変更する場合(`SharedRecord`/`SharedBusMessage` の必須フィールド変更、
  型変更、意味変更)は、影響するキー/チャンネル名にサフィックスを1つ上げる
  (例: `tc-shared-bus-v1` → `tc-shared-bus-v2`、個別トピックなら
  `tc-shared-<topic>-v1` → `tc-shared-<topic>-v2`)。
- フィールド追加など後方互換な変更は同じバージョンのままでよい。読み手は未知フィールドを
  無視し、欠落フィールドにはデフォルト値を当てること([conventions.md](conventions.md)の
  スキーマ進化ルールに準拠)。

## 開発時の動作確認について

- **同一アプリの2タブ間確認**(バス機構そのものの動作確認): 同じ dev サーバー
  (同一オリジン・同一ポート)を2タブで開き、片方で `publishShared` を発火する操作をすると、
  もう片方のタブで BroadcastChannel/`storage` イベント経由の `subscribeShared` コールバックが
  発火することを確認する。同一タブ内での即時反映(自分の変更が自分のUIにも反映されるか)は
  `tc-shared-bus-local-update` CustomEvent 経由で別途確認できる。
- **本番相当(3アプリ間連携)の確認**: dev サーバーはアプリごとに別ポートで動くため
  別オリジン扱いとなり、localStorage/BroadcastChannel は共有されない
  ([README.md](../README.md)「開発環境の注意」参照)。3アプリ間の連携を確認するには、
  3アプリを `npm run build` した `dist/` を単一の静的サーバー配下の別サブパス
  (`/tc-note/`, `/tc-pdf-viewer/`, `/tc-storage/` 等)にまとめて配置し、同一オリジン・
  同一ポートで配信すること。
