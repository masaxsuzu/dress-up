"use client";

// 提案 1 案のカード: 全身画像 (full-body-image.tsx) + 構成リスト
// (proposal-item-row.tsx) + 説明文。
import { cardStyle } from "@/lib/ui";
import type { Season } from "@/schema/clothing";
import type { Proposal } from "@/schema/recommend";
import { FullBodyImage } from "./full-body-image";
import { ProposalItemRow } from "./proposal-item-row";

export function ProposalCard({
  proposal,
  index,
  tpo,
  season,
  auto = true,
}: {
  proposal: Proposal;
  index: number;
  tpo: string;
  season: Season;
  /** マウント時に画像生成を auto-fire するか。fresh 提案では true、
   *  保存済みからの「見返し」表示では false (ボタン押下で生成)。 */
  auto?: boolean;
}) {
  const buyCount = proposal.items.filter((i) => i.kind === "buy").length;

  return (
    <article style={{ ...cardStyle, marginBottom: "1rem" }}>
      <h2
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.85rem",
          color: "var(--ink)",
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
              background: "var(--accent)",
              borderRadius: 4,
              padding: "0.1rem 0.4rem",
            }}
          >
            買い足し {buyCount} 点
          </span>
        )}
      </h2>

      <FullBodyImage proposal={proposal} tpo={tpo} season={season} auto={auto} />

      <h3
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.75rem",
          color: "var(--muted)",
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
          color: "var(--muted)",
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
