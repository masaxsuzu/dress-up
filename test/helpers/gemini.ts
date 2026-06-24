// Gemini SDK のモックヘルパ。vi.mock は hoist されるので各 spec ファイルの
// トップで installGenAIMock() を呼ぶこと (return 値は generateContent mock fn)。
//
// 使い方:
//   const generateContentMock = installGenAIMock();
//   beforeEach(() => generateContentMock.mockReset());
//   ...
//   generateContentMock.mockResolvedValue(toolCallResponse("recommend_outfits", args));

import { vi } from "vitest";

// hoisted mock を保持するシングルトン。vi.mock の中身から参照される。
const { generateContentMock } = vi.hoisted(() => {
  return { generateContentMock: vi.fn() };
});

vi.mock("@google/genai", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent: generateContentMock },
    })),
  };
});

export function installGenAIMock(): typeof generateContentMock {
  return generateContentMock;
}

// 関数呼び出しレスポンス (recommend / vlm)。
export function toolCallResponse(name: string, args: unknown) {
  return { functionCalls: [{ name, args }] };
}

// 画像生成レスポンス (outfit-image, iconize)。
// data は valid base64 を使う ("AAAA" = 3 byte) — route 側で atob する箇所があるため。
export function imageResponse(
  mediaType = "image/png",
  data = "AAAA",
) {
  return {
    candidates: [
      { content: { parts: [{ inlineData: { mimeType: mediaType, data } }] } },
    ],
  };
}
