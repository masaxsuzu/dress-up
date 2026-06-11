import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { listItems } from "@/lib/db";
import { errorResponse, validationError } from "@/lib/api-response";
import { generateOutfitImage, type OutfitImageInput } from "@/lib/outfit-image";
import { loadImageBase64 } from "@/lib/r2";
import { currentSeason } from "@/lib/season";
import type { ClothingItem } from "@/schema/clothing";

const InputSchema = z.object({
  item_ids: z.array(z.string()).min(1).max(10),
  tpo: z.string().min(1).max(200),
  season: z.enum(["spring", "summer", "autumn", "winter"]).optional(),
});

async function loadItemImage(
  bucket: R2Bucket,
  item: ClothingItem,
): Promise<OutfitImageInput | null> {
  const img = await loadImageBase64(bucket, item.imageKey);
  if (!img) return null;
  return { id: item.id, ...img };
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await req.json();
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const all = await listItems(env.DB);
  const map = new Map(all.map((i) => [i.id, i]));
  const items = parsed.data.item_ids
    .map((id) => map.get(id))
    .filter((x): x is NonNullable<typeof x> => x !== undefined);

  if (items.length === 0) {
    return errorResponse("アイテムが見つかりません", 400);
  }

  const settled = await Promise.all(items.map((i) => loadItemImage(env.IMAGES, i)));
  const images = settled.filter(
    (x): x is OutfitImageInput => x !== null,
  );

  try {
    const image = await generateOutfitImage(env.GEMINI_API_KEY, items, images, {
      tpo: parsed.data.tpo,
      season: parsed.data.season ?? currentSeason(),
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
}
