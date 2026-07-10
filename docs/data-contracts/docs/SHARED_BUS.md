# 共有バス(sharedBus)仕様

tc-note / tc-storage / tc-pdf-viewer / tc-translate / tc-chat / tc-news / tc-town / tc-travel が
同一オリジンで動く前提を活かし、「CID ポインタを
localStorage に置き、BroadcastChannel で変更を通知する」共有バスを提供する仕様。
tc-vrm-viewer は `SharedAppName` の一員として型上は予約済みだが、現時点ではまだこのファイルを
vendor していない(参加時期未定)。
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
  from: "tc-note" | "tc-storage" | "tc-pdf-viewer" | "tc-translate" | "tc-chat" | "tc-news"
      | "tc-town" | "tc-travel" | "tc-vrm-viewer";
}
```

## BroadcastChannel メッセージ契約(`tc-shared-bus-v1`)

```ts
interface SharedBusMessage {
  v: 1;
  type: "updated";
  topic: string;
  cid: string;
  from: "tc-note" | "tc-storage" | "tc-pdf-viewer" | "tc-translate" | "tc-chat" | "tc-news"
      | "tc-town" | "tc-travel" | "tc-vrm-viewer";
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
| tc-news | `tc-news/src/lib/sharedBus.ts` | TypeScript |
| tc-town | `tc-town/src/lib/sharedBus.ts` | TypeScript |
| tc-travel | `tc-travel/src/lib/drive/sharedBus.ts` | TypeScript |

8ファイルは `APP_NAME` 定数(vendor 先アプリ名)以外、実装をできる限り同一に保つ。
編集する場合は8ファイルすべてに反映すること。各ファイル冒頭のヘッダコメントに
この同期義務と契約バージョンを明記してある。

正本(参照実装)は [reference/sharedBus.ts](../reference/sharedBus.ts) /
[reference/sharedBus.js](../reference/sharedBus.js) にあり、`APP_NAME` の代わりに
`__APP_NAME__` というプレースホルダを持つ。各アプリへの配布(プレースホルダの置換とファイル
コピー)は `protocol/scripts/sync-vendored.mjs` が行う
(`node protocol/scripts/sync-vendored.mjs <app...|all> [--check]`)。手動コピーではなく
この正本+同期スクリプトを更新の起点にすること。

正本には診断用の `export const BUS_VERSION = 1;` がある。これは「vendor先アプリがどのバージョンの
sharedBus.ts を動かしているか」を人間がデバッグするためだけの値であり、契約そのものではない。
契約の互換性は下記の `tc-shared-bus-v1` / `tc-shared-<topic>-v1` の `-v1` サフィックスが担う
(バージョニング方針の節を参照)。`BUS_VERSION` を上げても契約上の意味は変わらない。

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
  `publishShared("note-article", cid, meta)` を呼ぶ。tc-news(`src/lib/chatShare.ts` の
  `publishArticleToChat`)も同トピックの書き手。生成した記事をユーザーが明示的に
  tc-chat へ送るときに呼ばれる点は tc-note と同様だが、`storage_add` の成否に関わらず
  常に `meta.text` にMarkdown全文をインラインする点が異なる(下記フォールバック参照)。

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

## 既存トピック: `drive-index`

tc-storage が自分のドライブの読み込み可能ファイル一覧を、ワークスペース内部状態
(スナップショット・フォルダ鍵)を直接読ませずに他アプリへ公開するためのトピック。

- **書き手**: tc-storage(`src/app/useDriveIndexPublishEffect.ts`)。スナップショット/
  フォルダ鍵が変わるたびに(デバウンス後)、および起動時に
  `publishShared("drive-index", "", meta)` を呼ぶ。`cid` は常に `""` 固定で、
  インデックス全体を `meta` にインラインする(`ocr-markdown-index` と同じ方針)。

  ```ts
  interface DriveIndexEntry {
    id: string
    name: string
    mimeType: string
    size: number
    lastCid: string     // 暗号化 FileBundle の mistlib CID
    path: string         // "Folder/Subfolder" のルートからのパス表示
    passphrase: string   // FileBundle 復号鍵
  }
  interface DriveIndexMeta {
    version: 1
    updatedAt: string
    files: DriveIndexEntry[]
  }
  ```

