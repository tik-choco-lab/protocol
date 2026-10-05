# 共有LLM設定(llmConfig)仕様

LLM/TTS/STT の接続設定(エンドポイント・APIキー)を、同一オリジンで動く tik-choco
ファミリー全アプリで**一度だけ**設定すれば済むようにするための、軽量・依存なしの契約。
[did-identity.md](did-identity.md) が採用している「共有キー」方式(アプリ名プレフィックスなし、
参加アプリ全員が読み書きする co-owned なキー)を LLM 接続設定にも適用したもの。

2026-10-04 の provider/room 統合では、モデル選択を preset から `{providerId, model}`
へ移す。Room も通常の provider として扱う。キーと `v: 1` は変えず、追加フィールドは
すべて optional とする。旧アプリとの共存のため、legacy フィールドは削除せず保持する。

## 共有キー

| キー | ストレージ | スキーマ |
|---|---|---|
| `tc-shared-llm-config-v1` | localStorage(アプリ名プレフィックスなし) | `SharedLlmConfigV1`(下記) |

[conventions.md](conventions.md) の `tc-shared-<name>` 形式に従う。所有者は共有であり、
参加アプリは全員このキーを読み書きしてよい(同一オリジンの相互信頼を前提とする)。

## スキーマ

```ts
type LlmProviderV1 = {
  id: string;
  label: string;
  baseUrl: string;           // HTTP URL または mist-network://<roomId>
  apiKey: string;            // Room は ""
  enabled?: boolean;        // 欠落 = true
  models?: string[];        // 最後に取得したモデル id のキャッシュ
  modelsFetchedAt?: string; // ISO 8601、取得成功時刻
};

type ModelRefV1 = { providerId: string; model: string };

// Deprecated: migration input only; new writers preserve unchanged.
type ModelPresetV1 = {
  id: string;
  label: string;
  providerId: string;
  model: string;
  temperature?: number;
  reasoningEffort?: string;
};

type VoiceConfigV1 = {
  providerId?: string;
  model: string;
  voice?: string;
  speed?: number;            // TTS: tts_request.speed (有限値、0.25..4.0)
};

type SharedLlmConfigV1 = {
  v: 1;
  providers: LlmProviderV1[];
  defaultModel?: ModelRefV1;    // defaultPresetId の後継
  presets: ModelPresetV1[];    // deprecated、変更せず書き戻す
  defaultPresetId: string;     // deprecated、変更せず書き戻す
  tts?: VoiceConfigV1;
  stt?: VoiceConfigV1;
  network: { roomId: string }; // deprecated、変更せず書き戻す
  updatedAt: string;           // ISO 8601、LWW 用
};

type ResolvedLlmTargetV1 = ModelRefV1 & {
  label: string;               // provider の label
  baseUrl: string;
  apiKey: string;
};
```

- **`providers`**: 接続先とモデルカタログ。APIキーは provider に一箇所だけ保持する。
  同じモデル id でも provider が異なれば別のモデル参照である。
- **`defaultModel`**: 既定のモデル参照。欠落は未設定。モデルキャッシュに載っていなくても
  参照は保持できる(キャッシュは利用許可のリストではない)。
- **`tts`/`stt`**: 形状は従来どおり。独自の接続情報は持たず、provider を参照する。
- **`presets`/`defaultPresetId`/`network`**: deprecated な移行元。新コードは選択・提供・
  ルーム管理の保存先に使わず、読み込んだ値を**変更せずに書き戻す(MUST)**。
  `defaultModel` を変えても対応 preset の作成や `defaultPresetId` の追従は行わない。
  旧 reader はこれらを必須とするため、省略すると設定全体を無効扱いする。
  新規設定でも `presets: []`, `defaultPresetId: ""`, `network: {roomId: ""}` を含める。
  壊れた入力に対する防御的パースは後述。

## HTTP / Room provider

