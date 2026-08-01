# 共有バス(sharedBus)仕様

tc-note / tc-storage / tc-pdf-viewer / tc-translate / tc-chat / tc-news / tc-town / tc-travel / tc-books / tc-lingo が
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

## 設計原則: publish, don't peek

アプリ間で受け渡すデータは必ず共有バストピック(`tc-shared-<topic>-v1`)を経由し、
**他アプリの `tc-<app>-*` 名前空間キーを直接読み書きしない**。トピック名は
アプリ名ではなく能力ベース(例: `folder-export`、`drive-index`)で命名し、
読み手・書き手はどのアプリが相手かに依存しないこと(`from` は表示・デバッグ用)。
これによりアプリ内部のスキーマ変更が他アプリを壊さない。

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
      | "tc-town" | "tc-travel" | "tc-vrm-viewer" | "tc-books" | "tc-lingo";
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
      | "tc-town" | "tc-travel" | "tc-vrm-viewer" | "tc-books" | "tc-lingo";
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
| tc-books | `tc-books/src/lib/sharedBus.ts` | TypeScript |
| tc-lingo | `tc-lingo/src/lib/sharedBus.ts` | TypeScript |

10ファイルは `APP_NAME` 定数(vendor 先アプリ名)以外、実装をできる限り同一に保つ。
編集する場合は10ファイルすべてに反映すること。各ファイル冒頭のヘッダコメントに
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
  publish 自体をブロックしないベストエフォートのバックグラウンド処理。`vrmChecksum` の解決先
  (tc-vrm-viewer と共有の IndexedDB VRMモデルライブラリ)の契約は
  [vrm-model-library.md](vrm-model-library.md) を参照。
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

## 既存トピック: `town-backup`

tc-town の全体バックアップ(キャラクター/ワールド/アプリ設定/プロバイダ設定)を、tc-storage の
ドライブへ自動でファイルとして複製するためのトピック。手動バックアップUI(Settings >
バックアップ タブでのJSON手動ダウンロード/アップロード)を廃止し、自動保存の一環として
このトピック経由の自動発行に置き換えた。`storage-drive-inbox` と同じ使い捨て鍵の暗号化方式を
採るが、対象が単一の安定IDを持つバックアップバンドル1件のみであり、`note-doc-index` と同じ
「生きているコピーは常に1つ」置換パターンを採る点が異なる。

- **書き手**: tc-town(`src/lib/townBackupPublisher.ts`)。キャラクター/ワールド/アプリ設定/
  プロバイダ設定の変更にデバウンス後追従して発行するほか、起動時にも1回発行する(自動保存の
  一環。手動バックアップUIは廃止)。`cid` は常に `""` 固定で、暗号化済みバンドルへの
  ポインタを `meta` にインラインで持つ。

  ```ts
  interface TownBackupMeta {
    v: 1
    updatedAt: string  // ISO 8601
    item: {
      id: 'tc-town-backup'   // 安定ID(固定)。「生きているコピーは常に1つ」の置換キー
      name: 'tc-town-backup.json'
      mimeType: 'application/json'
      size: number           // 平文バイト長
      checksum: string       // 平文(バンドルJSON)のSHA-256 hex
      cid: string            // AES-256-GCM暗号化済みバイト列の mistlib storage_add CID
      key: string            // Base64。使い捨てAES-256-GCM鍵材料(発行ごとに新規)
      iv: string             // Base64。96-bit IV
      updatedAt: string      // ISO 8601
    }
  }
  ```

  バックアップ本体は既存のフルバックアップバンドル(`exportImport.ts` の `ExportBundle`:
  appSettings / providerSettings / characters(画像アバターはdataURL埋め込み、VRMはchecksum
  参照のみ) / worlds)を整形JSON化したもの。

- **設計判断1(暗号化)**: バンドルは localStorage/IndexedDB 由来で mistlib block store には
  元々存在しない新規露出のため、`storage-drive-inbox` と同じ「使い捨てAES-256-GCM鍵で暗号化し
  ciphertextのみCID化、鍵/IVはmetaにインライン(同一オリジン信頼境界の内側)」方式を採る。
  `note-doc-index` の平文方式(本文が保存時点で既に平文でmistlibに存在するケース)は前提が
  異なるため採らない。
- **設計判断2(単一レコード置換)**: `note-doc-index` と同じ「同じ id の生きているコピーは
  常に1つ」方式を採る。安定 `id`(`tc-town-backup` 固定)に対し内容が変わると新しい
  `checksum`/`cid` で再発行され、受け手は取り込み済みファイルを in-place で置換する。
  ユーザーが tc-storage 側で削除したファイルは、tc-town のデータが実際に変わるまで復活しない。
  冪等キーは `checksum`(平文SHA-256) — 鍵が発行ごとに新規なため `cid` は同一平文でも変わり
  うるが、発行側の変更検知(下記)により同一内容の再発行自体が起きない。
