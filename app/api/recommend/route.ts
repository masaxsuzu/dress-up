import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";
import { recommendOutfits, type ItemImage } from "@/lib/recommend";
import type { ClothingItem, Season } from "@/schema/clothing";
import { RecommendInputSchema } from "@/schema/recommend";

const ALLOWED_MEDIA_TYPES = new Set<ItemImage["mediaType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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
): Promise<ItemImage | null> {
  const obj = await bucket.get(item.imageKey).catch(() => null);
  if (!obj) return null;
  const mediaType = (obj.httpMetadata?.contentType ??
    "image/jpeg") as ItemImage["mediaType"];
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) return null;
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
  const parsed = RecommendInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const items = await listItems(env.DB);
  if (items.length === 0) {
    return Response.json(
      { error: "ワードローブにアイテムがまだありません" },
      { status: 400 },
    );
  }

  const season = currentSeason();

  const settled = await Promise.all(items.map((i) => loadItemImage(env.IMAGES, i)));
  const images = settled.filter((x): x is ItemImage => x !== null);

  try {
    const draft = await recommendOutfits(env.ANTHROPIC_API_KEY, items, {
      season,
      tpo: parsed.data.tpo,
      images,
    });

    if (draft.kind === "shopping") {
      return Response.json({
        season,
        kind: "shopping" as const,
        missing: draft.missing,
        reason: draft.reason,
      });
    }

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const hydratedItems = draft.item_ids
      .map((id) => itemMap.get(id))
      .filter((x): x is NonNullable<typeof x> => x !== undefined);

    return Response.json({
      season,
      kind: "outfit" as const,
      items: hydratedItems,
      reason: draft.reason,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
