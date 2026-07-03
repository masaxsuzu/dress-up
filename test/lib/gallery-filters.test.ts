import { describe, expect, it } from "vitest";
import {
  buildURL,
  matchesAll,
  matchesCategory,
  matchesSeason,
  matchesText,
  parseParams,
} from "@/lib/gallery-filters";
import { makeItem } from "../helpers/factories";

describe("matchesText", () => {
  const item = makeItem({
    subcategory: "Tシャツ",
    brand: "UNIQLO",
    material: "コットン",
    notes: "夏用",
    tags: ["定番"],
  });

  it("空クエリは常に true", () => {
    expect(matchesText(item, "")).toBe(true);
  });

  it("brand / subcategory / tags を大文字小文字無視で部分一致", () => {
    expect(matchesText(item, "uniqlo")).toBe(true);
    expect(matchesText(item, "Tシャツ")).toBe(true);
    expect(matchesText(item, "定番")).toBe(true);
    expect(matchesText(item, "存在しない")).toBe(false);
  });
});

describe("matchesCategory / matchesSeason", () => {
  const item = makeItem({ category: "tops", season: ["spring", "summer"] });

  it("空フィルタは常に true", () => {
    expect(matchesCategory(item, [])).toBe(true);
    expect(matchesSeason(item, [])).toBe(true);
  });

  it("いずれか一致で true", () => {
    expect(matchesCategory(item, ["tops", "shoes"])).toBe(true);
    expect(matchesCategory(item, ["shoes"])).toBe(false);
    expect(matchesSeason(item, ["summer", "winter"])).toBe(true);
    expect(matchesSeason(item, ["winter"])).toBe(false);
  });
});

describe("matchesAll", () => {
  it("全条件の AND", () => {
    const item = makeItem({ category: "tops", season: ["spring"], brand: "Knot" });
    expect(
      matchesAll(item, { q: "knot", categories: ["tops"], seasons: ["spring"] }),
    ).toBe(true);
    expect(
      matchesAll(item, { q: "knot", categories: ["shoes"], seasons: ["spring"] }),
    ).toBe(false);
  });
});

describe("parseParams / buildURL", () => {
  it("往復変換が一致する", () => {
    const params = {
      q: "デニム",
      categories: ["bottoms" as const],
      seasons: ["autumn" as const, "winter" as const],
    };
    const url = buildURL(params);
    expect(url).toBe(
      "/?q=%E3%83%87%E3%83%8B%E3%83%A0&category=bottoms&season=autumn&season=winter",
    );
    const sp = new URLSearchParams(url.slice(2));
    expect(parseParams(sp)).toEqual(params);
  });

  it("不正な category/season 値は捨てる", () => {
    const sp = new URLSearchParams("category=bogus&season=nope&season=spring");
    expect(parseParams(sp)).toEqual({
      q: "",
      categories: [],
      seasons: ["spring"],
    });
  });

  it("空パラメータは / を返す", () => {
    expect(buildURL({ q: "", categories: [], seasons: [] })).toBe("/");
  });
});
