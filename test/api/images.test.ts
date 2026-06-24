// /api/images/[...key] の owner check。URL 推測で他人の画像を読めないことを保証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeItemInput } from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const { GET } = await import("@/app/api/images/[...key]/route");
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
  setTestEnv({
    DB: d1.db,
    IMAGES: r2.bucket,
    GEMINI_API_KEY: "test-key",
  } as unknown as CloudflareEnv);
});

async function createItemAs(user: string, key: string) {
  await r2.bucket.put(key, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await callRoute(itemsPOST, { user, body: makeItemInput({ imageKey: key }) });
}

describe("GET /api/images/[...key]", () => {
  it("自分のアイテム画像は 200 + body を返す", async () => {
    await createItemAs(ALICE, "items/own.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "own.jpg"] },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("他人のアイテム画像は 404 (R2 には存在していても)", async () => {
    await createItemAs(ALICE, "items/secret.jpg");
    const res = await callRoute(GET, {
      user: BOB,
      params: { key: ["items", "secret.jpg"] },
    });
    expect(res.status).toBe(404);
  });

  it("DB にも R2 にも無い key は 404", async () => {
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "ghost.jpg"] },
    });
    expect(res.status).toBe(404);
  });
});
