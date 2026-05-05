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
      </header>

      {/* Gallery is a client component; wrap in Suspense for useSearchParams */}
      <Suspense>
        <Gallery items={items} />
      </Suspense>
    </main>
  );
}
