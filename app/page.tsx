import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listItems } from "@/lib/db";
import { CATEGORY_LABEL } from "@/lib/labels";
import { AddButton } from "@/components/add-button";

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

      <p style={{ color: "#666", fontSize: "0.9rem", margin: "0 0 1rem" }}>
        {items.length === 0
          ? "まだアイテムがありません。"
          : `${items.length} 件のアイテム`}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
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
              <div style={{ padding: "0.6rem" }}>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  {CATEGORY_LABEL[item.category]}
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
          </Link>
        ))}
      </div>
    </main>
  );
}
