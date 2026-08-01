# 共有LLM設定(llmConfig)仕様

LLM/TTS/STT の接続設定(エンドポイント・APIキー)を、同一オリジンで動く tik-choco
ファミリー全アプリで**一度だけ**設定すれば済むようにするための、軽量・依存なしの契約。
[did-identity.md](did-identity.md) が採用している「共有キー」方式(アプリ名プレフィックスなし、
参加アプリ全員が読み書きする co-owned なキー)を LLM 接続設定にも適用したもの。

## 目的

これまで各アプリは自分専用のローカル設定キーに LLM のベース URL・APIキー・モデル名を
個別に保持しており、同じ LLM プロバイダを複数アプリで使う場合でもアプリごとに再入力が
必要だった。`tc-shared-llm-config-v1` に接続情報を集約することで、ユーザーはどこか1つの
アプリで一度設定すれば、他の参加アプリからも同じプロバイダ・モデルを再利用できる。

## 共有キー

| キー | ストレージ | スキーマ |
|---|---|---|
| `tc-shared-llm-config-v1` | localStorage(アプリ名プレフィックスなし) | `SharedLlmConfigV1`(下記) |

[conventions.md](conventions.md) の「新規キーの命名規約」が定める `tc-shared-<name>` 形式に
従う。did-identity と同じく**所有者は特定の1アプリではなく共有**であり、参加アプリは全員
このキーを読み書きしてよい(同一オリジンの相互信頼を前提とする — 「信頼境界」節を参照)。

## スキーマ

```ts
type LlmProviderV1 = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
};

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
  speed?: number;
};

type SharedLlmConfigV1 = {
  v: 1;
  providers: LlmProviderV1[];
  presets: ModelPresetV1[];
  defaultPresetId: string;      // "" = 未設定
  tts?: VoiceConfigV1;
  stt?: VoiceConfigV1;
  network: { roomId: string };  // AI Network の既定ルーム。"" = 未設定
  updatedAt: string;            // ISO 8601、LWW 用
};
```

- **`providers`**: 接続情報のみ = 「どこに繋ぐか」。`baseUrl` + `apiKey` の組。
- **`presets`**: 名前付きモデル設定 = 「どう呼ぶか」。`providerId` で `LlmProviderV1` を参照する。
- **`defaultPresetId`**: `presets` のどれを既定として使うかの `id`。空文字は未設定を表す。
- **`tts`/`stt`**: 音声合成/音声認識の設定。後述。
- **`network.roomId`**: AI Network(mistlib ルーム)の既定ルームID。空文字は未設定を表す。
- **`updatedAt`**: ISO 8601。後述の LWW(last-write-wins)判定に使う。

## provider と preset を分離している理由

同一エンドポイント(同一 `baseUrl`/`apiKey`)に対して複数のモデルを使い分けるケースが
多い(例: 同じ OpenAI 互換エンドポイントで `gpt-4o-mini` と `gpt-4o` を場面によって使い分ける)。
接続情報とモデル名を1レコードにまとめてしまうと、モデルを増やすたびに `apiKey` を複製する
ことになり、APIキーのローテーション時に更新漏れが起きやすい。`LlmProviderV1`(接続)と
`ModelPresetV1`(呼び方、`providerId` 参照)を分離することで、`apiKey` は provider 側に
一箇所だけ保持し、preset 側は provider を指す軽量な参照に留める。

## tts/stt は独自の接続情報を持たない

`VoiceConfigV1` は `baseUrl`/`apiKey` を持たない。`providerId` を省略した場合は
「`defaultPresetId` が指す preset の provider」にフォールバックする(解決規則は次節)。
TTS/STT 専用のエンドポイントを使いたい場合のみ `providerId` を明示すればよく、通常は
テキスト生成用と同じプロバイダを流用できるようにするための設計。

## 解決規則

参照実装は `resolvePreset`/`resolveVoice`(下記「reference 実装」参照)。

