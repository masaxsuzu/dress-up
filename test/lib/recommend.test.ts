import { beforeEach, describe, expect, it } from "vitest";
import type { ClothingItem } from "@/schema/clothing";
import {
  installGenAIMock,
  toolCallResponse,
} from "@/test/helpers/gemini";
import { makeItem, SAMPLE_PROPOSALS } from "@/test/helpers/factories";

const generateContentMock = installGenAIMock();
const { recommendOutfits } = await import("@/lib/recommend");

const ITEMS: ClothingItem[] = [
  makeItem({ id: "tops-1" }),
  makeItem({ id: "bottoms-1", category: "bottoms", subcategory: "デニム" }),
  makeItem({ id: "shoes-1", category: "shoes", subcategory: "スニーカー" }),
];

const mockProposals = (proposals: unknown) =>
  toolCallResponse("recommend_outfits", { proposals });

beforeEach(() => generateContentMock.mockReset());

describe("recommendOutfits", () => {
  it("3 案の owned/buy 混在レスポンスをそのままパースする", async () => {
    generateContentMock.mockResolvedValue(mockProposals(SAMPLE_PROPOSALS));

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
      mockProposals([
        {
          items: [
            { kind: "owned", id: "tops-1" },
            { kind: "owned", id: "ghost-item" },
            { kind: "buy", category: "shoes", description: "白スニーカー" },
          ],
          reason: "1",
        },
        SAMPLE_PROPOSALS[1],
        SAMPLE_PROPOSALS[2],
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
      mockProposals([
        { items: [{ kind: "owned", id: "ghost" }], reason: "1" },
        SAMPLE_PROPOSALS[1],
        SAMPLE_PROPOSALS[2],
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
    generateContentMock.mockResolvedValue(
      mockProposals([
        {
          items: [
            { kind: "owned", id: "tops-1" },
            { kind: "buy" },
            { kind: "buy", category: "shoes" },
            { kind: "buy", category: "not-a-category", description: "謎カテゴリ" },
          ],
          reason: "1",
        },
        SAMPLE_PROPOSALS[1],
        SAMPLE_PROPOSALS[2],
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
    expect(items[3]).toMatchObject({
      kind: "buy",
      category: "other",
      description: "謎カテゴリ",
    });
  });

  it("kind が無くてもフィールドの有無から推定する", async () => {
    generateContentMock.mockResolvedValue(
      mockProposals([
        {
          items: [
            { id: "tops-1" }, // → owned
            { category: "shoes", description: "白スニーカー" }, // → buy
            {}, // → drop
          ],
          reason: "1",
        },
        SAMPLE_PROPOSALS[1],
        SAMPLE_PROPOSALS[2],
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
    generateContentMock.mockResolvedValue(mockProposals([SAMPLE_PROPOSALS[0]]));

    const result = await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
    });

    expect(result.proposals).toHaveLength(3);
    expect(result.proposals[0]).toMatchObject({ reason: "1: シンプル" });
    expect(result.proposals[1].items[0]).toMatchObject({ kind: "buy" });
  });

  it("proposals が 3 を超えたら先頭 3 件に切り詰める", async () => {
    generateContentMock.mockResolvedValue(
      mockProposals([...SAMPLE_PROPOSALS, SAMPLE_PROPOSALS[0], SAMPLE_PROPOSALS[1]]),
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
    generateContentMock.mockResolvedValue(mockProposals(SAMPLE_PROPOSALS));
    await recommendOutfits("sk", [], { season: "spring", tpo: "x" });
    expect(generateContentMock).toHaveBeenCalledOnce();
    const text = generateContentMock.mock.calls[0][0].contents[0].parts[0].text;
    expect(text).toMatch(/Wardrobe: \(empty/);
  });

  it("model 名と allowedFunctionNames を Gemini に渡す", async () => {
    generateContentMock.mockResolvedValue(mockProposals(SAMPLE_PROPOSALS));
    await recommendOutfits("sk", ITEMS, { season: "winter", tpo: "通勤" });

    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe("gemini-2.5-pro");
    expect(
      args.config.toolConfig.functionCallingConfig.allowedFunctionNames,
    ).toEqual(["recommend_outfits"]);
    const text = args.contents[0].parts[0].text as string;
    expect(text).toContain("Season: winter");
    expect(text).toContain("TPO: 通勤");
    expect(text).toContain("tops-1");
    // 不要フィールド (imageKey, hex, notes) は含まれないこと
    expect(text).not.toContain("items/sample.jpg");
    expect(text).not.toContain("#ffffff");
  });

  it("profile を渡すと Pro のメッセージに User profile 行が入る", async () => {
    generateContentMock.mockResolvedValue(mockProposals(SAMPLE_PROPOSALS));
    await recommendOutfits("sk", ITEMS, {
      season: "spring",
      tpo: "x",
      profile: {
        gender: "female",
        heightCm: 160,
        weightKg: null,
        bodyType: "細身",
        referenceImageKey: null,
        updatedAt: "",
      },
    });

    const text = generateContentMock.mock.calls[0][0].contents[0].parts[0].text;
    expect(text).toMatch(/User profile:/);
    expect(text).toMatch(/gender: female/);
    expect(text).toMatch(/160cm/);
    expect(text).toMatch(/細身/);
  });

  it("profile を渡さない場合は User profile 行が入らない", async () => {
    generateContentMock.mockResolvedValue(mockProposals(SAMPLE_PROPOSALS));
    await recommendOutfits("sk", ITEMS, { season: "spring", tpo: "x" });
    const text = generateContentMock.mock.calls[0][0].contents[0].parts[0].text;
    expect(text).not.toMatch(/User profile:/);
  });

  it("images を渡すと各アイテムの inlineData + id ラベルが順に並ぶ", async () => {
    generateContentMock.mockResolvedValue(mockProposals(SAMPLE_PROPOSALS));

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
