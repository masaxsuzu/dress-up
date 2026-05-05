import Anthropic from "@anthropic-ai/sdk";
import { VLMExtractionSchema, type VLMExtraction } from "@/schema/clothing";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You analyze photos of clothing items and extract structured attributes for a Japanese personal wardrobe app.

Rules:
- Return only attributes that are clearly visible in the image.
- For uncertain optional attributes, use null rather than guessing.
- "colors" should list the dominant visible colors, most prominent first, max 4.
- "name" for each color must be a short Japanese color name (例: "ネイビー", "白", "オフホワイト", "ベージュ").
- "hex" should approximate the color as it appears in the photo (#RRGGBB).
- Formality scale: 1=loungewear, 2=casual, 3=smart casual, 4=business, 5=formal.
- The free-form fields below MUST be written in Japanese (日本語), since they are shown directly to the user:
  - "subcategory": short Japanese noun (例: "Tシャツ", "デニム", "ニット", "ブルゾン")
  - "material": short Japanese noun (例: "コットン", "ウール", "ポリエステル")
  - "silhouette": short Japanese phrase (例: "ゆったり", "タイト", "オーバーサイズ")
  - "occasion": Japanese keywords (例: ["オフィス", "デート", "休日"])
  - "tags": Japanese free-form keywords useful for search (例: ["定番", "お気に入り", "ヘビロテ"])
- The enum fields ("category", "pattern", "season") MUST use the English values defined in the tool schema; do not translate them.
- Always call the extract_clothing_attributes tool. Never reply with plain text.`;

const TOOL_INPUT_SCHEMA = {
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
    subcategory: { type: ["string", "null"] },
    colors: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        },
        required: ["name", "hex"],
      },
    },
    pattern: {
      type: ["string", "null"],
      enum: [
        "solid",
        "stripe",
        "check",
        "dot",
        "floral",
        "graphic",
        "other",
        null,
      ],
    },
    material: { type: ["string", "null"] },
    silhouette: { type: ["string", "null"] },
    season: {
      type: "array",
      minItems: 1,
      items: {
        type: "string",
        enum: ["spring", "summer", "autumn", "winter"],
      },
    },
    formality: { type: "integer", minimum: 1, maximum: 5 },
    occasion: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
  },
  required: [
    "category",
    "subcategory",
    "colors",
    "pattern",
    "material",
    "silhouette",
    "season",
    "formality",
    "occasion",
    "tags",
  ],
} as const;

export async function extractClothing(
  apiKey: string,
  image: { mediaType: string; base64: string },
): Promise<VLMExtraction> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "extract_clothing_attributes",
        description:
          "Record structured attributes extracted from a clothing photo.",
        input_schema: TOOL_INPUT_SCHEMA as never,
      },
    ],
    tool_choice: { type: "tool", name: "extract_clothing_attributes" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/gif",
              data: image.base64,
            },
          },
          { type: "text", text: "Extract attributes from this clothing photo." },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("VLM did not call the extraction tool");
  }
  return VLMExtractionSchema.parse(toolUse.input);
}
