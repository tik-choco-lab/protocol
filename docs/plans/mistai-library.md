# 計画書: mistai — mistlib 前提の共通 AI ネットワークライブラリ

Status: Draft(計画のみ、実装未着手)
Created: 2026-07-04
関連文書: [mistllm-wire.md](../data-contracts/docs/mistllm-wire.md), [types/tc-mistllm.d.ts](../data-contracts/types/tc-mistllm.d.ts)

## 背景と動機

現状、mistllm(mistlib P2P 経由の LLM 推論ネットワーク)の実装は
tc-mistllm を原本として各アプリに手動コピー(vendoring)されている:

| アプリ | 実装 | 状態 |
|---|---|---|
| tc-mistllm | `src/lib/{protocol,node,consumer,provider}.ts` | 原本(プロトコルの正) |
| tc-translate | `src/lib/mistllm/` に忠実移植 | 動作良好。最良の Web 実装 |
| tc-pdf-viewer | `src/services/mistllm.js` 独自書き直し | **未動作**。tc-translate 実装への置き換えを予定 |
| tc-note | なし(LLM 設定 UI の骨組みのみ) | 将来 mistai を採用 |
| tc-storage | なし(mistlib はファイル同期専用) | 対象外 |

手動コピー方式は protocol/ の契約文書と decode の防御的パースで
互換性を保っているが、実装品質のばらつき(tc-pdf-viewer が典型)と
機能追加時の N 重メンテが問題。**共通ライブラリ化**で解決する。

## ゴール

1. **単一実装**: 全 Web アプリが同じ mistai を使う(コピーではなく配布物)
2. **OpenAI API 互換の表面**: 将来的にアプリ側からは
   `client.chat.completions.create({model, messages, stream})` の形で呼べる。
   バックエンドが「直接 API」か「mistlib ネットワーク越しのピア」かを
   mistai が透過的に切り替える
3. **マルチモーダル拡張**: LLM(chat)に加えて TTS / STT /
   embedding / 画像生成などのサービス種別を同一ネットワーク・
   同一プロトコル体系で追加できる構造
4. **ワイヤ後方互換**: 既存 mistllm-wire v1 と相互運用可能
   (mistai の consumer は既存 tc-translate provider と通話できる)

## 非ゴール

- mistlib 本体(Rust core / wasm)の改修。1node=1room 制約は
  tc-translate 方式(join ごとに MistNode 再生成)+ アプリ側の
  room 排他(tc-pdf-viewer の claimRoom パターン)で吸収する
- Raft スケジューラ(`raft_message`)の Web 実装。CLI 専用のまま
- 課金・認証・レート制限(将来の別計画)

## アーキテクチャ

```
mistai/
├── core/          # 環境非依存の純粋ロジック
│   ├── protocol.ts    # ワイヤ codec(mistllm-wire v1 準拠 + 拡張)
│   ├── consumer.ts    # リクエスト相関、seq 並べ替え、タイムアウト
│   ├── provider.ts    # 受信リクエスト→上流 API 転送、ログ
│   └── session.ts     # join 世代管理(tc-translate client.ts の一般化)
├── transport/
│   └── mist.ts        # mistlib MistNode ラッパー(join ごとに再生成)
├── openai/        # OpenAI 互換の表面(Phase 2)
│   └── client.ts      # chat.completions.create() / audio.speech / audio.transcriptions
└── react/         # 任意採用の hooks(Phase 2)
    ├── useNetworkProvider.ts
    └── useNetworkConsumer.ts
```

設計原則(tc-translate 実装から継承):

- **防御的パース**: `decode()` は全フィールド検証、不正は黙って null。
  未知の optional フィールドは無視(前方互換)
- **依存注入**: core は mistlib にも fetch にも直接依存しない。
  送信関数・上流呼び出し関数を注入(単体テスト可能)
- **世代管理**: 非同期 join 中の設定変更に対する joinGeneration パターン
- **タイムアウト標準装備**: provider 発見 10s、応答は無通信 120s
  (チャンク受信ごとにリセット — tc-pdf-viewer be743f8 から採用)

## ワイヤプロトコルの拡張方針

mistllm-wire v1 を包含し、サービス種別を追加する:

- 既存 6 型(`consumer_hello`, `provider_hello`, `llm_request`,
  `llm_response_chunk`, `llm_response_done`, `llm_error`)は不変
- `provider_hello` に optional フィールドを追加(v1 のまま非破壊):
  - `models?: string[]` — tc-pdf-viewer be743f8 の拡張を正式化
  - `services?: string[]` — 提供サービス種別(`"chat"`, `"tts"`, `"stt"`, `"embedding"`)。
    欠落時は `["chat"]` 扱い(既存 provider との互換)
- 新サービスはメッセージ型を追加(型追加は非破壊、というのが
  mistllm-wire.md の既存互換ルール):
  - `tts_request` `{id, text, voice?, format?}` / `tts_response_chunk`
    `{id, data(base64), seq?}` / `tts_response_done`
  - `stt_request` `{id, data(base64), format, language?}` /
    `stt_response_done` `{id, text}`
  - `embedding_request` `{id, input: string[]}` / `embedding_response_done`
    `{id, vectors: number[][]}`
  - エラーは既存 `llm_error` を `error` に一般化せず、当面
    `llm_error` を全サービス共通のエラー型として流用(id 相関で十分)
- バイナリ大容量(音声)は将来 mistlib のブロックストア(CID)参照に
  切り替える余地を残す: `data` の代替として `cid?: string`

## 配布方式

tc-note の `scripts/fetch-mistlib.mjs` + prebuild フック方式を踏襲する
(npm registry 公開はしない):

1. mistai は独立リポジトリ `tik-choco/mistai`(TypeScript、ビルド成果物は
   ESM + .d.ts)
2. 各アプリは `scripts/fetch-mistai.mjs` で develop ブランチの
   ビルド成果物を `src/vendor/mistai/` に取得(prebuild / predev)
3. BUILD_INFO.txt にコミットハッシュと md5 を記録(mistlib-wasm 統一で
   確立した慣習に従う)

## 移行フェーズ

- **Phase 0(先行・mistai と独立に実施可)**: tc-pdf-viewer の mistllm を
  tc-translate の 4 ファイル実装で置き換えて動作させる。
  be743f8 の `provider_hello.models` 拡張とタイムアウトは保持。
  → これが実質 mistai core の初版コードベースになる
- **Phase 1**: mistai リポジトリ作成。tc-translate 実装 + models/timeout を
  core として切り出し、tc-translate と tc-pdf-viewer が fetch 方式で採用。
  contract 文書(mistllm-wire.md)に `models`/`services` を追記
- **Phase 2**: OpenAI 互換表面(`openai/client.ts`)と react/ hooks。
  tc-note の LLM 機能を mistai ベースで新規実装
- **Phase 3**: TTS / STT / embedding のメッセージ型追加と provider 実装。
  tc-mistllm 原本を mistai 利用側に反転(原本の座を mistai に移譲)

## 未決事項

- リポジトリ名・パッケージ名の確定(仮称 mistai)
- room 命名規約: 現状はユーザー自由入力の生 roomId。サービス種別ごとに
  room を分けるか、単一 room で `services` により多重化するか
  (現行の 1room 制約下では単一 room 多重化が有利)
- tc-mistllm CLI(Rust)側の追従: `models`/`services` と新サービス型を
  protocol.rs にいつ実装するか
- 音声データの チャンクサイズ上限と CID 参照への切替閾値
