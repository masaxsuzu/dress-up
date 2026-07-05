// Gemini (2.5-flash, forced function calling) で服写真から属性を抽出。
import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Type,
} from "@google/genai";
import { VLMExtractionSchema, type VLMExtraction } from "@/schema/clothing";

const MODEL = "gemini-2.5-flash";

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

// vlm-schema-sync.test.ts (test/lib/) が VLMExtractionSchema (schema/clothing.ts)
// との同期を検証するため export する。
export const TOOL_SCHEMA = {
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
    subcategory: { type: Type.STRING, nullable: true },
    colors: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "4",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          hex: { type: Type.STRING, pattern: "^#[0-9A-Fa-f]{6}$" },
        },
        required: ["name", "hex"],
      },
    },
    pattern: {
      type: Type.STRING,
      nullable: true,
      enum: ["solid", "stripe", "check", "dot", "floral", "graphic", "other"],
    },
    material: { type: Type.STRING, nullable: true },
    silhouette: { type: Type.STRING, nullable: true },
    season: {
      type: Type.ARRAY,
      minItems: "1",
      items: {
        type: Type.STRING,
        enum: ["spring", "summer", "autumn", "winter"],
      },
    },
    formality: { type: Type.INTEGER, minimum: 1, maximum: 5 },
    occasion: { type: Type.ARRAY, items: { type: Type.STRING } },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
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
};

export async function extractClothing(
  apiKey: string,
  image: { mediaType: string; base64: string },
): Promise<VLMExtraction> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: image.mediaType, data: image.base64 } },
          { text: "Extract attributes from this clothing photo." },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [
        {
          functionDeclarations: [
            {
              name: "extract_clothing_attributes",
              description:
                "Record structured attributes extracted from a clothing photo.",
              parameters: TOOL_SCHEMA,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["extract_clothing_attributes"],
        },
      },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call || call.name !== "extract_clothing_attributes") {
    throw new Error("VLM did not call the extraction tool");
  }
  return VLMExtractionSchema.parse(call.args);
}
