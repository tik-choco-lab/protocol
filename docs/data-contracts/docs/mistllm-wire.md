# tc-mistllm の P2P ワイヤプロトコル

tc-mistllm が mistlib の P2P ルーム上でやり取りする JSON メッセージの仕様。
consumer(LLM を利用する側)と provider(LLM を提供する側)がピア同士で直接メッセージを
送受信する(サーバー仲介なし)。**ピアは信頼できない**ため、受信側は必ず全フィールドの
型・値を検証してから使うこと(自プロトコル内でも [conventions.md](conventions.md) の
「クロスアプリ読み取りの原則」と同じ防御的パースの姿勢を取る)。

実装上の正:
- TypeScript: `tc-mistllm/src/lib/protocol.ts`(`encode`/`decode`)
- Rust: `tc-mistllm/cli/src/protocol.rs`(`encode_message`/`decode_message`)

両実装はフィールドレベルで一致するよう保守されている。本ドキュメントは実装から起こした
仕様であり、実装が正、本ドキュメントはそれに追従する。

### 第2の実装: mistai ライブラリ

`mistai/src/protocol.ts`(TypeScript、`encode`/`decode`)は tc-mistllm の
`protocol.ts`/`protocol.rs` と互換の `v: 1` ワイヤをやり取りするもう一つの実装。
consumer/provider それぞれの上位ロジック(`mistai/src/consumer.ts` 相当の
`ConsumerClient`、`mistai/src/provider.ts`)が tc-mistllm の consumer/provider の役割を担う。
tc-translate は mistlib ノードを注入した `@tik-choco/mistai` の `ConsumerClient` 経由でこの
ワイヤに参加する(`tc-translate/src/lib/network.ts`。`ConsumerClient` の生成・
`nodeIdStorageKey` の指定・チャット/音声リクエストの発行はいずれもこのファイル経由)。
mistai は本セクション基本メッセージ種別に加え、下記「音声拡張」も実装する。

## 概要

- 全メッセージは `v: 1` の JSON オブジェクトで、UTF-8 バイト列にエンコードして
  mistlib の `sendMessage`/`send_message` に渡す。
- `v` が `1` でない、または `type` が未知の値であれば、メッセージ全体を破棄する
  (`decode`/`decode_message` は `null`/`None` を返す)。
- ロール(`ChatMessage.role`)は `"system" | "user" | "assistant"` の3値のみ許可。

## メッセージ種別

| `type` | 送信方向 | 用途 |
|---|---|---|
| `consumer_hello` | consumer → provider | consumer がルームに参加したことを知らせる |
| `provider_hello` | provider → consumer | provider がルームに参加したことを知らせる |
| `llm_request` | consumer → provider | チャットリクエストの送信 |
| `llm_response_chunk` | provider → consumer | ストリーミング応答の断片(delta) |
| `llm_response_done` | provider → consumer | ストリーミング応答の完了通知 |
| `llm_error` | provider → consumer | リクエスト処理中のエラー通知 |
| `raft_message` | consumer ⇄ consumer | Raftベースのタスクスケジューラー(`--scheduler raft`)間の合意メッセージを運ぶ不透明ペイロード |

### `consumer_hello` / `provider_hello`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"consumer_hello"` \| `"provider_hello"` | 必須 | メッセージ種別 |
| `models` | `string[]`(`provider_hello` のみ) | 任意 | provider が自身の上流(HTTP API)に `GET /models` した結果を配布する optional 拡張。consumer 側はこれを受けて UI のモデル選択プルダウンに反映する。tc-pdf-viewer 発の拡張(commit `be743f8`)で、`v: 1` のまま追加された optional フィールドの実例 |

`consumer_hello` に `models` は存在しない。`provider_hello.models` は非空文字列の配列でなければならず、
それ以外の型(数値・オブジェクトを含む配列、非文字列要素など)であればこの**フィールドのみ**を
無視してメッセージ全体は受理する(必須フィールドが揃っていれば `provider_hello` 自体は成立する)。

### `llm_request`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"llm_request"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | リクエストID。以降の応答はこの `id` で相関付けられる |
| `messages` | `ChatMessage[]`(非空配列) | 必須 | チャット履歴。空配列は不正 |
| `model` | `string` | 任意 | 使用モデル名の指定 |

`ChatMessage` は `{ role: "system" | "user" | "assistant", content: string }`。
`messages` の各要素がこの形を満たさない場合、メッセージ全体を拒否する。

### `llm_response_chunk`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"llm_response_chunk"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | 対応する `llm_request.id` |
| `delta` | `string` | 必須 | 応答テキストの断片(空文字列も許可) |
| `seq` | `number`(0以上の整数) | 任意 | リクエストIDごとに0始まりで単調増加する連番。詳細は下記「ストリーミングと seq 並べ替え」参照 |

