# Task F: /recommend の E2E 追加

Branch: `claude/e2e-recommend` (main から作成、コミットして push、PR は作らない)

## 背景

E2E は CRUD と一覧周りが厚いが、コーデ提案 (`/recommend` → `/api/recommend` → `/api/outfit-image`) のジャーニーが空白。Gemini 本物呼びは時間・コスト・503 のため不適。Playwright の `page.route()` で API レスポンスをモックして UI 挙動を検証する。

## ゴール

`e2e/recommend.spec.ts` (新規) に最低限以下のケース:

1. **outfit 提案フロー**:
   - `/api/recommend` を `kind: "outfit"`, items を返すようモック
   - `/recommend` に遷移 → TPO 入力 → 「コーデを見つける」押下
   - 「コーデ提案」のヘッダー、`使ったアイテム` 見出し、使ったアイテムサムネイル (>=1)、`説明` 見出しと reason テキストが見える
2. **shopping 提案フロー**:
   - `/api/recommend` を `kind: "shopping"`, missing を返すようモック
   - 「買い足し提案」表示、ヘッダーが切り替わる、missing.description が表示
3. **全身画像生成 (button-driven)**:
   - outfit のモックを返したあと、`/api/outfit-image` を 1x1 PNG バイナリで返すモック (`page.route` で `Buffer` body)
   - 「全身イメージを生成」ボタン押下 → 画像が `<img>` で表示される
   - **404 など失敗ケース**: `/api/outfit-image` を 500 + `{ error: "..." }` で返し、エラーメッセージと「再試行」ボタンが出る
4. **エラー伝搬**: `/api/recommend` が 500 + `{ error: "..." }` を返すと、画面に同 error 文字列が表示される

## 参考

- 既存テストの clear ヘルパ・page.route の使い方は他の spec ファイル参照
- 1x1 PNG は registration.spec.ts の TINY_PNG を参考
- ボタンとセクションのラベルは `app/recommend/page.tsx` / `components/recommend/*.tsx` を参照 (現在は「コーデを見つける」「提案中...」「コーデ提案」「使ったアイテム」「説明」「買い足し提案」「全身イメージを生成（AI 画像、~10 秒）」「再試行」など)

## 触ってよいファイル

- e2e/recommend.spec.ts (新規)
- 必要なら e2e/global-setup.ts (絞り込みは破壊的にしないこと)

## 受け入れ条件

- `npx playwright test e2e/recommend.spec.ts` がローカル/CI で全パス
- 既存 18 E2E ケースに影響なし
- コードスタイルは既存 spec に合わせる (日本語テスト名 OK)
- コミットメッセージ末尾に: https://claude.ai/code/session_01RPcD8xtgnHu2KzTjsbVicJ
