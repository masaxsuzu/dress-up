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
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>dress-up</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