`seq` が存在する場合は非負整数でなければならず、それ以外の型・負の値は
メッセージ全体を拒否する(`null` は「フィールドなし」と同義に扱う実装がある。
Rust 側の `optional_seq` を参照)。

### `llm_response_done`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"llm_response_done"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | 対応する `llm_request.id` |
| `content` | `string` | 任意 | 応答の全文 |

`content` は **authoritative**(正)。存在する場合、受信側は `llm_response_chunk` を
積み上げて構築した文字列ではなく `content` を最終結果として採用しなければならない
(chunk 側にバッファ待ちの断片が残っていてもこれで確定させてよい)。`content` が
無い場合のみ、chunk の delta を順序どおり連結した文字列にフォールバックする。

### `llm_error`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"llm_error"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | 対応する `llm_request.id` |
| `message` | `string` | 必須 | エラー内容 |

### `raft_message`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"raft_message"` | 必須 | メッセージ種別 |
| `payload` | `string`(非空、base64) | 必須 | `mistlib_consensus_core::RaftMessage` をbincodeでシリアライズしbase64エンコードした不透明バイト列 |

`payload` の中身はこのプロトコル層では一切解釈しない(空文字列のみ拒否する)。デコード・
実際のRaft状態機械への適用は `--scheduler raft` を有効にしたCLI側(`cli/src/scheduler.rs`)
のみが行う。mistlib-consensus独自の `MistTransport` は `mistlib-core::L1Transport` を
前提とするが、tc-mistllmのP2P API(`node.rs`)はそれを実装しないグローバル関数形式のため、
Raftトラフィックはこの `ProtocolMessage` エンベロープに乗せて既存の送受信経路を流用する。

web版(`tc-mistllm/src/lib/protocol.ts`)は `raft_message` のエンコード/デコードのみ対応し、
Raft本体のロジック(スケジューラー)は未実装。

## 音声拡張 (Voice extension)

mistai ライブラリ(`mistai/src/protocol.ts`)は、同じ `v: 1` エンベロープの上に音声合成
(TTS)・音声認識(STT)のための5つのメッセージ種別を追加する。**tc-mistllmのコア実装
(`tc-mistllm/src/lib/protocol.ts`/`protocol.rs`)はこれらの型を実装していない**
(`MESSAGE_TYPES`/`msg_type` の一致セットに含まれない)。したがって送信側はこれらの
メッセージに対する受信側の対応を仮定してはならない — 相手が tc-mistllm 単体か mistai
搭載ピアかを判別する専用のネゴシエーション機構は無く(`provider_hello.models` は
LLMモデル一覧のみを扱う)、未対応ピアは下記「未知の型の扱い」のとおり黙って
メッセージを破棄する。

| `type` | 送信方向 | 用途 |
|---|---|---|
| `tts_request` | consumer → provider | 音声合成(テキスト→音声)のリクエスト |
| `tts_response` | provider → consumer | 合成音声の応答(順序付きチャンク配信) |
| `stt_request` | consumer → provider | 音声認識(音声→テキスト)のリクエスト(順序付きチャンク送信) |
| `stt_response` | provider → consumer | 認識結果テキストの応答 |
| `voice_error` | provider → consumer | tts_request/stt_request 処理中のエラー通知 |

### `tts_request` / `tts_response`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"tts_request"` \| `"tts_response"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | リクエストID。応答はこの `id` で相関付けられる |
| `text` | `string`(`tts_request` のみ) | 必須 | 合成対象テキスト |
| `model` | `string`(`tts_request` のみ) | 任意 | 使用モデル名の指定 |
| `voice` | `string`(`tts_request` のみ) | 任意 | 声質の指定 |
| `seq` | `number`(0以上の整数、`tts_response` のみ) | 必須 | リクエストIDごとに0始まりで単調増加する連番(`llm_response_chunk.seq` と異なり必須) |
| `data` | `string`(`tts_response` のみ) | 必須 | 音声データの base64 サブチャンク |
| `last` | `boolean`(`tts_response` のみ) | 必須 | 最終チャンクかどうか |
| `mime` | `string`(`tts_response` のみ、非空) | 必須 | 音声の MIME タイプ(最初のチャンクの値を正とする) |

consumer(`mistai/src/voice-consumer.ts` の `VoiceConsumerService`)は `seq` が期待値
(`nextSeq`)と一致しないチャンクを受け取ると即座にリクエストを失敗させる
(`llm_response_chunk` のようなバッファリング再整列は行わない — 順序どおりの到着を
前提とする、より厳格な検証)。受信済み base64 の合計サイズ・リクエストの
タイムアウトにも上限があり、超過時はエラーとして扱う。

