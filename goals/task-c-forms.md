# Task C: フォームのサニタイズ統合と clothing-form の分割

Branch: `claude/refactor-forms` (main から作成、コミットして push、PR は作らない)

## ゴール

1. **lib/sanitize.ts (新規)**: app/add/page.tsx の `sanitizeExtraction()` と
   app/items/[id]/edit/page.tsx の `sanitizeForEdit()` はほぼ同じスキーマ検証
   (ClothingCategorySchema.options / PatternSchema.options / SeasonSchema.options の個別チェック)
   をしている。共通ユーティリティに統合し、両ページから使う。
   - 関数シグネチャは両ページの用途を満たすよう設計してよい
   - test/lib/sanitize.test.ts (新規) で不正カテゴリ/パターン/季節が落とされることをカバー
2. **components/clothing-form.tsx (464 行) の分割**:
   - `ColorEditor` → components/color-editor.tsx
   - `TagChipInput` → components/tag-chip-input.tsx
   - `Field` / `inputStyle` / `primaryBtn` は **これまで通り clothing-form.tsx から export し続ける**
     (app/recommend/page.tsx が `primaryBtn` を import しているため、互換を壊さない)

## 触ってよいファイル (これ以外は変更禁止)

- lib/sanitize.ts (新規), test/lib/sanitize.test.ts (新規)
- app/add/page.tsx, app/items/[id]/edit/page.tsx
- components/clothing-form.tsx, components/color-editor.tsx (新規), components/tag-chip-input.tsx (新規)

## 受け入れ条件

- `npx tsc --noEmit` がエラーなし
- `npx vitest run` が全テストパス
- フォームの見た目・挙動は不変
- コードスタイルは既存に合わせる (日本語コメント、設計判断のみコメント)