HTTP provider は `baseUrl` + `apiKey` で上流を呼ぶ。Room provider は
`baseUrl: "mist-network://<roomId>"`, `apiKey: ""` として同じ `providers[]` に格納する。
既存の疑似プロバイダ行もそのまま Room provider と解釈し、id・label・参照を保持する。
単一の `network.roomId` に依存せず、複数のルームを同時に使い分けられる。
同じ roomId の追加では既存行を再利用し、重複する Room provider を作らない。

`enabled` 欠落は `true`。`false` は削除ではなく、接続と参照を保持したまま無効化する。
無効な provider はモデル候補に出さず、モデル一覧を取得しない。無効な Room は join
せず、提供もしない。タスク・既定・音声の参照を別の provider/model に書き換えては
ならない。UI は無効な参照に警告を示し、再有効化で元の参照を再利用できるようにする。

Room consumer は、有効かつタスク/既定/TTS/STT が参照中、または提供 ON のルームには
参加を維持する。それ以外の有効なルームは、設定画面やピッカーを開いたときに必要に
応じて参加し、広告を取得する。あるルームへの接続が別のルームのセッションを置き換えない。

## モデルカタログ

HTTP は `GET /models`、Room はそのルームの live な `provider_hello.models` から取得する。
ネットワークモデルを preset として共有設定へミラーしない。Room の live な広告と
`providers[].models` のキャッシュだけを使う。現在の広告にないキャッシュ項目は古い情報と
分かる表示にする。

設定画面・モデルピッカー・共有チェックリストを開いたら、キャッシュを即表示し、有効な
provider を裏で再検証する。追加、baseUrl/apiKey/roomId 編集の確定、再有効化では直ちに
取得する。取得は provider ごとに同時に1本へまとめ、前回成功から10秒未満の通常再検証は
省略する。何も開いていない間の定期ポーリングや手動更新ボタンは不要。

取得成功時は `models` と `modelsFetchedAt` を更新し、失敗時は以前のキャッシュと成功時刻を
保持する。Room 参加中の hello 再送も live な一覧へ反映する。広告を共有可否の変更に
追従させる規則は [mistllm-wire.md](mistllm-wire.md) を参照。

## 解決規則

- **`resolveModelExact(config, ref?)`**: model が空白のみ、provider が存在しない、
  `enabled === false`、baseUrl が空白のみなら `null`。それ以外は ref と接続情報を返す。
  label は provider の値。キャッシュへの掲載は必須条件ではない。既定へのフォールバックは
  行わず、ルームの共有リスト解決にもこの関数を使う。
- **`resolveModel(config, ref?)`**: 指定 ref が利用可能ならそれを使い、未指定/利用不能なら
  利用可能な `defaultModel` だけにフォールバックする。どちらも利用不能なら `null`。
  `providers[0]` や `presets[0]` は選ばず、保存済み参照は書き換えない。
- **`resolveVoice(config, kind)`**: `config[kind]` がない、または model が空なら `null`。
  providerId が省略されていれば `defaultModel.providerId` と音声設定の model を組にする。
  その ref を `resolveModel` で解決し、voice/speed を付ける。明示した provider が無効な
  場合も既定への実行時フォールバックだけを行い、保存済み音声設定は変更しない。

解決不能は例外ではなく `null`。呼び出し側は設定エラーとして扱う。

## 音声のルーム別「おまかせ」

TTS/STT のブラウザ標準を選ぶと共有音声設定をクリアする。有効な Room ごとの「おまかせ」は
`{providerId: <その Room provider の id>, model: "network-auto"}` として保存する。
`NETWORK_VOICE_AUTO_MODEL` はこの sentinel。チャットモデルとして使わず、広告にも載せない。
Room への TTS/STT 送信時、`networkVoiceModelParam` で sentinel/空文字を `undefined` に変換し、
wire の `model` を**省略**する。選んだルームの provider が自身の音声モデルで応答する。
通常の音声 model id はそのまま渡す。voice/speed の共有スキーマは変更しない。

## mistllm-wire への橋渡し

