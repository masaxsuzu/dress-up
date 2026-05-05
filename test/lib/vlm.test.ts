import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

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

beforeEach(() => {
  createMock.mockReset();
});

describe("extractClothing", () => {
  it("tool_useブロックの内容をスキーマでパースして返す", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", input: VALID_EXTRACTION }],
    });

    const result = await extractClothing("sk-test", IMAGE);
    expect(result).toEqual(VALID_EXTRACTION);
  });

  it("tool_useブロックが無いとthrowする", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "sorry" }],
    });

    await expect(extractClothing("sk-test", IMAGE)).rejects.toThrow(
      /did not call/i,
    );
  });

  it("不正な抽出結果はZodで弾く", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { ...VALID_EXTRACTION, category: "hoodie" }, // 未知のenum
        },
      ],
    });

    await expect(extractClothing("sk-test", IMAGE)).rejects.toThrow();
  });

  it("画像とapiKeyをAnthropic SDKに渡す", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", input: VALID_EXTRACTION }],
    });

    await extractClothing("sk-key-xyz", IMAGE);

    expect(createMock).toHaveBeenCalledOnce();
    const args = createMock.mock.calls[0][0];
    expect(args.tool_choice).toEqual({
      type: "tool",
      name: "extract_clothing_attributes",
    });
    const userMessage = args.messages[0];
    expect(userMessage.role).toBe("user");
    const imageBlock = userMessage.content.find(
      (c: { type: string }) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/png");
    expect(imageBlock.source.data).toBe("AAAA");
  });
});
