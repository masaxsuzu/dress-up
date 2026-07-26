import { errorResponse } from "@/app/_lib/api-response";
import { createItem, listItems } from "@/app/_lib/db";
import { parseJson, route } from "@/app/_lib/route-handler";
import { isUploadedBy } from "@/app/_lib/uploads";
import { ClothingItemInputSchema } from "@/schema/clothing";

export const GET = route(async ({ env, user }) => {
  const items = await listItems(env.DB, user);
  return Response.json({ items });
});

export const POST = route(async ({ req, env, user }) => {
  const parsed = await parseJson(req, ClothingItemInputSchema);
  if (!parsed.ok) return parsed.res;

  // imageKey は client 由来。自分がアップロードした key 以外を受け付けると、
  // 他人の画像を自分のアイテムとして参照でき、閲覧も (削除経由で) 破壊もできる。
  if (!(await isUploadedBy(env.DB, user, parsed.data.imageKey))) {
    return errorResponse("unknown imageKey", 400);
  }

  const item = await createItem(env.DB, user, parsed.data);
  return Response.json({ item }, { status: 201 });
});
