import { beforeEach, describe, expect, it } from "vitest";
import { makeItem } from "@/test/helpers/factories";
import { imageResponse, installGenAIMock } from "@/test/helpers/gemini";

const generateContentMock = installGenAIMock();
const { generateOutfitImage } = await import("@/lib/outfit-image");

beforeEach(() => generateContentMock.mockReset());

describe("generateOutfitImage", () => {
  it("inlineDataを返す候補をパースして {mediaType, base64} で返す", async () => {
    generateContentMock.mockResolvedValue(imageResponse("image/jpeg", "AAAA"));

    const result = await generateOutfitImage(
      "sk",
      [makeItem({ id: "tops-1" })],
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

    const result = await generateOutfitImage("sk", [makeItem()], [], {
      tpo: "x",
      season: "spring",
    });
    expect(result.mediaType).toBe("image/png");
  });

  it("inlineDataが無いとthrowする", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "sorry" }] } }],
    });

    await expect(
      generateOutfitImage("sk", [makeItem()], [], { tpo: "x", season: "spring" }),
    ).rejects.toThrow(/画像が返されませんでした/);
  });

  it("Flash Image モデルを呼び出し IMAGE モダリティを指定する", async () => {
    generateContentMock.mockResolvedValue(imageResponse());
    await generateOutfitImage("sk", [makeItem()], [], {
      tpo: "x",
      season: "spring",
    });

    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe("gemini-2.5-flash-image");
    expect(args.config.responseModalities).toEqual(["IMAGE"]);
  });

  it("referenceImage を渡すと先頭に inlineData + 説明テキストが入る", async () => {
    generateContentMock.mockResolvedValue(imageResponse());

    await generateOutfitImage(
      "sk",
      [makeItem({ id: "tops-1" })],
      [{ id: "tops-1", mediaType: "image/jpeg", base64: "ITEM" }],
      {
        tpo: "x",
        season: "spring",
        referenceImage: { mediaType: "image/png", base64: "REF" },
      },
    );

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    expect(parts[0].inlineData).toEqual({ mimeType: "image/png", data: "REF" });
    expect(parts[1].text).toMatch(/reference photo/i);
    expect(parts[2].inlineData).toEqual({ mimeType: "image/jpeg", data: "ITEM" });
    expect(parts[3].text).toMatch(/Subject:/);
    expect(parts[3].text).toMatch(/face and physique/i);
  });

  it("profile を渡すと Subject 行に反映される", async () => {
    generateContentMock.mockResolvedValue(imageResponse());

    await generateOutfitImage("sk", [makeItem()], [], {
      tpo: "x",
      season: "spring",
      profile: {
        gender: "female",
        heightCm: 160,
        weightKg: null,
        bodyType: null,
        referenceImageKey: null,
        updatedAt: "",
      },
    });

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    const promptText = parts[parts.length - 1].text;
    expect(promptText).toMatch(/young adult woman/);
    expect(promptText).toMatch(/160cm tall/);
  });

  it("各アイテム画像をinlineDataとしてプロンプトと並んで渡す", async () => {
    generateContentMock.mockResolvedValue(imageResponse());

    await generateOutfitImage(
      "sk",
      [makeItem({ id: "a" }), makeItem({ id: "b" })],
      [
        { id: "a", mediaType: "image/jpeg", base64: "AAA" },
        { id: "b", mediaType: "image/png", base64: "BBB" },
      ],
      { tpo: "結婚式", season: "autumn" },
    );

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    expect(parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "AAA" });
    expect(parts[1].inlineData).toEqual({ mimeType: "image/png", data: "BBB" });
    expect(typeof parts[parts.length - 1].text).toBe("string");
    expect(parts[parts.length - 1].text.length).toBeGreaterThan(0);
  });
});
