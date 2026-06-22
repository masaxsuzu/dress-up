import { describe, expect, it } from "vitest";
import type { ClothingItem } from "@/schema/clothing";
import { buildOutfitPrompt, type PromptItem } from "@/lib/outfit-prompt";

// テストヘルパ: ClothingItem を PromptItem (owned) に包む。
function owned(i: ClothingItem): PromptItem {
  return { kind: "owned", item: i };
}

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
    iconKey: null,
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
      { tpo: "週末ランチ" },
    );
    expect(prompt).toContain("white cotton t-shirt");
    expect(prompt).toContain("navy blue denim jeans");
    expect(prompt).toContain("white sneakers");
    expect(prompt).toContain("Top:");
    expect(prompt).toContain("Bottoms:");
    expect(prompt).toContain("Shoes:");
  });

  it("バッグ・アクセサリーも箇条書きに含まれる", () => {
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
      { tpo: "通勤" },
    );
    expect(prompt).toContain("Bag: black leather tote bag");
  });

  it("solid と other パターンは説明に含めない", () => {
    const prompt = buildOutfitPrompt(
      [item({ id: "t", pattern: "solid" })],
      { tpo: "x" },
    );
    // "solid" は形容詞として描写に入らない
    expect(prompt).not.toContain("solid t-shirt");
    expect(prompt).not.toContain("solid white");
  });

  it("striped パターンは含める", () => {
    const prompt = buildOutfitPrompt(
      [item({ id: "t", pattern: "stripe", subcategory: "シャツ" })],
      { tpo: "x" },
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
      { tpo: "x" },
    );
    expect(prompt).toContain("謎色");
    expect(prompt).toContain("謎素材");
    expect(prompt).toContain("オリジナル製品名");
  });

  it("着衣順 (outerwear→tops→dress→bottoms→shoes→bag→accessory) で並べる", () => {
    const prompt = buildOutfitPrompt(
      [
        item({ id: "shoes", category: "shoes", subcategory: "スニーカー" }),
        item({ id: "outer", category: "outerwear", subcategory: "コート" }),
        item({ id: "tops", category: "tops", subcategory: "Tシャツ" }),
        item({ id: "bottoms", category: "bottoms", subcategory: "デニム" }),
      ],
      { tpo: "x" },
    );
    const coatIdx = prompt.indexOf("coat");
    const tshirtIdx = prompt.indexOf("t-shirt");
    const denimIdx = prompt.indexOf("jeans");
    const sneakerIdx = prompt.indexOf("sneakers");
    expect(coatIdx).toBeGreaterThanOrEqual(0);
    expect(coatIdx).toBeLessThan(tshirtIdx);
    expect(tshirtIdx).toBeLessThan(denimIdx);
    expect(denimIdx).toBeLessThan(sneakerIdx);
  });

  it("素材が subcategory に既に含まれる場合は重複させない", () => {
    const prompt = buildOutfitPrompt(
      [
        item({
          id: "b",
          category: "bottoms",
          subcategory: "デニム",
          material: "デニム",
          colors: [{ name: "ネイビー", hex: "#001" }],
        }),
      ],
      { tpo: "x" },
    );
    // jeans (←デニム) は material "denim" を含むが、subcategory に "denim" は無いので
    // describeItem は "navy blue denim jeans" を返す。"denim denim" のような重複は無い。
    expect(prompt).not.toMatch(/denim denim/);
  });

  it("複数色は up to 2 まで使う", () => {
    const prompt = buildOutfitPrompt(
      [
        item({
          id: "t",
          subcategory: "シャツ",
          colors: [
            { name: "白", hex: "#fff" },
            { name: "黒", hex: "#000" },
            { name: "赤", hex: "#f00" },
          ],
        }),
      ],
      { tpo: "x" },
    );
    expect(prompt).toContain("white and black");
    expect(prompt).not.toContain("red");
  });

  it("TPO と season をプロンプトに含める", () => {
    const prompt = buildOutfitPrompt(
      [item({ id: "t" })],
      { tpo: "結婚式の二次会", season: "winter" },
    );
    expect(prompt).toContain("Scene: 結婚式の二次会");
    expect(prompt).toContain("Season: winter");
  });

  it("photorealistic と studio background のスタイル指定が含まれる", () => {
    const prompt = buildOutfitPrompt([item({ id: "t" })], { tpo: "x" });
    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("studio");
    expect(prompt).toContain("full body");
  });

  it("被写体は男性 (young adult man) で生成するよう指示する", () => {
    const prompt = buildOutfitPrompt([item({ id: "t" })], { tpo: "x" });
    expect(prompt).toMatch(/young adult man/);
  });

  it("subcategoryがnullならカテゴリ名を使う", () => {
    const prompt = buildOutfitPrompt(
      [
        item({
          id: "t",
          category: "tops",
          subcategory: null,
          material: null,
          colors: [{ name: "白", hex: "#fff" }],
        }),
      ],
      { tpo: "x" },
    );
    // CATEGORY_NOUN.tops = "top"
    expect(prompt).toContain("white top");
  });
});
