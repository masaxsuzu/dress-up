# Task B: recommend ページの分割とラベル重複排除

Branch: `claude/refactor-recommend-ui` (main から作成、コミットして push、PR は作らない)

## ゴール

1. **ラベルマップの重複削除**: app/recommend/page.tsx:20-36 にローカル定義された
   `SEASON_LABEL` / `CATEGORY_LABEL` を削除し `@/lib/labels` から import する
   (lib/labels.ts に同一定義が既にある)。
2. **コンポーネント抽出**: 440 行の app/recommend/page.tsx から以下を分離:
   - `OutfitCard` → components/recommend/outfit-card.tsx
   - `OutfitFullBodyImage` → components/recommend/outfit-full-body-image.tsx
   - `ShoppingCard` → components/recommend/shopping-card.tsx
   - 型 (`OutfitResult`, `ShoppingResult`, `MissingItem` など) は使う側に合わせて適切に配置 (共有が必要なら components/recommend/types.ts)
3. **ナビゲーション統一**: このページ (client component) 内の `<a href="/">` と
   `<a href={/items/...}>` を next/link の `Link` に置き換える。

## 触ってよいファイル (これ以外は変更禁止)

- app/recommend/page.tsx
- components/recommend/ (新規ディレクトリ、新規ファイルのみ)

注意: `primaryBtn` は引き続き `@/components/clothing-form` から import すること (移動しない)。

## 受け入れ条件

- `npx tsc --noEmit` がエラーなし
- `npx vitest run` が全テストパス
- ページの見た目・挙動は不変 (スタイルオブジェクトはそのまま移植)
- コードスタイルは既存に合わせる
