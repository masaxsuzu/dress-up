# Task G: アイコン (iconKey) 周りの E2E 強化

Branch: `claude/e2e-icons` (main から作成、コミットして push、PR は作らない)

## 背景

iconKey 周りの挙動 (詳細ページのアイコン表示・サムネイルの切り替え・iconize ボタン・delete 後ナビ) は単体テストではカバーしきれない統合点。E2E で固める。

## ゴール

`e2e/icons.spec.ts` (新規) に最低限以下のケース:

1. **iconKey 未生成のサムネイル**:
   - API で iconKey なしのアイテムを 1 件作成 → `/` で `<article>` 内の `<img>` が `objectFit: cover` 系のスタイル / src が `/api/images/items/...` を指す
2. **iconize ボタン → reload で iconKey 反映**:
   - API で 1 件作成 (iconKey なし)
   - `/items/<id>` に遷移、`/api/items/<id>/iconize` を `{ iconKey: "icons/x.png" }` で返すモック
   - 「アイコン化」ボタンを押す
   - **重要**: 現在の実装は POST 成功後に `window.location.reload()` を呼ぶので、リロード後 `/api/items/<id>` GET (詳細ページの SSR) でアイコン枠が見える状態を作る必要がある。これは難しい場合、別アプローチとして:
     - **直接 PATCH 等で D1 をいじることはせず**、API モックでまかなえる範囲 (ボタンの label 遷移「アイコン化」→「生成中...」→「完了」) だけテストする方が現実的
   - **どちらの戦略を採るか実装者の判断に任せる**。複雑なら後者で OK
3. **iconKey ありのサムネイル**:
   - これも実 D1 を `iconKey` 付きで作る手段がないので、`page.route()` で `/api/images/<iconKey>` を 1x1 PNG 透過で返すモックと、画面上で `iconKey` が反映された見え方をどう検証するかは実装者判断
   - 難しすぎる場合はスキップして case 1 と case 2 に集中
4. **delete 後の navigation**:
   - API で 1 件作成
   - `/items/<id>` で「削除」ボタン押下 (confirm 自動承認)
   - `/` に遷移 (`window.location.href = "/"` を使っているため hard nav)
   - 「まだアイテムがありません。」が表示される
   - **既存テストでカバー済み**ならスキップしてよい (existing registration.spec.ts:103-136)

## 触ってよいファイル

- e2e/icons.spec.ts (新規)
- e2e/global-setup.ts (絞り込みは破壊的にしないこと)

既存ファイルの test は触らない。

## 受け入れ条件

- `npx playwright test e2e/icons.spec.ts` がローカル/CI で全パス
- 既存 18+ E2E ケースに影響なし
- 達成困難なケースはコメントで理由を残してスキップしてよい (最低 2 ケース実装)
- コミットメッセージ末尾に: https://claude.ai/code/session_01RPcD8xtgnHu2KzTjsbVicJ
