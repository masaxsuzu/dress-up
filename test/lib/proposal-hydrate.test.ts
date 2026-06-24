import { describe, expect, it } from "vitest";
import { hydrateProposals } from "@/lib/proposal-hydrate";
import type { ClothingItem } from "@/schema/clothing";
import type { ProposalDraft } from "@/schema/recommend";

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: "tops-1",
    category: "tops",
    subcategory: "Tシャツ",
    colors: [{ name: "白", hex: "#ffffff" }],
    pattern: "solid",
    material: "コットン",
    silhouette: "レギュラー",
    season: ["spring", "summer"],
    formality: 2,
    occasion: ["カジュアル"],
    tags: ["定番"],
    brand: null,
    notes: null,
    imageKey: "items/x.jpg",
    iconKey: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("hydrateProposals", () => {
  it("owned id を実 ClothingItem に hydrate、buy はそのまま", () => {
    const drafts: ProposalDraft[] = [
      {
        items: [
          { kind: "owned", id: "tops-1" },
          { kind: "buy", category: "shoes", description: "白スニーカー" },
        ],
        reason: "r",
      },
    ];
    const result = hydrateProposals(drafts, [item({ id: "tops-1" })]);
    expect(result[0].items[0]).toMatchObject({
      kind: "owned",
      item: { id: "tops-1", category: "tops" },
    });
    expect(result[0].items[1]).toMatchObject({
      kind: "buy",
      category: "shoes",
      description: "白スニーカー",
    });
  });

  it("削除済み owned id は drop される", () => {
    const drafts: ProposalDraft[] = [
      {
        items: [
          { kind: "owned", id: "tops-1" },
          { kind: "owned", id: "deleted-id" },
          { kind: "buy", category: "shoes", description: "靴" },
        ],
        reason: "r",
      },
    ];
    const result = hydrateProposals(drafts, [item({ id: "tops-1" })]);
    expect(result[0].items).toHaveLength(2);
    expect(result[0].items[0]).toMatchObject({ kind: "owned" });
    expect(result[0].items[1]).toMatchObject({ kind: "buy" });
  });

  it("全部 drop されたら placeholder buy を 1 件入れる (min(1) 維持)", () => {
    const drafts: ProposalDraft[] = [
      {
        items: [
          { kind: "owned", id: "deleted-1" },
          { kind: "owned", id: "deleted-2" },
        ],
        reason: "r",
      },
    ];
    const result = hydrateProposals(drafts, []);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0]).toMatchObject({
      kind: "buy",
      category: "other",
    });
    if (result[0].items[0].kind === "buy") {
      expect(result[0].items[0].description).toMatch(/削除/);
    }
  });
});
