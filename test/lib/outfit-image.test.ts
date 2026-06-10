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

const { generateOutfitImage } = await import("@/lib/outfit-image");

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

function mockImageResponse(mimeType = "image/png", data = "GENERATED") {
  return {
    candidates: [
      { content: { parts: [{ inlineData: { mimeType, data } }] } },
    ],
  };
}

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("generateOutfitImage", () => {
  it("inlineDataを返す候補をパースして {mediaType, base64} で返す", async () => {
    generateContentMock.mockResolvedValue(
      mockImageResponse("image/jpeg", "AAAA"),
    );

    const result = await generateOutfitImage(
      "sk",
      [item()],
      [{ id: "tops-1", mediaType: "image/jpeg", base64: "ZZZ" }],
      { tpo: "週末", season: "spring" },
    );

    expect(result).toEqual({ mediaType: "image/jpeg", base64: "AAAA" });
  });

  it("mimeTypeが返らない時は image/png にフォールバック", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [
        { content: { parts: [{ inlineData: { data: "DATA" } }] } },
      ],
    });

    const result = await generateOutfitImage(
      "sk",
      [item()],
      [],
      { tpo: "x", season: "spring" },
    );

    expect(result.mediaType).toBe("image/png");
  });

  it("inlineDataが無いとthrowする", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "sorry" }] } }],
    });

    await expect(
      generateOutfitImage("sk", [item()], [], { tpo: "x", season: "spring" }),
    ).rejects.toThrow(/画像が返されませんでした/);
  });

  it("Flash Image モデルを呼び出し IMAGE モダリティを指定する", async () => {
    generateContentMock.mockResolvedValue(mockImageResponse());

    await generateOutfitImage(
      "sk",
      [item()],
      [],
      { tpo: "x", season: "spring" },
    );

    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe("gemini-2.5-flash-image");
    expect(args.config.responseModalities).toEqual(["IMAGE"]);
  });

  it("各アイテム画像をinlineDataとしてプロンプトと並んで渡す", async () => {
    generateContentMock.mockResolvedValue(mockImageResponse());

    await generateOutfitImage(
      "sk",
      [item({ id: "a" }), item({ id: "b" })],
      [
        { id: "a", mediaType: "image/jpeg", base64: "AAA" },
        { id: "b", mediaType: "image/png", base64: "BBB" },
      ],
      { tpo: "結婚式", season: "autumn" },
    );

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    expect(parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "AAA" });
    expect(parts[1].inlineData).toEqual({ mimeType: "image/png", data: "BBB" });
    // 最後はテキストプロンプト
    expect(typeof parts[parts.length - 1].text).toBe("string");
    expect(parts[parts.length - 1].text.length).toBeGreaterThan(0);
  });
});
