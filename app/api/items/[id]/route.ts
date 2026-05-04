import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deleteItem, getItem } from "@/lib/db";
import { deleteImage } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const item = await getItem(env.DB, id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ item });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });

  const item = await getItem(env.DB, id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });

  await deleteItem(env.DB, id);
  await deleteImage(env.IMAGES, item.imageKey);
  return new Response(null, { status: 204 });
}
