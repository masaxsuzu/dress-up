import { errorResponse } from "@/app/_lib/api-response";
import { deleteItem, getItem, updateItem } from "@/app/_lib/db";
import { releaseUpload } from "@/app/_lib/uploads";
import { parseJson, route } from "@/app/_lib/route-handler";
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
  // 行を消した後に呼ぶ (releaseUpload が他からの参照有無を見るため)。
  await releaseUpload(env.DB, env.IMAGES, user, item.imageKey);
  // アイコン (生成済みなら) も R2 から消す。残しておくと R2 にオーファンが残る。
  if (item.iconKey) {
    await releaseUpload(env.DB, env.IMAGES, user, item.iconKey);
  }
  return new Response(null, { status: 204 });
});
