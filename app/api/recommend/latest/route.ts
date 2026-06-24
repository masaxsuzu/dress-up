import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserEmail } from "@/lib/auth";
import { listItems } from "@/lib/db";
import { getLatestRecommendation } from "@/lib/latest-recommendation";
import { hydrateProposals } from "@/lib/proposal-hydrate";

// 最新の提案を返す。owned id は現在のワードローブから hydrate するので
// 「保存時にあったアイテムが今は無い」場合は silent drop され、placeholder buy
// が代わりに入る (proposal-hydrate.ts 参照)。
// 未保存なら { latest: null } を返す。
export async function GET(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmail(req);

  const latest = await getLatestRecommendation(env.DB, userEmail);
  if (!latest) return Response.json({ latest: null });

  const items = await listItems(env.DB, userEmail);
  const proposals = hydrateProposals(latest.proposals, items);

  return Response.json({
    latest: {
      tpo: latest.tpo,
      season: latest.season,
      proposals,
      createdAt: latest.createdAt,
    },
  });
}
