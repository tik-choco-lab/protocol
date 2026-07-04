# tc-home の localStorage キー

tc-home はタスク指定外だったが、`tik-choco/` 配下に存在し mistlib を使っているため
参考情報として記載する(未確定、要フォローアップ調査)。

mistlib 使用: あり(`tc-home/src/utils/mist.ts`、`tc-home/src/mistlib/`)

| キー | スキーマ | 書き手 | 読み手 | 出典 |
|---|---|---|---|---|
| `tc-home-sites` | サイト一覧(未詳細調査) | tc-home | tc-home | tc-home/src/hooks/useSites.ts:4 |
| `tc-home-device-id` | `string` | tc-home | tc-home | tc-home/src/utils/device.ts:1 |
| `tc-home-settings` | アプリ設定(未詳細調査) | tc-home | tc-home | tc-home/src/hooks/useSettings.ts:10 |

## 特記事項

- キー命名が `tc-home-<name>`(ハイフン区切り、versionサフィックスなし)で、
  tc-storage/tc-translate(`-v1` サフィックスあり)と微妙に異なる。
- 他アプリとの直接のクロスアプリ読み取りは確認されなかった。
