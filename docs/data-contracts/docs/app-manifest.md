# アプリマニフェスト(appManifest)仕様

各アプリが起動時に「自分はここにいる、このトピックを読み書きする」という自己申告レコードを
`localStorage` に置くための、軽量・依存なしの契約。同一オリジンで動く他アプリが、相手アプリを
一度も開かずに「このアプリは今までにこの端末で起動したことがあるか」「共有バスのどのトピックに
関与しているか」を安価にチェックできるようにする。

## 設計方針

- **依存なし**。sharedBus.ts と同じく mistlib にも他のどのアプリにも依存しない、単一ファイルの
  vendor コピー。
- **自己申告のキャッシュであり、信頼/セキュリティ境界ではない**。値は書き手アプリが自分自身の
  申告として書くだけで、署名も検証もされない。悪意あるコード(同一オリジン内)が偽の
  マニフェストを書くことは技術的に可能であり、これは想定内(localStorage 自体が同一オリジンを
  信頼境界とする設計のため)。**アクセス制御や真正性の判定には使わないこと**。用途は
  あくまで UX 上のガイダンス(例:「この機能には tc-storage との連携が必要です — 先に一度
  開いてください」といった案内の出し分け)。
- **鮮度は `updatedAt` で判断する**。マニフェストは起動のたびに上書きされる想定のため、
  `updatedAt` が古い(あるいはそもそもキーが無い)場合は「そのアプリは長らく起動されていない
  かもしれない」という弱い signal として扱う。厳密な生存確認ではない。

## localStorage 契約(`tc-app-manifest:<app>` の値)

```ts
type AppManifestV1 = {
  v: 1;
  app: string;              // "tc-note" など
  version?: string;
  busVersion?: number;      // vendored sharedBus の BUS_VERSION(診断用)
  publishes: string[];      // 書き込む sharedBus トピック
  consumes: string[];       // 購読/取り込みするトピック
  reads: string[];          // 契約に基づき直読みする他アプリの localStorage キー(完全一致文字列)
  updatedAt: string;        // ISO 8601(最終起動時刻を兼ねる)
};
```

- **キー**: `tc-app-manifest:<app>`(`<app>` はそのアプリ自身の名前、例
  `tc-app-manifest:tc-note`)。`tc-shared-<topic>-v1` 形式(sharedBus)とは別の名前空間。
- **所有者**: そのアプリ自身のみが書く。他アプリは読み取り専用。
- **`publishes`/`consumes`**: [SHARED_BUS.md](SHARED_BUS.md) のトピック名(例
  `"note-article"`, `"character-index"`)をそのまま列挙する。
- **`reads`**: [conventions.md](conventions.md) の「クロスアプリ読み取りの原則」に基づき
  直接 `localStorage.getItem` している他アプリのキーを、完全一致の文字列として列挙する
  (例 `"tc-storage-snapshot-v1"`)。**この一覧は各アプリの `docs/keys/<app>.md` に記載された
  クロスアプリ読み取りエントリと一致していなければならない**(手で二重管理せず、
  `docs/keys/<app>.md` を更新する際は `reads` の実装側リストも合わせて見直すこと)。
- **`busVersion`**: そのアプリが vendor している `sharedBus.ts`/`.js` の `BUS_VERSION`
  定数の値。あくまで「どのバージョンの vendored コピーが動いているか」を人間がデバッグする
  ための診断情報であり、[SHARED_BUS.md](SHARED_BUS.md) が定める互換性契約(キー名/
  チャンネル名の `-v1` サフィックス)そのものではない。

## 公開API

```ts
function writeAppManifest(input: Omit<AppManifestV1, "v" | "updatedAt">): void;
function readAppManifest(app: string): AppManifestV1 | null;
function listAppManifests(): AppManifestV1[];
```

- `writeAppManifest`: `v: 1` と `updatedAt`(現在時刻)を自動的に補い、
  `tc-app-manifest:<app>` へ書き込む。書き込み失敗(ストレージ無効・容量超過等)は
  `console.warn` した上で無視する(例外を投げない)。
- `readAppManifest`: 指定した `app` のマニフェストを読み、形状を検証してから返す。
  キー不在・JSON不正・スキーマ不一致はすべて `null` を返す(例外を投げない)。
- `listAppManifests`: `tc-app-manifest:` プレフィックスを持つ全キーを走査し、検証を通った
  マニフェストだけを配列で返す。壊れたエントリは黙ってスキップする。

## ファイル配置

sharedBus.ts と同様、単一の npm パッケージとして共有せず、各アプリに同一契約のファイルを
vendor コピーする(理由は [README.md](../README.md) の「原則: ランタイム依存禁止」参照)。
参照実装は [reference/appManifest.ts](../reference/appManifest.ts) /
[reference/appManifest.js](../reference/appManifest.js)、配布先は
`protocol/scripts/sync-vendored.mjs` の設定表を参照。sharedBus.ts と異なり `APP_NAME` のような
置換対象の定数を持たない(呼び出し側が `app` を引数として渡す設計のため)。

## バージョニング方針

[SHARED_BUS.md](SHARED_BUS.md) と同じ方針。破壊的変更は `tc-app-manifest:<app>` を
`tc-app-manifest-v2:<app>` のようにサフィックスを1つ上げるか、`v` フィールドで分岐する。
後方互換なフィールド追加は同じバージョンのままでよい。
