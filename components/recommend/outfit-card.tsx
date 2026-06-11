"use client";

import Link from "next/link";
import type { Season } from "@/schema/clothing";
import type { OutfitResult } from "./types";
import { OutfitFullBodyImage } from "./outfit-full-body-image";
import { cardStyle } from "@/lib/ui";

export function OutfitCard({
  outfit,
  tpo,
  season,
}: {
  outfit: OutfitResult;
  tpo: string;
  season: Season;
}) {
  return (
    <article style={cardStyle}>
      <OutfitFullBodyImage items={outfit.items} tpo={tpo} season={season} />

      <h2
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.8rem",
          color: "#888",
          fontWeight: "normal",
        }}
      >
        使ったアイテム
      </h2>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          margin: "0 0 0.75rem",
          paddingBottom: "0.25rem",
        }}
      >
        {outfit.items.map((item) => (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            style={{ flexShrink: 0, textDecoration: "none", color: "#111" }}
          >
            <img
              src={`/api/images/${item.iconKey ?? item.imageKey}`}
              alt={item.subcategory ?? item.category}
              style={{
                width: 72,
                height: 72,
                objectFit: item.iconKey ? "contain" : "cover",
                background: item.iconKey ? "#f7f5ef" : undefined,
                borderRadius: 6,
                border: "1px solid #eee",
                display: "block",
              }}
            />
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.7rem",
                color: "#666",
                textAlign: "center",
                maxWidth: 72,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {item.subcategory ?? item.category}
            </p>
          </Link>
        ))}
      </div>

      <h2
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.8rem",
          color: "#888",
          fontWeight: "normal",
        }}
      >
        説明
      </h2>
      <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
        {outfit.reason}
      </p>
    </article>
  );
}
