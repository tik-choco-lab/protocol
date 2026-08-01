# tc-lingo の localStorage キー

外国語学習アプリ(SRS: 簡易SM-2ベースの間隔反復)。mistlib 使用: あり(AI Network 用
`network.ts` の `MistNode` に加えて、`lingo-card-inbox` トピック受信のため `mistStorage.ts`
経由の `storage_add`/`storage_get`(CIDストア)も使用。vendor は `src/vendor/mistlib/{pkg,wrappers/web}`)。

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-lingo:cards-v1` | `Card[]`(SRSカード本体。下記参照) | tc-lingo | tc-lingo | tc-lingo/src/lib/cards.ts:6 |
| `tc-lingo:topics-v1` | `Topic[]`(練習テーマ一覧) | tc-lingo | tc-lingo | tc-lingo/src/lib/topics.ts:7 |
| `tc-lingo:attempts-v1` | `PracticeAttempt[]`(練習の出力+添削ラウンド履歴) | tc-lingo | tc-lingo | tc-lingo/src/lib/topics.ts:8 |
| `tc-lingo:settings-v1` | `LingoSettings`(対象言語一覧/母語/プリセット/接続モード等) | tc-lingo | tc-lingo | tc-lingo/src/lib/settings.ts:10 |
| `tc-lingo:onboarding-done` | `"1"`(初回オンボーディング完了フラグ) | tc-lingo | tc-lingo | tc-lingo/src/lib/onboarding.ts:8 |
| `tc-lingo:card-inbox-state-v1` | `{ v: 1; done: Record<itemId, 'imported' \| 'dismissed'> }`(上限1000件、古い順に間引き) | tc-lingo | tc-lingo | `lingo-card-inbox` トピック受信の冪等状態。契約対象外のアプリローカルキー。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `lingo-card-inbox` トピック |
| `tc-lingo-mistllm-node-id-v1` | `string`(UUID風ノードID) | tc-lingo | tc-lingo | tc-lingo/src/lib/network.ts:24。AI Network(mistllm-wire、P2P LLM)と `mistStorage.ts` のCIDストアが共用するノード識別子。tc-translate の `mistllm-node-id-v1` と同じ命名パターン |
| `tc-shared-llm-config-v1` | `SharedLlmConfigV1`(接続/モデル/TTS・STT/AI Networkルーム。詳細は [../llm-config.md](../llm-config.md)) | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm, tc-lingo | tc-note, tc-translate, tc-pdf-viewer, tc-news, tc-town, tc-travel, tc-mistllm, tc-lingo | tc-lingo/src/lib/llmConfig.ts。詳細は [../llm-config.md](../llm-config.md) |
| `tc-shared-lingo-card-inbox-v1` | `SharedRecord`(`meta` は `LingoCardInboxMeta`。詳細は [../SHARED_BUS.md](../SHARED_BUS.md)) | **tc-translate(クロスアプリ書き込み)** | tc-lingo | 共有バスの真の共有キー(アプリ名プレフィックスなし)。詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の `lingo-card-inbox` トピック |

## Card スキーマ

```ts
export type CardSource = "manual" | "mistake" | "translate";

export interface Card {
  id: string;
  front: string;
  reading: string;
  meaning: string;
  exampleSentence: string;
  context: string;
  cloze: string;
  source: CardSource;
  sourceTopicId: string | null;
  /** 学習対象言語のうちどれに属するカードか。マルチ言語対応前に保存された
   * カードは "" (どの言語フィルタでも表示対象扱い)。 */
  language: string;
  createdAt: string;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
}
```

`tc-lingo/src/types.ts`(2026-07-18時点)の型定義そのまま。`"translate"` は
`lingo-card-inbox` 連携の受信カード用に追加された値。`CardSource` の許容値は
`src/lib/cards.ts` の `isCard()` 型ガードにもハードコードされているため、今後値を
追加する際は**型と `isCard()` を同時に更新しないと、保存済みカードが `loadCards()` 時に
サイレント消失する**(未知の `source` 値を持つカードは `isCard` に弾かれて一覧から消える)。

## 共有バス参加 (sharedBus)

tc-lingo は [../SHARED_BUS.md](../SHARED_BUS.md) の汎用共有バス(`tc-shared-<topic>-v1` +
BroadcastChannel `tc-shared-bus-v1`)を vendor コピーしている(`tc-lingo/src/lib/sharedBus.ts`)。
参加しているトピック:

- **`lingo-card-inbox`(読み手)**: tc-translate の翻訳/解説履歴をSRSカード候補として受け取る、
  tc-lingo にとって初のエコシステム連携。起動時に `readShared("lingo-card-inbox")` を読み、
  以後 `subscribeShared` で購読する。冪等状態は `tc-lingo:card-inbox-state-v1`(上表参照)。
  書き手(tc-translate)の挙動を含む詳細は [../SHARED_BUS.md](../SHARED_BUS.md) の
  「既存トピック: `lingo-card-inbox`」を参照。

## app-manifest

`publishes: []`, `consumes: ["lingo-card-inbox"]`, `reads: []`
([app-manifest.md](../app-manifest.md)参照)。

## 特記事項

- mistlib は AI Network(`network.ts`)用に既に vendor 済みだったが、CIDストア
  (`storage_add`/`storage_get`)は `lingo-card-inbox` 連携以前は未使用だった。追加は
  tc-translate の `src/lib/mistStorage.ts` と同型の薄いラッパー1ファイルのみで済んでいる
  (`network.ts` の `MistNode` とは独立に、wasm の init だけ共有する設計。詳細は
  [../SHARED_BUS.md](../SHARED_BUS.md) の `lingo-card-inbox` トピック)。
- 対象言語リスト(`languageOptions` 等、`tc-lingo/src/lib/languages.ts`)は tc-translate の
  `constants.ts` を手動で mirror したもの。`lingo-card-inbox` 実装(2026-07-18)で
  Ukrainian/Filipino/Malay/Bengali/Hebrew の5言語を tc-lingo 側へ追加し、25言語の値集合が
  完全一致する状態になった(readingSpec は Ukrainian/Bengali/Hebrew を romanization、
  Filipino/Malay はラテン文字のため既定のまま)。mirror は手動運用のため、tc-translate 側で
  言語を増やす際は tc-lingo への追従を忘れないこと。
- 本ドキュメントは tc-lingo のエコシステム契約登録(sharedBus / app-manifest / llm-config
  参加)を対象としている。ローカル専用キーのうち `topics-v1`/`attempts-v1`/`settings-v1` の
  詳細スキーマは `tc-lingo/src/types.ts` を参照(型定義の転記はカードのみに留めた)。
