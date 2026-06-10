import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";
import { DressupClient } from "./dressup-client";

export const dynamic = "force-dynamic";

export default async function DressupPage() {
  const { env } = await getCloudflareContext({ async: true });
  const items = await listItems(env.DB);
  return <DressupClient items={items} />;
}
