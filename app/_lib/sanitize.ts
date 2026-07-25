// VLM 抽出結果や DB 保存値をフォームで安全に扱える ClothingItemUpdate に変換する。
// add/page.tsx の sanitizeExtraction と edit/page.tsx の sanitizeForEdit を統合した共通ユーティリティ。

import {
  ClothingCategorySchema,
  PatternSchema,
  SeasonSchema,
  type ClothingItemUpdate,
} from "@/schema/clothing";

const validCategories = ClothingCategorySchema.options as readonly string[];
const validPatterns = PatternSchema.options as readonly string[];
const validSeasons = SeasonSchema.options as readonly string[];

/**
 * 不正な enum 値を安全なデフォルトに置き換えて ClothingItemUpdate を返す。
 * hadInvalidFields は edit 画面で警告表示する用途に使う。
 */
export function sanitizeToUpdate(input: {
  category: string;
  subcategory: string | null;
  colors: ClothingItemUpdate["colors"];
  pattern: string | null;
  material: string | null;
  silhouette: string | null;
  season: string[];
  formality: number;
  occasion: string[];
  tags: string[];
  brand: string | null;
  notes: string | null;
}): { sanitized: ClothingItemUpdate; hadInvalidFields: boolean } {
  let hadInvalidFields = false;

  const category = validCategories.includes(input.category)
    ? (input.category as ClothingItemUpdate["category"])
    : ((hadInvalidFields = true), "tops" as const);

  const pattern =
    input.pattern === null || validPatterns.includes(input.pattern)
      ? (input.pattern as ClothingItemUpdate["pattern"])
      : ((hadInvalidFields = true), null);

  const filteredSeasons = input.season.filter((s) =>
    validSeasons.includes(s),
  ) as ClothingItemUpdate["season"];

  if (filteredSeasons.length !== input.season.length || filteredSeasons.length === 0) {
    hadInvalidFields = true;
  }
  // シーズンが全滅した場合は spring をデフォルトにする
  const season = filteredSeasons.length > 0 ? filteredSeasons : (["spring"] as const as ClothingItemUpdate["season"]);

  return {
    sanitized: {
      category,
      subcategory: input.subcategory,
      colors: input.colors,
      pattern,
      material: input.material,
      silhouette: input.silhouette,
      season,
      formality: input.formality,
      occasion: input.occasion,
      tags: input.tags,
      brand: input.brand,
      notes: input.notes,
    },
    hadInvalidFields,
  };
}
