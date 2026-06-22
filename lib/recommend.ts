import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Type,
} from "@google/genai";
import { z } from "zod";
import {
  ClothingCategorySchema,
  type ClothingItem,
  type Season,
} from "@/schema/clothing";
import type { Profile } from "@/schema/profile";
import {
  RecommendDraftSchema,
  type ProposalItemDraft,
  type RecommendDraft,
} from "@/schema/recommend";

const MODEL = "gemini-2.5-pro";

export type ItemImage = {
  id: string;
  mediaType: string;
  base64: string;
};

const SYSTEM_PROMPT = `You are a fashion stylist for a Japanese personal wardrobe app.
You receive the user's wardrobe — both the structured attributes (JSON) and the actual photos of each item — together with the current season and a TPO description. Use the images to judge color tone, texture, fit and styling cues that the JSON cannot fully convey.

Your job: propose THREE distinct full outfit coordinations for this TPO and season. Each proposal is a complete outfit (tops + bottoms + shoes at minimum; outerwear / bag / accessory may be added; a "dress" replaces tops + bottoms). Across the three proposals try to vary the vibe (e.g. one safer, one bolder, one more polished).

For each item, emit EXACTLY one of these two shapes — never mix the fields:

  {"kind": "owned", "id": "<id from the provided wardrobe>"}
    — use ONLY ids that appear in the provided wardrobe list, never invent
    — DO NOT include category or description for owned items

  {"kind": "buy", "category": "<one of: tops, outerwear, bottoms, dress, shoes, bag, accessory, other>", "description": "<concrete Japanese phrase>"}
    — REQUIRED: both category AND description. If you cannot fill both, do not emit a buy item at all
    — DO NOT include id for buy items

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

// Pro の function_call は条件付き required を理解しないので、buy なのに
// category/description を欠落させたり、kind を omit してくることがある。
// strict Zod に入れる前にここで救えるものを救う。
const LooseItemSchema = z.object({
  kind: z.string().optional(),
  id: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

const LooseDraftSchema = z.object({
  proposals: z
    .array(
      z.object({
        items: z.array(LooseItemSchema).optional(),
        reason: z.string().optional(),
      }).passthrough(),
    )
    .optional(),
}).passthrough();

function normalizeItem(
  it: z.infer<typeof LooseItemSchema>,
): ProposalItemDraft | null {
  // kind が無くてもフィールドの有無から推定する
  let kind = it.kind;
  if (!kind) {
    if (it.id && !it.category && !it.description) kind = "owned";
    else if (it.category || it.description) kind = "buy";
    else return null;
  }
  if (kind === "owned") {
    return it.id ? { kind: "owned", id: it.id } : null;
  }
  if (kind === "buy") {
    // category が enum 外でも "other" にフォールバック、description が無ければ
    // placeholder を入れて schema を保つ (実運用では Pro はだいたい埋めてくる)。
    const catParse = ClothingCategorySchema.safeParse(it.category);
    const category = catParse.success ? catParse.data : "other";
    const description = it.description?.trim() || "(モデルが説明を返しませんでした)";
    return { kind: "buy", category, description };
  }
  return null;
}

// プロフィールから提案者ヒント文を組み立てる。Pro はこれを読んで
// 体型に合うシルエットや、性別に応じたカテゴリ (e.g. dress) の使い分けを判断する。
function formatProfile(profile: Profile | null | undefined): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.gender) parts.push(`gender: ${profile.gender}`);
  if (profile.heightCm) parts.push(`${profile.heightCm}cm`);
  if (profile.weightKg) parts.push(`${profile.weightKg}kg`);
  if (profile.bodyType) parts.push(profile.bodyType);
  return parts.length > 0 ? `User profile: ${parts.join(", ")}.\n` : "";
}

export async function recommendOutfits(
  apiKey: string,
  items: ClothingItem[],
  context: {
    season: Season;
    tpo: string;
    images?: ItemImage[];
    profile?: Profile | null;
  },
): Promise<RecommendDraft> {
  const ai = new GoogleGenAI({ apiKey });
  const compact = items.map(compactItem);
  const images = context.images ?? [];

  const wardrobeText = compact.length > 0
    ? `Wardrobe (JSON):\n${JSON.stringify(compact)}`
    : "Wardrobe: (empty — every item in every proposal must be kind=\"buy\")";

  const profileText = formatProfile(context.profile);

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `Season: ${context.season}\nTPO: ${context.tpo}\n${profileText}\n${wardrobeText}`,
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

  // 緩いスキーマで一旦受けて手で正規化する。
  const raw = LooseDraftSchema.parse(call.args ?? {});
  const validIds = new Set(items.map((i) => i.id));

  const proposals = (raw.proposals ?? []).map((p) => {
    const normalized = (p.items ?? [])
      .map(normalizeItem)
      .filter((x): x is ProposalItemDraft => x !== null)
      // owned のハルシ id (wardrobe に無いもの) は除外
      .filter((x) => x.kind === "buy" || validIds.has(x.id));

    // 各 proposal に最低 1 個確保 (Zod の min(1) を満たすため)
    if (normalized.length === 0) {
      normalized.push({
        kind: "buy",
        category: "other",
        description: "(モデルが有効な提案を返しませんでした)",
      });
    }

    return {
      items: normalized,
      reason: p.reason?.trim() || "(理由なし)",
    };
  });

  // 3 案に揃える: 足りなければ placeholder で埋め、余れば切り詰め
  while (proposals.length < 3) {
    proposals.push({
      reason: "(モデルが追加の提案を返しませんでした)",
      items: [{ kind: "buy", category: "other", description: "(該当なし)" }],
    });
  }
  if (proposals.length > 3) proposals.length = 3;

  // 厳密スキーマでもう一度通して、形が正しいことを保証する。
  return RecommendDraftSchema.parse({ proposals });
}
