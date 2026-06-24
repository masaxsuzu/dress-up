import { createItem, listItems } from "@/lib/db";
import { parseJson, route } from "@/lib/route-handler";
import { ClothingItemInputSchema } from "@/schema/clothing";

export const GET = route(async ({ env, user }) => {
  const items = await listItems(env.DB, user);
  return Response.json({ items });
});

export const POST = route(async ({ req, env, user }) => {
  const parsed = await parseJson(req, ClothingItemInputSchema);
  if (!parsed.ok) return parsed.res;
  const item = await createItem(env.DB, user, parsed.data);
  return Response.json({ item }, { status: 201 });
});
