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

// 3 案を 1 つの functionCall として返す mock。
function mockCall(proposals: unknown) {
  return {
    functionCalls: [{ name: "recommend_outfits", args: { proposals } }],
  };
}

const SAMPLE_THREE = [
  {
    items: [
      { kind: "owned", id: "tops-1" },
      { kind: "owned", id: "bottoms-1" },
      { kind: "owned", id: "shoes-1" },
    ],
    reason: "1: シンプル",
  },
  {
    items: [
      { kind: "owned", id: "tops-1" },
      { kind: "buy", category: "bottoms", description: "ベージュチノパン" },
      { kind: "owned", id: "shoes-1" },
    ],
    reason: "2: チノで明るく",
  },
  {
    items: [
      { kind: "buy", category: "tops", description: "ネイビーポロ" },
      { kind: "buy", category: "bottoms", description: "黒スラックス" },
      { kind: "buy", category: "shoes", description: "茶色レザー" },
    ],
    reason: "3: 全部買い替え",
  },
];

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("recommendOutfits", () => {
  it("3 案の owned/buy 混在レスポンスをそのままパースする", async () => {
    generateContentMock.mockResolvedValue(mockCall(SAMPLE_THREE));

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "週末ランチ",
    });

    expect(result.proposals).toHaveLength(3);
    expect(result.proposals[0].items.every((i) => i.kind === "owned")).toBe(true);
    expect(result.proposals[1].items[1]).toMatchObject({
      kind: "buy",
      category: "bottoms",
      description: "ベージュチノパン",
    });
    expect(result.proposals[2].items.every((i) => i.kind === "buy")).toBe(true);
  });

  it("owned で未知の id を返してきたら除外し、buy はそのまま残す", async () => {
    generateContentMock.mockResolvedValue(
      mockCall([
        {
          items: [
            { kind: "owned", id: "tops-1" },
            { kind: "owned", id: "ghost-item" },
            { kind: "buy", category: "shoes", description: "白スニーカー" },
          ],
          reason: "1",
        },
        SAMPLE_THREE[1],
        SAMPLE_THREE[2],
      ]),
    );

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    const ids = result.proposals[0].items
      .filter((i) => i.kind === "owned")
      .map((i) => (i.kind === "owned" ? i.id : ""));
    expect(ids).toEqual(["tops-1"]);
    expect(result.proposals[0].items.some((i) => i.kind === "buy")).toBe(true);
  });

  it("有効アイテムが 1 個も残らなければ placeholder buy を入れて schema を保つ", async () => {
    generateContentMock.mockResolvedValue(
      mockCall([
        { items: [{ kind: "owned", id: "ghost" }], reason: "1" },
        SAMPLE_THREE[1],
        SAMPLE_THREE[2],
      ]),
    );

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    expect(result.proposals[0].items).toHaveLength(1);
    expect(result.proposals[0].items[0]).toMatchObject({ kind: "buy" });
  });

  it("buy アイテムで category/description が欠落していてもエラーにせず placeholder で埋める", async () => {
    // Gemini Pro が conditional required を理解せず、kind:'buy' のまま
    // category や description を omit してくる現実のケース。
    generateContentMock.mockResolvedValue(
      mockCall([
        {
          items: [
            { kind: "owned", id: "tops-1" },
            { kind: "buy" }, // 完全欠落
            { kind: "buy", category: "shoes" }, // description 欠落
            { kind: "buy", category: "not-a-category", description: "謎カテゴリ" }, // enum 外
          ],
          reason: "1",
        },
        SAMPLE_THREE[1],
        SAMPLE_THREE[2],
      ]),
    );

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    const items = result.proposals[0].items;
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ kind: "owned" });
    expect(items[1]).toMatchObject({ kind: "buy", category: "other" });
    expect(items[2]).toMatchObject({ kind: "buy", category: "shoes" });
    // enum 外は "other" にフォールバック
    expect(items[3]).toMatchObject({ kind: "buy", category: "other", description: "謎カテゴリ" });
  });

  it("kind が無くてもフィールドの有無から推定する (owned/buy)", async () => {
    generateContentMock.mockResolvedValue(
      mockCall([
        {
          items: [
            { id: "tops-1" }, // kind 無し、id だけ → owned 扱い
            { category: "shoes", description: "白スニーカー" }, // kind 無し → buy 扱い
            {}, // 完全に空 → 除外
          ],
          reason: "1",
        },
        SAMPLE_THREE[1],
        SAMPLE_THREE[2],
      ]),
    );

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    expect(result.proposals[0].items).toHaveLength(2);
    expect(result.proposals[0].items[0]).toMatchObject({ kind: "owned", id: "tops-1" });
    expect(result.proposals[0].items[1]).toMatchObject({
      kind: "buy",
      category: "shoes",
      description: "白スニーカー",
    });
  });

  it("proposals が 3 未満なら placeholder で 3 に揃える", async () => {
    generateContentMock.mockResolvedValue(mockCall([SAMPLE_THREE[0]]));

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    expect(result.proposals).toHaveLength(3);
    expect(result.proposals[0]).toMatchObject({ reason: "1: シンプル" });
    expect(result.proposals[1].items).toHaveLength(1);
    expect(result.proposals[1].items[0]).toMatchObject({ kind: "buy" });
  });

  it("proposals が 3 を超えたら先頭 3 件に切り詰める", async () => {
    generateContentMock.mockResolvedValue(
      mockCall([...SAMPLE_THREE, SAMPLE_THREE[0], SAMPLE_THREE[1]]),
    );

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    expect(result.proposals).toHaveLength(3);
  });

  it("function_call が無いとthrowする", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [] });
    await expect(
      recommendOutfits("sk", ITEMS, { season: "spring", tpo: "x" }),
    ).rejects.toThrow(/did not call/i);
  });

  it("空のワードローブでも throw せず Gemini を呼ぶ (全 buy 想定)", async () => {
    generateContentMock.mockResolvedValue(mockCall(SAMPLE_THREE));
    await recommendOutfits("sk", [], { season: "spring", tpo: "x" });
    expect(generateContentMock).toHaveBeenCalledOnce();
    const text = generateContentMock.mock.calls[0][0].contents[0].parts[0].text;
    expect(text).toMatch(/Wardrobe: \(empty/);
  });

  it("apiKey, season, tpo, アイテム JSON が Gemini に渡される", async () => {
    generateContentMock.mockResolvedValue(mockCall(SAMPLE_THREE));

    await recommendOutfits("sk-test-xyz", ITEMS, {
      season: "winter",
      tpo: "通勤",
    });

    expect(generateContentMock).toHaveBeenCalledOnce();
    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe("gemini-2.5-pro");
    expect(args.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([
      "recommend_outfits",
    ]);
    const text = args.contents[0].parts[0].text as string;
    expect(text).toContain("Season: winter");
    expect(text).toContain("TPO: 通勤");
    expect(text).toContain("tops-1");
    // 不要フィールド (imageKey, hex, notes) は含まれないこと
    expect(text).not.toContain("items/x.jpg");
    expect(text).not.toContain("#ffffff");
  });

  it("images を渡すと各アイテムの inlineData + id ラベルが順に並ぶ", async () => {
    generateContentMock.mockResolvedValue(mockCall(SAMPLE_THREE));

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
    expect(parts[5].text).toMatch(/Propose three/);
  });
});