### `stt_request` / `stt_response`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"stt_request"` \| `"stt_response"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | リクエストID |
| `seq` | `number`(0以上の整数、`stt_request` のみ) | 必須 | 0始まりで単調増加する連番 |
| `data` | `string`(`stt_request` のみ) | 必須 | 音声データの base64 サブチャンク |
| `last` | `boolean`(`stt_request` のみ) | 必須 | 最終チャンクかどうか |
| `mime` | `string`(`stt_request` のみ、非空) | 必須 | 音声の MIME タイプ |
| `model` | `string`(`stt_request` のみ) | 任意 | 使用モデル名の指定(先頭チャンクにのみ乗る) |
| `fileName` | `string`(`stt_request` のみ) | 任意 | 元ファイル名(先頭チャンクにのみ乗る) |
| `text` | `string`(`stt_response` のみ) | 必須 | 認識結果テキスト |

provider(`mistai/src/voice-provider.ts` の `VoiceProviderService`)も `seq` の順序を
検証し、期待値とずれたチャンクを受け取った時点でそのアップロードを破棄して
`voice_error` を返す。同時に受け付けるアップロード本数・合計サイズにも上限があり、
超過時は新規アップロードを `voice_error` で拒否する(未信頼ピア前提のリソース保護)。

### `voice_error`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"voice_error"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | 対応する `tts_request`/`stt_request` の `id` |
| `message` | `string` | 必須 | エラー内容 |

### 未知の型の扱い

音声拡張の型を実装しないピア(現状の tc-mistllm コア実装を含む)がこれらの `type` を
受信した場合の挙動は、本ドキュメント冒頭の「概要」に定義済みの一般規則がそのまま適用
される: `type` が未知の値であればメッセージ全体を破棄する(`decode`/`decode_message` は
`null`/`None` を返す。実装ごとの特別扱いは無い)。音声拡張に固有のネゴシエーションや
機能フラグは存在しないため、送信側は相手が対応しているという前提を持たず、
実装依存(implementation-defined)の挙動として扱うこと。

## ストリーミングと seq 並べ替え

### 背景

mistlib のオーバーレイ多経路ルーティングでは、同一リクエストに属する複数の
`llm_response_chunk` が経路差により**送信順と異なる順序で consumer に到着することがある**
(tik-choco-lab/mistlib-dev#5)。`seq` フィールドはこの到着順逆転を consumer 側で
補正するために追加された。

### アルゴリズム(TCP受信ウィンドウ方式)

consumer はリクエストID(`id`)ごとに以下の状態を保持する:

- `nextSeq`: 次に適用されるべき seq(初期値 0)
- `buffered`: `seq -> delta` の一時バッファ(まだ順番が来ていない断片)

`llm_response_chunk` を受信するたびに、以下の規則で処理する:

1. **`seq` が無い場合**: 並べ替えを行わず、到着順に即座に適用する(レガシー送信者、
   または並べ替え不要と判断した送信者向け)。
2. **`seq === nextSeq` の場合**: 直ちに適用し、`nextSeq` を1進める。その後、
   バッファ内に `nextSeq` に一致する断片があれば連続して取り出して適用し、
   `nextSeq` をさらに進める(ドレイン)。これを次の連続断片が無くなるまで繰り返す。
3. **`seq > nextSeq` の場合**: 将来の断片としてバッファに格納し、まだ適用しない。
4. **`seq < nextSeq` の場合**: 過去分の重複(再送等)とみなし、破棄する(適用しない)。

状態はリクエストIDごとに独立しており、`llm_response_done` または `llm_error` の
受信時に破棄される。バッファサイズの上限やタイムアウトは設けていない
(provider が `llm_response_done` を送るまでバッファは無制限に保持されうる)。

### 実装

- TypeScript: `tc-mistllm/src/lib/consumer.ts` の `ConsumerService.applyChunk`
  (`PendingRequest.nextSeq` / `PendingRequest.buffered`)
- Rust: `tc-mistllm/cli/src/server.rs` の `apply_chunk`
  (`next_seq` / `buffered` フィールド)。両実装ともロジックは同一。

## 後方互換ルール

- 本プロトコルはメッセージ単位ではなく `v: 1` 全体で1つのバージョンを持つ。
- **フィールド追加は破壊的変更ではない**: 既存メッセージ種別に optional フィールドを
  追加しても `v` は `1` のまま据え置く(`llm_response_chunk.seq` はこのパターンの実例)。
  受信側は未知フィールドを無視し、欠落フィールドにはデフォルト値
  (`seq` なら「並べ替えなしで即時適用」)を当てる実装にすること。
- **メッセージ種別の追加**も `v: 1` のまま可能。未知の `type` を受信した側はメッセージ
  全体を破棄する(エラーにはしない)。
- 必須フィールドの削除・型変更・意味変更など、真に破壊的な変更を行う場合は
  `v` をインクリメントすること(tc-protocol 全体の
  [スキーマ進化ルール](conventions.md#スキーマ進化ルール)に準じる)。