  一覧に載るのは「削除されておらず、復号鍵が解決できるファイル」のみ(`tc-storage/src/storage/driveIndex.ts`
  の `buildDriveIndex`)。
- **読み手**: tc-travel(`src/lib/drive/reader.ts`)。`listDriveFiles()` で読み、
  VRM インポートなど(`ARCameraScreen.tsx` 等)向けにファイルバイト列を
  `loadDriveFileBytes()` で解決する。tc-travel は tc-storage のスナップショット/フォルダ鍵を
  一切直接読まず、このインデックス経由のみでファイルへアクセスする。

## 既存トピック: `character-index`

tc-town のキャラクターロースターを、tc-town に直接依存せず他アプリへ公開するためのトピック。

- **書き手**: tc-town(`src/lib/characterIndexPublisher.ts`)。キャラクター/ワールドの変更に
  デバウンス後追従して(`schedulePublish`)、`publishShared("character-index", "", meta)`
  を呼ぶ。`cid` は常に `""` 固定で、ロースター全体を `meta` にインラインする。

  ```ts
  interface CharacterIndexEntry {
    id: string
    name: string
    summary: string        // 一行説明
    personaPrompt: string  // 生成済みのシステムプロンプト(人格)全文
    vrmChecksum?: string   // sha256 hex。同一オリジンの tc-vrm-viewer IndexedDB で解決
    vrmCid?: string        // .vrm 生バイト列の mistlib CID(フォールバック/端末間共有用)
    vrmFileName?: string
    voiceModel?: string
    voiceName?: string
    updatedAt: string       // ISO 8601
  }
  interface CharacterIndexMeta {
    v: 1
    updatedAt: string
    entries: CharacterIndexEntry[]
  }
  ```

  `vrmChecksum`/`vrmCid` が無いエントリは persona-only(画像またはアバターなし)のキャラクターで、
  読み手は VRM が存在しない前提のハンドリングが必要。VRM CID の充足(`storage_add` 経由)は
  publish 自体をブロックしないベストエフォートのバックグラウンド処理。
- **読み手**: tc-travel(`src/lib/town/characterIndex.ts`)。`loadTownCharacters()`/
  `subscribeTownCharacters()` で読み、tc-town のキャラクターを VRM コンパニオン + AI ペルソナ
  として取り込める(`AvatarScreen.tsx`)。フィールドごとに防御的にコアース/検証し、単一の
  不正フィールドで一覧全体を落とさない。

## 既存トピック: `folder-export`

暗号化フォルダバンドル(`FolderBundle`)を、任意のドライブ実装アプリへエクスポートするための
単一レコード・複数書き手トピック。

- **書き手**: tc-pdf-viewer(`src/services/driveExport.js`、`FOLDER_EXPORT_TOPIC`)が最初の
  書き手。tc-travel(`src/lib/drive/export.ts`)も同トピックへ書き込む2人目の書き手
  (`note-article` と同様のパターン)。どちらも「フォルダ + ファイル群を mistlib の
  `storage_add` でCID化した暗号化バンドル」を作り、そのCIDと以下の `meta` で
  `publishShared("folder-export", folderCid, meta)` を呼ぶ。

  ```ts
  interface FolderExportMeta {
    folderId: string
    folderName: string
    passphrase: string   // FolderBundle 復号鍵
    fileCount: number
    exportedAt: string    // ISO 8601
  }
  ```

