import Anthropic from "@anthropic-ai/sdk";
import type { ClothingItem, Season } from "@/schema/clothing";
import { RecommendDraftSchema, type RecommendDraft } from "@/schema/recommend";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a fashion stylist for a Japanese personal wardrobe app.
You receive the user's wardrobe (a JSON list of items with attributes), the current season, and a TPO description.

Your job: propose ONE recommendation. The result is one of two kinds:

1. kind="outfit": If the wardrobe has enough items to build a complete, season-appropriate, TPO-appropriate outfit, return the item_ids of that outfit (using ONLY items from the provided list).
2. kind="shopping": If the wardrobe is missing key pieces required for the TPO/season (e.g. no formal shoes for a wedding, no warm coat in winter, no dress for a fancy dinner), DO NOT force a poor outfit from existing items. Instead, return a list of items the user should buy. Each missing item has a category and a Japanese description (e.g. "黒のレザーパンプス").

Rules:
- Output exactly one proposal (never both).
- A typical outfit has tops + bottoms + shoes. Outerwear / bag / accessory may be added. A "dress" replaces tops + bottoms.
- For kind="outfit": only reference item ids that exist in the provided list. NEVER invent ids. Each id used once.
- For kind="shopping": list 1-5 missing items, each genuinely necessary for the TPO. Don't suggest items the user already owns.
- Match the current season (avoid winter coats in summer, etc.) and the TPO (formality, vibe, color mood).
- "reason" is in Japanese, 1-3 sentences, concrete. For outfit, mention key items and why they suit the TPO. For shopping, explain what's missing and why it matters for this TPO.
- Always call the recommend_outfit tool. Never reply with plain text.`;

const TOOL_INPUT_SCHEMA = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["outfit", "shopping"],
      description:
        "outfit: the wardrobe is sufficient. shopping: items must be purchased.",
    },
    item_ids: {
      type: "array",
      items: { type: "string" },
      description:
        "Required when kind='outfit'. Ids from the provided wardrobe.",
    },
    missing: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "tops",
              "outerwear",
              "bottoms",
              "dress",
              "shoes",
              "bag",
              "accessory",
              "other",
            ],
          },
          description: {
            type: "string",
            description: "Japanese, concrete. e.g. '黒のレザーパンプス'",
          },
        },
        required: ["category", "description"],
      },
      description:
        "Required when kind='shopping'. Items the user should buy.",
    },
    reason: { type: "string" },
  },
  required: ["kind", "reason"],
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
        name: "recommend_outfit",
        description:
          "Record one outfit recommendation, or shopping suggestions if the wardrobe is insufficient.",
        input_schema: TOOL_INPUT_SCHEMA as never,
      },
    ],
    tool_choice: { type: "tool", name: "recommend_outfit" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Season: ${context.season}\nTPO: ${context.tpo}\n\nWardrobe (JSON):\n${JSON.stringify(compact)}\n\nPropose one outfit, or a shopping list if the wardrobe is insufficient.`,
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

  if (draft.kind === "shopping") {
    return draft;
  }

  // ハルシネーション防止: 存在しない id を返してきたら除外。
  const validIds = new Set(items.map((i) => i.id));
  const filtered = draft.item_ids.filter((id) => validIds.has(id));

  if (filtered.length === 0) {
    throw new Error("提案アイテムが既存のワードローブと一致しませんでした");
  }

  return { ...draft, item_ids: filtered };
}
