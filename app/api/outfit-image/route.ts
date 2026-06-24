import { z } from "zod";
import { errorResponse } from "@/lib/api-response";
import { getItem } from "@/lib/db";
import {
  generateOutfitImage,
  type OutfitImageInput,
  type ReferenceImageInput,
} from "@/lib/outfit-image";
import type { PromptItem } from "@/lib/outfit-prompt";
import { getProfile } from "@/lib/profile";
import { loadImageBase64 } from "@/lib/r2";
import { parseJson, route } from "@/lib/route-handler";
import { currentSeason } from "@/lib/season";
import { ClothingCategorySchema } from "@/schema/clothing";

// owned / buy 両方を受ける。owned は wardrobe の id、buy は category + description。
const InputItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("owned"), id: z.string().min(1) }),
  z.object({
    kind: z.literal("buy"),
    category: ClothingCategorySchema,
    description: z.string().min(1),
  }),
]);

const InputSchema = z.object({
  items: z.array(InputItemSchema).min(1).max(10),
  tpo: z.string().min(1).max(200),
  season: z.enum(["spring", "summer", "autumn", "winter"]).optional(),
});

export const POST = route(async ({ req, env, user }) => {
  const parsed = await parseJson(req, InputSchema);
  if (!parsed.ok) return parsed.res;

  // owned は DB から fetch、画像を R2 から base64 化して Gemini に渡す。
  // buy はテキストで渡すのみ。
  const promptItems: PromptItem[] = [];
  const images: OutfitImageInput[] = [];
  for (const it of parsed.data.items) {
    if (it.kind === "owned") {
      const item = await getItem(env.DB, user, it.id);
      if (!item) continue;
      promptItems.push({ kind: "owned", item });
      const img = await loadImageBase64(env.IMAGES, item.imageKey);
      if (img) images.push({ id: item.id, ...img });
    } else {
      promptItems.push({ kind: "buy", category: it.category, description: it.description });
    }
  }

  if (promptItems.length === 0) {
    return errorResponse("アイテムが見つかりません", 400);
  }

  // プロフィール (性別・体型) と参考画像を Flash Image に同梱する。
  const profile = await getProfile(env.DB, user);
  let referenceImage: ReferenceImageInput | null = null;
  if (profile?.referenceImageKey) {
    const ref = await loadImageBase64(env.IMAGES, profile.referenceImageKey);
    if (ref) referenceImage = ref;
  }

  try {
    const image = await generateOutfitImage(env.GEMINI_API_KEY, promptItems, images, {
      tpo: parsed.data.tpo,
      season: parsed.data.season ?? currentSeason(),
      profile,
      referenceImage,
    });

    const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        "Content-Type": image.mediaType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse(message, 500);
  }
});
