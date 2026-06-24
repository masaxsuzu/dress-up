import { errorResponse } from "@/lib/api-response";
import { listItems } from "@/lib/db";
import { setLatestRecommendation } from "@/lib/latest-recommendation";
import { getProfile } from "@/lib/profile";
import { hydrateProposals } from "@/lib/proposal-hydrate";
import { loadImageBase64 } from "@/lib/r2";
import { recommendOutfits, type ItemImage } from "@/lib/recommend";
import { parseJson, route } from "@/lib/route-handler";
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

export const POST = route(async ({ req, env, user }) => {
  const parsed = await parseJson(req, RecommendInputSchema);
  if (!parsed.ok) return parsed.res;

  // ワードローブが空でも 3 案 (all buy) を返す方針なので、空判定でエラーにしない。
  const [items, profile] = await Promise.all([
    listItems(env.DB, user),
    getProfile(env.DB, user),
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
    // 見返し時に現在のワードローブから hydrate するので、保存後にアイテムが
    // 削除された場合も placeholder で安全に扱える。
    await setLatestRecommendation(env.DB, user, {
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
});
