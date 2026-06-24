import { getCloudflareContext } from "@opennextjs/cloudflare";
import { errorResponse, validationError } from "@/lib/api-response";
import { getUserEmail } from "@/lib/auth";
import { listItems } from "@/lib/db";
import { setLatestRecommendation } from "@/lib/latest-recommendation";
import { getProfile } from "@/lib/profile";
import { hydrateProposals } from "@/lib/proposal-hydrate";
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
  const userEmail = getUserEmail(req);

  const body = await req.json();
  const parsed = RecommendInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  // ワードローブが空でも 3 案 (all buy) を返す方針なので、空判定でエラーにしない。
  const [items, profile] = await Promise.all([
    listItems(env.DB, userEmail),
    getProfile(env.DB, userEmail),
  ]);
  const season = currentSeason();

  // 画像はワードローブが空でない時のみロードする。
  const settled = items.length > 0
    ? await Promise.all(items.map((i) => loadItemImage(env.IMAGES, i)))
    : [];
  const images = settled.filter((x): x is ItemImage => x !== null);

  try {
    const draft = await recommendOutfits(env.GEMINI_API_KEY, items, {
      season,
      tpo: parsed.data.tpo,
      images,
      profile,
    });

    // 「最新の提案」として draft (owned: id だけの軽量形) を D1 に保存。
    // hydrate 済みの ClothingItem を保存すると古い snapshot がずっと残るので
    // あくまで id 参照。見返し時に現在のワードローブから hydrate する。
    await setLatestRecommendation(env.DB, userEmail, {
      tpo: parsed.data.tpo,
      season,
      proposals: draft.proposals,
    });

    const proposals = hydrateProposals(draft.proposals, items);
    return Response.json({ season, proposals });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse(message, 500);
  }
}
