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
mistai は本セクション基本メッセージ種別に加え、下記「音声拡張」も実装する。さらに mistai
v0.4.0 で `provider_hello.services` と `llm_error.code`/`voice_error.code`(下記
「capability 広告」「capability 不一致時の応答義務」参照)を実装する。tc-mistllm コア実装
(`protocol.ts`/`protocol.rs`)および mistl は本稿執筆時点でこれらを未実装だが、`services`
欠落時は `["chat"]` を広告したものとみなす既定の後方互換ルールにより、更新前のピアとも
相互運用できる。

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
| `models` | `string[]`(`provider_hello` のみ) | 任意 | provider が自身の上流(HTTP API)に `GET /models` した結果を配布する optional 拡張。consumer 側はこれを受けて UI のモデル選択プルダウンに反映する。tc-pdf-viewer 発の拡張(commit `be743f8`)で、`v: 1` のまま追加された optional フィールドの実例。広告してよい内容の義務・省略時の扱いは下記「`models`(広告名 = ラベル規約)」参照 |
| `services` | `string[]`(`provider_hello` のみ) | 任意 | provider が提供するサービス種別の広告(capability 広告)。既知値は `"chat"` \| `"tts"` \| `"stt"` \| `"embedding"`。mistai v0.4.0 で実装。フィールド省略時の意味論は下記参照 |
| `voices` | `string[]`(`provider_hello` のみ) | 任意 | provider が TTS で受け付ける voice 名のカタログ広告(capability 広告)。`services` に `"tts"` を広告する provider のみが広告してよい。mistai v0.6.0 で実装。詳細は下記「`voices`(capability 広告)」参照 |

`consumer_hello` に `models`/`services`/`voices` は存在しない。`provider_hello` の `models`・
`services`・`voices` は同じ防御的パース規則に従う:

- フィールド自体が配列でない場合(数値・オブジェクト等)は、この**フィールドのみ**を
  無視してメッセージ全体は受理する(必須フィールドが揃っていれば `provider_hello`
  自体は成立する)。
- 配列ではあるが非文字列・空文字列の要素を含む場合は、**その要素だけを個別にフィルタして
  除外**し、残った非空文字列要素をフィールドの値として採用する(mistai v0.4.0 実装準拠。
  それ以前の文書は `models` を「フィールド全体無視」と記述していたが、実装は当初から
  要素単位フィルタであり、本改訂で実装に合わせた)。`voices` も mistai v0.6.0 から
  同じ規則で実装されている。

#### `models`(広告名 = ラベル規約)

`models[]` に載る文字列は、必ずしもモデル id そのものではなく、**表示名を兼ねた不透明な
ルーティングキー**(プリセットのラベル。未設定ならモデル id)である場合がある。consumer は
受け取った文字列をそのまま表示し・そのまま `llm_request.model` に載せてよい(値の意味を
解釈しようとしないこと)。広告名がどの上流モデルに対応するかは**広告した provider だけが
知っており**、provider は受信した `model` を実モデル id に書き換えてから上流へ転送してよい
(tc-translate の `mist-network://` 疑似プロバイダ実装がこの規約の参照実装)。ワイヤ形状は
従来どおり `string[]` のままであり、素のモデル id をそのまま広告する旧来の実装とも
混在できる(この規約はワイヤ変更を伴わない、広告される文字列の意味論についての取り決め)。

さらに、`models[]` を広告する場合、provider は**共有対象として明示的に選択した preset の
広告名のみ**で `models` を構成しなければならない。上流エンドポイント(`GET /models` 等)
から取得したモデル一覧を、選択を経ずにそのまま広告する実装は本規約違反である(共有して
いないモデルの存在をネットワークに露出させてしまうため)。共有対象の preset が一つも
選択されていない場合は、`models` フィールド自体を省略すること。上記「フィールドの
防御的パース」で述べたとおり、フィールド省略時は consumer 側で「`models` 広告なし
(= モデル一覧不明のレガシー単一上流モード)」として扱われる。

