# VRMモデルライブラリ共有(IndexedDB)仕様

tc-vrm-viewer / tc-town / tc-travel が同一オリジンで共有する、VRMモデル本体(バイト列)の
IndexedDB ストアの契約。[SHARED_BUS.md](SHARED_BUS.md) の `character-index` トピックの
`vrmChecksum` フィールドが指す実体がこれであり、稼働自体は以前からしていたが契約ドキュメントが
存在していなかった。本ドキュメントで正式に契約化する。

## 動機

tc-vrm-viewer は自分のVRMモデルライブラリ(インポート済み `.vrm` ファイル一式)を、
汎用ファイル管理ドメイン(`FolderRecord`/`FileRecord`、フォルダ・ファイル共通の内部スキーマ)
の一部として IndexedDB(ブラウザネイティブAPI、mistlib 経由ではない)に保存している。
tc-town は「キャラクターにVRMアバターを紐付ける」機能のために、このライブラリを**自分の
ローカル状態を経由せず直接**読み書きする(同一オリジンなら別アプリの IndexedDB データベースへ
プログラムから直接アクセスできるブラウザの性質を利用)。tc-travel はさらにそれを読み取り専用で
消費し、tc-town のキャラクター(`character-index` トピック経由)が参照するVRMアバターの実体を
解決する。

これまでの共有契約([did-identity.md](did-identity.md)、[llm-config.md](llm-config.md)、
[SHARED_BUS.md](SHARED_BUS.md))はいずれも `localStorage`(+ mistlib OPFS の CID ポインタ)を
対象としてきたが、本契約は**IndexedDB を直接共有する初めての契約**である。

## ストレージ

| 項目 | 値 |
|---|---|
| API | ブラウザネイティブ `indexedDB`(mistlib を経由しない) |
| データベース名 | `tc-vrm-viewer` |
| バージョン | `1` |
| オブジェクトストア名 | `models` |
| keyPath | `id` |

データベース名がアプリ名 `tc-vrm-viewer` と同じだが、これは tc-vrm-viewer が canonical owner
(スキーマ本家)であることの名残であり、tc-town・tc-travel も同じ DB/ストアへ直接アクセスする
という点で、実質的にはアプリ名プレフィックスなしの共有ストアと同じ扱いである
(localStorage の `tc-shared-<topic>-v1` 命名規約とは異なるが、同じ「co-owned」の精神)。

## スキーマ: `FileRecord`

`models` ストアの各レコードは、tc-vrm-viewer の汎用ファイルドメインの `FileRecord` 型
(`tc-vrm-viewer/src/storage/domain.ts`)そのもの。VRMライブラリでは以下のサブセットが実質的に
使われる(`folderId` が常に `"library"` 固定になる点を除き、フィールド自体は汎用ファイル管理と
共通):

```ts
type FileRecord = {
  id: string            // 例: "file-<uuid>"。ストアの keyPath
  folderId: string       // VRMライブラリでは常に "library" 固定
  name: string            // 元ファイル名
  mimeType: string        // "model/gltf-binary"
  size: number             // バイト数
  dataUrl: string           // "data:model/gltf-binary;base64,..." — VRMバイト本体をbase64 data URLとして保持
  checksum: string          // SHA-256 hex digest。クロスアプリの安定ID(下記参照)
  version: number           // 常に 1(VRMライブラリでは更新時にインクリメントされない)
  starred: boolean          // 常に false(VRMライブラリでは未使用)
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
}
```

tc-vrm-viewer 本家の `FileRecord` はさらに `sortOrder` / `lastCid` / `lastShareCid` /
`deletedAt` / `fieldVersions` など汎用ファイル管理向けの追加フィールドを持つが、これらは
VRMモデルレコードでは付与されない(オプショナル扱い)。読み手はこれらの追加フィールドを
無視してよい。

## `checksum` がクロスアプリの安定ID

`id` は生成元アプリごとに独立した採番(tc-vrm-viewer と tc-town でID生成ロジックが異なる)の
ため、同じVRMファイルでも別アプリでインポートすると異なる `id` を持つレコードが2つ存在しうる。
これを避けるため、**`checksum`(VRMバイト列そのものの SHA-256 hex digest)をクロスアプリの
安定な同一性判定キーとする**:

- 追加(write)時、書き手は追加前に既存レコードを `checksum` で検索し、一致するものがあれば
  **新規レコードを作らず既存レコードをそのまま返す**(重複排除)。tc-town の
  `importVrmFile`(`tc-town/src/vrm/library.ts`)がこれを実施している。
- 解決(read)時、読み手は可能なら `id` で直接引き、無ければ `checksum` で全件走査して
  一致するレコードにフォールバックする(下記「参加アプリと役割」参照)。

checksum の算出方式は両アプリで同一: VRMバイト列(`Uint8Array`)を `crypto.subtle.digest`
(SHA-256)にかけ、各バイトを2桁16進数へパディングして連結した hex 文字列
(`checksumOf`、tc-vrm-viewer は `src/storage/library.ts`、tc-town は `src/vrm/library.ts`)。

## 参加アプリと役割