Room を指す解決済み `ModelRefV1.model` は、生のモデル id として `llm_request.model` に
載せる。preset label への変換はしない。どのピアが対応するかは、そのルーム内の広告と
[mistllm-wire.md](mistllm-wire.md) の選択・受信規則で扱う。

**temperature は使用しない**。旧 preset の `temperature` は互換保存だけのために残し、
HTTP/ネットワークいずれの生成リクエストにも `temperature` を送らない(上流の既定を使う)。
reasoning effort は共有モデル参照に含めず、タスクごとのアプリローカル設定に保持する。
HTTP では上流の `reasoning_effort`、Room では optional な `llm_request.reasoning_effort`
で運ぶ。wire は `v: 1` のままで、リクエストの指定値が provider の既定より優先する。
未設定なら省略し、`none` は明示値として送る。

Room の TTS では共有音声設定の `tts.speed` を `tts_request.speed` へ対応させる。呼び出し側の
speed オプションがあればそちらを優先し、有限値かつ 0.25 以上 4.0 以下の数値だけを送る。
未設定 / 不正な値は省略し、provider の既定(mistl は `ai.tts.speed`、未設定なら上流の既定)
に従う。`tts_request.response_format` は呼び出し側が明示的に要求した場合だけ送り、
共有音声設定には追加しない。要求した形式を実際の音声形式とみなさず、応答の
`tts_response.mime` を正として扱う([mistllm-wire.md](mistllm-wire.md) 参照)。

## マイグレーション規則

読み込み時に一度だけ、冪等に実行する。共有データとアプリローカルデータは別々に移行し、
**実際に変更があったときだけ保存**する。`migrateSharedLlmConfig` は config を変更して
`{changed}` を返すだけで、保存やネットワーク接続は呼び出し側が行う。

1. `defaultModel` がない場合だけ、`defaultPresetId` と一致する preset の
   `{providerId, model}` をコピーする。既存の `defaultModel` を上書きしない。
2. legacy `network.roomId` が空でなければ `mist-network://<roomId>` の provider を
   再利用し、なければ label = roomId、apiKey = "" の Room provider を追加する。
   既存 Room 行は無効なものも含めてそのまま保持する。
3. HTTP provider に属する旧 preset の手動登録 model を `models` キャッシュへ重複なしで
   取り込む。実取得ではないため `modelsFetchedAt` は更新しない。アプリは移行完了を
   ローカルに記録し、後の live 取得で消えた旧 model を読み込みごとに復活させない。
4. Room provider に属する旧ミラー preset はカタログ移行では無視する。削除やミラー再生成は
   行わない。既定/タスクの既存参照を移すための lookup は可能だが、live 広告から選び直せる。
5. アプリローカルのタスク preset id は `presetIdToRef(config, presetId)` で ref に変換する。
   タスクに reasoning effort があれば保持し、未設定なら旧 preset の `reasoningEffort` を
   引き継ぐ。存在しない preset への参照から別の preset を勝手に選ばない。
6. アプリローカルの共有 preset id 配列は、legacy `network.roomId` の Room provider id を
   キーとする `roomProvide[id].shared` に変換する。HTTP provider の ref のみ対象とし、
   順序を保持する。旧 `networkProviderEnabled` は同ルームの `enabled`(提供フラグ)へ移す。
   すでに移行済みのローカル設定は上書きしない。
7. `presets`/`defaultPresetId`/`network` は全段階で変更せず書き戻す。

各アプリのさらに古い接続情報を取り込む場合も merge-never-delete に従う。
`loadLlmConfig() ?? emptyLlmConfig()` に `ensureProvider` で接続を追加/再利用し、model を
ref/cache へ取り込む。defaultModel/tts/stt は未設定のときだけ補う。旧 shared フィールドへ
新しい preset や roomId を書き込まない。

## アプリローカル層