共有 preset の選択内容が変わった(追加・削除・入れ替え)場合、provider は接続を維持した
まま `provider_hello` を全ピアへ再送する**べきである**(SHOULD)。consumer は接続中に
受信した `provider_hello` で provider table と UI 表示を即時更新する(tc-translate/mistai
v0.5.0 の実装で運用済みの挙動)。この再送規則は下記「`voices`(capability 広告)」の
再送記述(TTS 設定変更時の再送は MAY)と対をなすが、`models` は共有可否そのものに関わる
規約準拠の問題であるため、voices より一段強い SHOULD とする。

#### `services`(capability 広告)

- 値が `"chat"`/`"tts"`/`"stt"`/`"embedding"` のいずれでもない未知の文字列は、無視せず
  そのまま素通しする(将来のサービス種別追加に備えた前方互換。consumer 側は認識できない
  値を単に無視すればよい)。

**`services` フィールド自体が欠落している `provider_hello` は `["chat"]` を広告したものと
みなす**。services 拡張以前の provider(tc-mistllm コア実装・mistl など、更新前のピア)は
チャット専用として扱われる。音声(tts/stt)や embedding を提供する provider は `services`
を明示しなければ consumer から発見されない。

#### `voices`(capability 広告)

`services` に `"tts"` を広告する provider のみが `voices` を広告してよい。一覧は provider が
自身の TTS 上流から取得する(取得できない場合はフィールド自体を省略する — 空配列とは
区別する)。

- 各要素は `tts_request.voice` にそのまま指定できる**実 id**をそのまま広告する。上記
  「`models`(広告名 = ラベル規約)」とは異なり、voice は provider が受信値を上流へ
  素通しするだけなので、広告名からの逆引き変換が不要(実 id を広告してよい理由)。
- 広告は最大 **64 件**を推奨する(hello の JSON サイズを mist の安全上限(~16KB)内に
  収めるため)。上流が多数の voice を持つ場合は先頭 64 件に切り詰めてよく、切り詰めた
  事実自体はワイヤ上に表現しない。
- provider の TTS 設定変更で一覧が変わった場合、provider は `provider_hello` を再送して
  よい(hello 再送の契機・実装はこの規約自体が定めるものではなく、consumer/provider
  実装側の合意事項)。`models` の共有リスト変更時は同じ再送がより強い規範(SHOULD)
  として定められている — 上記「`models`(広告名 = ラベル規約)」参照。
- mistai v0.6.0 で実装。

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
| `code` | `string` | 任意 | 機械可読のエラー理由コード。既知値は `"unsupported_service"`(provider が要求されたサービス自体を提供していないことを表す。詳細は下記「capability 不一致時の応答義務」)。mistai v0.4.0 で実装 |

`code` が文字列でない場合はこの**フィールドのみ**を無視し(`models`/`services` と同じ
フィールド単位の防御的パース)、`message` があれば `llm_error` 自体は成立する。
`"unsupported_service"` 以外の未知の文字列値はそのまま素通しする(将来のコード追加に
備えた前方互換)。`code` が無い `llm_error` は従来どおり `message` のみで理由を表す
汎用エラー(上流 API 呼び出し失敗など)であり、`"unsupported_service"` とは区別される。

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
メッセージに対する受信側の対応を仮定してはならない。

相手が tc-mistllm 単体(chat専用)か音声対応の mistai 搭載ピアかは、上記
「capability 広告」で追加された `provider_hello.services` で判別できる — `services` を
広告しない、または `services` に `"tts"`/`"stt"` を含まない provider は音声非対応とみなし、
consumer 側は `tts_request`/`stt_request` を送るべきではない(送った場合の provider 側の
応答義務は下記「capability 不一致時の応答義務」参照)。`services` フィールド自体が
省略された(services 拡張以前の)provider は `["chat"]` を広告したものとみなされるため、
音声非対応として扱われる。

ただし `services` はあくまで provider の**自己申告**であり、真に音声メッセージ型を
実装していないピア(tc-mistllmコア実装等)が `tts_request`/`stt_request` を受信した
場合は、そもそも `type` を認識できないため「capability 不一致時の応答義務」の対象外で、
下記「未知の型の扱い」の一般規則(黙って破棄)がそのまま適用される。

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
| `lang` | `string`(`tts_request` のみ) | 任意 | `text` の言語を表す BCP-47 言語タグのヒント(例 `en`, `ja`, `en-US`) |
| `seq` | `number`(0以上の整数、`tts_response` のみ) | 必須 | リクエストIDごとに0始まりで単調増加する連番(`llm_response_chunk.seq` と異なり必須) |
| `data` | `string`(`tts_response` のみ) | 必須 | 音声データの base64 サブチャンク |
| `last` | `boolean`(`tts_response` のみ) | 必須 | 最終チャンクかどうか |
| `mime` | `string`(`tts_response` のみ、非空) | 必須 | 音声の MIME タイプ(最初のチャンクの値を正とする) |

