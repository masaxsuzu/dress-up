import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Type,
} from "@google/genai";
import type { ClothingItem, Season } from "@/schema/clothing";
import { RecommendDraftSchema, type RecommendDraft } from "@/schema/recommend";

const MODEL = "gemini-2.5-pro";

export type ItemImage = {
  id: string;
  mediaType: string;
  base64: string;
};

const SYSTEM_PROMPT = `You are a fashion stylist for a Japanese personal wardrobe app.
You receive the user's wardrobe — both the structured attributes (JSON) and the actual photos of each item — together with the current season and a TPO description. Use the images to judge color tone, texture, fit and styling cues that the JSON cannot fully convey.

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

const TOOL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    kind: {
      type: Type.STRING,
      enum: ["outfit", "shopping"],
      description:
        "outfit: the wardrobe is sufficient. shopping: items must be purchased.",
    },
    item_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Required when kind='outfit'. Ids from the provided wardrobe.",
    },
    missing: {
      type: Type.ARRAY,
      maxItems: "5",
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
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
            type: Type.STRING,
            description: "Japanese, concrete. e.g. '黒のレザーパンプス'",
          },
        },
        required: ["category", "description"],
      },
      description: "Required when kind='shopping'. Items the user should buy.",
    },
    reason: { type: Type.STRING },
  },
  required: ["kind", "reason"],
};

// Gemini に渡す軽量 view。imageKey, hex, notes, タイムスタンプは不要。
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
  context: { season: Season; tpo: string; images?: ItemImage[] },
): Promise<RecommendDraft> {
  if (items.length === 0) {
    throw new Error("ワードローブにアイテムがありません");
  }

  const ai = new GoogleGenAI({ apiKey });
  const compact = items.map(compactItem);
  const images = context.images ?? [];

  // ユーザーメッセージ:
  //   1. ヘッダー（季節 / TPO / JSON）
  //   2. 各アイテムについて [画像] + [id ラベル]
  //   3. 末尾の指示
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `Season: ${context.season}\nTPO: ${context.tpo}\n\nWardrobe (JSON):\n${JSON.stringify(compact)}`,
    },
  ];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    parts.push({ text: `^ id: ${img.id}` });
  }
  parts.push({
    text: "Propose one outfit, or a shopping list if the wardrobe is insufficient.",
  });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [
        {
          functionDeclarations: [
            {
              name: "recommend_outfit",
              description:
                "Record one outfit recommendation, or shopping suggestions if the wardrobe is insufficient.",
              parameters: TOOL_SCHEMA as never,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["recommend_outfit"],
        },
      },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call || call.name !== "recommend_outfit") {
    throw new Error("Gemini did not call the recommendation tool");
  }

  const draft = RecommendDraftSchema.parse(call.args);

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
