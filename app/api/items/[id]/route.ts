import { getCloudflareContext } from "@opennextjs/cloudflare";
import { errorResponse, validationError } from "@/lib/api-response";
import { getUserEmail } from "@/lib/auth";
import { deleteItem, getItem, updateItem } from "@/lib/db";
import { deleteImage } from "@/lib/r2";
import { ClothingItemUpdateSchema } from "@/schema/clothing";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);
  const item = await getItem(env.DB, userEmail, id);
  if (!item) return errorResponse("not found", 404);
  return Response.json({ item });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);

  const body = await req.json();
  const parsed = ClothingItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const updated = await updateItem(env.DB, userEmail, id, parsed.data);
  if (!updated) return errorResponse("not found", 404);
  return Response.json({ item: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);

  const item = await getItem(env.DB, userEmail, id);
  if (!item) return errorResponse("not found", 404);

  await deleteItem(env.DB, userEmail, id);
  await deleteImage(env.IMAGES, item.imageKey);
  // アイコン (生成済みなら) も R2 から消す。残しておくと R2 にオーファンが残る。
  if (item.iconKey) {
    await deleteImage(env.IMAGES, item.iconKey).catch(() => {});
  }
  return new Response(null, { status: 204 });
}