`lang` は `voice` と同じく防御的パースの対象である: 値が文字列でない、または空文字列の
場合はこの**フィールドのみ**を無視する(`models`/`services`/`code` 等と同じフィールド
単位の規則)。既存メッセージ種別への optional フィールド追加であり、`v: 1` のまま追加
された下記「後方互換ルール」のパターンの一実例(欠落時のデフォルトは「言語ヒントなし」、
すなわち下記「provider の `lang` 尊重規則」の「`voice` 指定なし・`lang` なし」と同じ
従来の扱い)。

consumer(`mistai/src/voice-consumer.ts` の `VoiceConsumerService`)は `seq` が期待値
(`nextSeq`)と一致しないチャンクを受け取ると即座にリクエストを失敗させる
(`llm_response_chunk` のようなバッファリング再整列は行わない — 順序どおりの到着を
前提とする、より厳格な検証)。受信済み base64 の合計サイズ・リクエストの
タイムアウトにも上限があり、超過時はエラーとして扱う。

#### provider の `voice` / `model` 尊重規則

`tts_request` を受けた provider は、`voice` と `model` を次のように**非対称**に扱う:

| フィールド | 指定あり | 指定なし |
|---|---|---|
| `voice` | **指定された voice をそのまま上流へ渡す**(provider 自身の設定 voice で上書きしない。provider 側で事前検証も行わない — 上流が拒否した場合はそのエラーを `voice_error` で返す。広告一覧との照合は consumer UI 側の責務) | provider 自身の設定済み voice で応答する |
| `model` | provider 自身の設定と一致するときだけ尊重する。不一致なら provider 自身の設定済みモデルで応答する(拒否はしない — `llm_request.model` に対する「広告済みモデルに対する応答規則」とは扱いが異なる。下記参照) | provider 自身の設定済みモデルで応答する |

この非対称性は、`voice` が実 id をそのまま素通しできる(上記「`voices`(capability 広告)」
参照)のに対し、`model` の広告カードは chat preset の名前(上記「`models`(広告名 = ラベル
規約)」参照)であり、その名前を音声 API へそのまま流すと必ず失敗するために生じる。

tc-translate・mistai(wire 層)はこの挙動で実装済み。mistl は voice 素通しは当初から
実装済みだったが、model のフォールバックは未実装で、リクエストの `model`(広告ラベル
文字列)をそのまま上流へ転送していた(実機で上流 400 を確認)。2026-07-23 の
`resolve_voice_call_model` 導入(tts/stt 両方)で本節準拠となった。

#### provider の `lang` 尊重規則

`tts_request` に `lang` が伴う場合、provider は次の規則に従う:

- **`voice` 指定あり**: 上記の通り `voice` が最優先であり、**`lang` は明示された `voice`
  を上書きしない**(`lang` は無視してよい)。
- **`voice` 指定なし・`lang` あり**: provider は `lang` に適した voice を選択する
  **べきである(SHOULD)**(例: 設定済みの言語別 voice マッピング、上流カタログからの
  言語推定)。適した voice を選択できない場合は、上記「`voice` 指定なし」の従来の
  デフォルト解決(provider 自身の設定済み voice 等)へフォールバックし、**エラーには
  しない**(`lang` はヒントであり解決を保証するものではない)。
- `lang` を理解しない旧実装は、この拡張フィールドを単に無視してよい(後方互換)。

`lang` に基づく voice 自動選択は mistai v0.7.0 で実装。mistl も同ヒントを尊重する対応を
実装中である(本稿執筆時点で未コミット)。

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
| `code` | `string` | 任意 | 機械可読のエラー理由コード。既知値は `"unsupported_service"`(下記「capability 不一致時の応答義務」参照)。mistai v0.4.0 で実装 |

`code` の防御的パース・意味論は `llm_error.code` と同一(上記参照)。

