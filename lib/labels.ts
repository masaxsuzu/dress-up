// enum 値 → 日本語表示ラベルの対応表と itemLabel ヘルパー。
import type {
  ClothingCategory,
  Pattern,
  Season,
} from "@/schema/clothing";

export const CATEGORY_LABEL: Record<ClothingCategory, string> = {
  tops: "トップス",
  outerwear: "アウター",
  bottoms: "ボトムス",
  dress: "ワンピース",
  shoes: "シューズ",
  bag: "バッグ",
  accessory: "アクセサリー",
  other: "その他",
};

export const SEASON_LABEL: Record<Season, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

export const PATTERN_LABEL: Record<Pattern, string> = {
  solid: "無地",
  stripe: "ストライプ",
  check: "チェック",
  dot: "ドット",
  floral: "花柄",
  graphic: "グラフィック",
  other: "その他",
};

// サブカテゴリがあればそれだけ表示、なければカテゴリ名。
export function itemLabel(
  category: ClothingCategory,
  subcategory: string | null | undefined,
): string {
  return subcategory ?? CATEGORY_LABEL[category];
}

export const FORMALITY_LABEL: Record<number, string> = {
  1: "ルームウェア",
  2: "カジュアル",
  3: "スマートカジュアル",
  4: "ビジネス",
  5: "フォーマル",
};
