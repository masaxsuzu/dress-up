import { describe, expect, it } from "vitest";
import type { ClothingCategory, ClothingItem } from "@/schema/clothing";
import { layoutOutfitBoard } from "@/lib/outfit-layout";

function item(id: string, category: ClothingCategory): ClothingItem {
  return {
    id,
    category,
    subcategory: null,
    colors: [{ name: "白", hex: "#ffffff" }],
    pattern: "solid",
    material: null,
    silhouette: null,
    season: ["spring"],
    formality: 2,
    occasion: [],
    tags: [],
    brand: null,
    notes: null,
    imageKey: `items/${id}.jpg`,
    iconKey: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("layoutOutfitBoard", () => {
  it("main を outerwear→tops→dress→bottoms→shoes の順に並べる", () => {
    const input = [
      item("shoes-1", "shoes"),
      item("tops-1", "tops"),
      item("outer-1", "outerwear"),
      item("bottoms-1", "bottoms"),
    ];
    const { main } = layoutOutfitBoard(input);
    expect(main.map((i) => i.id)).toEqual([
      "outer-1",
      "tops-1",
      "bottoms-1",
      "shoes-1",
    ]);
  });

  it("side を bag→accessory→other の順に並べる", () => {
    const input = [
      item("other-1", "other"),
      item("bag-1", "bag"),
      item("acc-1", "accessory"),
    ];
    const { main, side } = layoutOutfitBoard(input);
    expect(main).toEqual([]);
    expect(side.map((i) => i.id)).toEqual(["bag-1", "acc-1", "other-1"]);
  });

  it("main と side の両方に正しく振り分ける", () => {
    const input = [
      item("bag-1", "bag"),
      item("tops-1", "tops"),
      item("bottoms-1", "bottoms"),
      item("acc-1", "accessory"),
      item("shoes-1", "shoes"),
    ];
    const { main, side } = layoutOutfitBoard(input);
    expect(main.map((i) => i.id)).toEqual([
      "tops-1",
      "bottoms-1",
      "shoes-1",
    ]);
    expect(side.map((i) => i.id)).toEqual(["bag-1", "acc-1"]);
  });

  it("同じカテゴリの複数アイテムも保持する", () => {
    const input = [
      item("tops-a", "tops"),
      item("tops-b", "tops"),
      item("bottoms-1", "bottoms"),
    ];
    const { main } = layoutOutfitBoard(input);
    expect(main.map((i) => i.id)).toEqual([
      "tops-a",
      "tops-b",
      "bottoms-1",
    ]);
  });

  it("dress は main に入る", () => {
    const input = [item("dress-1", "dress"), item("shoes-1", "shoes")];
    const { main, side } = layoutOutfitBoard(input);
    expect(main.map((i) => i.id)).toEqual(["dress-1", "shoes-1"]);
    expect(side).toEqual([]);
  });

  it("空配列は main/side ともに空", () => {
    const { main, side } = layoutOutfitBoard([]);
    expect(main).toEqual([]);
    expect(side).toEqual([]);
  });
});
