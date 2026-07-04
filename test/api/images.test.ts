// /api/images/[...key] の owner check。URL 推測で他人の画像を読めないことを保証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeItemInput } from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";
import { setIconKey } from "@/lib/db";

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
  const res = await callRoute(itemsPOST, {
    user,
    body: makeItemInput({ imageKey: key }),
  });
  return ((await res.json()) as { item: { id: string } }).item;
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

  it("200 応答に ETag ヘッダが付く", async () => {
    await createItemAs(ALICE, "items/etag.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "etag.jpg"] },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
  });

  it("If-None-Match が一致すると 304 (body 無し)", async () => {
    await createItemAs(ALICE, "items/cond.jpg");
    const first = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "cond.jpg"] },
    });
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();

    const second = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "cond.jpg"] },
      headers: { "If-None-Match": etag! },
    });
    expect(second.status).toBe(304);
    const bytes = await second.arrayBuffer();
    expect(bytes.byteLength).toBe(0);
  });

  it("items/ キーの Cache-Control は immutable、icons/ は付かない", async () => {
    await createItemAs(ALICE, "items/cache-check.jpg");
    const itemRes = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "cache-check.jpg"] },
    });
    expect(itemRes.headers.get("Cache-Control")).toContain("immutable");

    const created = await createItemAs(ALICE, "items/for-icon.jpg");
    await r2.bucket.put("icons/cache-check.png", new Uint8Array([1]), {
      httpMetadata: { contentType: "image/png" },
    });
    await setIconKey(d1.db, ALICE, created.id, "icons/cache-check.png");

    const iconRes = await callRoute(GET, {
      user: ALICE,
      params: { key: ["icons", "cache-check.png"] },
    });
    expect(iconRes.status).toBe(200);
    expect(iconRes.headers.get("Cache-Control")).not.toContain("immutable");
  });
});
