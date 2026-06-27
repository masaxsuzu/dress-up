import { Suspense } from "react";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUserEmailFromHeaders } from "@/lib/auth";
import { listItems } from "@/lib/db";
import { AddButton } from "@/components/add-button";
import { Gallery } from "@/components/gallery";
import { pageStyle, pillLinkStyle, pillLinkFilledStyle } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const userEmail = getUserEmailFromHeaders(await headers());
  const items = await listItems(env.DB, userEmail);

  return (
    <main style={pageStyle(1100)}>
      <header className="page-header">
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>dress-up</h1>
        <div className="page-header-nav">
          <a href="/stats" style={pillLinkStyle}>
            統計
          </a>
          <a href="/profile" style={pillLinkStyle}>
            設定
          </a>
          <a href="/recommend" style={pillLinkStyle}>
            提案
          </a>
          <AddButton style={pillLinkFilledStyle} />
        </div>
      </header>

      {/* Gallery is a client component; wrap in Suspense for useSearchParams */}
      <Suspense>
        <Gallery items={items} />
      </Suspense>
    </main>
  );
}
