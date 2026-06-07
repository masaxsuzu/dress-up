import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { listItems } from "@/lib/db";
import { buildOutfitPrompt } from "@/lib/outfit-prompt";

const InputSchema = z.object({
  item_ids: z.array(z.string()).min(1).max(10),
  tpo: z.string().min(1).max(200),
});

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

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

  const prompt = buildOutfitPrompt(items, parsed.data.tpo);

  try {
    const result = (await env.AI.run(MODEL, {
      prompt,
      steps: 4,
    })) as { image: string };

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
