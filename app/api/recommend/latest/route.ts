import { listItems } from "@/lib/db";
import { getLatestRecommendation } from "@/lib/latest-recommendation";
import { hydrateProposals } from "@/lib/proposal-hydrate";
import { route } from "@/lib/route-handler";

export const GET = route(async ({ env, user }) => {
  const latest = await getLatestRecommendation(env.DB, user);
  if (!latest) return Response.json({ latest: null });

  const items = await listItems(env.DB, user);
  const proposals = hydrateProposals(latest.proposals, items);

  return Response.json({
    latest: {
      tpo: latest.tpo,
      season: latest.season,
      proposals,
      createdAt: latest.createdAt,
    },
  });
});