```ts
type TaskModelV1 = { ref?: ModelRefV1; reasoningEffort: string };
type RoomProvideV1 = { enabled: boolean; shared: ModelRefV1[] };
// tasks: Record<taskId, TaskModelV1>
// roomProvide: Record<roomProviderId, RoomProvideV1>
// recentModels: ModelRefV1[] (max 8)
```

ref 欠落のタスクは `defaultModel` に従う。reasoning effort の値は
`none | minimal | low | medium | high | xhigh | max`。`none` は明示的な送信値であり、
未設定とは異なる。これらと最近使ったモデルはアプリローカルに保存する。

提供 ON/OFF と共有リストも**ルームごと・アプリローカル**。共有キーへ保存すると同一
オリジンの全タブが提供を始めてしまうため、この共有スキーマには追加しない。提供するのは
有効な Room の提供フラグが ON の場合だけで、共有できるのは有効な HTTP provider の
モデルだけ。Room から Room への再共有は禁止する(ループ防止)。提供停止/Room 無効化でも
共有リストは保持する。旧アプリ別キーカタログに残る preset id はこの移行の入力を示す。

## LWW(last-write-wins)

`saveLlmConfig` は `updatedAt` を現在時刻へ更新する。後から保存した内容が勝つ。
クロスタブ/クロスアプリ通知は `storage` イベント(`subscribeLlmConfig`)で受け取り、
BroadcastChannel は併用しない。変更のない移行では保存せず LWW の時刻を動かさない。

## 信頼境界 / appManifest

同一オリジンのアプリ同士は相互に信頼する。localStorage 内の apiKey は従来どおり平文で
あり、共有化はアクセス制御や真正性を提供しない。共有キーは特定アプリの専有キーでは
ないため、[app-manifest.md](app-manifest.md) の `AppManifestV1.reads` には載せない
([did-identity.md](did-identity.md) と同じ扱い)。

## reference 実装 / vendor 運用

参照実装は [llmConfig.ts](../reference/llmConfig.ts) / [llmConfig.js](../reference/llmConfig.js)。
この repo 自体はランタイム npm 依存を提供しない。vendor 配布先は
`scripts/sync-vendored.mjs` の `APPS` テーブルを参照する。全アプリ向けの正本には
アプリ名置換はない。mistai v0.9.0 の `@tik-choco/mistai/llm-config` もこの契約に従う。

```ts
function emptyLlmConfig(): SharedLlmConfigV1;
function loadLlmConfig(): SharedLlmConfigV1 | null;
function saveLlmConfig(config: SharedLlmConfigV1): void;
function subscribeLlmConfig(cb: (config: SharedLlmConfigV1 | null) => void): () => void;
function normalizeBaseUrl(url: string): string;
function isModelRef(value: unknown): value is ModelRefV1;
function resolveModelExact(config: SharedLlmConfigV1, ref?: ModelRefV1): ResolvedLlmTargetV1 | null;
function resolveModel(config: SharedLlmConfigV1, ref?: ModelRefV1): ResolvedLlmTargetV1 | null;
function resolveVoice(config: SharedLlmConfigV1, kind: "tts" | "stt"): (ResolvedLlmTargetV1 & {voice?: string; speed?: number}) | null;
function providerKind(provider: LlmProviderV1): "http" | "room";
function isNetworkProviderBaseUrl(baseUrl: string): boolean;
function networkProviderBaseUrl(roomId: string): string;
function roomIdFromBaseUrl(baseUrl: string): string;
function networkVoiceModelParam(model: string): string | undefined;
function ensureProvider(config: SharedLlmConfigV1, input: {label?: string; baseUrl: string; apiKey: string}): string;
function createProvider(config: SharedLlmConfigV1, label: string): string;
function createRoomProvider(config: SharedLlmConfigV1, input: {roomId: string; label?: string}): {id: string; existed: boolean};
function patchProvider(config: SharedLlmConfigV1, id: string, patch: Partial<Omit<LlmProviderV1, "id">>): void;
function deleteProvider(config: SharedLlmConfigV1, id: string): void;
function setDefaultModel(config: SharedLlmConfigV1, ref?: ModelRefV1): void;
function setVoiceConfig(config: SharedLlmConfigV1, kind: "tts" | "stt", next?: VoiceConfigV1): void;
function migrateSharedLlmConfig(config: SharedLlmConfigV1): {changed: boolean};
function presetIdToRef(config: SharedLlmConfigV1, presetId: string): ModelRefV1 | undefined;
```

