import { describe, expect, it } from "vitest";
import type { ClothingItem } from "@/schema/clothing";
import { buildOutfitPrompt } from "@/lib/outfit-prompt";

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: "x",
    category: "tops",
    subcategory: "Tシャツ",
    colors: [{ name: "白", hex: "#ffffff" }],
    pattern: "solid",
    material: "コットン",
    silhouette: null,
    season: ["spring"],
    formality: 2,
    occasion: [],
    tags: [],
    brand: null,
    notes: null,
    imageKey: "items/x.jpg",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildOutfitPrompt", () => {
  it("日本語の color/subcategory/material を英語に変換する", () => {
    const prompt = buildOutfitPrompt(
      [
        item({ id: "t", colors: [{ name: "白", hex: "#fff" }], subcategory: "Tシャツ", material: "コットン" }),
        item({ id: "b", category: "bottoms", colors: [{ name: "ネイビー", hex: "#001" }], subcategory: "デニム", material: "デニム" }),
        item({ id: "s", category: "shoes", colors: [{ name: "白", hex: "#fff" }], subcategory: "スニーカー", material: null }),
      ],
      "週末ランチ",
    );
    expect(prompt).toContain("white cotton T-shirt");
    expect(prompt).toContain("navy denim denim jeans");
    expect(prompt).toContain("white sneakers");
    expect(prompt).toContain("Full-body fashion lookbook");
  });

  it("バッグ・アクセサリーは Holding 句に入る", () => {
    const prompt = buildOutfitPrompt(
      [
        item({ id: "t", subcategory: "Tシャツ" }),
        item({
          id: "bag",
          category: "bag",
          subcategory: "トート",
          colors: [{ name: "黒", hex: "#000" }],
          material: "レザー",
        }),
      ],
      "通勤",
    );
    expect(prompt).toContain("Holding black leather tote bag");
  });

  it("solid と other パターンは説明に含めない", () => {
    const prompt = buildOutfitPrompt(
      [item({ id: "t", pattern: "solid" })],
      "x",
    );
    expect(prompt).not.toContain("solid");
  });

  it("striped パターンは含める", () => {
    const prompt = buildOutfitPrompt(
      [item({ id: "t", pattern: "stripe", subcategory: "シャツ" })],
      "x",
    );
    expect(prompt).toContain("striped");
  });

  it("未知の単語はそのまま使う (フォールバック)", () => {
    const prompt = buildOutfitPrompt(
      [
        item({
          id: "t",
          subcategory: "オリジナル製品名",
          colors: [{ name: "謎色", hex: "#abc" }],
          material: "謎素材",
        }),
      ],
      "x",
    );
    expect(prompt).toContain("謎色");
    expect(prompt).toContain("謎素材");
    expect(prompt).toContain("オリジナル製品名");
  });

  it("着衣順 (outerwear→tops→dress→bottoms→shoes) で並べる", () => {
    const prompt = buildOutfitPrompt(
      [
        item({ id: "shoes", category: "shoes", subcategory: "スニーカー" }),
        item({ id: "outer", category: "outerwear", subcategory: "コート" }),
        item({ id: "tops", category: "tops", subcategory: "Tシャツ" }),
        item({ id: "bottoms", category: "bottoms", subcategory: "デニム" }),
      ],
      "x",
    );
    const coatIdx = prompt.indexOf("coat");
    const tshirtIdx = prompt.indexOf("T-shirt");
    const denimIdx = prompt.indexOf("denim jeans");
    const sneakerIdx = prompt.indexOf("sneakers");
    expect(coatIdx).toBeGreaterThanOrEqual(0);
    expect(coatIdx).toBeLessThan(tshirtIdx);
    expect(tshirtIdx).toBeLessThan(denimIdx);
    expect(denimIdx).toBeLessThan(sneakerIdx);
  });
});
