# Task A: サーバ/lib の重複排除

Branch: `claude/refactor-server-lib` (main から作成、コミットして push、PR は作らない)

## ゴール

1. **lib/season.ts (新規)**: `currentSeason(date = new Date()): Season` を 1 箇所に。
   現在 `app/api/recommend/route.ts:14-20` と `app/api/outfit-image/route.ts:13-19` に同一実装が重複している。
2. **lib/r2.ts**: R2 から画像を読んで base64 化する共通ヘルパーを追加:
   `loadImageBase64(bucket: R2Bucket, key: string): Promise<{ mediaType: string; base64: string } | null>`
   - バリデーションはホワイトリスト方式 (image/jpeg, png, webp, gif) に統一する。
     現在 recommend/route.ts はホワイトリスト、outfit-image/route.ts は `startsWith("image/")` で不統一。
   - 未使用 export `getImage` を削除し、test/lib/r2.test.ts の該当テストは `bucket.get` 直接呼び出しに置き換えるか削除。
3. **利用側を更新**:
   - app/api/recommend/route.ts: ローカル currentSeason / loadItemImage を削除して lib を使う
   - app/api/outfit-image/route.ts: 同上
   - app/api/items/[id]/iconize/route.ts: R2 読み込み + base64 変換部分を loadImageBase64 で置き換え
4. **テスト**: test/lib/season.test.ts (新規、月→季節の境界をカバー)。r2.test.ts に loadImageBase64 のテスト追加。

## 触ってよいファイル (これ以外は変更禁止)

- lib/season.ts (新規), lib/r2.ts
- app/api/recommend/route.ts, app/api/outfit-image/route.ts, app/api/items/[id]/iconize/route.ts
- test/lib/season.test.ts (新規), test/lib/r2.test.ts

## 受け入れ条件

- `npx tsc --noEmit` がエラーなし
- `npx vitest run` が全テストパス
- API ルートの挙動 (レスポンス形状・ステータス) は不変
- コードスタイルは既存に合わせる (日本語コメント、設計判断のみコメント)
