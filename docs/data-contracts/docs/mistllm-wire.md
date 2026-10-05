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
(`protocol.ts`/`protocol.rs`)および更新前の mistl はこれらを未実装だが、`services`
欠落時は `["chat"]` を広告したものとみなす既定の後方互換ルールにより、更新前のピアとも
相互運用できる。

## 概要

- 全メッセージは `v: 1` の JSON オブジェクトで、UTF-8 バイト列にエンコードして
  mistlib の `sendMessage`/`send_message` に渡す。
- `v` が `1` でない、または `type` が未知の値であれば、メッセージ全体を破棄する
  (`decode`/`decode_message` は `null`/`None` を返す)。
- ロール(`ChatMessage.role`)は `"system" | "user" | "assistant"` の3値を基本とし、
  `"tools"` capability を広告する provider に対してのみ `"tool"` も許可する。

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
| `models` | `string[]`(`provider_hello` のみ) | 任意 | そのルームで明示的に共有するモデルの生 id。上流の `GET /models` の結果全体を自動公開しない。consumer はモデル選択に反映する。広告・省略時の扱いは下記「`models`(広告名 = 生モデル id)」参照 |
| `services` | `string[]`(`provider_hello` のみ) | 任意 | provider が提供するサービス種別の広告(capability 広告)。既知値は `"chat"` \| `"tts"` \| `"stt"` \| `"embedding"` \| `"tools"`。services 広告は mistai v0.4.0 で実装。フィールド省略時の意味論は下記参照 |
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

#### `models`(広告名 = 生モデル id)

2026-10-04 の provider/room 統合以降、広告名は**生のモデル id**とする。
provider/preset の label を広告名にする旧規約は退役する。共有対象は
`ModelRefV1 {providerId, model}`(ネイティブでは `{provider_id, model}`)の順序付きリスト。
provider はそのルームで明示的に共有した、有効な HTTP provider の ref の `model` のみを
`models[]` に載せる。同じ id が複数 ref にあれば広告は重複を除き、受信時はリスト順で
最初の ref の HTTP provider が担当する。model 文字列は上流へそのまま渡し、label 変換はしない。

上流エンドポイント(`GET /models` 等)から取得したカタログを、共有選択を経ずにそのまま
広告してはならない。共有 ref が一つもなければ `models` フィールドを省略する。
省略は従来どおり「一覧不明」であり、consumer はこれを閉じた空のカタログと解釈しない。
Room で発見したモデルを別の Room へ再共有してはならない(ループ防止)。

**提供はルームごと**に ON/OFF と shared refs を持つ。web ではアプリローカル、mistl では
Room provider の provide/shared に保存する([llm-config.md](llm-config.md) 参照)。
提供 ON かつ有効な Room のみに参加・広告し、そのルームの共有リストだけで受信を解決する。
別のルームの共有リストで要求を満たしてはならない。停止/無効化ではそのルームへの提供を
止めるが、保存済みリストは保持する。単一の legacy network.roomId/global 提供フラグを
現行の状態源にはしない。`services` の形状・既定・capability 規則は変更しない。

共有 ref の追加・削除・入れ替え、または HTTP provider の有効状態変更で提供内容が変わる
場合、provider はそのルームの接続を維持したまま `provider_hello` を同ルームの全ピアへ
再送する**べきである(SHOULD)**。最後の共有を解除した再送では `models` を省略する。
consumer は同じルーム/ピアの古い広告を置き換え、provider table・UI・Room provider の
モデルキャッシュを更新する(古いモデルを累積し続けない)。順序だけの変更でも同名 id の
担当が変わりうるため、受信解決も直ちに更新する。

**旧ピアとの互換**: 更新前の provider は preset label(空ならモデル id)を不透明な
ルーティングキーとして広告することがある。consumer は受け取った文字列をそのピアへ
そのまま返してよく、旧 provider 側が label を実 id へ変換する。ワイヤは `v: 1` と
`string[]` のままで、label/raw id を識別する新フィールドはない。旧ラベルと新しい生 id を
同一モデルとして推測・統合しない。新 provider は旧ラベルを別名として自動受理せず、
下記の共有 ref による解決規則に従う。

#### `services`(capability 広告)

