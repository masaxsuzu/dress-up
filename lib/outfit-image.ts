import { GoogleGenAI, Modality } from "@google/genai";
import { buildOutfitPrompt, type PromptItem } from "@/lib/outfit-prompt";
import type { ClothingItem, Season } from "@/schema/clothing";

const MODEL = "gemini-2.5-flash-image";

// Owned アイテムを画像として渡すための実画像 (R2 から読んだ base64)。
export type OutfitImageInput = {
  id: string;
  mediaType: string;
  base64: string;
};

export type OutfitImage = {
  mediaType: string;
  base64: string;
};

export async function generateOutfitImage(
  apiKey: string,
  items: Array<ClothingItem | PromptItem>,
  images: OutfitImageInput[],
  options: { tpo: string; season: Season },
): Promise<OutfitImage> {
  const prompt = buildOutfitPrompt(items, options);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          ...images.map((img) => ({
            inlineData: { mimeType: img.mediaType, data: img.base64 },
          })),
          { text: prompt },
        ],
      },
    ],
    config: { responseModalities: [Modality.IMAGE] },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  );
  const data = part?.inlineData?.data;
  if (!data) throw new Error("画像が返されませんでした");
  return {
    mediaType: part?.inlineData?.mimeType ?? "image/png",
    base64: data,
  };
}
