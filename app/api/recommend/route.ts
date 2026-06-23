import { getCloudflareContext } from "@opennextjs/cloudflare";
import { errorResponse, validationError } from "@/lib/api-response";
import { getUserEmail } from "@/lib/auth";
import { listItems } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { loadImageBase64 } from "@/lib/r2";
import { recommendOutfits, type ItemImage } from "@/lib/recommend";
import { currentSeason } from "@/lib/season";
import type { ClothingItem } from "@/schema/clothing";
import {
  RecommendInputSchema,
  type Proposal,
  type ProposalItem,
} from "@/schema/recommend";

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

    // draft の owned アイテムを ClothingItem に hydrate。
    // 万一 id が消滅していたら buy にフォールバック (description は元 item から推定難なので
    // generic に。実運用ではほぼ起きない)。
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const proposals: Proposal[] = draft.proposals.map((p) => ({
      reason: p.reason,
      items: p.items.flatMap<ProposalItem>((it) => {
        if (it.kind === "owned") {
          const item = itemMap.get(it.id);
          return item ? [{ kind: "owned", item }] : [];
        }
        return [{ kind: "buy", category: it.category, description: it.description }];
      }),
    }));

    return Response.json({ season, proposals });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse(message, 500);
  }
}
