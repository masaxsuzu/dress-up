import Link from "next/link";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserEmailFromHeaders } from "@/lib/auth";
import { listItems } from "@/lib/db";
import { StatsView } from "@/components/stats";
import { pageStyle, pillLinkStyle } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmailFromHeaders(await headers());
  const items = await listItems(env.DB, userEmail);

  return (
    <main style={pageStyle(640)}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>統計</h1>
        <Link href="/" style={pillLinkStyle}>
          ← 一覧
        </Link>
      </header>

      <StatsView items={items} />
    </main>
  );
}
