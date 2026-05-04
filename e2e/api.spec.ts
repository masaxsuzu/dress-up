import { expect, test } from "@playwright/test";

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

async function clear(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/items");
  const { items } = await res.json();
  for (const item of items) {
    await request.delete(`/api/items/${item.id}`);
  }
}

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
    expect(body.error.fieldErrors.category).toBeDefined();
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
});

test.describe("/api/images", () => {
  test("returns 404 for unknown key", async ({ request }) => {
    const res = await request.get("/api/images/items/does-not-exist.jpg");
    expect(res.status()).toBe(404);
  });
});