- 値が `"chat"`/`"tts"`/`"stt"`/`"embedding"`/`"tools"` のいずれでもない未知の文字列は、無視せず
  そのまま素通しする(将来のサービス種別追加に備えた前方互換。consumer 側は認識できない
  値を単に無視すればよい)。

**`services` フィールド自体が欠落している `provider_hello` は `["chat"]` を広告したものと
みなす**。services 拡張以前の provider(tc-mistllm コア実装・mistl など、更新前のピア)は
チャット専用として扱われる。音声(tts/stt)や embedding を提供する provider は `services`
を明示しなければ consumer から発見されない。

`"tools"` は `"chat"` と併せて広告する tool calling の capability であり、provider が
下記の optional tool フィールドを受け付け、応答に `tool_calls` を返せることを表す。
mistl provider は `"chat"` を広告するとき常に `"tools"` も広告する。
consumer は `"tools"` を広告しない provider に、リクエストの `tools`/`tool_choice`、
または `role: "tool"`/`tool_calls`/`tool_call_id` を含む message を
**送信してはならない(MUST NOT)**。`services` 欠落時の `["chat"]` は tools 対応を
意味しないため、旧ピアには新しい tool フィールドが届かない。

#### `voices`(capability 広告)

`services` に `"tts"` を広告する provider のみが `voices` を広告してよい。一覧は provider が
自身の TTS 上流から取得する(取得できない場合はフィールド自体を省略する — 空配列とは
区別する)。

- 各要素は `tts_request.voice` にそのまま指定できる**実 id**を広告する。
  model と同様に label への変換は不要で、voice は受信値をそのまま上流へ渡す。
- 広告は最大 **64 件**を推奨する(hello の JSON サイズを mist の安全上限(~16KB)内に
  収めるため)。上流が多数の voice を持つ場合は先頭 64 件に切り詰めてよく、切り詰めた
  事実自体はワイヤ上に表現しない。
- provider の TTS 設定変更で一覧が変わった場合、provider は `provider_hello` を再送して
  よい(hello 再送の契機・実装はこの規約自体が定めるものではなく、consumer/provider
  実装側の合意事項)。`models` の共有リスト変更時は同じ再送がより強い規範(SHOULD)
  として定められている — 上記「`models`(広告名 = 生モデル id)」参照。
- mistai v0.6.0 で実装。

