import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createItem, listItems } from "@/lib/db";
import { validationError } from "@/lib/api-response";
import { ClothingItemInputSchema } from "@/schema/clothing";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const items = await listItems(env.DB);
  return Response.json({ items });
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const body = await req.json();
  const parsed = ClothingItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const item = await createItem(env.DB, parsed.data);
  return Response.json({ item }, { status: 201 });
}
