import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { listItems } from "@/lib/db";
import { generateOutfitImage, type OutfitImageInput } from "@/lib/outfit-image";
import type { ClothingItem, Season } from "@/schema/clothing";

const InputSchema = z.object({
  item_ids: z.array(z.string()).min(1).max(10),
  tpo: z.string().min(1).max(200),
  season: z.enum(["spring", "summer", "autumn", "winter"]).optional(),
});

function currentSeason(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

async function loadItemImage(
  bucket: R2Bucket,
  item: ClothingItem,
): Promise<OutfitImageInput | null> {
  const obj = await bucket.get(item.imageKey).catch(() => null);
  if (!obj) return null;
  const mediaType = obj.httpMetadata?.contentType ?? "image/jpeg";
  if (!mediaType.startsWith("image/")) return null;
  const buf = await obj.arrayBuffer();
  return {
    id: item.id,
    mediaType,
    base64: Buffer.from(buf).toString("base64"),
  };
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await req.json();
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const all = await listItems(env.DB);
  const map = new Map(all.map((i) => [i.id, i]));
  const items = parsed.data.item_ids
    .map((id) => map.get(id))
    .filter((x): x is NonNullable<typeof x> => x !== undefined);

  if (items.length === 0) {
    return Response.json(
      { error: "アイテムが見つかりません" },
      { status: 400 },
    );
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
    return Response.json({ error: message }, { status: 500 });
  }
}