### capability 不一致時の応答義務

provider は、自身が `services` で広告していない(広告省略時は `["chat"]` のみを
広告したものとみなす)サービスへのリクエストを受信した場合、**黙ってリクエストを
破棄してはならない**。該当するエラーメッセージを即時返却すること:

| 受信メッセージ | provider が非対応の場合の応答 |
|---|---|
| `llm_request`(chat 非対応) | `llm_error`(`code: "unsupported_service"`) |
| `tts_request`(tts 非対応) | `voice_error`(`code: "unsupported_service"`) |
| `stt_request`(stt 非対応) | `voice_error`(`code: "unsupported_service"`)。`stt_request` はアップロードがチャンク分割されているため、この応答は **`seq === 0` の先頭チャンクに対してのみ**行う(後続チャンクに対して重複して返却しない) |

`unsupported_service` は「provider がそのサービス自体を一切提供していない」ことを表す
エラーであり、サービス自体は提供しているが個別リクエストの処理中に失敗した場合
(上流 API 呼び出し失敗など、`code` 省略または他の理由コード)とは区別される。

この応答義務は、mistl が単体プロトコルとして既に実装していた「音声非対応リクエストへの
`voice_error` 即時応答」という**挙動**を、`services` 広告と組み合わせて全サービス種別・
プロトコル全体(chat を含む)に一般化・昇格したものである。mistai v0.4.0 で `services`/
`code` を実装。tc-mistllm コア実装はこの応答義務自体(chat 以外のメッセージ型を
そもそも実装していない)を含めて未実装だが、chat 以外のリクエストを受け取る経路が無いため
実害はない。mistl は上記の即時応答という挙動自体は本仕様策定以前から備えているが、
`code: "unsupported_service"` フィールドの付与は本稿執筆時点で未実装。いずれの未更新
ピアも、`services` 欠落時は chat 専用とみなす既定のおかげで、consumer 側が `services` を
正しく参照する限り(下記「consumer 側の provider 選択手順」参照)capability 不一致自体が
起こりにくい。

### 広告済みモデルに対する応答規則(`llm_request.model` の named-but-unshared 拒否)

provider が `provider_hello.models` を広告している場合、`llm_request.model` の扱いは
次の規範に従う:

| `model` 指定 | provider が `models[]` を広告している場合 | provider が `models[]` を広告していない場合(レガシー単一上流モード) |
|---|---|---|
| 指定あり・`models[]` の広告値と一致 | 該当する上流モデルへ書き換えて応答する(上記「`models`(広告名 = ラベル規約)」により、広告名と実モデル id が異なる場合は provider が変換する) | 指定された名前をそのまま上流へ転送する(従来互換) |
| 指定あり・`models[]` を広告中だが不一致 | **拒否する**。上流へは転送せず、理由を示すメッセージを付した `llm_error` を返す(例: 「The requested model is not shared by this provider.」)。共有解除したモデルを名前知識だけで使わせないための規則 | (該当なし。左列「広告していない場合」を参照) |
| 指定なし | provider 既定の上流モデルで応答する | provider 既定の上流モデルで応答する(レガシー consumer /「おまかせ」) |

**「`model` 省略 = provider が自分の設定済みモデルで応える」が一般規則である**。

本節は `llm_request.model` に対する規則である。`tts_request`/`stt_request.model` の扱いは
上記「provider の `voice`/`model` 尊重規則」を参照 — TTS/STT の `model` は provider ごとの
単一設定であり、`models[]` のような共有リストに対する named-but-unshared 拒否は行わない
(不一致時は常に provider 自身の設定へフォールバックし、拒否はしない)。

この規則は tc-translate の共有設定実装(`llm-config.md` 参照)で既に運用されている挙動を
一般化・明文化したものである。

### 未知の型の扱い

音声拡張の型を実装しないピア(現状の tc-mistllm コア実装を含む)がこれらの `type` を
受信した場合の挙動は、本ドキュメント冒頭の「概要」に定義済みの一般規則がそのまま適用
される: `type` が未知の値であればメッセージ全体を破棄する(`decode`/`decode_message` は
`null`/`None` を返す。実装ごとの特別扱いは無い)。

