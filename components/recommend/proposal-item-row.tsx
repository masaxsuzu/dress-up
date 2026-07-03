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
          borderBottom: "1px solid #f3f3f3",
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
            style={{
              width: 48,
              height: 48,
              objectFit: i.iconKey ? "contain" : "cover",
              background: i.iconKey ? "#f7f5ef" : undefined,
              borderRadius: 6,
              border: "1px solid #eee",
              display: "block",
            }}
          />
        </Link>
        <span
          style={{
            fontSize: "0.65rem",
            color: "#fff",
            background: "#444",
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
            color: "#111",
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
        borderBottom: "1px solid #f3f3f3",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          background: "#f7f5ef",
          border: "1px dashed #ccc",
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          fontSize: "0.6rem",
          color: "#a87",
        }}
      >
        買う
      </div>
      <span
        style={{
          fontSize: "0.65rem",
          color: "#fff",
          background: "#a87",
          borderRadius: 4,
          padding: "0.1rem 0.4rem",
          whiteSpace: "nowrap",
        }}
      >
        買い足し
      </span>
      <span style={{ fontSize: "0.9rem", flex: 1 }}>
        <span style={{ color: "#666", marginRight: "0.4rem" }}>
          {itemLabel(item.category, null)}
        </span>
        {item.description}
      </span>
    </li>
  );
}
