import { Suspense } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";
import { AddButton } from "@/components/add-button";
import { Gallery } from "@/components/gallery";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const items = await listItems(env.DB);

  return (
    <main
      style={{
        padding: "1rem",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
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
          <a
            href="/recommend"
            style={{
              padding: "0.6rem 1rem",
              background: "#fff",
              color: "#111",
              border: "1px solid #111",
              borderRadius: 999,
              textDecoration: "none",
              fontSize: "0.95rem",
              whiteSpace: "nowrap",
            }}
          >
            提案
          </a>
          <AddButton
            style={{
              padding: "0.6rem 1rem",
              background: "#111",
              color: "#fff",
              borderRadius: 999,
              textDecoration: "none",
              fontSize: "0.95rem",
              whiteSpace: "nowrap",
            }}
          />
        </div>
      </header>

      {/* Gallery is a client component; wrap in Suspense for useSearchParams */}
      <Suspense>
        <Gallery items={items} />
      </Suspense>
    </main>
  );
}
