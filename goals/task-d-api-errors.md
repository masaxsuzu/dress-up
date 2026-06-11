# Task D: API エラーレスポンス形状の統一

Branch: `claude/refactor-api-errors` (main から作成、コミットして push、PR は作らない)

## 背景

API ルートのエラー形状が不統一:
- Zod 失敗: `{ error: parsed.error.flatten() }` (構造化オブジェクト)
- その他: `{ error: string }`
クライアントは `error?: string | { formErrors?: string[] }` のような防御的な型を書く羽目になっている。

## ゴール

1. **lib/api-response.ts (新規)**:
   - `errorResponse(message: string, status: number): Response` — `{ error: string }` を返す
   - `validationError(error: ZodError): Response` — flatten 結果を人間可読な 1 つの message 文字列に変換して `{ error: string }` で 400 を返す (フィールド名: メッセージ, ... 形式)
   - test/lib/api-response.test.ts (新規) で両方をカバー
2. **全 API ルートを統一**: すべてのエラーレスポンスが `{ error: string }` になるよう置き換える
   - app/api/extract/route.ts
   - app/api/items/route.ts
   - app/api/items/[id]/route.ts
   - app/api/items/[id]/iconize/route.ts
   - app/api/recommend/route.ts
   - app/api/outfit-image/route.ts
   - 成功レスポンスの形状・ステータスは変更しない (204 含む)
   - extract ルートの「VLM 失敗でも 200 + extraction:null + error message」という特殊ケースの挙動は維持

## 触ってよいファイル (これ以外は変更禁止)

- lib/api-response.ts (新規), test/lib/api-response.test.ts (新規)
- app/api/ 以下の全 route.ts

クライアント側 (app/ の page.tsx 等) は触らない (既存コードは string エラーを処理できる)。

## 受け入れ条件

- `npx tsc --noEmit` がエラーなし
- `npx vitest run` が全テストパス
- すべてのエラーレスポンスが `{ error: string }` 形状
- コードスタイルは既存に合わせる (日本語コメント、設計判断のみコメント)
