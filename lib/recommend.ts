import Anthropic from "@anthropic-ai/sdk";
import type { ClothingItem, Season } from "@/schema/clothing";
import { RecommendDraftSchema, type RecommendDraft } from "@/schema/recommend";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a fashion stylist for a Japanese personal wardrobe app.
You receive the user's wardrobe (a JSON list of items with attributes), the current season, and a TPO description.

Your job: propose 3 distinct outfit ideas using ONLY items from the provided wardrobe.

Outfit construction rules:
- A typical outfit has tops + bottoms + shoes. Outerwear / bag / accessory may be added.
- A "dress" item replaces tops + bottoms.
- Each outfit must include at least 1 item, no item used twice within the same outfit.
- Only reference item ids that exist in the provided list. NEVER invent ids.
- Match the current season (avoid winter coats in summer, etc.).
- Match the TPO: formality, vibe, color mood.
- The 3 outfits should be distinct from each other (different vibes, formality levels, or color tones).
- Each outfit's "reason" must be in Japanese, 1-2 sentences, concrete (mention key items and why they suit the TPO).
- Always call the recommend_outfits tool. Never reply with plain text.`;

const TOOL_INPUT_SCHEMA = {
  type: "object",
  properties: {
    outfits: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          item_ids: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          reason: { type: "string" },
        },
        required: ["item_ids", "reason"],
      },
    },
  },
  required: ["outfits"],
} as const;

// Claude に渡す軽量 view。imageKey, hex, notes, タイムスタンプは不要。
function compactItem(item: ClothingItem) {
  return {
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    colors: item.colors.map((c) => c.name),
    pattern: item.pattern,
    season: item.season,
    formality: item.formality,
    occasion: item.occasion,
    tags: item.tags,
    brand: item.brand,
  };
}

export async function recommendOutfits(
  apiKey: string,
  items: ClothingItem[],
  context: { season: Season; tpo: string },
): Promise<RecommendDraft> {
  if (items.length === 0) {
    throw new Error("ワードローブにアイテムがありません");
  }

  const client = new Anthropic({ apiKey });
  const compact = items.map(compactItem);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "recommend_outfits",
        description: "Record outfit recommendations.",
        input_schema: TOOL_INPUT_SCHEMA as never,
      },
    ],
    tool_choice: { type: "tool", name: "recommend_outfits" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Season: ${context.season}\nTPO: ${context.tpo}\n\nWardrobe (JSON):\n${JSON.stringify(compact)}\n\nPropose 3 outfits.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call the recommendation tool");
  }

  const draft = RecommendDraftSchema.parse(toolUse.input);

  // ハルシネーション防止: 存在しない id を返してきたらフィルタ。
  // 全アイテムが消えた outfit は捨てる。
  const validIds = new Set(items.map((i) => i.id));
  const cleaned = draft.outfits
    .map((o) => ({
      ...o,
      item_ids: o.item_ids.filter((id) => validIds.has(id)),
    }))
    .filter((o) => o.item_ids.length > 0);

  if (cleaned.length === 0) {
    throw new Error("提案アイテムが既存のワードローブと一致しませんでした");
  }

  return { outfits: cleaned };
}
