import { describe, expect, it } from "vitest";
import type { ClothingCategory } from "@/schema/clothing";
import { clearSlots, toggleSlot, type DressupSlots } from "@/lib/dressup-slots";

function item(id: string, category: ClothingCategory) {
  return { id, category };
}

describe("toggleSlot", () => {
  it("同じカテゴリの新しいアイテムは置き換え", () => {
    const s1 = toggleSlot({}, item("t1", "tops"));
    expect(s1).toEqual({ tops: "t1" });
    const s2 = toggleSlot(s1, item("t2", "tops"));
    expect(s2).toEqual({ tops: "t2" });
  });

  it("選択中のアイテムを再タップで脱がせる", () => {
    const s1: DressupSlots = { tops: "t1" };
    const s2 = toggleSlot(s1, item("t1", "tops"));
    expect(s2).toEqual({});
  });

  it("dress を着ると tops と bottoms が外れる", () => {
    const s: DressupSlots = { tops: "t1", bottoms: "b1", shoes: "sh1" };
    const next = toggleSlot(s, item("d1", "dress"));
    expect(next).toEqual({ dress: "d1", shoes: "sh1" });
  });

  it("dress 装着中に tops を着ると dress が外れる", () => {
    const s: DressupSlots = { dress: "d1", shoes: "sh1" };
    const next = toggleSlot(s, item("t1", "tops"));
    expect(next).toEqual({ tops: "t1", shoes: "sh1" });
  });

  it("dress 装着中に bottoms を着ると dress が外れる", () => {
    const s: DressupSlots = { dress: "d1" };
    const next = toggleSlot(s, item("b1", "bottoms"));
    expect(next).toEqual({ bottoms: "b1" });
  });

  it("outerwear / shoes / bag / accessory はそれぞれ独立", () => {
    let s: DressupSlots = {};
    s = toggleSlot(s, item("o1", "outerwear"));
    s = toggleSlot(s, item("sh1", "shoes"));
    s = toggleSlot(s, item("bg1", "bag"));
    s = toggleSlot(s, item("a1", "accessory"));
    expect(s).toEqual({
      outerwear: "o1",
      shoes: "sh1",
      bag: "bg1",
      accessory: "a1",
    });
  });

  it("入力 slots を直接変更しない (immutable)", () => {
    const s: DressupSlots = { tops: "t1" };
    toggleSlot(s, item("t2", "tops"));
    expect(s).toEqual({ tops: "t1" });
  });
});

describe("clearSlots", () => {
  it("空オブジェクトを返す", () => {
    expect(clearSlots()).toEqual({});
  });
});