  単一レコードのトピックなので、後から発行したアプリのレコードが前の発行者のものを上書きする。
  両書き手とも「変更が無くても、バス上の現在のレコードのCIDが自分の最終発行CIDと食い違って
  いれば再発行する」処理を持つため、別アプリが上書きした後でも自分のフォルダを取りこぼさず
  再公開できる。
- **読み手**: tc-storage(`src/app/useFolderImportEffect.ts` + `src/storage/folderImport.ts`)。
  起動時に1回読み、以後 `subscribeShared` で購読する。フォルダIDごとに最後に取り込んだCID
  (`tc-storage-folder-import-cids-v1`)を記録して冪等に取り込み、既存の CRDT マージ機構
  (`mergeSnapshots`)でワークスペースへ統合する。

## 既存トピック: `storage-drive-inbox`

tc-note にドロップされたファイルを、tc-storage のドライブへ「ファイルとして」複製するための
トピック。`translations-inbox` と同様、他アプリのデータが tc-storage のドライブにそのまま
現れるパターンだが、本文がファイルの生バイト列であるため各アイテムをその場で暗号化して運ぶ点が
異なる。

- **書き手**: tc-note(`src/lib/storageDriveInbox.ts` の `syncDroppedFileToTcStorage`)。
  ノートにファイルがドロップされるたびに、本文を暗号化(下記)した上で
  `publishShared("storage-drive-inbox", "", { items })` を呼ぶ。`cid` は常に `""` 固定
  (`translations-inbox` と同じ方針)で、各アイテムは mistlib CID を指すポインタとして
  `meta.items` にインラインで持つ。ローリングリストは直近 `MAX_INBOX_ITEMS`(50件)までで、
  `translations-inbox` と同じく毎回まるごと再発行する。

  ```ts
  interface DriveInboxItem {
    id: string          // 安定ID(UUID)。受け手はこれで重複排除する
    name: string
    mimeType: string
    size: number
    checksum: string     // 平文バイト列のSHA-256 hex digest
    cid: string          // 暗号化済みバイト列のmistlib storage_add CID
    key: string          // Base64。使い捨てのAES-256-GCM鍵材料
    iv: string           // Base64。96-bit AES-GCM IV
    addedAt: string      // ISO 8601
  }
  ```

- **暗号化モデル**: 各アイテムはドロップの都度生成される使い捨ての AES-256-GCM 鍵で暗号化され、
  ciphertext のみが mistlib の block store(P2P で可視になりうる)に乗る。鍵と IV は `key`/`iv`
  として `meta` にそのままインラインで乗るが、これは上記「設計方針」の
  「署名なし・同一オリジンを信頼境界とする」方針どおりで、そもそも `localStorage`/
  BroadcastChannel への到達自体が同一オリジンに限定されているため許容している。この鍵の同梱も
  その境界の内側にあり、バス自体に新たな信頼境界を持ち込むものではない。
- **読み手**: tc-storage(`src/app/appDriveInbox.ts`)。起動時に
  `readShared("storage-drive-inbox")` を読み、以後 `subscribeShared` で購読する。各アイテムを
  `storage_get(cid)` → AES-GCM 復号 → SHA-256 チェックサム照合の順に処理し、一致した平文だけを
  `File` 化して通常のアップロードフローへ渡す。専用フォルダ「tc-noteから追加」(ルート直下、
  既存があれば再利用)へ格納する。取込済み `id` は `tc-storage-drive-inbox-imported-v1`
  (上限1000件)に記録して冪等化する — `translations-inbox` の `tc-storage-translate-imported-v1`
  と同じパターン。
- **取込失敗の扱い(一時的 vs 恒久的)**: アイテム解決の失敗は性質によって扱いを分ける。
  **一時的な失敗**(mist モジュールのロード失敗、`storage_get` の失敗など、P2P/ネットワーク
  状態に依存し再試行すれば成功しうるもの)は取込済みマークをつけない — 次回の republish/購読で
  再試行される。一方、**恒久的な失敗**(復号エラー、チェックサム不一致)は、ciphertext と
  チェックサムが発行時点で固定されており再試行しても結果が変わらないため、恒久的に取込済み
  扱いとしてマークされ、以後の再発行では無視される。復号までは成功したがアップロード段階
  自体で失敗した場合も取込済みマークをつけない(次回の republish/購読で再試行される)。
- **クロスアプリ書き込みについて**: `translations-inbox` と同様、tc-storage の
  `tc-storage-snapshot-v1` へは tc-storage 自身が書き込む。tc-note はバス経由でアイテムを
  渡すだけで、スナップショットや tc-storage の他の localStorage キーを直接読み書きしない。

## 既存トピック: `note-doc-index`

tc-note に書かれたノートを、tc-storage のドライブへ「ノート本体」として複製するための
トピック。`storage-drive-inbox` と同じ tc-note→tc-storage 方向のインボックス系トピックだが、
対象がドロップされた任意ファイルではなくノート自身の Markdown 本文であり、かつ暗号化を
行わない点が異なる。

- **書き手**: tc-note(`src/lib/noteDocExport.ts` の `publishNoteDocIndex`/
  `schedulePublishNoteDocIndex`)。ノートの保存・削除・復元のたびにデバウンス(約1秒)して
  発行するほか、アプリ起動時にも1回発行する。ローカルのノート索引全体から、CID を持つ
  (=一度でも保存された)ノートだけを対象に、更新日時降順で直近500件までに絞り込み、
  `translations-inbox`/`storage-drive-inbox` と同じく毎回まるごと再発行する(差分でなく
  全量republish)。`cid` は常に `""` 固定で、各ノートへのポインタは `meta` にインラインで
  持つ。

