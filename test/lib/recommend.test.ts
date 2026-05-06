import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClothingItem } from "@/schema/clothing";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

const { recommendOutfits } = await import("@/lib/recommend");

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: "id-tops",
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
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const ITEMS: ClothingItem[] = [
  item({ id: "tops-1" }),
  item({ id: "bottoms-1", category: "bottoms", subcategory: "デニム" }),
  item({ id: "shoes-1", category: "shoes", subcategory: "スニーカー" }),
];

beforeEach(() => {
  createMock.mockReset();
});

describe("recommendOutfits", () => {
  it("kind='outfit' のレスポンスをパースして返す", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            kind: "outfit",
            item_ids: ["tops-1", "bottoms-1", "shoes-1"],
            reason: "白Tにデニムでカジュアル。",
          },
        },
      ],
    });

    const result = await recommendOutfits("sk-test", ITEMS, {
      season: "spring",
      tpo: "週末ランチ",
    });
    expect(result.kind).toBe("outfit");
    if (result.kind !== "outfit") return;
    expect(result.item_ids).toEqual(["tops-1", "bottoms-1", "shoes-1"]);
    expect(result.reason).toContain("白T");
  });

  it("kind='shopping' のレスポンスをそのまま返す", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            kind: "shopping",
            missing: [
              { category: "shoes", description: "黒のレザーパンプス" },
              { category: "dress", description: "ネイビーのミディ丈ワンピース" },
            ],
            reason: "結婚式の二次会には足元と一着の主役が必要です。",
          },
        },
      ],
    });

    const result = await recommendOutfits("sk-test", ITEMS, {
      season: "autumn",
      tpo: "結婚式の二次会",
    });
    expect(result.kind).toBe("shopping");
    if (result.kind !== "shopping") return;
    expect(result.missing).toHaveLength(2);
    expect(result.missing[0].category).toBe("shoes");
    expect(result.missing[0].description).toBe("黒のレザーパンプス");
  });

  it("outfit でハルシネーションされた未知のidは除外される", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            kind: "outfit",
            item_ids: ["tops-1", "ghost-item"],
            reason: "test",
          },
        },
      ],
    });

    const result = await recommendOutfits("sk-test", ITEMS, {
      season: "spring",
      tpo: "test",
    });
    expect(result.kind).toBe("outfit");
    if (result.kind !== "outfit") return;
    expect(result.item_ids).toEqual(["tops-1"]);
  });

  it("outfit で有効なidが残らない場合はthrowする", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            kind: "outfit",
            item_ids: ["ghost-1", "ghost-2"],
            reason: "x",
          },
        },
      ],
    });

    await expect(
      recommendOutfits("sk-test", ITEMS, { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/一致しません/);
  });

  it("tool_useブロックが無いとthrowする", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "sorry" }],
    });

    await expect(
      recommendOutfits("sk-test", ITEMS, { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/did not call/i);
  });

  it("空のワードローブはthrowする", async () => {
    await expect(
      recommendOutfits("sk-test", [], { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/アイテムがありません/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("apiKey, season, tpo, アイテムがClaudeに渡される", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            kind: "outfit",
            item_ids: ["tops-1"],
            reason: "ok",
          },
        },
      ],
    });

    await recommendOutfits("sk-test-xyz", ITEMS, {
      season: "winter",
      tpo: "通勤",
    });

    expect(createMock).toHaveBeenCalledOnce();
    const args = createMock.mock.calls[0][0];
    expect(args.tool_choice).toEqual({
      type: "tool",
      name: "recommend_outfit",
    });
    const userMsg = args.messages[0];
    expect(userMsg.role).toBe("user");
    const text = userMsg.content[0].text as string;
    expect(text).toContain("Season: winter");
    expect(text).toContain("TPO: 通勤");
    expect(text).toContain("tops-1");
    // 不要フィールド (imageKey, hex, notes) は含まれないこと
    expect(text).not.toContain("items/x.jpg");
    expect(text).not.toContain("#ffffff");
  });
});
