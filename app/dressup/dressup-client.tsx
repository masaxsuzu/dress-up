"use client";

import { useMemo, useState } from "react";
import type { ClothingCategory, ClothingItem } from "@/schema/clothing";
import { CATEGORY_LABEL } from "@/lib/labels";
import {
  clearSlots,
  toggleSlot,
  type DressupSlots,
} from "@/lib/dressup-slots";

// アバター（縦に積む）スロットの順序。dress は tops の位置に出す。
const AVATAR_STACK: ClothingCategory[] = [
  "outerwear",
  "tops",
  "dress",
  "bottoms",
  "shoes",
];

// アバター横に並べる小物。
const AVATAR_SIDE: ClothingCategory[] = ["bag", "accessory"];

// ピッカーで出すカテゴリ順。
const PICKER_ORDER: ClothingCategory[] = [
  "outerwear",
  "tops",
  "dress",
  "bottoms",
  "shoes",
  "bag",
  "accessory",
  "other",
];

function imgSrc(item: ClothingItem) {
  return `/api/images/${item.iconKey ?? item.imageKey}`;
}

export function DressupClient({ items }: { items: ClothingItem[] }) {
  const [slots, setSlots] = useState<DressupSlots>({});

  const byCategory = useMemo(() => {
    const map = new Map<ClothingCategory, ClothingItem[]>();
    for (const item of items) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [items]);

  const byId = useMemo(
    () => new Map(items.map((i) => [i.id, i] as const)),
    [items],
  );

  const wornItems: ClothingItem[] = [];
  for (const cat of [...AVATAR_STACK, ...AVATAR_SIDE]) {
    const id = slots[cat];
    if (!id) continue;
    const item = byId.get(id);
    if (item) wornItems.push(item);
  }
  const isEmpty = wornItems.length === 0;

  return (
    <main style={{ padding: "1rem", maxWidth: 900, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          gap: "0.5rem",
        }}
      >
        <p style={{ margin: 0 }}>
          <a href="/" style={{ color: "#666" }}>
            ← 一覧へ
          </a>
        </p>
        <h1 style={{ margin: 0, fontSize: "1.2rem" }}>着せ替え</h1>
        <button
          onClick={() => setSlots(clearSlots())}
          disabled={isEmpty}
          style={{
            padding: "0.4rem 0.8rem",
            background: isEmpty ? "#eee" : "#fff",
            color: isEmpty ? "#999" : "#111",
            border: "1px solid",
            borderColor: isEmpty ? "#ddd" : "#111",
            borderRadius: 999,
            fontSize: "0.85rem",
            cursor: isEmpty ? "not-allowed" : "pointer",
          }}
        >
          ぜんぶ脱がせる
        </button>
      </header>

      <Avatar slots={slots} byId={byId} />

      <section style={{ marginTop: "1rem" }}>
        {PICKER_ORDER.map((cat) => {
          const list = byCategory.get(cat);
          if (!list || list.length === 0) return null;
          return (
            <CategoryRow
              key={cat}
              category={cat}
              items={list}
              selectedId={slots[cat]}
              onToggle={(item) => setSlots((s) => toggleSlot(s, item))}
            />
          );
        })}
        {items.length === 0 && (
          <p style={{ color: "#666", fontSize: "0.9rem" }}>
            ワードローブにアイテムがありません。先に追加してください。
          </p>
        )}
      </section>
    </main>
  );
}

function Avatar({
  slots,
  byId,
}: {
  slots: DressupSlots;
  byId: Map<string, ClothingItem>;
}) {
  const stack = AVATAR_STACK
    .map((cat) => ({ cat, item: slots[cat] ? byId.get(slots[cat]!) : null }))
    .filter((x) => x.item);
  const side = AVATAR_SIDE
    .map((cat) => ({ cat, item: slots[cat] ? byId.get(slots[cat]!) : null }))
    .filter((x) => x.item);

  const empty = stack.length === 0 && side.length === 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          side.length > 0 ? "minmax(0, 2fr) minmax(0, 1fr)" : "1fr",
        gap: "0.5rem",
        background: "#f7f5ef",
        border: "1px solid #ece7d8",
        borderRadius: 12,
        padding: "0.75rem",
        minHeight: 220,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          alignItems: "center",
        }}
      >
        {stack.length === 0 && side.length === 0 ? (
          <p
            style={{
              margin: "auto",
              color: "#888",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            下のアイテムをタップして着せ替えしてください
          </p>
        ) : (
          stack.map(({ cat, item }) => (
            <AvatarSlot
              key={cat}
              item={item!}
              size={140}
            />
          ))
        )}
      </div>
      {side.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            justifyContent: "flex-end",
          }}
        >
          {side.map(({ cat, item }) => (
            <AvatarSlot key={cat} item={item!} size={90} />
          ))}
        </div>
      )}
      {empty && null}
    </div>
  );
}

function AvatarSlot({ item, size }: { item: ClothingItem; size: number }) {
  return (
    <img
      src={imgSrc(item)}
      alt={item.subcategory ?? item.category}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5dfc9",
        display: "block",
      }}
    />
  );
}

function CategoryRow({
  category,
  items,
  selectedId,
  onToggle,
}: {
  category: ClothingCategory;
  items: ClothingItem[];
  selectedId: string | undefined;
  onToggle: (item: ClothingItem) => void;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h2
        style={{
          margin: "0 0 0.4rem",
          fontSize: "0.85rem",
          color: "#666",
          fontWeight: "normal",
        }}
      >
        {CATEGORY_LABEL[category]}
      </h2>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.3rem",
        }}
      >
        {items.map((item) => {
          const selected = selectedId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item)}
              style={{
                flexShrink: 0,
                position: "relative",
                padding: 0,
                background: "#fff",
                border: "2px solid",
                borderColor: selected ? "#111" : "#eee",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <img
                src={imgSrc(item)}
                alt={item.subcategory ?? item.category}
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              {!item.iconKey && (
                <span
                  title="アイコン未生成"
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    fontSize: "0.6rem",
                    padding: "1px 4px",
                    borderRadius: 4,
                  }}
                >
                  原
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
