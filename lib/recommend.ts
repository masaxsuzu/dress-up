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

Your job: propose THREE distinct full outfit coordinations for this TPO and season. Each proposal is a complete outfit (tops + bottoms + shoes at minimum; outerwear / bag / accessory may be added; a "dress" replaces tops + bottoms). Across the three proposals try to vary the vibe (e.g. one safer, one bolder, one more polished).

For each proposal, each item is either:
- {kind: "owned", id: "<id from the provided wardrobe>"} — use ONLY ids that exist in the provided list, never invent ids
- {kind: "buy", category, description} — when no suitable owned item fills a slot, suggest a specific item the user should buy (description is a concrete Japanese phrase, e.g. "黒のレザーパンプス")

Rules:
- Always return exactly 3 proposals, even if the wardrobe is small — fill the gaps with kind="buy" items rather than dropping the slot.
- Within a single outfit, prefer owned items when something suitable exists. Mix owned + buy freely.
- Don't suggest a "buy" item the user clearly already owns.
- Match the current season and TPO (formality, vibe, color mood).
- "reason" is in Japanese, 1-3 concrete sentences explaining the coordination and why it suits the TPO. Mention key items.
- Always call the recommend_outfits tool. Never reply with plain text.`;

const PROPOSAL_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    kind: {
      type: Type.STRING,
      enum: ["owned", "buy"],
      description:
        "owned: reuse an existing wardrobe item by id. buy: suggest a new item with category+description.",
    },
    id: {
      type: Type.STRING,
      description: "Required when kind='owned'. Must be an id from the provided wardrobe.",
    },
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
      description: "Required when kind='buy'.",
    },
    description: {
      type: Type.STRING,
      description: "Required when kind='buy'. Concrete Japanese, e.g. '黒のレザーパンプス'.",
    },
  },
  required: ["kind"],
};

const TOOL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    proposals: {
      type: Type.ARRAY,
      description: "Exactly three full outfit proposals.",
      minItems: "3",
      maxItems: "3",
      items: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description:
              "The garments that make up this outfit. Each item is owned (id) or buy (category+description).",
            items: PROPOSAL_ITEM_SCHEMA,
          },
          reason: { type: Type.STRING },
        },
        required: ["items", "reason"],
      },
    },
  },
  required: ["proposals"],
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
  const ai = new GoogleGenAI({ apiKey });
  const compact = items.map(compactItem);
  const images = context.images ?? [];

  // ユーザーメッセージ:
  //   1. ヘッダー (season / TPO / wardrobe JSON; empty なら明示)
  //   2. 各アイテムの画像 + id ラベル
  //   3. 末尾の指示
  const wardrobeText = compact.length > 0
    ? `Wardrobe (JSON):\n${JSON.stringify(compact)}`
    : "Wardrobe: (empty — every item in every proposal must be kind=\"buy\")";

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `Season: ${context.season}\nTPO: ${context.tpo}\n\n${wardrobeText}`,
    },
  ];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    parts.push({ text: `^ id: ${img.id}` });
  }
  parts.push({
    text: "Propose three full outfit coordinations for this TPO and season.",
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
              name: "recommend_outfits",
              description:
                "Record three full outfit coordinations. Each item is owned (id) or buy (category+description).",
              parameters: TOOL_SCHEMA as never,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["recommend_outfits"],
        },
      },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call || call.name !== "recommend_outfits") {
    throw new Error("Gemini did not call the recommendation tool");
  }

  const draft = RecommendDraftSchema.parse(call.args);

  // ハルシネーション防止: owned の id が wardrobe に無ければ buy にフォールバック。
  // ProposalDraft は最低 1 アイテム持つので、全部消えると invalid になる。
  // 1 案ぶんが空になりうるが、実際そうなることは Pro の指示上ほぼない。
  const validIds = new Set(items.map((i) => i.id));
  const proposals = draft.proposals.map((p) => ({
    ...p,
    items: p.items.filter((i) => i.kind === "buy" || validIds.has(i.id)),
  }));

  // 空の items は無効なのでフィルタするのではなく、最低 1 個の "buy" placeholder を
  // 入れて schema を満たす。実運用では Pro はちゃんと埋めてくるはずなのでセーフネット。
  for (const p of proposals) {
    if (p.items.length === 0) {
      p.items.push({
        kind: "buy",
        category: "other",
        description: "(モデルが有効な提案を返しませんでした)",
      });
    }
  }

  return { proposals } as RecommendDraft;
}
