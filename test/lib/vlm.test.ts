import { beforeEach, describe, expect, it } from "vitest";
import { installGenAIMock, toolCallResponse } from "@/test/helpers/gemini";

const generateContentMock = installGenAIMock();
const { extractClothing } = await import("@/lib/vlm");

const VALID_EXTRACTION = {
  category: "tops",
  subcategory: "Tシャツ",
  colors: [{ name: "ネイビー", hex: "#1f2a44" }],
  pattern: "solid",
  material: "コットン",
  silhouette: "レギュラー",
  season: ["spring", "summer"],
  formality: 2,
  occasion: ["カジュアル"],
  tags: ["定番"],
};

const IMAGE = { mediaType: "image/png", base64: "AAAA" };

beforeEach(() => generateContentMock.mockReset());

describe("extractClothing", () => {
  it("function_call の args をスキーマでパースして返す", async () => {
    generateContentMock.mockResolvedValue(
      toolCallResponse("extract_clothing_attributes", VALID_EXTRACTION),
    );
    expect(await extractClothing("sk-test", IMAGE)).toEqual(VALID_EXTRACTION);
  });

  it("function_call が無いとthrowする", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [] });
    await expect(extractClothing("sk-test", IMAGE)).rejects.toThrow(
      /did not call/i,
    );
  });

  it("不正な抽出結果はZodで弾く", async () => {
    generateContentMock.mockResolvedValue(
      toolCallResponse("extract_clothing_attributes", {
        ...VALID_EXTRACTION,
        category: "hoodie", // 未知のenum
      }),
    );
    await expect(extractClothing("sk-test", IMAGE)).rejects.toThrow();
  });

  it("画像と apiKey を Gemini SDK に渡す", async () => {
    generateContentMock.mockResolvedValue(
      toolCallResponse("extract_clothing_attributes", VALID_EXTRACTION),
    );

    await extractClothing("sk-key-xyz", IMAGE);

    expect(generateContentMock).toHaveBeenCalledOnce();
    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe("gemini-2.5-flash");
    expect(
      args.config.toolConfig.functionCallingConfig.allowedFunctionNames,
    ).toEqual(["extract_clothing_attributes"]);
    const inline = args.contents[0].parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData,
    );
    expect(inline.inlineData.mimeType).toBe("image/png");
    expect(inline.inlineData.data).toBe("AAAA");
  });
});
