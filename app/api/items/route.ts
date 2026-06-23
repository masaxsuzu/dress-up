import { getCloudflareContext } from "@opennextjs/cloudflare";
import { validationError } from "@/lib/api-response";
import { getUserEmail } from "@/lib/auth";
import { createItem, listItems } from "@/lib/db";
import { ClothingItemInputSchema } from "@/schema/clothing";

export async function GET(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);
  const items = await listItems(env.DB, userEmail);
  return Response.json({ items });
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);

  const body = await req.json();
  const parsed = ClothingItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const item = await createItem(env.DB, userEmail, parsed.data);
  return Response.json({ item }, { status: 201 });
}
