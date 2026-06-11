import { describe, expect, it } from "vitest";
import { sanitizeToUpdate } from "@/lib/sanitize";
import type { ClothingItemUpdate } from "@/schema/clothing";

const base: Parameters<typeof sanitizeToUpdate>[0] = {
  category: "tops",
  subcategory: "Tシャツ",
  colors: [{ name: "white", hex: "#ffffff" }],
  pattern: "solid",
  material: "cotton",
  silhouette: "regular",
  season: ["spring", "summer"],
  formality: 2,
  occasion: ["casual"],
  tags: ["basic"],
  brand: "UNIQLO",
  notes: null,
};

describe("sanitizeToUpdate", () => {
  it("正常なデータをそのまま保持する", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate(base);
    expect(hadInvalidFields).toBe(false);
    expect(sanitized.category).toBe("tops");
    expect(sanitized.pattern).toBe("solid");
    expect(sanitized.season).toEqual(["spring", "summer"]);
  });

  it("不正なカテゴリを tops に置き換え hadInvalidFields を立てる", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate({
      ...base,
      category: "hoodie",
    });
    expect(hadInvalidFields).toBe(true);
    expect(sanitized.category).toBe("tops");
  });

  it("不正なパターンを null に置き換え hadInvalidFields を立てる", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate({
      ...base,
      pattern: "paisley",
    });
    expect(hadInvalidFields).toBe(true);
    expect(sanitized.pattern).toBeNull();
  });

  it("pattern が null のときはそのまま null を保持する", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate({
      ...base,
      pattern: null,
    });
    expect(hadInvalidFields).toBe(false);
    expect(sanitized.pattern).toBeNull();
  });

  it("不正な季節値だけが除去される", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate({
      ...base,
      season: ["spring", "monsoon"],
    });
    expect(hadInvalidFields).toBe(true);
    expect(sanitized.season).toEqual(["spring"]);
  });

  it("季節が全て不正な場合は spring にフォールバックする", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate({
      ...base,
      season: ["monsoon", "dry"],
    });
    expect(hadInvalidFields).toBe(true);
    expect(sanitized.season).toEqual(["spring"]);
  });

  it("有効なカテゴリ全種類を受理する", () => {
    const validCategories: ClothingItemUpdate["category"][] = [
      "tops", "outerwear", "bottoms", "dress", "shoes", "bag", "accessory", "other",
    ];
    for (const category of validCategories) {
      const { sanitized, hadInvalidFields } = sanitizeToUpdate({ ...base, category });
      expect(hadInvalidFields).toBe(false);
      expect(sanitized.category).toBe(category);
    }
  });

  it("有効なパターン全種類を受理する", () => {
    const validPatterns: NonNullable<ClothingItemUpdate["pattern"]>[] = [
      "solid", "stripe", "check", "dot", "floral", "graphic", "other",
    ];
    for (const pattern of validPatterns) {
      const { sanitized, hadInvalidFields } = sanitizeToUpdate({ ...base, pattern });
      expect(hadInvalidFields).toBe(false);
      expect(sanitized.pattern).toBe(pattern);
    }
  });

  it("有効なシーズン全種類を受理する", () => {
    const { sanitized, hadInvalidFields } = sanitizeToUpdate({
      ...base,
      season: ["spring", "summer", "autumn", "winter"],
    });
    expect(hadInvalidFields).toBe(false);
    expect(sanitized.season).toEqual(["spring", "summer", "autumn", "winter"]);
  });

  it("brand・notes を正しく引き継ぐ", () => {
    const { sanitized } = sanitizeToUpdate({ ...base, brand: "MUJI", notes: "お気に入り" });
    expect(sanitized.brand).toBe("MUJI");
    expect(sanitized.notes).toBe("お気に入り");
  });
});
