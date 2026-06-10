import type { ClothingCategory } from "@/schema/clothing";

// 着せ替えの「装着中」状態。各カテゴリ最大1点。
// dress は tops + bottoms の代わりとして扱い、相互に排他にする。
export type DressupSlots = Partial<Record<ClothingCategory, string>>;

export function toggleSlot(
  slots: DressupSlots,
  item: { id: string; category: ClothingCategory },
): DressupSlots {
  const next: DressupSlots = { ...slots };

  if (next[item.category] === item.id) {
    delete next[item.category];
    return next;
  }

  next[item.category] = item.id;

  if (item.category === "dress") {
    delete next.tops;
    delete next.bottoms;
  } else if (item.category === "tops" || item.category === "bottoms") {
    delete next.dress;
  }
  return next;
}

export function clearSlots(): DressupSlots {
  return {};
}