- **`resolvePreset(config, presetId?)`**: `presetId` が指す preset があればそれを、
  無ければ(または未指定なら)`defaultPresetId` が指す preset を使う。見つかった preset の
  `providerId` が指す provider が存在しない場合は解決失敗(`null`)。存在すれば
  `{ presetId, providerId, label, baseUrl, apiKey, model, temperature?, reasoningEffort? }`
  にマージして返す(`label` は preset 側の値)。
- **`resolveVoice(config, kind)`**(`kind` は `"tts"` | `"stt"`): `config[kind]` が無い、または
  `model` が空なら解決失敗。`providerId` が指定されていればその provider を、無ければ
  `resolvePreset(config)`(= 既定preset)が指す provider を使う。provider が見つからなければ
  解決失敗。見つかれば `{ baseUrl, apiKey, model, voice?, speed? }` を返す。

いずれも例外を投げず、解決できない場合は `null` を返す。

## mistllm-wire への橋渡し

`resolvePreset` が返す `ResolvedLlmTargetV1.model` は、そのまま
[mistllm-wire.md](mistllm-wire.md) の `llm_request.model` に載せてよい(両者とも型は
`string`)。consumer アプリは preset 解決までをこの契約(llm-config)で行い、解決した
`model` 名を wire メッセージに橋渡しするだけでよく、それ以上の変換は不要。

本契約の責務はローカル設定層での解決までであり、載せた `model` を実際に相手 provider が
扱えるかどうかの判定はこの契約の対象外: provider が要求 `model` に対応しているかは
mistllm-wire 側のマッチング(`provider_hello.models` との突き合わせ、
[mistllm-wire.md](mistllm-wire.md)「consumer 側の provider 選択手順」参照)と、
対応していない場合の上流エラー伝播(`llm_error`)によって扱われる。

## LWW(last-write-wins)

同一オリジンの複数アプリ(・複数タブ)が同じキーへ書き込みうるため、衝突解決は
`updatedAt` による LWW とする。`saveLlmConfig` は書き込み時に必ず現在時刻で
`updatedAt` を上書きするため、後から保存した側の内容が結果的に勝つ。クロスタブ/
クロスアプリの変更通知は `storage` イベント(`subscribeLlmConfig`)で受け取れる。
sharedBus のような BroadcastChannel 併用はしない(このキーは低頻度書き込みの設定値であり、
sharedBus 各トピックのような高頻度な通知ファンアウトは不要と判断)。

## マイグレーション規則

各アプリが自分の旧ローカル設定からこの共有キーへ移行する際のルール(コードでは強制されず、
規約として全アプリが従う):

1. `loadLlmConfig()` で読み、`null` なら `emptyLlmConfig()` から始める。
2. 自分の旧ローカル設定の provider/preset を `ensureProvider`/`ensurePreset` で**追加**する。
   両関数は同値の既存エントリがあれば再利用し、なければ末尾に追加するだけで、既存エントリを
   削除・上書きすることはない(**merge-never-delete**)。
3. `defaultPresetId`/`tts`/`stt`/`network.roomId` は**現在値が空/未設定のときのみ**設定する。
   既に他アプリが設定済みの値を自分の都合で上書きしない。
4. `saveLlmConfig(config)` で保存する(`updatedAt` は関数側が自動的に現在時刻へ更新する)。

この規則により、複数アプリが同時にマイグレーションを行っても、互いの provider/preset を
消し合ったり、既定値を奪い合ったりしない。

## アプリローカル層の指針

`tc-shared-llm-config-v1` が持つのは「どこに繋ぐか」「どう呼ぶか」という共有可能な設定までで、
「どの機能でどの preset を使うか」というアプリ固有のマッピングはこの契約の対象外。各アプリは
自分のローカルキーに `presetId` への参照を持たせて管理すること。参加7アプリではいずれも
実装済みで、以下がその実例:

- **tc-town**: `tc-town:characters` の各 `Character.llmProfileId`(フィールド名は移行前の
  `LlmProfile.id` 参照だった頃のまま温存)が `ModelPresetV1.id` を指す。キャラID→`presetId`
  のマッピングをキャラクターレコード自体に埋め込む形。詳細は
  [keys/tc-town.md](keys/tc-town.md)。
