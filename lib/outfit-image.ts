// Gemini (flash-image) で全身コーデ画像を生成。
import { GoogleGenAI, Modality } from "@google/genai";
import { buildOutfitPrompt, type PromptItem } from "@/lib/outfit-prompt";
import type { ClothingItem, Season } from "@/schema/clothing";
import type { Profile } from "@/schema/profile";

const MODEL = "gemini-2.5-flash-image";

// Owned アイテムを画像として渡すための実画像 (R2 から読んだ base64)。
export type OutfitImageInput = {
  id: string;
  mediaType: string;
  base64: string;
};

// プロフィールの参考画像 (顔・体型のモデル素材)。
export type ReferenceImageInput = {
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
  options: {
    tpo: string;
    season: Season;
    profile?: Profile | null;
    referenceImage?: ReferenceImageInput | null;
  },
): Promise<OutfitImage> {
  const hasReferenceImage = !!options.referenceImage;
  const prompt = buildOutfitPrompt(items, {
    tpo: options.tpo,
    season: options.season,
    profile: options.profile ?? null,
    hasReferenceImage,
  });

  // 参考画像があれば先頭に追加。Gemini は最初の画像を「被写体」と認識しやすい。
  const referenceParts = options.referenceImage
    ? [
        {
          inlineData: {
            mimeType: options.referenceImage.mediaType,
            data: options.referenceImage.base64,
          },
        },
        { text: "^ reference photo of the subject (use this face and physique)" },
      ]
    : [];

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          ...referenceParts,
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
