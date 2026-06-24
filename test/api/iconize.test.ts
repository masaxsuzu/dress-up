// /api/items/[id]/iconize — Flash Image でアイコンを生成し R2 と D1 を更新する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeItemInput } from "@/test/helpers/factories";
import { imageResponse, installGenAIMock } from "@/test/helpers/gemini";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const generateContentMock = installGenAIMock();
const { POST } = await import("@/app/api/items/[id]/iconize/route");
const { POST: itemsPOST } = await import("@/app/api/items/route");

let d1: TestD1;
let r2: TestR2;

beforeAll(async () => {
  d1 = await createTestD1();
  r2 = await createTestR2();
});
afterAll(async () => {
  await d1.dispose();
  await r2.dispose();
});
beforeEach(async () => {
  await d1.reset();
  await r2.reset();
  generateContentMock.mockReset();
  setTestEnv({
    DB: d1.db,
    IMAGES: r2.bucket,
    GEMINI_API_KEY: "sk",
  } as unknown as CloudflareEnv);
});

async function setupItem(user: string) {
  await r2.bucket.put("items/own.jpg", new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  const res = await callRoute(itemsPOST, {
    user,
    body: makeItemInput({ imageKey: "items/own.jpg" }),
  });
  return ((await res.json()) as { item: { id: string } }).item;
}

describe("POST /api/items/[id]/iconize", () => {
  it("生成成功で iconKey を返し R2 にアイコンが保存される", async () => {
    const item = await setupItem(ALICE);
    generateContentMock.mockResolvedValue(imageResponse("image/png", "QUFB"));

    const res = await callRoute(POST, { user: ALICE, params: { id: item.id } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { iconKey: string };
    expect(body.iconKey).toBe(`icons/${item.id}.png`);
    expect(await r2.bucket.get(body.iconKey)).not.toBeNull();
  });

  it("他人のアイテムは 404", async () => {
    const item = await setupItem(ALICE);
    const res = await callRoute(POST, { user: BOB, params: { id: item.id } });
    expect(res.status).toBe(404);
  });

  it("元画像が R2 に無いと 404", async () => {
    const item = await setupItem(ALICE);
    await r2.bucket.delete("items/own.jpg");
    const res = await callRoute(POST, { user: ALICE, params: { id: item.id } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "元画像が見つかりません" });
  });

  it("Gemini エラーは 500 で透過する", async () => {
    const item = await setupItem(ALICE);
    generateContentMock.mockRejectedValue(new Error("upstream 503"));
    const res = await callRoute(POST, { user: ALICE, params: { id: item.id } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "upstream 503" });
  });
});