- **tc-news**: `tc-news:provider-settings` の `orchestratorPresetId`/`workerPresetId` が
  編集部生成パイプラインの orchestrator 役/worker 役それぞれの preset 参照。空文字は
  `defaultPresetId` に従う。詳細は [keys/tc-news.md](keys/tc-news.md)。
- **tc-pdf-viewer**: `tc-pdf-viewer-ai-settings-v1` の `taskPresetIds: { explain, translate,
  chat, ocr }` がタスク種別ごとの preset 参照。詳細は
  [keys/tc-pdf-viewer.md](keys/tc-pdf-viewer.md)。
- **tc-translate**: `tc-translate-provider-settings-v1` の `visionPresetId` が画像入力を伴う
  翻訳(vision)専用の preset 参照。通常のテキスト翻訳は `defaultPresetId` を使う。詳細は
  [keys/tc-translate.md](keys/tc-translate.md)。

こうすることで、`tc-shared-llm-config-v1` 自体は「利用可能な接続とモデルのカタログ」という
薄い共有層に留まり、各アプリの機能設計に引きずられない。

## 信頼境界

sharedBus/appManifest/did-identity と同様、同一オリジンで動くアプリ同士は相互に信頼する
という前提に立つ。`apiKey` を含む本契約もこの信頼境界を変えるものではない —
`apiKey` は元々各アプリがそれぞれのローカル設定キーに平文で保持していたものであり、
共有キーへ集約したことで新たに露出範囲が広がるわけではない(同一オリジンの
`localStorage` は元々そのオリジンで動く全コードからアクセス可能)。悪意あるコードが
同一オリジン内で偽の provider/preset を書き込むことは技術的に可能であり、これは
appManifest と同じ「想定内」の前提である。アクセス制御や真正性の判定には使わないこと。

## appManifest への記載について

`tc-shared-llm-config-v1` は特定アプリが所有するキーではない共有キーのため、
[app-manifest.md](app-manifest.md) が定める `AppManifestV1.reads`(他アプリの
localStorage キーを直読みする一覧)には**載せない**。これは `tc-shared-did-identity-cid-v1`
と同じ扱いであり([did-identity.md](did-identity.md) 参照)、`reads` は「契約に基づき他アプリ
"専有"のキーを直読みするケース」を対象とした一覧であるため、co-owned な共有キーは対象外とする。

## 参加アプリ

- tc-note
- tc-translate
- tc-pdf-viewer
- tc-news
- tc-town
- tc-travel
- tc-mistllm
- tc-books
- tc-lingo

## reference 実装 / vendor 運用

sharedBus.ts / appManifest.ts と同様、単一の npm パッケージとして共有せず、各参加アプリに
同一契約のファイルを vendor コピーする(理由は [README.md](../README.md) の
「原則: ランタイム依存禁止」参照)。参照実装は
[reference/llmConfig.ts](../reference/llmConfig.ts) /
[reference/llmConfig.js](../reference/llmConfig.js)。配布先・言語(TS/JS)は
`protocol/scripts/sync-vendored.mjs` の `APPS` テーブル(`llmConfig: true` のエントリ)を
参照。appManifest.ts と同様、`APP_NAME` のような置換対象の定数を持たないため、vendored
コピーは全アプリでバイト同一になる。

## 公開API

```ts
function emptyLlmConfig(): SharedLlmConfigV1;
function loadLlmConfig(): SharedLlmConfigV1 | null;
function saveLlmConfig(config: SharedLlmConfigV1): void;
function subscribeLlmConfig(cb: (config: SharedLlmConfigV1 | null) => void): () => void;
function normalizeBaseUrl(url: string): string;
function ensureProvider(config: SharedLlmConfigV1, input: { label?: string; baseUrl: string; apiKey: string }): string;
function ensurePreset(config: SharedLlmConfigV1, input: { id?: string; label?: string; providerId: string; model: string; temperature?: number; reasoningEffort?: string }): string;
function resolvePreset(config: SharedLlmConfigV1, presetId?: string | null): ResolvedLlmTargetV1 | null;
function resolveVoice(config: SharedLlmConfigV1, kind: "tts" | "stt"): { baseUrl: string; apiKey: string; model: string; voice?: string; speed?: number } | null;
```