これは上記「capability 不一致時の応答義務」(`llm_error`/`voice_error` の
`code: "unsupported_service"` による即時応答)とは別の話であることに注意: 応答義務は
`type` 自体を認識できる(=メッセージ種別としては実装済みの)provider が、広告している
`services` の範囲外のリクエストを受け取った場合の規則。一方 `type` そのものを実装して
いないピア(音声拡張未対応の tc-mistllm コア実装等)は、この一般規則により黙って
メッセージを破棄する — `services` を見て事前に判別できるのが望ましい動作であり
(上記参照)、consumer 側がそれを怠った場合のフォールバックがこの「未知の型は
黙って破棄」という実装依存(implementation-defined)の挙動になる。

## consumer 側の provider 選択手順(参考)

本節は**プロトコルが規定する義務ではなく**、consumer 実装(mistai `ConsumerClient` 等)が
蓄積した `provider_hello` 群から実際にどの provider へリクエストを送るかを決める際の
推奨手順を示す参考情報(informative)。ワイヤ上の受信側の検証・破棄規則、capability
不一致時の応答義務など、これまでの各節が定める規範的な挙動とは性質が異なり、本節の
手順を実装しない consumer がいても(結果としてリクエストが失敗しやすくなるだけで)
ワイヤレベルの相互運用性そのものは損なわれない。

1. consumer はルーム参加中に受信した `provider_hello` を(`services`/`models` を含めて)
   provider ごとに蓄積しておく。`services` が欠落している provider は `["chat"]` を
   広告したものとして扱う(上記「capability 広告」参照)。
2. リクエストのサービス種別(chat/tts/stt/embedding)で、その `services` を広告する
   provider に候補を絞り込む。
3. 上記で絞り込んだ候補のうち、リクエストに `model` 指定があれば `provider_hello.models`
   にその `model` が含まれる provider を優先する。該当する provider が無ければ、
   `models` を広告していない(= モデル一覧不明で対応可否が判断できない)provider へ
   `model` を省略してリクエストを送る。それも無ければ、任意の適格な provider へ
   `model` を指定したまま送り、対応可否の判断は provider 側(および上流エラーの伝播)に
   委ねる。
4. リクエストが `tts_request` で `voice` 指定がある場合、上記で絞り込んだ候補のうち
   `provider_hello.voices` にその `voice` が含まれる provider をさらに優先する。該当する
   provider が無ければ `voices` を広告していない provider へ、それも無ければ任意の適格な
   provider へ送る(`model` の優先規則(上記3)と同型)。
5. 上記で同格の候補が複数残った場合はランダムに選ぶ。
6. 送信先が切断/タイムアウト/`unsupported_service`(`llm_error`/`voice_error` の
   `code`)のいずれかで応答した場合、次点の候補へ**1回だけ**フェイルオーバーする
   (2回目の失敗はリクエスト全体の失敗として扱う)。

なお、`tts_request` を送る consumer はテキストの言語が判明している場合、上記の provider
選択手順とは別に `lang` を付与する**べきである(SHOULD)**(provider 側の voice 自動選択に
資する。上記「provider の `lang` 尊重規則」参照)。

`ModelPresetV1.model`(llm-config の解決済み preset)を `llm_request.model` に載せる際の
扱いは [llm-config.md](llm-config.md) の「mistllm-wire への橋渡し」を参照。

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
  追加しても `v` は `1` のまま据え置く(`llm_response_chunk.seq`、および
  `provider_hello.services`/`provider_hello.voices`/`llm_error.code`/`voice_error.code`/
  `tts_request.lang` はいずれもこのパターンの実例)。受信側は未知フィールドを無視し、
  欠落フィールドにはデフォルト値(`seq` なら「並べ替えなしで即時適用」、`services` なら
  `["chat"]`、`voices` なら「voice 広告なし」、`lang` なら「言語ヒントなし(従来の
  デフォルト解決)」)を当てる実装にすること。
- **メッセージ種別の追加**も `v: 1` のまま可能。未知の `type` を受信した側はメッセージ
  全体を破棄する(エラーにはしない)。
- 必須フィールドの削除・型変更・意味変更など、真に破壊的な変更を行う場合は
  `v` をインクリメントすること(tc-protocol 全体の
  [スキーマ進化ルール](conventions.md#スキーマ進化ルール)に準じる)。
