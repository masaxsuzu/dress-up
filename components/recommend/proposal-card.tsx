"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/labels";
import { cardStyle } from "@/lib/ui";
import type { ClothingCategory, Season } from "@/schema/clothing";
import type { Proposal, ProposalItem } from "@/schema/recommend";

// /api/outfit-image に渡す形 (owned は id、buy は category+description)。
type ImageRequestItem =
  | { kind: "owned"; id: string }
  | { kind: "buy"; category: ClothingCategory; description: string };

function toRequestItem(it: ProposalItem): ImageRequestItem {
  return it.kind === "owned"
    ? { kind: "owned", id: it.item.id }
    : { kind: "buy", category: it.category, description: it.description };
}

export function ProposalCard({
  proposal,
  index,
  tpo,
  season,
}: {
  proposal: Proposal;
  index: number;
  tpo: string;
  season: Season;
}) {
  const buyCount = proposal.items.filter((i) => i.kind === "buy").length;

  return (
    <article style={{ ...cardStyle, marginBottom: "1rem" }}>
      <h2
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.85rem",
          color: "#444",
          fontWeight: 600,
        }}
      >
        提案 {index + 1}
        {buyCount > 0 && (
          <span
            style={{
              marginLeft: "0.5rem",
              fontSize: "0.7rem",
              color: "#fff",
              background: "#a87",
              borderRadius: 4,
              padding: "0.1rem 0.4rem",
            }}
          >
            買い足し {buyCount} 点
          </span>
        )}
      </h2>

      <FullBodyImage proposal={proposal} tpo={tpo} season={season} />

      <h3
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.75rem",
          color: "#888",
          fontWeight: "normal",
        }}
      >
        コーデ構成
      </h3>
      <ul style={{ margin: "0 0 0.75rem", padding: 0, listStyle: "none" }}>
        {proposal.items.map((it, i) => (
          <ProposalItemRow key={i} item={it} />
        ))}
      </ul>

      <h3
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.75rem",
          color: "#888",
          fontWeight: "normal",
        }}
      >
        説明
      </h3>
      <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
        {proposal.reason}
      </p>
    </article>
  );
}

function ProposalItemRow({ item }: { item: ProposalItem }) {
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
          {CATEGORY_LABEL[i.category]}
          {i.subcategory ? ` / ${i.subcategory}` : ""}
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
          {CATEGORY_LABEL[item.category]}
        </span>
        {item.description}
      </span>
    </li>
  );
}

// マウント時に /api/outfit-image を自動発火し、画像が来たら差し込む。
function FullBodyImage({
  proposal,
  tpo,
  season,
}: {
  proposal: Proposal;
  tpo: string;
  season: Season;
}) {
  const [state, setState] = useState<"running" | "done" | "error">("running");
  const [url, setUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let blobUrl: string | null = null;
    setState("running");
    setErrorMsg(null);

    (async () => {
      try {
        const res = await fetch("/api/outfit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: proposal.items.map(toRequestItem),
            tpo,
            season,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const ct = res.headers.get("Content-Type") ?? "";
          const msg = ct.includes("json")
            ? (((await res.json()) as { error?: string }).error ?? "生成失敗")
            : `${res.status}`;
          throw new Error(msg);
        }
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        setState("done");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErrorMsg((e as Error).message);
        setState("error");
      }
    })();

    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // proposal の参照が変わる + retryKey で再走
  }, [proposal, tpo, season, retryKey]);

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {state === "done" && url && (
        <img
          src={url}
          alt="全身コーデ"
          style={{
            width: "100%",
            maxWidth: 480,
            display: "block",
            margin: "0 auto",
            borderRadius: 8,
            border: "1px solid #eee",
          }}
        />
      )}
      {state === "running" && (
        <div
          style={{
            padding: "2rem 0.75rem",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#666",
            textAlign: "center",
          }}
        >
          全身イメージを生成中…
        </div>
      )}
      {state === "error" && (
        <div
          style={{
            padding: "0.75rem",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <p
            style={{
              color: "#c00",
              fontSize: "0.85rem",
              margin: "0 0 0.5rem",
            }}
          >
            画像の生成に失敗しました: {errorMsg}
          </p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.85rem",
              background: "#fff",
              color: "#111",
              border: "1px solid #111",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
