import type { ClothingCategory, ClothingItem } from "@/schema/clothing";

const MAIN_ORDER: readonly ClothingCategory[] = [
  "outerwear",
  "tops",
  "dress",
  "bottoms",
  "shoes",
] as const;

const SIDE_ORDER: readonly ClothingCategory[] = [
  "bag",
  "accessory",
  "other",
] as const;

export function layoutOutfitBoard(items: ClothingItem[]): {
  main: ClothingItem[];
  side: ClothingItem[];
} {
  const main = items
    .filter((i) => MAIN_ORDER.includes(i.category))
    .sort(
      (a, b) =>
        MAIN_ORDER.indexOf(a.category) - MAIN_ORDER.indexOf(b.category),
    );
  const side = items
    .filter((i) => SIDE_ORDER.includes(i.category))
    .sort(
      (a, b) =>
        SIDE_ORDER.indexOf(a.category) - SIDE_ORDER.indexOf(b.category),
    );
  return { main, side };
}
