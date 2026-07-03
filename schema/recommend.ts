// コーデ提案の Zod スキーマ (リクエスト / 保存用 draft / hydrate 後の Proposal)。
import { z } from "zod";
import { ClothingCategorySchema, ClothingItemSchema } from "./clothing";

// クライアントが送るリクエスト。season は省略 (サーバが現在月から推定)。
export const RecommendInputSchema = z.object({
  tpo: z.string().min(1).max(200),
});
export type RecommendInput = z.infer<typeof RecommendInputSchema>;

// 1 案の中の 1 アイテム (Gemini 生レスポンス内)。
// - owned: 既存ワードローブから流用、id は item.id
// - buy: 持っていないので買うべき。description は具体的な日本語 (例「黒のレザースニーカー」)
export const ProposalItemDraftSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("owned"), id: z.string().min(1) }),
  z.object({
    kind: z.literal("buy"),
    category: ClothingCategorySchema,
    description: z.string().min(1),
  }),
]);
export type ProposalItemDraft = z.infer<typeof ProposalItemDraftSchema>;

// Gemini Pro が返す 1 案。
export const ProposalDraftSchema = z.object({
  items: z.array(ProposalItemDraftSchema).min(1),
  reason: z.string().min(1),
});
export type ProposalDraft = z.infer<typeof ProposalDraftSchema>;

// Gemini Pro の生レスポンス。常に 3 案。
export const RecommendDraftSchema = z.object({
  proposals: z.array(ProposalDraftSchema).length(3),
});
export type RecommendDraft = z.infer<typeof RecommendDraftSchema>;

// API がクライアントに返す 1 案 (owned は ClothingItem に hydrate 済み)。
export const ProposalItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("owned"), item: ClothingItemSchema }),
  z.object({
    kind: z.literal("buy"),
    category: ClothingCategorySchema,
    description: z.string().min(1),
  }),
]);
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export const ProposalSchema = z.object({
  items: z.array(ProposalItemSchema).min(1),
  reason: z.string(),
});
export type Proposal = z.infer<typeof ProposalSchema>;