  ```ts
  interface NoteDocIndexEntry {
    id: string          // ノートのUUID。受け手はこれで重複排除・差し替えを行う
    title: string
    cid: string          // mistlib storage_add のCID。ノート本文(Markdown)そのもの、平文
    updatedAt: number    // ms epoch
  }
  ```

  `meta` の形は `{ notes: NoteDocIndexEntry[] }`。CID を持たないノート(未保存)はインデックス
  から除外される。

- **設計判断(暗号化なし)**: `storage-drive-inbox` はドロップされたファイルをその場で暗号化
  してから CID 化する(暗号化前の平文が tc-storage 以外のどこにも存在しなかったため)。
  `note-doc-index` はこれと異なり、意図的に暗号化しない: tc-note の `saveNote`
  (`mistlib.ts`)がノート保存の時点で既に本文を平文のまま同一オリジン共有の mistlib OPFS
  ブロックストアへ `storage_add` しており(このCIDは `tc-note:index` の `NoteMeta.cid` として
  既に扱われている)、そのCIDをバスに乗せても新たな露出を生まない。既存の平文保存に
  「あと乗り」するだけであり、`storage-drive-inbox` のように新規の信頼境界(使い捨て鍵の同梱)
  を持ち込む必要がない。
- **読み手**: tc-storage(`src/app/appNoteDocInbox.ts`)。起動時に `readShared("note-doc-index")`
  を読み、以後 `subscribeShared` で購読する。各エントリを `<タイトル>.md`(ファイル名は
  サニタイズ、タイトルが使えない場合は「無題」)としてルート直下の専用フォルダ
  「tc-noteのノート」へ取り込む。ノートIDごとに「生きているコピーは常に1つ」で、同じ `id`
  が新しいCIDで再発行された(編集された)場合は前回取り込んだファイルを置き換える。取込状態
  (ノートID→CID/ファイルIDの対応)は `tc-storage-note-doc-imported-v1`(上限1000件)に記録し、
  ユーザーが tc-storage 側で取り込み済みファイルを削除した場合、同じCIDは再取込しない
  (削除の意思を尊重する)。
- **ノート削除は伝播しない(v1)**: tc-note でノートを削除しても、次回発行のインデックスから
  当該エントリが単に外れるだけで、tc-storage へ削除通知が飛ぶことはない。tc-storage は
  既に取り込んだコピーをそのまま保持し続ける(`storage-drive-inbox`/`translations-inbox` にも
  共通するインボックス系トピックの性質:「一度取り込んだら受け手の管理下」という設計)。
- **クロスアプリ書き込みについて**: `storage-drive-inbox` と同様、tc-storage の
  `tc-storage-snapshot-v1` へは tc-storage 自身が書き込む。tc-note はバス経由でインデックスを
  渡すだけで、tc-storage の他の localStorage キーを直接読み書きしない。

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
