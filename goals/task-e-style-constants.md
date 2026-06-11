# Task E: 共有スタイル定数化

Branch: `claude/refactor-styles` (main から作成、コミットして push、PR は作らない)

## 背景

ページレイアウトやボタンの inline style が 5+ ファイルに重複:
- `{ padding: "1rem", maxWidth: ..., margin: "0 auto" }` (全ページ)
- ピル型ナビボタン (app/page.tsx の「提案」「Add」)
- アクションボタン `{ padding: "0.7rem 1.2rem", borderRadius: 8, ... }` (delete-button, iconize-button, clothing-form の primaryBtn)
- カード `{ border: "1px solid #e5e5e5", borderRadius: 10, padding: "0.75rem", background: "#fff" }`

## ゴール

1. **lib/ui.ts (新規)**: 共有スタイル定数/ヘルパーを定義。最低限:
   - `pageStyle(maxWidth: number): CSSProperties` — ページコンテナ
   - `pillLinkStyle: CSSProperties` — ピル型ナビリンク
   - `actionBtnStyle(opts?)` — アクションボタン (primary 黒 / danger 赤 / disabled をカバー)
   - `cardStyle: CSSProperties` — カード枠
   - 命名・分割は使い勝手を見て調整してよいが、過度な抽象化はしない (現状の見た目を変えないこと最優先)
2. **利用側を置き換え**:
   - app/page.tsx, app/add/page.tsx, app/items/[id]/page.tsx, app/items/[id]/edit/page.tsx, app/recommend/page.tsx
   - app/items/[id]/delete-button.tsx, app/items/[id]/iconize-button.tsx
   - components/recommend/*.tsx (カード枠)
   - components/clothing-form.tsx の `primaryBtn` は lib/ui.ts の実装を re-export する形に変えてよい (import 互換を保つこと)
3. 100% の置き換えは不要。**繰り返しの多い 4 パターン (ページ/ピル/アクションボタン/カード) に絞る**。1 箇所しか出ないスタイルはそのまま。

## 触ってよいファイル (これ以外は変更禁止)

- lib/ui.ts (新規)
- app/ 以下の page.tsx / *-button.tsx (app/api/ は触らない)
- components/ 以下

## 受け入れ条件

- `npx tsc --noEmit` がエラーなし
- `npx vitest run` が全テストパス
- 見た目が変わらない (スタイル値はそのまま移植)
- コードスタイルは既存に合わせる