- `loadLlmConfig`/`saveLlmConfig`: 他の contract と同じく防御的パース([conventions.md](conventions.md)
  の「クロスアプリ読み取りの原則」)。`loadLlmConfig` はキー不在・JSON不正・スキーマ不一致で
  `null` を返し、`providers`/`presets` 配列内の壊れたエントリは個別にスキップする(配列全体を
  無効化しない)。`saveLlmConfig` は書き込み失敗(ストレージ無効・容量超過等)を `console.warn`
  した上で無視する(例外を投げない)。
- `ensureProvider`/`ensurePreset`: 既存エントリの再利用・末尾追加のみを行い、`config` を
  直接ミューテートする(呼び出し側が別途 `saveLlmConfig` を呼ぶ)。マイグレーション規則の
  「merge-never-delete」を実現するための中心的な API。

## バージョニング方針

[SHARED_BUS.md](SHARED_BUS.md)/[app-manifest.md](app-manifest.md) と同じ方針。破壊的変更は
`tc-shared-llm-config-v1` を `tc-shared-llm-config-v2` のようにサフィックスを1つ上げるか、
`v` フィールドで分岐する。後方互換なフィールド追加は同じバージョンのままでよい。

## 関連実装: mistl

mistl(OS常駐ノード)は localStorage を持たないネイティブデーモンのため本契約の参加者
ではないが、同じ provider/preset 分離仕様を `config.toml` の `[ai]` セクションに
snake_case で採用する。

| 本契約(localStorage, camelCase) | mistl(config.toml, snake_case) |
|---|---|
| `providers[]` `{id,label,baseUrl,apiKey}` | `[[ai.providers]]` `{id,label,base_url,api_key}` |
| `presets[]` `{id,label,providerId,model,temperature?,reasoningEffort?}` | `[[ai.presets]]` `{id,label,provider_id,model,temperature?,reasoning_effort?}` |
| `defaultPresetId` | `ai.default_preset_id` |
| `network.roomId` | `ai.room_id`(既存フィールドが兼任) |
| `tts`/`stt` | なし(音声非対応、`voice_error` で応答) |
| (共有 preset の選択。本契約側に対応フィールドなし) | `ai.advertised_models`(`string[]`) |

レガシーの旧フラットフィールド(`ai.upstream_url`/`upstream_api_key`/`default_model`/
`temperature`)は読み込み時に provider+preset の組(id `"default"`)へ一度だけ移行し
(冪等・merge-never-delete、本契約の「マイグレーション規則」と同方針)、保存後は
旧フィールドを落とす。

`ai.advertised_models` は [mistllm-wire.md](mistllm-wire.md) の
`provider_hello.models`(「共有対象として明示的に選択した preset の広告名のみ」を
広告する義務、上記「models(広告名 = ラベル規約)」参照)に対応する mistl 側の設定で、
**「広告する preset id の配列」**である(2026-07-23 に mistl 側で再定義・修正実装中)。
旧形式では `ai.presets[].model` と同じ形の生モデル id をそのまま並べる配列だったが、
この形では上流の全モデルをフィルタなしで広告してしまう(=未選択モデルの露出)ケースと
区別がつかず、mistllm-wire.md の広告義務に違反していた。再定義後は要素を preset id
として解釈し、`ai.presets[].id` と一致する preset のみを `provider_hello.models` へ
その preset の広告名で広告する。旧形式(生モデル id 配列)の設定ファイルは、読み込み時に
`model` が一致する preset の id へ要素ごとに一度だけ自動 migration する
(該当する preset が無い生モデル id は破棄する。冪等・merge-never-delete)。
`ai.advertised_models` が空または未設定の場合は `models` フィールド自体を省略する
(上記 mistllm-wire.md の規約どおり)。
