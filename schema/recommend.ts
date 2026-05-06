import { z } from "zod";
import { ClothingCategorySchema, ClothingItemSchema } from "./clothing";

export const RecommendInputSchema = z.object({
  tpo: z.string().min(1).max(200),
});
export type RecommendInput = z.infer<typeof RecommendInputSchema>;

// 買うべきアイテムの提案（既存ワードローブに無い品）
export const MissingItemSchema = z.object({
  category: ClothingCategorySchema,
  description: z.string().min(1),
});
export type MissingItem = z.infer<typeof MissingItemSchema>;

// Claude が返す素のレスポンス。outfit か shopping のいずれか。
export const OutfitProposalSchema = z.object({
  kind: z.literal("outfit"),
  item_ids: z.array(z.string()).min(1),
  reason: z.string().min(1),
});
export const ShoppingProposalSchema = z.object({
  kind: z.literal("shopping"),
  missing: z.array(MissingItemSchema).min(1),
  reason: z.string().min(1),
});
export const RecommendDraftSchema = z.discriminatedUnion("kind", [
  OutfitProposalSchema,
  ShoppingProposalSchema,
]);
export type RecommendDraft = z.infer<typeof RecommendDraftSchema>;

// API がクライアントに返す形（item を hydrate 済み）
export const OutfitSchema = z.object({
  kind: z.literal("outfit"),
  items: z.array(ClothingItemSchema),
  reason: z.string(),
});
export type Outfit = z.infer<typeof OutfitSchema>;

export const ShoppingSchema = z.object({
  kind: z.literal("shopping"),
  missing: z.array(MissingItemSchema),
  reason: z.string(),
});
export type Shopping = z.infer<typeof ShoppingSchema>;
