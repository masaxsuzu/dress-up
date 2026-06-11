import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";
import { errorResponse, validationError } from "@/lib/api-response";
import { loadImageBase64 } from "@/lib/r2";
import { recommendOutfits, type ItemImage } from "@/lib/recommend";
import { currentSeason } from "@/lib/season";
import type { ClothingItem } from "@/schema/clothing";
import { RecommendInputSchema } from "@/schema/recommend";

async function loadItemImage(
  bucket: R2Bucket,
  item: ClothingItem,
): Promise<ItemImage | null> {
  const img = await loadImageBase64(bucket, item.imageKey);
  if (!img) return null;
  return { id: item.id, ...img };
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await req.json();
  const parsed = RecommendInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const items = await listItems(env.DB);
  if (items.length === 0) {
    return errorResponse("ワードローブにアイテムがまだありません", 400);
  }

  const season = currentSeason();

  const settled = await Promise.all(items.map((i) => loadItemImage(env.IMAGES, i)));
  const images = settled.filter((x): x is ItemImage => x !== null);

  try {
    const draft = await recommendOutfits(env.GEMINI_API_KEY, items, {
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
    return errorResponse(message, 500);
  }
}
