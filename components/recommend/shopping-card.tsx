"use client";

import { CATEGORY_LABEL } from "@/lib/labels";
import type { ShoppingResult } from "./types";

export function ShoppingCard({ shopping }: { shopping: ShoppingResult }) {
  return (
    <article
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: "0.75rem",
        background: "#fff",
      }}
    >
      <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
        買い足したいアイテム
      </h2>
      <p
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.85rem",
          color: "#555",
          background: "#f7f5ef",
          border: "1px solid #ece7d8",
          borderRadius: 6,
          padding: "0.5rem 0.6rem",
        }}
      >
        このシーンに合うコーデを既存のワードローブから組めなかったため、買い足し候補を提案します。
      </p>
      <ul style={{ margin: "0 0 0.75rem", padding: 0, listStyle: "none" }}>
        {shopping.missing.map((m, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.5rem",
              padding: "0.4rem 0",
              borderBottom:
                i === shopping.missing.length - 1 ? "none" : "1px solid #eee",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                color: "#fff",
                background: "#888",
                borderRadius: 4,
                padding: "0.1rem 0.4rem",
                whiteSpace: "nowrap",
              }}
            >
              {CATEGORY_LABEL[m.category]}
            </span>
            <span style={{ fontSize: "0.9rem" }}>{m.description}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
        {shopping.reason}
      </p>
    </article>
  );
}
