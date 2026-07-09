# 共有バス(sharedBus)仕様

tc-note / tc-storage / tc-pdf-viewer / tc-translate / tc-chat が同一オリジンで動く前提を活かし、「CID ポインタを
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
  from: "tc-note" | "tc-storage" | "tc-pdf-viewer" | "tc-translate" | "tc-chat";
}
```

## BroadcastChannel メッセージ契約(`tc-shared-bus-v1`)

```ts
interface SharedBusMessage {
  v: 1;
  type: "updated";
  topic: string;
  cid: string;
  from: "tc-note" | "tc-storage" | "tc-pdf-viewer" | "tc-translate" | "tc-chat";
  updatedAt: string;
}
```

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
| tc-translate | `tc-translate/src/lib/sharedBus.ts` | TypeScript |
| tc-chat | `tc-chat/src/lib/sharedBus.ts` | TypeScript |

5ファイルは `APP_NAME` 定数(vendor 先アプリ名)以外、実装をできる限り同一に保つ。
編集する場合は5ファイルすべてに反映すること。各ファイル冒頭のヘッダコメントに
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

## 既存トピック: `translations-inbox`

tc-translate の翻訳結果を tc-storage のドライブへ「ファイルとして」流し込むためのトピック。

- **書き手**: tc-translate(`src/lib/shareToStorage.ts` の `publishTranslationsInbox`)。
  翻訳履歴(`tc-translate-history-v1`)が更新されるたびに、翻訳が確定した履歴項目を
  Markdown 化して `publishShared("translations-inbox", "", meta)` を呼ぶ。
- **設計判断**: 翻訳テキストは小さいので mistlib の `storage_add` でCID化せず、`cid` は
  `""` 固定、本文は `meta` にインラインで持つ(`ocr-markdown-index` と同じ方針)。
  `meta` は `{ v: 1, count, items: TranslationInboxItem[] }`。`items` は履歴上限
  (`maxHistoryItems`)までのスナップショットで、毎回まるごと再発行する。各項目は安定
  `id`(履歴項目ID)を持ち、受け手はこの `id` で冪等にインポートする。

  ```ts
  interface TranslationInboxItem {
    id: string          // 安定ID(履歴項目ID)。受け手はこれで重複排除する
    title: string       // 表示用の短いタイトル
    fileName: string    // 拡張子付きの推奨ファイル名
    mimeType: string    // "text/markdown"
    text: string        // ファイル本文(Markdown)
    sourceText: string  // 原文(検索/メタ用)
    targetLanguage: string
    createdAt: string   // ISO 8601
  }
  ```

- **読み手**: tc-storage(`src/app/appTranslationsInbox.ts`)。起動時に
  `readShared("translations-inbox")` を1回読み、以後 `subscribeShared` で購読する。
  未取込(`id` が `tc-storage-translate-imported-v1` に無い)の項目だけを、専用フォルダ
  「TC Translate」へ通常のアップロードフロー(`fileActions.uploadFiles`)で追加する。
  取り込んだ `id` は localStorage に記録するので、再発行・再読込で重複せず、ユーザーが
  tc-storage 側で消したファイルも復活しない。
- **クロスアプリ書き込みについて**: これは「他アプリのデータが tc-storage のドライブに
  そのまま現れる」最初のトピック。tc-storage の `tc-storage-snapshot-v1` へは tc-storage
  自身が(自前のマージ/クロック規則で)書き込む — 送り手は snapshot を直接触らず、バス経由で
  項目を渡すだけ、という疎結合を保つ。

## 既存トピック: `note-article`

tc-note のノートを、tc-chat のボードへ「記事」として取り込むためのトピック。CIDポインタと
インライン本文フォールバックの両方を受け手が扱う必要がある、最初のトピック。

- **書き手**: tc-note(`src/lib/shareArticle.ts` の `shareNoteAsArticle`)。ノートの
  ツールバーにある共有ボタン(EditorToolbar)から明示的に呼ばれる(自動発行ではない)。
  ノート本文(Markdown全文)を mistlib の `storage_add` でCID化し、
  `publishShared("note-article", cid, meta)` を呼ぶ。

  ```ts
  // meta の形。text は cid === "" のときのみ存在する(下記フォールバック参照)。
  interface NoteArticleMeta {
    title: string;
    format: "markdown";
    excerpt: string;        // プレーンテキスト、先頭 ~200 文字
    publishedAt: string;    // ISO 8601
    text?: string;          // cid === "" のときのみ: Markdown全文のインライン本文
  }
  ```

- **設計判断(CID / インライン本文の二重形状)**: ノート本文は基本的に mistlib の
  `storage_add` でCID化し、`cid` にそのCIDを入れる(本文は `meta` に含めない)。ただし
  `storage_add` が失敗する、または mistlib(OPFS)が利用できない環境では、`cid: ""` に
  フォールバックし、代わりに `meta.text` にMarkdown全文をそのままインラインで持たせる。
  **受け手は両方の形状を扱う必要がある**: `cid` が非空ならそれを `storage_get` で解決し、
  空なら `meta.text` を使う。他のトピック(`ocr-markdown-index` 等)と異なり、この
  使い分けは呼び出しごとに動的に切り替わる(トピック全体でどちらか片方に固定ではない)。
- **読み手**: tc-chat(`src/hooks/useNoteArticleImport.ts`)。起動時に
  `readShared("note-article")` を読み、以後 `subscribeShared` で購読することで、
  開いたままの tc-note タブからの発行がボードにライブで反映される。ボード composer の
  上に控えめなチップ(「tc-noteの記事を取り込む: {title}」)を表示し、クリックすると
  本文を解決(`cid` があれば `storage_get`、無ければ `meta.text`)して composer に
  タイトル・本文をプリフィルする(投稿は通常のボードノード作成フローに乗る — バス自体は
  投稿を代行しない)。
- **未取込ゲーティング**: 一度取り込む(またはチップを閉じる)と、その記録の `updatedAt` を
  tc-chat のローカルストレージキー `tc-chat-note-article-consumed-v1` に保存し、以後
  同じ `updatedAt` の記録は再表示しない。ノートを再度共有すると `updatedAt` が更新される
  ため、チップは新しい発行ごとに再度現れる(`ocr-markdown-index` の安定 `id` 方式と異なり、
  このトピックは単一の最新レコードしか保持しないため、`updatedAt` そのものを冪等キーとして
  使う)。

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