- **発行側の変更検知**: バンドルの `exportedAt` は毎回変わるため、これを除外した内容シグネチャ
  (SHA-256)を `tc-town:backup-publish-state-v1`(`{ v: 1, signature }`)に記録し、変化が無ければ
  再発行しない(無限churn防止)。発行成功時のみシグネチャを更新する(失敗時は次回のトリガーで
  再試行される)。
- **読み手**: tc-storage(`src/app/appTownBackupInbox.ts`)。起動時に `readShared("town-backup")`
  を1回読み、以後 `subscribeShared` で購読する。`storage_get(cid)` → AES-GCM復号 →
  SHA-256チェックサム照合の順に処理し、一致した平文だけをルート直下の専用フォルダ「TC Town」へ
  `tc-town-backup.json` として取り込む。取込状態は
  `tc-storage-town-backup-imported-v1`(`{ v: 1, entries: Record<id, { checksum, fileId }> }`)に
  記録し、`note-doc-index` と同じ「生きているコピーは常に1つ」の置換ロジックで管理する。
- **取込失敗の扱い(一時的 vs 恒久的)**: `storage-drive-inbox` と同じ分類。一時的な失敗
  (mistモジュールのロード失敗、`storage_get` の失敗など)は取込済みマークをつけず、次回の
  republish/購読で再試行する。恒久的な失敗(復号エラー、チェックサム不一致)は恒久的に
  取込済み扱いとしてマークし、以後の再発行では無視する。
- **クロスアプリ書き込みについて**: 他のインボックス系トピックと同様、`tc-storage-snapshot-v1`
  へは tc-storage 自身が書き込む。tc-town はバス経由でレコードを渡すだけで、tc-storage の
  他の localStorage キーを直接読み書きしない。
- **復元経路**: tc-storage 上に取り込まれたバンドルJSONは、tc-town のキャラクター画面の
  インポート(`parseCharacterImport` はフルバンドル形状も受け付ける)から読み込むことで
  復元できる。

## 既存トピック: `books-backup`

tc-books(複式簿記の会計/家計簿アプリ)の帳簿バンドル(仕訳/勘定科目/アプリ設定)を、
tc-storage のドライブへ自動でファイルとして複製するためのトピック。`town-backup` と
完全に同型: 使い捨て鍵の暗号化方式・単一の安定IDを持つバックアップバンドル1件のみ・
「生きているコピーは常に1つ」置換パターン、のすべてを引き継ぐ。

- **書き手**: tc-books(vendored `sharedBus.ts` 経由)。仕訳/勘定科目/アプリ設定の変更に
  デバウンス後追従して発行するほか、起動時にも1回発行する(自動保存の一環)。`cid` は常に
  `""` 固定で、暗号化済みバンドルへのポインタを `meta` にインラインで持つ。

  ```ts
  interface BooksBackupMeta {
    v: 1
    updatedAt: string  // ISO 8601
    item: {
      id: 'tc-books-backup'  // 安定ID(固定)。「生きているコピーは常に1つ」の置換キー
      name: 'tc-books-backup.json'
      mimeType: 'application/json'
      size: number           // 平文バイト長
      checksum: string       // 平文(バンドルJSON)のSHA-256 hex
      cid: string            // AES-256-GCM暗号化済みバイト列の mistlib storage_add CID
      key: string            // Base64。使い捨てAES-256-GCM鍵材料(発行ごとに新規)
      iv: string             // Base64。96-bit IV
      updatedAt: string      // ISO 8601
    }
  }
  ```

  バックアップ本体は仕訳(journal)・勘定科目(accounts)・アプリ設定を整形JSON化したもの。

- **設計判断(暗号化・単一レコード置換)**: `town-backup` と同じ判断を採る。バンドルは
  localStorage 由来で mistlib block store には元々存在しない新規露出のため、使い捨て
  AES-256-GCM鍵で暗号化しciphertextのみCID化、鍵/IVはmetaにインライン(同一オリジン信頼境界の
  内側)する。安定 `id`(`tc-books-backup` 固定)に対し内容が変わると新しい `checksum`/`cid` で
  再発行され、受け手は取り込み済みファイルを in-place で置換する。冪等キーは `checksum`
  (平文SHA-256)。
