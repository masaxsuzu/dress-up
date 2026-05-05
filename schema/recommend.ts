import { z } from "zod";
import { ClothingItemSchema } from "./clothing";

export const RecommendInputSchema = z.object({
  tpo: z.string().min(1).max(200),
});
export type RecommendInput = z.infer<typeof RecommendInputSchema>;

// Claude が返す素のレスポンス。item_ids はワードローブの id 集合に存在する前提。
export const OutfitDraftSchema = z.object({
  item_ids: z.array(z.string()).min(1),
  reason: z.string().min(1),
});
export const RecommendDraftSchema = z.object({
  outfits: z.array(OutfitDraftSchema).min(1).max(5),
});
export type RecommendDraft = z.infer<typeof RecommendDraftSchema>;

// API がクライアントに返す形（item を hydrate 済み）
export const OutfitSchema = z.object({
  items: z.array(ClothingItemSchema),
  reason: z.string(),
});
export type Outfit = z.infer<typeof OutfitSchema>;
