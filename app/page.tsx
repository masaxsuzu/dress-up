import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const items = await listItems(env.DB);

  return (
    <main
      style={{
        padding: "2rem",
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>dress-up</h1>
        <Link
          href="/add"
          style={{
            padding: "0.5rem 1rem",
            background: "#111",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          + 服を追加
        </Link>
      </header>

      <p style={{ color: "#666" }}>
        {items.length === 0
          ? "まだアイテムがありません。"
          : `${items.length} 件のアイテム`}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {items.map((item) => (
          <article
            key={item.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <img
              src={`/api/images/${item.imageKey}`}
              alt={item.subcategory ?? item.category}
              style={{
                width: "100%",
                aspectRatio: "1",
                objectFit: "cover",
                display: "block",
              }}
            />
            <div style={{ padding: "0.75rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                {item.category}
                {item.subcategory ? ` / ${item.subcategory}` : ""}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {item.colors.map((c) => (
                  <span
                    key={c.hex + c.name}
                    title={c.name}
                    style={{
                      width: 14,
                      height: 14,
                      background: c.hex,
                      borderRadius: "50%",
                      border: "1px solid #ccc",
                    }}
                  />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