### `llm_request`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"llm_request"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | リクエストID。以降の応答はこの `id` で相関付けられる |
| `messages` | `ChatMessage[]`(非空配列) | 必須 | チャット履歴。空配列は不正 |
| `model` | `string` | 任意 | 生モデル id。省略/空文字は下記の既定解決 |
| `tools` | JSON 配列 | 任意 | OpenAI `tools` 形状の tool 定義。そのまま上流へ渡す(`"tools"` capability が必要) |
| `tool_choice` | JSON 文字列またはオブジェクト | 任意 | OpenAI `tool_choice` をそのまま上流へ渡す(`"tools"` capability が必要) |
| `reasoning_effort` | `string` | 任意 | 依頼側タスクの推論の強さ(既知値は `none` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max`)。指定値は provider 自身の既定より優先して上流の `reasoning_effort` へ渡す。省略時は provider の既定を使い、既定も未設定なら上流へ送らない。未知の文字列値も素通しする。理解しない旧 provider は無視してよい(後方互換) |

`reasoning_effort` が文字列でない場合はこの**フィールドのみ**を無視し、必須フィールドが
揃っていれば `llm_request` 自体は受理する。未知の文字列値は前方互換のためそのまま渡す。
`none` は明示的な送信値であり、省略(未設定)とは異なる。mistl provider の既定タスク
effort は `ai.default_reasoning_effort` である([llm-config.md](llm-config.md) 参照)。

`ChatMessage` の基本形は `{ role: "system" | "user" | "assistant", content: string }`。
tools 拡張では次のフィールドを使用できる(optional フィールドは無い場合に省略する):

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `role` | `"system"` \| `"user"` \| `"assistant"` \| `"tool"` | 必須 | `"tool"` は `"tools"` capability を広告する provider に対してのみ使用できる |
| `content` | `string` | 必須 | メッセージ本文。tool 呼び出しのみの assistant ターンの OpenAI `content: null` はワイヤ上では `""` にエンコードする |
| `tool_calls` | JSON 配列(assistant のみ) | 任意 | OpenAI 形状の tool 呼び出しをそのまま渡す(`"tools"` capability が必要) |
| `tool_call_id` | `string`(tool のみ) | 任意 | tool の結果に対応する呼び出し id(`"tools"` capability が必要) |

`messages` の各要素がこの形を満たさない場合、メッセージ全体を拒否する。
`content` は引き続きワイヤ上では文字列であり、`null` は送らない。tool 呼び出しの形状・
上限は下記「tools 拡張」参照。

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
| `tool_calls` | JSON 配列 | 任意 | 応答の完全な、マージ済み tool 呼び出し(OpenAI 非ストリーミング形状)。無い場合は省略する |

`content` は **authoritative**(正)。存在する場合、受信側は `llm_response_chunk` を
積み上げて構築した文字列ではなく `content` を最終結果として採用しなければならない
(chunk 側にバッファ待ちの断片が残っていてもこれで確定させてよい)。`content` が
無い場合のみ、chunk の delta を順序どおり連結した文字列にフォールバックする。

`tool_calls` は `llm_response_done` でまとめて返す。`llm_response_chunk` では tool 呼び出しを
ストリーミングせず、従来どおりテキストの delta のみを運ぶ。tool 呼び出しのみの応答でも、
`content` を送る場合は `""` とし、`null` は送らない。

### `llm_error`

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `v` | `1` | 必須 | プロトコルバージョン |
| `type` | `"llm_error"` | 必須 | メッセージ種別 |
| `id` | `string`(非空) | 必須 | 対応する `llm_request.id` |
| `message` | `string` | 必須 | エラー内容 |
| `code` | `string` | 任意 | 機械可読のエラー理由コード。既知値は `"unsupported_service"`(サービス非対応)と `"model_not_shared"`(そのルームで要求モデルを共有していない)。詳細は下記の応答規則。code 拡張は mistai v0.4.0 で実装 |

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

## tools 拡張 (Tools extension)

OpenAI function/tool calling を同じ `v: 1` の既存メッセージ上で運ぶ optional 拡張。
送信先は上記「`services`(capability 広告)」の規則に従い、`"chat"` と `"tools"` を
広告する provider に限定する。新しいメッセージ種別やプロトコルバージョンは追加しない。

message の `tool_calls` と `llm_response_done.tool_calls` は、次の OpenAI 形状を用いる:

```json
[{"id":"call-1","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"Tokyo\"}"}}]
```

`id`・`type`・`function.name`・`function.arguments` を含めてそのまま渡す。
`function.arguments` は JSON オブジェクトではなく、**JSON エンコードされた文字列**。
done に載せる値は上流から受け取った断片をマージした完全な呼び出しである。

受信側は次の上限を検証し、超過したリクエストは `llm_error` で拒否する:

- `tools` は最大 **128 件**、シリアライズ後のサイズは **256 KiB 以下**。
- 1 message あたりの `tool_calls` は最大 **128 件**。
- 既存のメッセージ数・サイズの上限も引き続き適用する。

mistl のローカル OpenAI 互換 API は、OpenAI tool calling をこの拡張へマッピングする。

### JSON 交換例

以下の配列は交換順を示す例であり、ワイヤでは各要素を個別の JSON メッセージとして送る。
provider の広告 → 初回リクエスト → tool 呼び出しの完了通知 → tool 結果を含む後続リクエスト
の順。assistant 履歴の `content: ""` は OpenAI の `content: null` に対応する。

```json
[
  {
    "v": 1,
    "type": "provider_hello",
    "services": ["chat", "tools"]
  },
  {
    "v": 1,
    "type": "llm_request",
    "id": "req-1",
    "messages": [{"role": "user", "content": "東京の天気を教えて。"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "指定した都市の天気を取得する",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }],
    "tool_choice": "auto"
  },
  {
    "v": 1,
    "type": "llm_response_done",
    "id": "req-1",
    "content": "",
    "tool_calls": [{
      "id": "call-1",
      "type": "function",
      "function": {"name": "get_weather", "arguments": "{\"city\":\"Tokyo\"}"}
    }]
  },
  {
    "v": 1,
    "type": "llm_request",
    "id": "req-2",
    "messages": [
      {"role": "user", "content": "東京の天気を教えて。"},
      {
        "role": "assistant",
        "content": "",
        "tool_calls": [{
          "id": "call-1",
          "type": "function",
          "function": {"name": "get_weather", "arguments": "{\"city\":\"Tokyo\"}"}
        }]
      },
      {"role": "tool", "content": "{\"weather\":\"晴れ\"}", "tool_call_id": "call-1"}
    ]
  }
]
```

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
| `speed` | `number`(有限値、0.25 以上 4.0 以下、`tts_request` のみ) | 任意 | 再生速度のヒント(OpenAI `/audio/speech` の `speed`)。範囲外・非数値・非有限値はこのフィールドのみを無視する |
| `response_format` | `string`(`tts_request` のみ) | 任意 | 希望する音声コンテナ(OpenAI 名: `mp3` / `opus` / `aac` / `flac` / `wav` / `pcm`)。未知の値はこのフィールドのみを無視する |
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

`speed` / `response_format` も同じ防御的パースの対象である: `speed` は数値かつ有限値で
0.25 以上 4.0 以下の場合だけ採用する。数値文字列への型変換や範囲内への丸めは行わない。
`response_format` は上記6値のいずれかと完全一致する文字列の場合だけ採用する。非文字列・
空文字列・未知の値は無視する。いずれも不正な**フィールドのみ**を無視し、必須フィールドが
揃っていれば `tts_request` 自体は受理する。optional フィールド追加なので `v: 1` を維持し、
理解しない旧 provider は無視してよい。欠落時の扱いは下記の規則に従う。

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

`models` は現在は生 id の広告だが、chat 用の共有モデルリストであり、TTS/STT の受理モデル
一覧ではない。音声は引き続き provider 自身の設定済みモデルを使うこの規則に従う。
consumer のルーム別「おまかせ」(`network-auto`)はローカル設定の sentinel であり、
wire では `model` を省略する([llm-config.md](llm-config.md) 参照)。sentinel 自体は送らない。

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

#### provider / consumer の `speed` / `response_format` 規則

| フィールド | provider の指定あり時の扱い | 省略時の扱い |
|---|---|---|
| `speed` | 検証済みの指定値を上流の音声合成呼び出しへ渡す(provider 自身の既定より優先) | provider の既定を使う。mistl は `ai.tts.speed` が設定されていればそれを使い、未設定なら上流の既定を使う |
| `response_format` | 検証済みの指定値を上流の音声合成呼び出しへ渡す | provider / 上流の既定の音声形式を使う |

上流 / バックエンドが `response_format` に対応できない場合も合成を行い、**実際に返す
音声の形式**を `tts_response.mime` に載せる。consumer は要求した形式ではなく
**`tts_response.mime` を正として扱わなければならない(MUST)**(trust `tts_response.mime`)。
チャンク受信時は上記の通り最初のチャンクの `mime` を採用する。

consumer は共有音声設定の `tts.speed`(`VoiceConfigV1`、[llm-config.md](llm-config.md))、
または呼び出し側のオプションから `tts_request.speed` を送る。呼び出し側の指定があれば
そちらを優先し、どちらも未設定なら省略する。`response_format` は呼び出し側が明示的に
要求した場合だけ送る(共有音声設定には保存しない)。

mistai v0.10.0 の consumer API(`requestRoomTts` / `VoiceConsumerService`)では
`{speed, responseFormat}` を受け付け、wire では `speed` / `response_format` に対応させる。
provider の合成関数には既存の位置引数を維持したまま、末尾に一つの options オブジェクト
`{speed?: number; responseFormat?: string}` を追加して渡す。mistl の `ai serve`
`/v1/audio/speech` も body の `speed` / `response_format` を転送し、Room 経由でも同じ
`tts_request` フィールドで運ぶ。

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

provider/room 統合後の provider は、受信した**そのルームの**設定済み shared refs を
使って解決する。古い hello や別のルームのリストを許可判定に使わない。有効な HTTP
provider へ `resolveModelExact` で解決できる ref だけを提供可能な候補とする。

| `llm_request.model` | 解決・応答 |
|---|---|
| 非空で、提供可能な shared ref の model と完全一致 | リスト順で最初の一致 ref の HTTP provider で応答する。model は生 id のまま上流へ渡す |
| 非空で一致せず、設定済み shared リストが非空 | **拒否する(MUST)**。上流へ転送せず、同じ id の `llm_error` に `code: "model_not_shared"` と理由の message を付ける。共有 ref がすべて無効でもこの拒否を行う |
| 省略または空文字 `""` | defaultModel が有効な HTTP provider へ解決できればそれを使い、そうでなければこのルームの最初の提供可能な shared ref を使う。defaultModel が Room なら中継しない |
| 非空で shared リストが空 | `model_not_shared` の対象外。統合後の provider は上記の空 model と同じ既定解決を使う(要求名を未知の上流へ転送しない) |

既定解決でも候補がなければ `llm_error` で設定/利用不能のエラーを返す。任意の先頭
provider/preset や他のルームへフォールバックしない。defaultModel は共有リストに載って
いなくても空 model の要求に使えるが、非空の unshared 要求を既定へ逃がしてはならない。
設定済み ref とその順序は実行時解決で書き換えない。

互換注記: 統合前の単一上流 provider が models を省略している場合は、従来どおり非空の
要求名をそのまま上流へ転送する実装もある。旧 label 広告への要求は旧 provider 側が変換
する(上記互換注記)。空 model を扱う新規則により、旧 consumer の「おまかせ」も利用できる。

HTTP 上流への生成リクエストに temperature を付けない。

**reasoning effort**(2026-10-04 追加): consumer は依頼タスクの推論の強さを `llm_request.reasoning_effort`
で送る。未設定なら省略し、`none` は明示値として送る。provider は指定された文字列を
自身の既定より優先して上流へ渡す(未知の文字列値も素通し)。省略時は自身の既定
(mistl は `ai.default_reasoning_effort`)を使い、既定も未設定なら上流へ送らない。
非文字列はフィールドのみを無視する(上記 `llm_request` 参照)。ストリーミングはそのまま。
ルーム経由の**チャットは常に `llm_request`** を使い、effort を運ぶために oai トンネルへ迂回しない。
oai トンネルは `llm_request` で運べないもの(画像 content part を含む vision/OCR、`/models`、`/embeddings`)専用とする
(`ChatMessage.content` はワイヤ上で文字列のため)。

本節は `llm_request.model` に対する規則である。`tts_request`/`stt_request.model` の扱いは
上記「provider の `voice`/`model` 尊重規則」を参照 — TTS/STT の `model` は provider ごとの
単一設定であり、`models[]` のような共有リストに対する named-but-unshared 拒否は行わない
(不一致時は常に provider 自身の設定へフォールバックし、拒否はしない)。

この規則は受信時の共有 ref 解決に適用する。services/capability の既存の検証は引き続き
独立して適用する。

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
   provider に候補を絞り込む。tool フィールドを使用する chat リクエストは、上記の
   送信禁止規則に従い `"tools"` も広告する provider に限定する。
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

`ModelRefV1.model`(llm-config の解決済みモデル参照)を `llm_request.model` に載せる際の
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
  `llm_request.reasoning_effort`/`tts_request.lang`/`tts_request.speed`/
  `tts_request.response_format` はいずれもこのパターンの実例)。受信側は未知フィールドを無視し、
  欠落フィールドにはデフォルト値(`seq` なら「並べ替えなしで即時適用」、`services` なら
  `["chat"]`、`voices` なら「voice 広告なし」、`lang` なら「言語ヒントなし(従来の
  デフォルト解決)」、`reasoning_effort` なら「provider の既定(未設定なら上流へ送らない)」、
  `speed` なら「provider の既定(mistl は `ai.tts.speed`、未設定なら上流の既定)」、
  `response_format` なら「provider / 上流の既定の音声形式」)を当てる実装にすること。
- **メッセージ種別の追加**も `v: 1` のまま可能。未知の `type` を受信した側はメッセージ
  全体を破棄する(エラーにはしない)。
- **tools 拡張も `v: 1` のまま**: `tools`/`tool_choice`/`tool_calls`/`tool_call_id` は
  optional で、無い場合は省略し、従来のテキストチャットとして扱う。`role: "tool"` を
  含む tool フィールドは `"tools"` を広告する provider にのみ送るため、更新前のピアにも
  後方互換を保つ。`content` のワイヤ型は文字列のまま変えない。
- 必須フィールドの削除・型変更・意味変更など、真に破壊的な変更を行う場合は
  `v` をインクリメントすること(tc-protocol 全体の
  [スキーマ進化ルール](conventions.md#スキーマ進化ルール)に準じる)。
