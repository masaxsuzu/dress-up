import { describe, expect, it } from "vitest";
import { computeStats } from "@/lib/stats";
import { makeItem } from "../helpers/factories";

describe("computeStats", () => {
  it("空配列: 全カウント 0", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.iconized).toBe(0);
    expect(s.topColors).toEqual([]);
    expect(s.topBrands).toEqual([]);
    expect(s.brandCount).toBe(0);
    expect(Object.values(s.byCategory).every((n) => n === 0)).toBe(true);
  });

  it("カテゴリ・シーズン・フォーマリティを集計する", () => {
    const s = computeStats([
      makeItem({ id: "1", category: "tops", season: ["spring", "summer"], formality: 2 }),
      makeItem({ id: "2", category: "tops", season: ["spring"], formality: 4 }),
      makeItem({ id: "3", category: "bottoms", season: ["winter"], formality: 4 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.byCategory.tops).toBe(2);
    expect(s.byCategory.bottoms).toBe(1);
    expect(s.bySeason.spring).toBe(2); // multi-value
    expect(s.bySeason.summer).toBe(1);
    expect(s.byFormality[4]).toBe(2);
  });

  it("iconized: iconKey ありのみカウント", () => {
    const s = computeStats([
      makeItem({ id: "1", iconKey: "icons/1.png" }),
      makeItem({ id: "2", iconKey: null }),
    ]);
    expect(s.iconized).toBe(1);
  });

  it("カラー: 同一 hex を集約し hex 昇順で返す", () => {
    const s = computeStats([
      makeItem({ id: "1", colors: [{ name: "白", hex: "#ffffff" }] }),
      makeItem({
        id: "2",
        colors: [
          { name: "白", hex: "#ffffff" },
          { name: "黒", hex: "#000000" },
        ],
      }),
    ]);
    expect(s.topColors).toEqual([
      ["#000000", { name: "黒", count: 1 }],
      ["#ffffff", { name: "白", count: 2 }],
    ]);
  });

  it("ブランド: trim して集約し件数降順、brandCount はユニーク数", () => {
    const s = computeStats([
      makeItem({ id: "1", brand: "UNIQLO" }),
      makeItem({ id: "2", brand: "UNIQLO " }), // 末尾スペースの表記揺れ
      makeItem({ id: "3", brand: "Knot" }),
      makeItem({ id: "4", brand: null }),
    ]);
    expect(s.topBrands).toEqual([
      ["UNIQLO", 2],
      ["Knot", 1],
    ]);
    expect(s.brandCount).toBe(2);
  });

  it("パターン: null は集計しない", () => {
    const s = computeStats([
      makeItem({ id: "1", pattern: "solid" }),
      makeItem({ id: "2", pattern: null }),
    ]);
    expect(s.byPattern).toEqual({ solid: 1 });
  });
});
