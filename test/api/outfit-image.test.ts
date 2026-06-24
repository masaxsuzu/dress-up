// /api/outfit-image — owned/buy 混在 → Flash Image でフルボディ画像を返す。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, makeItemInput } from "@/test/helpers/factories";
import { imageResponse, installGenAIMock } from "@/test/helpers/gemini";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const generateContentMock = installGenAIMock();
const { POST } = await import("@/app/api/outfit-image/route");
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

async function createItem(user: string, imageKey = "items/x.jpg") {
  await r2.bucket.put(imageKey, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  const res = await callRoute(itemsPOST, {
    user,
    body: makeItemInput({ imageKey }),
  });
  return ((await res.json()) as { item: { id: string } }).item;
}

describe("POST /api/outfit-image", () => {
  it("owned 1 件で 200 + 画像 bytes を返す", async () => {
    const item = await createItem(ALICE);
    generateContentMock.mockResolvedValue(imageResponse("image/jpeg", "QUFB"));

    const res = await callRoute(POST, {
      user: ALICE,
      body: {
        items: [{ kind: "owned", id: item.id }],
        tpo: "週末",
        season: "spring",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("buy 1 件 (画像なし) でも生成できる", async () => {
    generateContentMock.mockResolvedValue(imageResponse("image/png", "QUFB"));
    const res = await callRoute(POST, {
      user: ALICE,
      body: {
        items: [{ kind: "buy", category: "tops", description: "白シャツ" }],
        tpo: "週末",
      },
    });
    expect(res.status).toBe(200);
  });

  it("削除済み owned id しか無いと 400", async () => {
    const res = await callRoute(POST, {
      user: ALICE,
      body: {
        items: [{ kind: "owned", id: "ghost" }],
        tpo: "週末",
      },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "アイテムが見つかりません" });
  });

  it("バリデーション失敗で 400", async () => {
    const res = await callRoute(POST, {
      user: ALICE,
      body: { items: [], tpo: "" },
    });
    expect(res.status).toBe(400);
  });

  it("Gemini エラーは 500 で透過する", async () => {
    const item = await createItem(ALICE);
    generateContentMock.mockRejectedValue(new Error("upstream 429"));
    const res = await callRoute(POST, {
      user: ALICE,
      body: {
        items: [{ kind: "owned", id: item.id }],
        tpo: "x",
      },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "upstream 429" });
  });
});