| アプリ | 役割 | 実装 |
|---|---|---|
| tc-vrm-viewer | **canonical owner**。DB/ストアのスキーマ本家、書き手 | `src/storage/library.ts`(`addModelToLibrary`)、`src/storage/domain.ts`(`FileRecord` 定義) |
| tc-town | 書き手 + 読み手 | `src/vrm/library.ts`。`importVrmFile` で追加(checksum重複排除)、`getVrmBytesForAvatar(blobKey, checksum)` で解決(`id` 優先→`checksum` フォールバック) |
| tc-travel | 読み手専用 | `src/lib/town/vrmResolve.ts`(`resolveTownVrmBytes`)。tc-town の `character-index` エントリ(`CharacterIndexEntry.vrmChecksum`)から checksum で解決する |

tc-travel の実装は tc-town の `id` 優先ロジックを持たず、**checksum のみ**で検索する
(tc-travel は tc-town が発行した `vrmChecksum` しか持たないため `id` を知らない)。また
tc-travel は書き込みを一切行わない読み取り専用の visitor であり、`indexedDB.open(DB_NAME)`
を**バージョン番号を指定せずに**開き、`onupgradeneeded` で何もしない(オブジェクトストアを
作成しない)ことで、万一 DB が未作成の環境でも本来のスキーマ所有者(tc-town/tc-vrm-viewer)の
将来の `onupgradeneeded` を壊さないよう配慮している(下記「運用ルール」も参照)。

## フォールバック: mistlib CID 経由

IndexedDB に該当レコードが見つからない場合(別端末で作られたキャラクター、初回訪問でまだ
ローカルに VRM が無い等)、`character-index` トピックの `CharacterIndexEntry.vrmCid`
(VRM生バイト列の mistlib CID)から `storage_get` で取得するフォールバックへ落ちる。
このフォールバックの詳細は [SHARED_BUS.md](SHARED_BUS.md) の「既存トピック:
`character-index`」節を参照。tc-travel の `resolveTownVrmBytes` は
「IndexedDB(checksum)→mistlib storage(vrmCid)」の順に試し、両方失敗すれば `null` を返す
(例外を投げない)。

## 運用ルール

- **信頼境界は同一オリジン**。localStorage 共有(`SHARED_BUS.md` の「設計方針」)と同じ前提で、
  署名や暗号化はなく、同一オリジンで動く全コードが `models` ストアを読み書きできる。悪意ある
  コードによる偽装・改ざんは想定内であり、アクセス制御には使わないこと([llm-config.md](llm-config.md)
  の「信頼境界」節と同方針)。
- **DBスキーマ変更(`DB_VERSION` の bump、オブジェクトストア追加等)は canonical owner の
  tc-vrm-viewer のみが行う**。tc-town・tc-travel は自分の `openDb()` 実装で
  `indexedDB.open(DB_NAME, DB_VERSION)` を呼ぶ際、tc-vrm-viewer 側の `DB_VERSION` と
  同じ値を使うこと。バージョン不一致のまま各アプリが別々にバージョンを上げると
  `onupgradeneeded`/`onblocked` の競合を招くため、スキーマ変更は必ず tc-vrm-viewer 側の
  変更を起点にし、他の参加アプリへ変更を伝播させること。
- **読み取り専用の参加アプリ(tc-travel)は `indexedDB.open(DB_NAME)` をバージョン省略で開き、
  `onupgradeneeded` で何もしない**こと。バージョンを明示指定して独自の
  `onupgradeneeded` を実装すると、canonical owner が想定しないタイミング・内容で
  スキーマが変更されるリスクがある。
- **`FileRecord.folderId`**: VRMライブラリのレコードは `"library"` 固定。tc-vrm-viewer の
  汎用ファイル管理機能(通常のフォルダ)とは名前空間上区別されるが、同じ `models` ストア・
  同じ `FileRecord` 型を共用しているため、読み手は `folderId === "library"` または
  `dataUrl` の有無でVRMライブラリのレコードかどうかを判別すること(tc-town の
  `listVrmModels` が両条件の OR で判定している実例を参照)。
- **重複排除は書き手の責務**。ストア自体は `checksum` にユニーク制約を持たない(keyPath は
  `id` のみ)ため、書き手が追加前に `checksum` 一致チェックを行わないと同一VRMの重複レコードが
  発生しうる。

## バージョニング方針

[SHARED_BUS.md](SHARED_BUS.md)/[llm-config.md](llm-config.md) と同じ方針。`FileRecord` の
必須フィールドを破壊的に変更する場合は `DB_VERSION` を bump し(canonical owner である
tc-vrm-viewer が起点)、旧バージョンのレコードは `onupgradeneeded` 内でマイグレーションする
(現時点でマイグレーションの実装例なし)。後方互換なフィールド追加は `DB_VERSION` を変えずに
行ってよい(読み手は未知フィールドを無視すること)。

## 関連実装

- tc-vrm-viewer: `src/storage/domain.ts`(`FileRecord` 定義)、`src/storage/library.ts`
  (`addModelToLibrary`/`listLibraryModels`/`removeModelFromLibrary`/`checksumOf`)
- tc-town: `src/vrm/library.ts`(`importVrmFile`/`listVrmModels`/`getVrmBytes`/
  `getVrmBytesForAvatar`/`deleteVrmModel`/`checksumOf`)
- tc-travel: `src/lib/town/vrmResolve.ts`(`resolveTownVrmBytes`)
- `character-index` トピックとの関係: [SHARED_BUS.md](SHARED_BUS.md) の「既存トピック:
  `character-index`」節、[keys/tc-town.md](keys/tc-town.md)
