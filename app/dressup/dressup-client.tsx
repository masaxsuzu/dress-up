"use client";

import { useMemo, useState } from "react";
import type { ClothingCategory, ClothingItem } from "@/schema/clothing";
import { CATEGORY_LABEL } from "@/lib/labels";
import {
  clearSlots,
  toggleSlot,
  type DressupSlots,
} from "@/lib/dressup-slots";

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

// レイヤードキャンバスでの各カテゴリの配置（%）。
// dress は tops+bottoms をまたぐ位置・サイズで、tops と排他なので両立しない。
// z-index は: outerwear(下) < bottoms < tops/dress < shoes < bag/accessory(浮かせる)
type LayerPos = {
  top?: string;
  left?: string;
  right?: string;
  width: string;
  height: string;
  zIndex: number;
};

const LAYER_POS: Partial<Record<ClothingCategory, LayerPos>> = {
  outerwear: { top: "6%", left: "8%", width: "84%", height: "60%", zIndex: 1 },
  tops: { top: "16%", left: "24%", width: "52%", height: "34%", zIndex: 3 },
  dress: { top: "16%", left: "22%", width: "56%", height: "58%", zIndex: 3 },
  bottoms: { top: "44%", left: "24%", width: "52%", height: "38%", zIndex: 2 },
  shoes: { top: "78%", left: "35%", width: "30%", height: "18%", zIndex: 4 },
  bag: { top: "4%", right: "4%", width: "22%", height: "22%", zIndex: 5 },
  accessory: { top: "4%", left: "4%", width: "18%", height: "18%", zIndex: 5 },
};

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

  const isEmpty = Object.keys(slots).length === 0;

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

      <OutfitCanvas slots={slots} byId={byId} />

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

function OutfitCanvas({
  slots,
  byId,
}: {
  slots: DressupSlots;
  byId: Map<string, ClothingItem>;
}) {
  const layers = (Object.keys(LAYER_POS) as ClothingCategory[])
    .map((cat) => {
      const id = slots[cat];
      if (!id) return null;
      const item = byId.get(id);
      if (!item) return null;
      const pos = LAYER_POS[cat];
      if (!pos) return null;
      return { cat, item, pos };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 360,
        aspectRatio: "3 / 4",
        margin: "0 auto",
        background: "#f7f5ef",
        border: "1px solid #ece7d8",
        borderRadius: 12,
        overflow: "hidden",
        // mix-blend-mode の backdrop を canvas に確定させる。
        // これがないと各レイヤーが自分の stacking context に閉じてしまい blend が空振りする。
        isolation: "isolate",
      }}
    >
      {layers.length === 0 && (
        <p
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            display: "grid",
            placeItems: "center",
            color: "#888",
            fontSize: "0.9rem",
            textAlign: "center",
            padding: "0 1rem",
          }}
        >
          下のアイテムをタップして着せ替えしてください
        </p>
      )}
      {layers.map(({ cat, item, pos }) => (
        <CanvasLayer key={cat} item={item} pos={pos} />
      ))}
    </div>
  );
}

function CanvasLayer({ item, pos }: { item: ClothingItem; pos: LayerPos }) {
  const hasIcon = !!item.iconKey;
  return (
    <div
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        right: pos.right,
        width: pos.width,
        height: pos.height,
        zIndex: pos.zIndex,
        // blend mode はラッパー側に置く。img 側に付けると z-index で作られる
        // 内側 stacking context に閉じてしまい canvas 背景と混ざらない。
        mixBlendMode: hasIcon ? "multiply" : "normal",
      }}
    >
      <img
        src={imgSrc(item)}
        alt={item.subcategory ?? item.category}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          // アイコン未生成 (元写真) は白フレームで「写真」として浮かせる。
          background: hasIcon ? "transparent" : "#fff",
          border: hasIcon ? "none" : "1px solid #ddd",
          borderRadius: 6,
          display: "block",
        }}
      />
    </div>
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
