import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getItem } from "@/lib/db";
import {
  CATEGORY_LABEL,
  FORMALITY_LABEL,
  PATTERN_LABEL,
  SEASON_LABEL,
} from "@/lib/labels";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const item = await getItem(env.DB, id);
  if (!item) notFound();

  return (
    <main
      style={{
        padding: "1rem",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/" style={{ color: "#666" }}>
          ← 一覧に戻る
        </Link>
      </p>

      <img
        src={`/api/images/${item.imageKey}`}
        alt={item.subcategory ?? item.category}
        style={{
          width: "100%",
          maxHeight: "60vh",
          objectFit: "contain",
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #eee",
        }}
      />

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          marginTop: "1rem",
          background: "#fff",
          padding: "1rem",
          borderRadius: 10,
          border: "1px solid #eee",
        }}
      >
        <Row label="カテゴリ">
          {CATEGORY_LABEL[item.category]}
          {item.subcategory ? ` / ${item.subcategory}` : ""}
        </Row>

        <Row label="カラー">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {item.colors.map((c) => (
              <span
                key={c.hex + c.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    background: c.hex,
                    borderRadius: "50%",
                    border: "1px solid #ccc",
                  }}
                />
                {c.name}
              </span>
            ))}
          </div>
        </Row>

        {item.pattern && <Row label="柄">{PATTERN_LABEL[item.pattern]}</Row>}
        {item.material && <Row label="素材">{item.material}</Row>}
        {item.silhouette && <Row label="シルエット">{item.silhouette}</Row>}

        <Row label="シーズン">
          {item.season.map((s) => SEASON_LABEL[s]).join("・")}
        </Row>

        <Row label="フォーマル度">
          {FORMALITY_LABEL[item.formality] ?? item.formality}
        </Row>

        {item.occasion.length > 0 && (
          <Row label="シーン">{item.occasion.join("、")}</Row>
        )}

        {item.tags.length > 0 && (
          <Row label="タグ">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {item.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    padding: "2px 8px",
                    background: "#f0f0f0",
                    borderRadius: 999,
                    fontSize: "0.8rem",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </Row>
        )}

        {item.brand && <Row label="ブランド">{item.brand}</Row>}
        {item.notes && (
          <Row label="メモ">
            <span style={{ whiteSpace: "pre-wrap" }}>{item.notes}</span>
          </Row>
        )}

        <Row label="登録日">
          {new Date(item.createdAt).toLocaleString("ja-JP")}
        </Row>
      </div>

      <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
        <Link
          href={`/items/${item.id}/edit`}
          style={{
            display: "block",
            padding: "0.7rem 1.2rem",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            width: "100%",
            textAlign: "center",
            textDecoration: "none",
            boxSizing: "border-box",
          }}
        >
          編集
        </Link>
        <DeleteButton id={item.id} />
      </div>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: "0.8rem", color: "#888" }}>{label}</span>
      <div style={{ fontSize: "0.95rem" }}>{children}</div>
    </div>
  );
}
