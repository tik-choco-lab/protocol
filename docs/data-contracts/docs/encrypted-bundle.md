# 暗号化バンドル仕様 (encrypted-bundle)

ファイル/フォルダを mistlib storage (OPFS `mistlib-blocks`) 上で受け渡すための
中立なコンテナ形式。元は tc-storage の内部形式だったものを、`folder-export` /
`drive-index` トピック([SHARED_BUS.md](SHARED_BUS.md))の登場に伴い
ファミリー共通のバージョン付き契約として昇格した。正準実装は
tc-storage `src/storage/domain.ts` / `src/crypto/crypto.ts`、互換移植は
tc-travel `src/lib/drive/types.ts` / `src/lib/drive/crypto.ts`。

## 暗号化 envelope (`EncryptedPayload` v1)

mist storage に書かれるバイト列は、常に「バンドル JSON を暗号化した envelope の
JSON」を UTF-8 エンコードしたもの。

```ts
interface AesGcmPayload {
  version: 1;
  algorithm: "AES-GCM";        // 256-bit key
  kdf: "PBKDF2-SHA256";        // 書き込み時 210,000 iterations
  iterations: number;           // 読み手は 100,000〜1,000,000 を受理
  salt: string;                 // base64, 16 bytes (毎回ランダム)
  iv: string;                   // base64, 12 bytes (毎回ランダム)
  cipherText: string;           // base64
}
```

鍵はパスフレーズ文字列から都度 PBKDF2 導出する(生鍵は永続化しない)。
フォルダ鍵のパスフレーズは 24 ランダムバイトの base64url 文字列。

## バンドル形状

```ts
interface FileBundle {
  version: 1;
  exportedAt: string;   // ISO 8601
  originNode: string;   // 書き手のノード id (DID 推奨)
  folder: FolderRecord; // 所属フォルダ
  file: FileRecord;     // dataUrl (base64 data URL) を含む
}

interface FolderBundle {
  version: 1;
  exportedAt: string;
  originNode: string;
  folder: FolderRecord;      // ルートとして parentId: null
  folders?: FolderRecord[];  // サブツリー (省略時は folder 単体)
  files: FileRecord[];       // dataUrl は strip 済み・lastCid 必須
}
```

`FolderRecord` / `FileRecord` / `VersionStamp` のフィールドは tc-storage
`src/storage/domain.ts` の定義を正とする。要点:

- 変更可能フィールドは `fieldVersions: Record<field, {updatedAt, nodeId}>` で
  per-field LWW マージされる。**変えていないフィールドに新しいスタンプを
  押してはならない**(受け手側でユーザーの編集を巻き戻すため)。新規レコードは
  全フィールド同一スタンプ、更新は変更フィールドのみ再スタンプ。
- `FileRecord.lastCid` は当該ファイル単体の暗号化 FileBundle の CID。
- mist storage 上の名前は `<fileId>.tc-file.enc.json` / `<folderId>.tc-folder.enc.json`。

## バージョニング

envelope / バンドルの破壊的変更は `version` を上げ、読み手は未知バージョンを
明示的に拒否すること。フィールド追加は後方互換([conventions.md](conventions.md))。
