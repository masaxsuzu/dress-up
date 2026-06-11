import { describe, expect, it } from "vitest";
import type { ClothingCategory } from "@/schema/clothing";
import { buildIconPrompt } from "@/lib/icon-prompt";

const ALL_CATEGORIES: ClothingCategory[] = [
  "tops",
  "outerwear",
  "bottoms",
  "dress",
  "shoes",
  "bag",
  "accessory",
  "other",
];

describe("buildIconPrompt", () => {
  it("全カテゴリで非空文字列を返す", () => {
    for (const cat of ALL_CATEGORIES) {
      const prompt = buildIconPrompt(cat);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(40);
    }
  });

  it("全カテゴリで白背景・no person/mannequin の指示を含む", () => {
    for (const cat of ALL_CATEGORIES) {
      const prompt = buildIconPrompt(cat);
      expect(prompt).toMatch(/white background/i);
      expect(prompt).toMatch(/no person or mannequin/i);
    }
  });

  it("tops/outerwear/bottoms/dress は ghost-mannequin / invisible body を指示する", () => {
    for (const cat of ["tops", "outerwear", "bottoms", "dress"] as const) {
      const prompt = buildIconPrompt(cat);
      expect(prompt).toMatch(/ghost-mannequin|invisible body/i);
    }
  });

  it("shoes は 3/4 angle で pair を並行に並べる (V字にしない) ことを指定する", () => {
    const prompt = buildIconPrompt("shoes");
    expect(prompt).toMatch(/3\/4/);
    expect(prompt).toMatch(/pair/i);
    expect(prompt).toMatch(/PARALLEL/);
    expect(prompt).toMatch(/same diagonal direction/i);
    // V字 / ハの字 にしない否定指示が入っていること
    expect(prompt).toMatch(/do NOT.*V-shape|do NOT.*ハの字|NOT.*splay/i);
  });

  it("outerwear は閉じた自然な着用形 (中央を切り抜かない) を指示する", () => {
    const prompt = buildIconPrompt("outerwear");
    expect(prompt).toMatch(/closed at the front|buttoned|zipped|naturally overlapping/i);
    expect(prompt).toMatch(/do NOT cut out|do NOT.*center axis empty/i);
  });

  it("bag は hanging を指定する", () => {
    expect(buildIconPrompt("bag")).toMatch(/hanging/i);
  });

  it("カテゴリ別に固有のフレーズを含む (使い回しではない)", () => {
    const tops = buildIconPrompt("tops");
    const bottoms = buildIconPrompt("bottoms");
    expect(tops).toMatch(/hem at the waist/i);
    expect(bottoms).toMatch(/waistband at the top/i);
    expect(tops).not.toBe(bottoms);
  });
});
