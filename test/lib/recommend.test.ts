import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClothingItem } from "@/schema/clothing";

const generateContentMock = vi.fn();
vi.mock("@google/genai", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent: generateContentMock },
    })),
  };
});

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
    iconKey: null,
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

function mockCall(args: unknown) {
  return { functionCalls: [{ name: "recommend_outfit", args }] };
}

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("recommendOutfits", () => {
  it("kind='outfit' のレスポンスをパースして返す", async () => {
    generateContentMock.mockResolvedValue(
      mockCall({
        kind: "outfit",
        item_ids: ["tops-1", "bottoms-1", "shoes-1"],
        reason: "白Tにデニムでカジュアル。",
      }),
    );

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
    generateContentMock.mockResolvedValue(
      mockCall({
        kind: "shopping",
        missing: [
          { category: "shoes", description: "黒のレザーパンプス" },
          { category: "dress", description: "ネイビーのミディ丈ワンピース" },
        ],
        reason: "結婚式の二次会には足元と一着の主役が必要です。",
      }),
    );

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
    generateContentMock.mockResolvedValue(
      mockCall({
        kind: "outfit",
        item_ids: ["tops-1", "ghost-item"],
        reason: "test",
      }),
    );

    const result = await recommendOutfits("sk-test", ITEMS, {
      season: "spring",
      tpo: "test",
    });
    expect(result.kind).toBe("outfit");
    if (result.kind !== "outfit") return;
    expect(result.item_ids).toEqual(["tops-1"]);
  });

  it("outfit で有効なidが残らない場合はthrowする", async () => {
    generateContentMock.mockResolvedValue(
      mockCall({
        kind: "outfit",
        item_ids: ["ghost-1", "ghost-2"],
        reason: "x",
      }),
    );

    await expect(
      recommendOutfits("sk-test", ITEMS, { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/一致しません/);
  });

  it("function_call が無いとthrowする", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [] });

    await expect(
      recommendOutfits("sk-test", ITEMS, { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/did not call/i);
  });

  it("空のワードローブはthrowする", async () => {
    await expect(
      recommendOutfits("sk-test", [], { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/アイテムがありません/);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("apiKey, season, tpo, アイテムが Gemini に渡される", async () => {
    generateContentMock.mockResolvedValue(
      mockCall({ kind: "outfit", item_ids: ["tops-1"], reason: "ok" }),
    );

    await recommendOutfits("sk-test-xyz", ITEMS, {
      season: "winter",
      tpo: "通勤",
    });

    expect(generateContentMock).toHaveBeenCalledOnce();
    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe("gemini-2.5-pro");
    expect(args.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([
      "recommend_outfit",
    ]);
    const userParts = args.contents[0].parts;
    const text = userParts[0].text as string;
    expect(text).toContain("Season: winter");
    expect(text).toContain("TPO: 通勤");
    expect(text).toContain("tops-1");
    // 不要フィールド (imageKey, hex, notes) は含まれないこと
    expect(text).not.toContain("items/x.jpg");
    expect(text).not.toContain("#ffffff");
  });

  it("images を渡すと各アイテムの inlineData + id ラベルが順に並ぶ", async () => {
    generateContentMock.mockResolvedValue(
      mockCall({ kind: "outfit", item_ids: ["tops-1"], reason: "ok" }),
    );

    await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "週末",
      images: [
        { id: "tops-1", mediaType: "image/jpeg", base64: "AAA" },
        { id: "bottoms-1", mediaType: "image/png", base64: "BBB" },
      ],
    });

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    expect(parts[0].text).toMatch(/Season:/);
    expect(parts[1].inlineData).toEqual({ mimeType: "image/jpeg", data: "AAA" });
    expect(parts[2]).toEqual({ text: "^ id: tops-1" });
    expect(parts[3].inlineData).toEqual({ mimeType: "image/png", data: "BBB" });
    expect(parts[4]).toEqual({ text: "^ id: bottoms-1" });
    expect(parts[5].text).toMatch(/Propose/);
  });

  it("images を渡さない場合は inlineData が入らない", async () => {
    generateContentMock.mockResolvedValue(
      mockCall({ kind: "outfit", item_ids: ["tops-1"], reason: "ok" }),
    );

    await recommendOutfits("sk", ITEMS, { season: "spring", tpo: "x" });

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    const hasImage = parts.some(
      (p: { inlineData?: unknown }) => p.inlineData !== undefined,
    );
    expect(hasImage).toBe(false);
  });
});
