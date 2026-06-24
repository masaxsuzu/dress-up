// /api/extract のアップロード → R2 保存 → VLM 抽出フロー。
// VLM が失敗しても 200 で imageKey を返す (extraction: null) ことを保証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { installGenAIMock, toolCallResponse } from "@/test/helpers/gemini";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const generateContentMock = installGenAIMock();
const { POST } = await import("@/app/api/extract/route");

let r2: TestR2;

const VALID_EXTRACTION = {
  category: "tops",
  subcategory: "Tシャツ",
  colors: [{ name: "ネイビー", hex: "#1f2a44" }],
  pattern: "solid",
  material: "コットン",
  silhouette: "レギュラー",
  season: ["spring"],
  formality: 2,
  occasion: ["カジュアル"],
  tags: ["定番"],
};

beforeAll(async () => {
  r2 = await createTestR2();
});
afterAll(() => r2.dispose());
beforeEach(async () => {
  await r2.reset();
  generateContentMock.mockReset();
  setTestEnv({
    IMAGES: r2.bucket,
    GEMINI_API_KEY: "sk-test",
  } as unknown as CloudflareEnv);
});

function imageForm(file: Blob, name = "x.jpg"): FormData {
  const form = new FormData();
  form.append("file", file, name);
  return form;
}

describe("POST /api/extract", () => {
  it("成功時は imageKey + 抽出結果を返し R2 に画像が保存される", async () => {
    generateContentMock.mockResolvedValue(
      toolCallResponse("extract_clothing_attributes", VALID_EXTRACTION),
    );

    const file = new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" });
    const res = await callRoute(POST, { formData: imageForm(file) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { imageKey: string; extraction: unknown };
    expect(body.imageKey).toMatch(/^items\/[0-9a-f-]{36}\.jpg$/);
    expect(body.extraction).toEqual(VALID_EXTRACTION);
    expect(await r2.bucket.get(body.imageKey)).not.toBeNull();
  });

  it("VLM 失敗でも 200 で imageKey を返し extraction: null", async () => {
    generateContentMock.mockRejectedValue(new Error("503 Service Unavailable"));

    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
    const res = await callRoute(POST, { formData: imageForm(file, "x.png") });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      imageKey: string;
      extraction: unknown;
      error: string;
    };
    expect(body.imageKey).toMatch(/\.png$/);
    expect(body.extraction).toBeNull();
    expect(body.error).toMatch(/503/);
  });

  it("file が無いと 400", async () => {
    const res = await callRoute(POST, { formData: new FormData() });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing file" });
  });

  it("非対応の content-type は 400", async () => {
    const file = new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" });
    const res = await callRoute(POST, { formData: imageForm(file, "x.pdf") });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unsupported content type/);
  });
});
