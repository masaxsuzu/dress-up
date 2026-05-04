import { describe, expect, it } from "vitest";
import {
  ClothingItemInputSchema,
  VLMExtractionSchema,
} from "@/schema/clothing";

describe("VLMExtractionSchema", () => {
  const valid = {
    category: "tops" as const,
    subcategory: "tee",
    colors: [{ name: "navy", hex: "#1f2a44" }],
    pattern: "solid" as const,
    material: "cotton",
    silhouette: "regular",
    season: ["spring" as const],
    formality: 2,
    occasion: ["casual"],
    tags: ["basic"],
  };

  it("正常な抽出結果を受理する", () => {
    expect(() => VLMExtractionSchema.parse(valid)).not.toThrow();
  });

  it("未知のカテゴリを拒否する", () => {
    expect(() =>
      VLMExtractionSchema.parse({ ...valid, category: "hoodie" }),
    ).toThrow();
  });

  it("無効なhexを拒否する", () => {
    expect(() =>
      VLMExtractionSchema.parse({
        ...valid,
        colors: [{ name: "navy", hex: "1f2a44" }],
      }),
    ).toThrow();
  });

  it("formality 範囲外を拒否する", () => {
    expect(() =>
      VLMExtractionSchema.parse({ ...valid, formality: 0 }),
    ).toThrow();
    expect(() =>
      VLMExtractionSchema.parse({ ...valid, formality: 6 }),
    ).toThrow();
  });

  it("colorsが空でない配列であることを要求する", () => {
    expect(() =>
      VLMExtractionSchema.parse({ ...valid, colors: [] }),
    ).toThrow();
  });

  it("seasonが空でない配列であることを要求する", () => {
    expect(() =>
      VLMExtractionSchema.parse({ ...valid, season: [] }),
    ).toThrow();
  });

  it("optionalな属性をnullで受理する", () => {
    expect(() =>
      VLMExtractionSchema.parse({
        ...valid,
        subcategory: null,
        pattern: null,
        material: null,
        silhouette: null,
      }),
    ).not.toThrow();
  });
});

describe("ClothingItemInputSchema", () => {
  it("imageKey欠落で失敗する", () => {
    expect(() =>
      ClothingItemInputSchema.parse({
        category: "tops",
        subcategory: null,
        colors: [{ name: "navy", hex: "#1f2a44" }],
        pattern: null,
        material: null,
        silhouette: null,
        season: ["spring"],
        formality: 2,
        occasion: [],
        tags: [],
        brand: null,
        notes: null,
      }),
    ).toThrow();
  });
});
