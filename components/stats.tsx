// /stats のワードローブ統計ビュー (集計ロジックは lib/stats.ts)
import type { ClothingItem } from "@/schema/clothing";
import { ClothingCategorySchema, SeasonSchema } from "@/schema/clothing";
import {
  CATEGORY_LABEL,
  FORMALITY_LABEL,
  PATTERN_LABEL,
  SEASON_LABEL,
} from "@/lib/labels";
import { computeStats } from "@/lib/stats";
import { cardStyle } from "@/lib/ui";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ ...cardStyle, marginBottom: "1rem" }}>
      <h2
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.85rem",
          color: "#888",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function BarRow({
  label,
  count,
  max,
  labelWidth = 100,
}: {
  label: string;
  count: number;
  max: number;
  labelWidth?: number;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "0.45rem",
      }}
    >
      <span
        style={{
          width: labelWidth,
          fontSize: "0.82rem",
          color: "#555",
          flexShrink: 0,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          background: "#f0f0f0",
          borderRadius: 4,
          height: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            background: "#111",
            height: "100%",
            borderRadius: 4,
            minWidth: count > 0 ? 4 : 0,
          }}
        />
      </div>
      <span
        style={{
          width: 28,
          fontSize: "0.82rem",
          color: "#444",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function ColorHistogram({
  colors,
}: {
  colors: [string, { name: string; count: number }][];
}) {
  const maxCount = Math.max(...colors.map(([, { count }]) => count), 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        height: 80,
        gap: 2,
        borderBottom: "1px solid #eee",
      }}
    >
      {colors.map(([hex, { name, count }]) => (
        <div
          key={hex}
          title={`${name} (${hex}) × ${count}`}
          style={{
            flex: 1,
            minWidth: 8,
            height: `${Math.max((count / maxCount) * 100, 8)}%`,
            background: hex,
            borderRadius: "3px 3px 0 0",
            border: "1px solid rgba(0,0,0,0.08)",
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function StatsView({ items }: { items: ClothingItem[] }) {
  if (items.length === 0) {
    return (
      <p style={{ color: "#888", fontSize: "0.9rem" }}>
        アイテムがまだありません。
      </p>
    );
  }

  const s = computeStats(items);
  const maxCategory = Math.max(...Object.values(s.byCategory));
  const maxSeason = Math.max(...Object.values(s.bySeason));
  const maxFormality = Math.max(...Object.values(s.byFormality));
  const maxPattern = Math.max(...Object.values(s.byPattern));

  return (
    <>
      {/* Summary */}
      <Section title="サマリー">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {[
            { label: "アイテム合計", value: s.total },
            {
              label: "アイコン化済み",
              value: `${s.iconized} / ${s.total}`,
            },
            { label: "ブランド数", value: s.brandCount },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                textAlign: "center",
                padding: "0.75rem 0.5rem",
                background: "#fafafa",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  lineHeight: 1,
                  marginBottom: "0.3rem",
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#888" }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Category */}
      <Section title="カテゴリ">
        {ClothingCategorySchema.options.map((cat) => (
          <BarRow
            key={cat}
            label={CATEGORY_LABEL[cat]}
            count={s.byCategory[cat]}
            max={maxCategory}
          />
        ))}
      </Section>

      {/* Season */}
      <Section title="シーズン">
        {SeasonSchema.options.map((season) => (
          <BarRow
            key={season}
            label={SEASON_LABEL[season]}
            count={s.bySeason[season]}
            max={maxSeason}
            labelWidth={32}
          />
        ))}
      </Section>

      {/* Formality */}
      <Section title="フォーマリティ">
        {([1, 2, 3, 4, 5] as const).map((f) => (
          <BarRow
            key={f}
            label={FORMALITY_LABEL[f]}
            count={s.byFormality[f]}
            max={maxFormality}
            labelWidth={120}
          />
        ))}
      </Section>

      {/* Pattern */}
      <Section title="パターン">
        {Object.entries(s.byPattern)
          .sort((a, b) => b[1] - a[1])
          .map(([pattern, count]) => (
            <BarRow
              key={pattern}
              label={PATTERN_LABEL[pattern as keyof typeof PATTERN_LABEL] ?? pattern}
              count={count}
              max={maxPattern}
            />
          ))}
      </Section>

      {/* Colors */}
      <Section title="使用カラー">
        <ColorHistogram colors={s.topColors} />
      </Section>

      {/* Brands */}
      {s.topBrands.length > 0 && (
        <Section title="ブランド">
          {s.topBrands.map(([brand, count]) => (
            <BarRow
              key={brand}
              label={brand}
              count={count}
              max={s.topBrands[0][1]}
              labelWidth={120}
            />
          ))}
        </Section>
      )}
    </>
  );
}
