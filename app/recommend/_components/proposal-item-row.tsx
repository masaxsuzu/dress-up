"use client";

// 提案内の 1 アイテム行。owned はアイコン + 詳細リンク、buy は買い足しプレースホルダ。
import Link from "next/link";
import { itemLabel } from "@/lib/labels";
import type { ProposalItem } from "@/schema/recommend";

export function ProposalItemRow({ item }: { item: ProposalItem }) {
  if (item.kind === "owned") {
    const i = item.item;
    return (
      <li
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.4rem 0",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link
          href={`/items/${i.id}`}
          style={{ flexShrink: 0, textDecoration: "none" }}
        >
          <img
            src={`/api/images/${i.iconKey ?? i.imageKey}`}
            alt={i.subcategory ?? i.category}
            loading="lazy"
            decoding="async"
            style={{
              width: 48,
              height: 48,
              objectFit: i.iconKey ? "contain" : "cover",
              background: i.iconKey ? "var(--bg)" : undefined,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
        </Link>
        <span
          style={{
            fontSize: "0.65rem",
            color: "#fff",
            background: "var(--ink)",
            borderRadius: 4,
            padding: "0.1rem 0.4rem",
            whiteSpace: "nowrap",
          }}
        >
          所有
        </span>
        <Link
          href={`/items/${i.id}`}
          style={{
            fontSize: "0.9rem",
            color: "var(--ink)",
            textDecoration: "none",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {itemLabel(i.category, i.subcategory)}
        </Link>
      </li>
    );
  }

  // buy
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.4rem 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          background: "var(--bg)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-sm)",
          display: "grid",
          placeItems: "center",
          fontSize: "0.6rem",
          color: "var(--accent)",
        }}
      >
        買う
      </div>
      <span
        style={{
          fontSize: "0.65rem",
          color: "#fff",
          background: "var(--accent)",
          borderRadius: 4,
          padding: "0.1rem 0.4rem",
          whiteSpace: "nowrap",
        }}
      >
        買い足し
      </span>
      <span style={{ fontSize: "0.9rem", flex: 1 }}>
        <span style={{ color: "var(--muted)", marginRight: "0.4rem" }}>
          {itemLabel(item.category, null)}
        </span>
        {item.description}
      </span>
    </li>
  );
}
