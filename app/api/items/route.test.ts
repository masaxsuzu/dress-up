// /api/items の GET/POST と /api/items/[id] の GET/PATCH/DELETE。
// route() ラッパ + auth ヘッダ + マルチテナント分離まで一気通貫で検証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeItemInput, makeItemUpdate } from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const { GET: listGET, POST: listPOST } = await import("@/app/api/items/route");
const {
  GET: idGET,
  PATCH: idPATCH,
  DELETE: idDELETE,
} = await import("@/app/api/items/[id]/route");

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

async function createItemAs(user: string, key = "items/sample.jpg") {
  const res = await callRoute(listPOST, {
    user,
    body: makeItemInput({ imageKey: key }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { item: { id: string } };
  return body.item;
}

describe("GET /api/items", () => {
  it("認証ヘッダの user の所有物だけ返す", async () => {
    await createItemAs(ALICE, "items/a.jpg");
    await createItemAs(ALICE, "items/a2.jpg");
    await createItemAs(BOB, "items/b.jpg");

    const res = await callRoute(listGET, { user: ALICE });
    const body = (await res.json()) as { items: Array<{ imageKey: string }> };
    expect(body.items).toHaveLength(2);
    expect(body.items.every((i) => i.imageKey.startsWith("items/a"))).toBe(true);
  });

  it("認証ヘッダ無し (dev fallback) でも DB の dev@local 行だけ返す", async () => {
    await createItemAs(ALICE, "items/a.jpg");
    const res = await callRoute(listGET);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });
});

describe("POST /api/items", () => {
  it("バリデーション失敗で 400 + { error }", async () => {
    const res = await callRoute(listPOST, {
      user: ALICE,
      body: { category: "not-a-category" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("成功で 201 + { item } を返し DB に行ができる", async () => {
    const item = await createItemAs(ALICE, "items/x.jpg");
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await callRoute(listGET, { user: ALICE });
    const body = (await list.json()) as { items: Array<{ id: string }> };
    expect(body.items.some((i) => i.id === item.id)).toBe(true);
  });
});

describe("GET /api/items/[id]", () => {
  it("自分のアイテムは 200", async () => {
    const item = await createItemAs(ALICE);
    const res = await callRoute(idGET, { user: ALICE, params: { id: item.id } });
    expect(res.status).toBe(200);
  });

  it("他人のアイテムは 404 (存在/非所有を区別しない)", async () => {
    const item = await createItemAs(ALICE);
    const res = await callRoute(idGET, { user: BOB, params: { id: item.id } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});

describe("PATCH /api/items/[id]", () => {
  it("自分のアイテムを更新できる", async () => {
    const item = await createItemAs(ALICE);
    const res = await callRoute(idPATCH, {
      user: ALICE,
      params: { id: item.id },
      body: makeItemUpdate({ notes: "patched" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { notes: string } };
    expect(body.item.notes).toBe("patched");
  });

  it("他人のアイテムは 404", async () => {
    const item = await createItemAs(ALICE);
    const res = await callRoute(idPATCH, {
      user: BOB,
      params: { id: item.id },
      body: makeItemUpdate(),
    });
    expect(res.status).toBe(404);
  });

  it("バリデーション失敗で 400", async () => {
    const item = await createItemAs(ALICE);
    const res = await callRoute(idPATCH, {
      user: ALICE,
      params: { id: item.id },
      body: { category: "bogus" },
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/items/[id]", () => {
  it("自分のアイテムを削除し R2 画像も消える", async () => {
    await r2.bucket.put("items/own.jpg", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const item = await createItemAs(ALICE, "items/own.jpg");

    const res = await callRoute(idDELETE, { user: ALICE, params: { id: item.id } });
    expect(res.status).toBe(204);

    expect(await r2.bucket.get("items/own.jpg")).toBeNull();
  });

  it("他人のアイテムは 404 で R2 画像は残る", async () => {
    await r2.bucket.put("items/keep.jpg", new Uint8Array([9]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const item = await createItemAs(ALICE, "items/keep.jpg");

    const res = await callRoute(idDELETE, { user: BOB, params: { id: item.id } });
    expect(res.status).toBe(404);
    expect(await r2.bucket.get("items/keep.jpg")).not.toBeNull();
  });
});