- **発行側の変更検知**: `town-backup` と同じく、`exportedAt` 相当のタイムスタンプを除いた
  内容シグネチャ(SHA-256)を `tc-books:backup-publish-state-v1` に記録し、変化が無ければ
  再発行しない(無限churn防止)。発行成功時のみシグネチャを更新する。
- **読み手**: tc-storage(`src/app/appBooksBackupInbox.ts`)。起動時に
  `readShared("books-backup")` を1回読み、以後 `subscribeShared` で購読する。
  `storage_get(cid)` → AES-GCM復号 → SHA-256チェックサム照合の順に処理し、一致した平文だけを
  ルート直下の専用フォルダ「TC Books」へ `tc-books-backup.json` として取り込む。取込状態は
  `tc-storage-books-backup-imported-v1`(`{ v: 1, entries: Record<id, { checksum, fileId }> }`)に
  記録し、`town-backup` と同じ「生きているコピーは常に1つ」の置換ロジックで管理する。
- **取込失敗の扱い(一時的 vs 恒久的)**: `town-backup`/`storage-drive-inbox` と同じ分類。
  一時的な失敗(mistモジュールのロード失敗、`storage_get` の失敗など)は取込済みマークを
  つけず、次回のrepublish/購読で再試行する。恒久的な失敗(復号エラー、チェックサム不一致)は
  恒久的に取込済み扱いとしてマークし、以後の再発行では無視する。
- **クロスアプリ書き込みについて**: 他のインボックス系トピックと同様、`tc-storage-snapshot-v1`
  へは tc-storage 自身が書き込む。tc-books はバス経由でレコードを渡すだけで、tc-storage の
  他の localStorage キーを直接読み書きしない。

## 既存トピック: `pdf-viewer-inbox`

tc-storage のファイルプレビューから「tc-pdf-viewer で開く」を選んだファイルを、tc-pdf-viewer の
ライブラリへ「ファイルとして」複製するためのトピック。`storage-drive-inbox`/`translations-inbox`
とは向きが逆で、tc-storage が発行しファミリー内の別アプリ(tc-pdf-viewer)が消費する
インボックス系トピック。書き手側の実装(`fileHandoff.ts`)は同じワイヤ形式・同じ発行方式で
`note-inbox`(tc-note 向け、テキスト/Markdown ファイルの引き渡し)トピックも発行し、
tc-note 側は `src/lib/noteInbox.ts` が消費する(冪等キー `tc-note-inbox-imported-v1`、
`{ v: 1, ids: string[] }`・上限1000件)。以下の契約記述はトピック名と読み手・冪等キーを
読み替えれば `note-inbox` にもそのまま適用される。

