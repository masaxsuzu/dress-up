import { errorResponse } from "@/lib/api-response";
import { deleteItem, getItem, updateItem } from "@/lib/db";
import { deleteImage } from "@/lib/r2";
import { parseJson, route } from "@/lib/route-handler";
import { ClothingItemUpdateSchema } from "@/schema/clothing";

type IdParams = { id: string };

export const GET = route<IdParams>(async ({ env, user, params }) => {
  const item = await getItem(env.DB, user, params.id);
  if (!item) return errorResponse("not found", 404);
  return Response.json({ item });
});

export const PATCH = route<IdParams>(async ({ req, env, user, params }) => {
  const parsed = await parseJson(req, ClothingItemUpdateSchema);
  if (!parsed.ok) return parsed.res;
  const updated = await updateItem(env.DB, user, params.id, parsed.data);
  if (!updated) return errorResponse("not found", 404);
  return Response.json({ item: updated });
});

export const DELETE = route<IdParams>(async ({ env, user, params }) => {
  const item = await getItem(env.DB, user, params.id);
  if (!item) return errorResponse("not found", 404);

  await deleteItem(env.DB, user, params.id);
  await deleteImage(env.IMAGES, item.imageKey);
  // アイコン (生成済みなら) も R2 から消す。残しておくと R2 にオーファンが残る。
  if (item.iconKey) {
    await deleteImage(env.IMAGES, item.iconKey).catch(() => {});
  }
  return new Response(null, { status: 204 });
});
