import Link from "next/link";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserEmailFromHeaders } from "@/app/_lib/auth";
import { listItems } from "@/app/_lib/db";
import { StatsView } from "./_components/stats";
import { pageStyle, pillLinkStyle } from "@/app/_lib/ui";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmailFromHeaders(await headers());
  const items = await listItems(env.DB, userEmail);

  return (
    <main style={pageStyle(640)}>
      <header className="page-header" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>統計</h1>
        <div className="page-header-nav">
          <Link href="/" style={pillLinkStyle}>
            ← 一覧
          </Link>
        </div>
      </header>

      <StatsView items={items} />
    </main>
  );
}
