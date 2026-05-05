import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";
import { recommendOutfits } from "@/lib/recommend";
import type { Season } from "@/schema/clothing";
import { RecommendInputSchema } from "@/schema/recommend";

function currentSeason(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
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

  try {
    const draft = await recommendOutfits(env.ANTHROPIC_API_KEY, items, {
      season,
      tpo: parsed.data.tpo,
    });

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const outfits = draft.outfits.map((o) => ({
      items: o.item_ids
        .map((id) => itemMap.get(id))
        .filter((x): x is NonNullable<typeof x> => x !== undefined),
      reason: o.reason,
    }));

    return Response.json({ season, outfits });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
