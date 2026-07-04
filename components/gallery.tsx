"use client";

// 一覧ページのギャラリービュー: 検索/絞り込み UI + アイテムグリッド。
// 絞り込みロジックと URL パラメータ変換は lib/gallery-filters.ts。
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ClothingCategory, ClothingItem, Season } from "@/schema/clothing";
import { ClothingCategorySchema, SeasonSchema } from "@/schema/clothing";
import { CATEGORY_LABEL, SEASON_LABEL, itemLabel } from "@/lib/labels";
import {
  type GalleryParams,
  buildURL,
  matchesAll,
  parseParams,
} from "@/lib/gallery-filters";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? "chip chip-active" : "chip"}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Gallery component
// ---------------------------------------------------------------------------

export function Gallery({ items }: { items: ClothingItem[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const { q, categories, seasons } = parseParams(searchParams);

  // local controlled state for the search box so it's responsive
  const [searchText, setSearchText] = useState(q);

  const updateParams = useCallback(
    (next: Partial<GalleryParams>) => {
      const merged: GalleryParams = {
        q: next.q ?? q,
        categories: next.categories ?? categories,
        seasons: next.seasons ?? seasons,
      };
      startTransition(() => {
        router.replace(buildURL(merged), { scroll: false });
      });
    },
    [q, categories, seasons, router],
  );

  function toggleCategory(cat: ClothingCategory) {
    const next = categories.includes(cat)
      ? categories.filter((c) => c !== cat)
      : [...categories, cat];
    updateParams({ categories: next });
  }

  function toggleSeason(s: Season) {
    const next = seasons.includes(s)
      ? seasons.filter((x) => x !== s)
      : [...seasons, s];
    updateParams({ seasons: next });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchText.trim() });
  }

  function clearAll() {
    setSearchText("");
    startTransition(() => {
      router.replace("/", { scroll: false });
    });
  }

  const activeFilterCount =
    (q ? 1 : 0) + categories.length + seasons.length;

  const filtered = useMemo(
    () => items.filter((item) => matchesAll(item, { q, categories, seasons })),
    [items, q, categories, seasons],
  );

  return (
    <>
      {/* Search & filter panel */}
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        {/* Search box */}
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onBlur={() => updateParams({ q: searchText.trim() })}
            placeholder="ブランド・素材・タグで検索"
            className="chip"
            style={{
              flex: 1,
              padding: "0.5rem 0.9rem",
              cursor: "text",
              fontSize: "0.9rem",
              outline: "none",
              minWidth: 0,
            }}
          />
        </form>

        {/* Category chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
          }}
        >
          {ClothingCategorySchema.options.map((cat) => (
            <Chip
              key={cat}
              label={CATEGORY_LABEL[cat]}
              active={categories.includes(cat)}
              onClick={() => toggleCategory(cat)}
            />
          ))}
        </div>

        {/* Season chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {SeasonSchema.options.map((s) => (
            <Chip
              key={s}
              label={SEASON_LABEL[s]}
              active={seasons.includes(s)}
              onClick={() => toggleSeason(s)}
            />
          ))}
        </div>

        {/* Active filter count + clear */}
        {activeFilterCount > 0 && (
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span style={{ fontSize: "0.8rem", color: "#666" }}>
              {activeFilterCount} 件のフィルター適用中
            </span>
            <button
              onClick={clearAll}
              style={{
                background: "none",
                border: "none",
                color: "#555",
                cursor: "pointer",
                fontSize: "0.8rem",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              クリア
            </button>
          </div>
        )}
      </div>

      {/* Item count */}
      <p
        data-testid="item-count"
        style={{ color: "#666", fontSize: "0.9rem", margin: "0 0 1rem" }}
      >
        {items.length === 0
          ? "まだアイテムがありません。"
          : activeFilterCount > 0
            ? `${filtered.length} / ${items.length} 件`
            : `${items.length} 件のアイテム`}
      </p>

      {/* Gallery grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {filtered.map((item) => (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article
              className="card card-interactive"
              style={{ overflow: "hidden" }}
            >
              <img
                src={`/api/images/${item.iconKey ?? item.imageKey}`}
                alt={item.subcategory ?? item.category}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  // アイコン (透過 PNG, 服が中央) なら contain で全体を見せる。
                  // 元写真フォールバック時は cover で枠を埋める。
                  objectFit: item.iconKey ? "contain" : "cover",
                  background: item.iconKey ? "#fff" : undefined,
                  display: "block",
                }}
              />
              <div style={{ padding: "0.6rem", minHeight: "3.75rem", boxSizing: "border-box" }}>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  {itemLabel(item.category, item.subcategory)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    marginTop: 6,
                    flexWrap: "wrap",
                    minHeight: 14,
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
    </>
  );
}