- **書き手**: tc-storage(`src/storage/fileHandoff.ts` の `publishFileHandoff`、
  `src/app/appFileHandoffActions.ts` の `sendFileToApp` から呼ばれる)。ユーザーがファイル
  プレビューの「送信」操作で明示的に対象アプリを選んだときにのみ発行される(自動発行ではない)。
  `storage-drive-inbox`/`town-backup` と同じく、ファイルごとに使い捨ての AES-256-GCM鍵で
  暗号化し、ciphertext のみを mistlib の `storage_add_pinned` でCID化した上で、`cid` は
  常に `""` 固定、各アイテムは `meta.items` にインラインで持つローリングリストとして
  `publishShared("pdf-viewer-inbox", "", { items })` を呼ぶ。直近 `maxHandoffItems`(50件)
  までを毎回まるごと再発行する(`translations-inbox`/`storage-drive-inbox` と同じ方針)。

  ```ts
  interface FileHandoffItem {
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

  ファイルサイズは50MB(`maxHandoffBytes`)を超えると発行自体が失敗する。

- **暗号化モデル**: `storage-drive-inbox` と同じく、各アイテムは送信の都度生成される使い捨ての
  AES-256-GCM鍵で暗号化され、ciphertextのみが mistlib の block store(P2P で可視になりうる)に
  乗る。鍵と IV は `key`/`iv` として `meta` にそのままインラインで乗るが、「設計方針」の
  「署名なし・同一オリジンを信頼境界とする」方針どおり許容している。
- **読み手**: tc-pdf-viewer(`src/services/storageHandoffInbox.js`)。マウント時に
  `readShared("pdf-viewer-inbox")` を1回読み、以後 `subscribeShared` で購読する。各アイテムを
  `storage_get(cid)` → AES-GCM 復号 → SHA-256 チェックサム照合の順に処理し、一致した平文だけを
  通常のアップロードフロー(`savePdf()`)で専用フォルダ「tc-storageから追加」へ取り込む。
  取り込み直後はライブラリ一覧を再取得し、直近取り込んだPDFを自動で開く(ユーザーがこの操作の
  ためにタブを開いた可能性が高いための best-effort な挙動)。取込済み `id` は
  `tc-pdf-viewer-inbox-imported-v1`(上限1000件)に記録して冪等化する —
  `storage-drive-inbox` の `tc-storage-drive-inbox-imported-v1` と同じパターン。
- **PDF以外のアイテムの扱い**: MIMEタイプが `application/pdf` でも拡張子が `.pdf` でもない
  アイテムは取り込まず、恒久的に取込済み扱いとしてマークする(`storage-drive-inbox` の
  「恒久的な失敗」と同じ扱い)。
- **取込失敗の扱い(一時的 vs 恒久的)**: `storage-drive-inbox`/`town-backup` と同じ分類。
  **一時的な失敗**(mistlib初期化・`storage_get`の失敗など、再試行すれば成功しうるもの)は
  取込済みマークをつけず、次回の republish/購読で再試行する。**恒久的な失敗**(復号エラー・
  チェックサム不一致・PDF以外のファイル)は恒久的に取込済み扱いとしてマークし、以後の再発行では
  無視する。ライブラリへの追加(`savePdf()`)自体が失敗した場合(storage_add/ネットワーク
  障害など)も取込済みマークをつけず、次回再試行する。
- **インボックスパターンについて**: tc-storage → 他アプリ方向のファイルハンドオフとしては、
  `storage-drive-inbox`/`note-doc-index`/`town-backup`/`books-backup` の「他アプリ →
  tc-storage」方向と逆になる、初めての「tc-storage → 他アプリ」方向のインボックス。使い捨て鍵
  暗号化・ローリングリスト・冪等ID記録という設計はすべて既存インボックス系トピックと共通の
  interop v2 標準形であり、新規インボックストピックを追加する際のテンプレートとして
  参照すること。
- **クロスアプリ書き込みについて**: 他のインボックス系トピックと同様、tc-pdf-viewer の
  `mist_files_index`/`mist_ocr_markdown_index` 等へは tc-pdf-viewer 自身が(通常のアップロード
  フロー経由で)書き込む。tc-storage はバス経由でアイテムを渡すだけで、tc-pdf-viewer の
  localStorage キーを直接読み書きしない。

## 既存トピック: `lingo-card-inbox`

tc-translate の翻訳/解説履歴を、ユーザーが選んだエントリ単位で tc-lingo の SRS カード候補へ
送り込むためのトピック。tc-lingo にとって初のエコシステム連携(それまでマニフェストは
`publishes: [] / consumes: [] / reads: []` で連携ゼロだった)。`translations-inbox` と同じ
「トップレベル `cid` は空、`meta` に軽量アイテム一覧、本文はアイテム単位の CID」という
ワイヤ形式を踏襲するが、本文側は `translations-inbox` のようにインラインではなく mistlib の
`storage_add` でCID化する点が異なる(全文インラインは localStorage quota を圧迫するため。
2026-07-13 の storage 監査で問題化済みの観点)。

- **書き手**: tc-translate(新規モジュール `src/lib/shareToLingo.ts`)。`HistoryPanel.tsx` の
  各履歴エントリに追加された「Lingoへ送る」ボタン(`useHistoryPanel.ts` の
  `sendHistoryItemToLingo(id)`)から明示的に呼ばれる(自動発行ではない。`note-article`/
  `pdf-viewer-inbox` と同じ「ユーザー操作起点」パターン)。`loadHistory()` が返す hydrate 済み
  履歴アイテム(legacy インラインアイテムも同一経路で扱える)から `LingoCardPayloadV1` を
  構築して `storageAddJson` でCID化し、`LingoCardInboxItem` に整形して既存 `meta.items` と
  併合、ローリング上限50件で `publishShared("lingo-card-inbox", "", meta)` を呼ぶ。同一 `id`
  の再送は既存エントリを置換する(`sentAt` 更新)。`kind === 'proofread'` の履歴は送信ボタン
  自体を出さない(`targetLanguage` 空・`translations` 空のため v1 対象外)。

  ```ts
  // meta の形。トップレベル cid は空(translations-inbox と同型)。
  interface LingoCardInboxMeta {
    v: 1
    items: LingoCardInboxItem[]   // ローリング上限 50 件、毎回まるごと再発行
  }

  interface LingoCardInboxItem {
    id: string             // 安定ID = tc-translate 履歴アイテムの id。受け手はこれで冪等化
    kind: 'translate' | 'explain'  // v1 では proofread 対象外
    targetLanguage: string // languageOptions の英語名(例 'Japanese')
    sourcePreview: string  // 先頭200字。受信箱一覧の表示用(CID解決前に出せる)
    cid: string             // LingoCardPayloadV1 の storage_add CID(平文)
    sentAt: string          // ISO 8601
  }

  // cid の指す先。平文JSON、送信時に storageAddJson で新規保存する。
  interface LingoCardPayloadV1 {
    v: 1
    sourceText: string      // 全文
    translations: { tone: string; text: string; reading?: string; pinyin?: string }[]
    vocabulary?: { word: string; reading?: string; meaning: string; note?: string }[]   // explain 由来
    grammarPoints?: { pattern: string; explanation: string; example?: string }[]        // explain 由来
    notes: string[]
  }
  ```

- **設計判断(平文CID)**: 履歴本文は保存時点で既に平文のまま同一オリジン共有の mistlib
  ストアへ `storageAddJson` 済み(`PersistedHistoryItem.bodyCid` が指す `HistoryItemBody`。
  詳細は [keys/tc-translate.md](keys/tc-translate.md))であり、契約形状に整形し直して
  `LingoCardPayloadV1` として再度 `storage_add` しても新たな露出を生まない。`note-doc-index`
  の判断と同じ側(「暗号化前の平文がどこにも存在しなかったデータ」に限って使い捨て鍵で
  暗号化する `storage-drive-inbox` とは前提が異なる)。
- **設計判断(`bodyCid` の使い回しではなく専用ペイロードを新規 add)**: `bodyCid` の指す
  `HistoryItemBody` は tc-translate の内部型でバージョンフィールドも持たない。これをそのまま
  契約に昇格させると tc-translate の内部実装を凍結してしまうため、`LingoCardPayloadV1`
  (`v` 付き・契約形状)を送信時に add し直すことで疎結合を保つ。legacy インラインアイテム
  (`bodyCid` を持たない旧形式)も `loadHistory()` の hydrate 後は同一形状で届くため、
  同一コードパスで送信できる。
- **失敗吸収**: `storageAddJson` 失敗時はそのアイテムを publish から除外するだけで、
  他のアイテムの発行は継続する(`shareToStorage.ts` の `buildInboxItem` パターン踏襲、
  全体はベストエフォート)。
- **読み手**: tc-lingo(`src/lib/cardInbox.ts` の購読ロジック + `CardsView` の受信箱UI)。
  起動時に `readShared("lingo-card-inbox")` を1回読み、以後 `subscribeShared` で購読する。
  一覧は `sourcePreview`/`targetLanguage` だけで CID解決前に表示でき、ユーザーが個別に展開
  したときに初めて `cid` を `storage_get` で解決して `LingoCardPayloadV1` を取得する。候補
  生成は決定的マッピング(`explain` 由来は `vocabulary[]`/`grammarPoints[]` を機械的にカードへ、
  `translate` 由来は原文↔訳文の文カード1枚)を既定とし、任意ボタンでのLLM語彙抽出(共有LLM設定
  `tc-shared-llm-config-v1` 使用)を追加できる。カード確定はユーザーが候補選択UIで選んだものだけ
  が通常の `addCard` へ渡る(バス自体はカードを自動生成しない)。
  **冪等キー**: `tc-lingo:card-inbox-state-v1`
  (`{ v: 1, done: Record<itemId, 'imported' | 'dismissed'> }`、上限1000件、古い順に間引き)。
  同一 `id` の再発行(送り手側のトーン追記等による再送)は既定でスキップする。
- **取込失敗の扱い(一時的 vs 恒久的)**: `storage-drive-inbox`/`pdf-viewer-inbox` と同じ分類。
  **一時的な失敗**(mistlib ロード失敗、`storage_get` の失敗など、再試行すれば成功しうるもの)は
  `done` に記録せず、受信箱に「取得できません・再試行」を表示して次回に委ねる。**恒久的な失敗**
  (`LingoCardPayloadV1` の型ガード不合格)は、送信時点でペイロードが固定されており再試行しても
  結果が変わらないため、`dismissed` として恒久的に取込済み扱いにマークする。
- **クロスアプリ書き込みについて**: tc-translate は共有トピックキー
  (`tc-shared-lingo-card-inbox-v1`)のみを書き、`tc-lingo:*` の localStorage キーには一切
  触れない。tc-lingo 側の `tc-lingo:cards-v1` への書き込みは常に tc-lingo 自身の `addCard`
  経由で行われ(ユーザーの候補選択を介する)、バスがカードストアを直接書き換えることはない —
  他のインボックス系トピックと同じ「送り手はアイテムを渡すだけ、書き込みは受け手の既存フローに
  乗る」原則を踏襲する。

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
