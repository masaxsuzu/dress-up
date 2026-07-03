import { expect, test } from "@playwright/test";
import { clearItems as clear } from "./helpers";

const VALID_PAYLOAD = {
  category: "tops",
  subcategory: "Tシャツ",
  colors: [{ name: "navy", hex: "#1f2a44" }],
  pattern: "solid",
  material: "cotton",
  silhouette: "regular",
  season: ["spring", "summer"],
  formality: 2,
  occasion: ["casual"],
  tags: ["basic"],
  brand: null,
  notes: null,
  imageKey: "items/test.jpg",
};

test.describe("/api/items", () => {
  test.beforeEach(async ({ request }) => {
    await clear(request);
  });

  test("POST creates an item and GET lists it", async ({ request }) => {
    const create = await request.post("/api/items", { data: VALID_PAYLOAD });
    expect(create.status()).toBe(201);
    const { item } = await create.json();
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.category).toBe("tops");
    expect(item.colors).toEqual(VALID_PAYLOAD.colors);

    const list = await request.get("/api/items");
    expect(list.status()).toBe(200);
    const { items } = await list.json();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  test("POST rejects invalid payload with 400", async ({ request }) => {
    const res = await request.post("/api/items", { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    // エラー形状は { error: string } に統一されている (lib/api-response.ts)。
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/category/);
  });

  test("POST rejects bad enum with 400", async ({ request }) => {
    const res = await request.post("/api/items", {
      data: { ...VALID_PAYLOAD, category: "hoodie" },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/items/:id returns 404 for missing id", async ({ request }) => {
    const res = await request.get("/api/items/no-such-id");
    expect(res.status()).toBe(404);
  });

  test("GET /api/items/:id returns the item", async ({ request }) => {
    const create = await request.post("/api/items", { data: VALID_PAYLOAD });
    const { item } = await create.json();

    const get = await request.get(`/api/items/${item.id}`);
    expect(get.status()).toBe(200);
    const body = await get.json();
    expect(body.item.id).toBe(item.id);
  });

  test("DELETE removes the item then 404", async ({ request }) => {
    const create = await request.post("/api/items", { data: VALID_PAYLOAD });
    const { item } = await create.json();

    const del = await request.delete(`/api/items/${item.id}`);
    expect(del.status()).toBe(204);

    const get = await request.get(`/api/items/${item.id}`);
    expect(get.status()).toBe(404);
  });

  test("DELETE on missing id returns 404", async ({ request }) => {
    const res = await request.delete("/api/items/no-such-id");
    expect(res.status()).toBe(404);
  });

  test("PATCH updates fields and returns updated item", async ({ request }) => {
    const create = await request.post("/api/items", { data: VALID_PAYLOAD });
    expect(create.status()).toBe(201);
    const { item } = await create.json();

    const patch = await request.patch(`/api/items/${item.id}`, {
      data: {
        ...VALID_PAYLOAD,
        category: "bottoms",
        subcategory: "デニム",
        brand: "levis",
        notes: "test note",
      },
    });
    expect(patch.status()).toBe(200);
    const { item: updated } = await patch.json();
    expect(updated.id).toBe(item.id);
    expect(updated.category).toBe("bottoms");
    expect(updated.subcategory).toBe("デニム");
    expect(updated.brand).toBe("levis");
    expect(updated.notes).toBe("test note");
    // imageKey must not change
    expect(updated.imageKey).toBe(item.imageKey);
    // updatedAt should be refreshed
    expect(updated.updatedAt).not.toBe(item.updatedAt);
  });

  test("PATCH returns 404 for missing id", async ({ request }) => {
    const res = await request.patch("/api/items/no-such-id", {
      data: {
        category: "tops",
        subcategory: null,
        colors: [{ name: "navy", hex: "#1f2a44" }],
        pattern: "solid",
        material: "cotton",
        silhouette: "regular",
        season: ["spring"],
        formality: 2,
        occasion: [],
        tags: [],
        brand: null,
        notes: null,
      },
    });
    expect(res.status()).toBe(404);
  });

  test("PATCH returns 400 on invalid payload", async ({ request }) => {
    const create = await request.post("/api/items", { data: VALID_PAYLOAD });
    const { item } = await create.json();

    const res = await request.patch(`/api/items/${item.id}`, {
      data: { category: "not-a-real-category" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

test.describe("/api/images", () => {
  test("returns 404 for unknown key", async ({ request }) => {
    const res = await request.get("/api/images/items/does-not-exist.jpg");
    expect(res.status()).toBe(404);
  });
});
