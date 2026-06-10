import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { listItems } from "@/lib/db";
import { buildOutfitPrompt } from "@/lib/outfit-prompt";
import type { Season } from "@/schema/clothing";

const InputSchema = z.object({
  item_ids: z.array(z.string()).min(1).max(10),
  tpo: z.string().min(1).max(200),
  season: z.enum(["spring", "summer", "autumn", "winter"]).optional(),
});

const MODEL = "@cf/black-forest-labs/flux-2-dev";

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

  const prompt = buildOutfitPrompt(items, {
    tpo: parsed.data.tpo,
    season: parsed.data.season ?? currentSeason(),
  });

  try {
    // flux-2-dev は multipart 入力。body には text-to-image パラメタを JSON で渡す。
    const result = (await env.AI.run(MODEL, {
      multipart: {
        contentType: "application/json",
        body: {
          prompt,
          width: 768,
          height: 1152,
          steps: 28,
          guidance: 3.5,
        },
      },
    })) as { image: string };

    if (!result.image) {
      throw new Error("画像が返されませんでした");
    }

    const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