`ensurePreset`/`resolvePreset` は現行 API から退役する。preset は移行 lookup に限る。
load はキー不在・不正 JSON・必須 v1 フィールドの欠落/型不一致なら `null`。壊れた
providers/presets の要素は個別に除外し、壊れた optional defaultModel/tts/stt は無視する。
正常な legacy 値はそのまま保持する。save はストレージ失敗を warn し、例外を投げない。
CRUD/移行 helper は config を変更するだけで、自動保存しない。Room 作成 UI は空の roomId を
拒否する。`networkProviderBaseUrl("")` は旧 helper 互換の `mist-network://default` を返す。

## バージョニング方針

今回の追加は optional なのでキーと `v: 1` を維持する。旧 reader が必要とする legacy
フィールドを落とさない。将来の破壊的スキーマ変更は新キーまたは v の分岐で扱う。

## 関連実装: mistl

mistl は localStorage を持たず本キーの参加者ではないが、同じモデル参照を TOML/IPC に
snake_case で採用する。ネイティブ設定の legacy フィールドは deserialize/migrate 後に
再 serialize しない。この点は web の「legacy 値を変更せず書き戻す」義務とは異なる。

| 本契約(web) | mistl(TOML / config.show JSON) |
|---|---|
| `providers[]` + enabled/models/modelsFetchedAt | `[[ai.providers]]` + enabled/models/models_fetched_at |
| `defaultModel: {providerId, model}` | `ai.default_ref: {provider_id, model}` |
| `tts`(voice / speed を含む) | `ai.tts`(`tts.speed` ↔ `ai.tts.speed` は 1:1、null でクリア) |
| `stt` | `ai.stt`(null でクリア。TTS の速度は `ai.tts.speed` に保持し、STT wire には送らない) |
| アプリローカルの既定タスク effort | `ai.default_reasoning_effort`(既定モデル `ai.default_ref` のタスク設定に相当) |
| アプリローカル `roomProvide[roomProviderId]` | Room provider の `provide`/`shared: [{provider_id, model}]` |
| legacy `network.roomId`/presets/defaultPresetId | legacy `ai.room_id`/presets/default_preset_id |

mistl はタスク一覧を持たず、`ai.default_ref` を既定タスクとして扱う。
`ai.default_reasoning_effort` は省略可能な文字列で、受け付ける値は上記の7値と同じ。省略は未設定、
`none` は明示値である。不正値は `config set` で拒否し、読み込み時は警告して無視する。
legacy presets があり新キーが未設定の場合だけ、`default_preset_id` が参照する preset の
`reasoning_effort` を冪等に引き継ぐ。共有 `defaultModel` やモデル参照の一部にはしない。

Room provider は受信した `llm_request.reasoning_effort` を優先し、省略時だけ
`ai.default_reasoning_effort` を使う。ローカル API(`/v1/chat/completions` /
`/v1/rooms/{room}/chat/completions`)と `ai chat` は body / flag の指定値を優先し、
指定がなく既定モデルへ解決する場合(model 省略または `ai.default_ref` と一致)だけ
この既定 effort を使う。未設定なら上流へ送らない。

旧 advertised_models(共有 preset id 配列)は旧 room_id(未設定なら net::DEFAULT_ROOM)の
Room provider の shared refs へ移し、モデルがあれば provide = true とする。
bot の preset_id は model ref へ移す。提供サービスは有効な Room のいずれかが
provide = true の間だけ動作し、起動時と ai.providers の変更時に join/leave/広告を照合する。
旧 persisted global providing フラグは移行後の状態源にしない。
