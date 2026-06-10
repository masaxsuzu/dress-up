import { z } from "zod";

export const ClothingCategorySchema = z.enum([
  "tops",
  "outerwear",
  "bottoms",
  "dress",
  "shoes",
  "bag",
  "accessory",
  "other",
]);
export type ClothingCategory = z.infer<typeof ClothingCategorySchema>;

export const SeasonSchema = z.enum(["spring", "summer", "autumn", "winter"]);
export type Season = z.infer<typeof SeasonSchema>;

export const PatternSchema = z.enum([
  "solid",
  "stripe",
  "check",
  "dot",
  "floral",
  "graphic",
  "other",
]);
export type Pattern = z.infer<typeof PatternSchema>;

export const ColorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type Color = z.infer<typeof ColorSchema>;

// VLM が画像から抽出する属性。画像キーや時刻はサーバー側で付与する。
export const VLMExtractionSchema = z.object({
  category: ClothingCategorySchema,
  subcategory: z.string().nullable(),
  colors: z.array(ColorSchema).min(1).max(4),
  pattern: PatternSchema.nullable(),
  material: z.string().nullable(),
  silhouette: z.string().nullable(),
  season: z.array(SeasonSchema).min(1),
  formality: z.number().int().min(1).max(5),
  occasion: z.array(z.string()),
  tags: z.array(z.string()),
});
export type VLMExtraction = z.infer<typeof VLMExtractionSchema>;

// ユーザーが編集して保存する直前の形。
export const ClothingItemInputSchema = VLMExtractionSchema.extend({
  brand: z.string().nullable(),
  notes: z.string().nullable(),
  imageKey: z.string().min(1),
});
export type ClothingItemInput = z.infer<typeof ClothingItemInputSchema>;

// DBに保存された行を読み出した形。
export const ClothingItemSchema = ClothingItemInputSchema.extend({
  id: z.string(),
  iconKey: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClothingItem = z.infer<typeof ClothingItemSchema>;

// 編集時の入力形 (imageKey は変更しない)。
export const ClothingItemUpdateSchema = VLMExtractionSchema.extend({
  brand: z.string().nullable(),
  notes: z.string().nullable(),
});
export type ClothingItemUpdate = z.infer<typeof ClothingItemUpdateSchema>;
