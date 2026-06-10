import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createItem, deleteItem, getItem, listItems, updateItem } from "@/lib/db";
import type { ClothingItemInput, ClothingItemUpdate } from "@/schema/clothing";

let mf: Miniflare;
let db: D1Database;

const SAMPLE: ClothingItemInput = {
  category: "tops",
  subcategory: "Tシャツ",
  colors: [
    { name: "navy", hex: "#1f2a44" },
    { name: "white", hex: "#ffffff" },
  ],
  pattern: "solid",
  material: "cotton",
  silhouette: "regular",
  season: ["spring", "summer"],
  formality: 2,
  occasion: ["casual", "office-casual"],
  tags: ["basic", "everyday"],
  brand: "muji",
  notes: null,
  imageKey: "items/sample.jpg",
};

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    d1Databases: { DB: "test" },
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;

  const migrationsDir = resolve(__dirname, "../../migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), "utf8");
    const statements = sql
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.prepare(stmt).run();
    }
  }
});

afterAll(async () => {
  await mf.dispose();
});

beforeEach(async () => {
  await db.exec("DELETE FROM clothing_items");
});

describe("createItem + listItems", () => {
  it("ラウンドトリップで配列とnullが保たれる", async () => {
    const item = await createItem(db, SAMPLE);

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.createdAt).toBe(item.updatedAt);
    expect(typeof item.createdAt).toBe("string");

    const list = await listItems(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(item);
    expect(list[0].colors).toEqual(SAMPLE.colors);
    expect(list[0].season).toEqual(SAMPLE.season);
    expect(list[0].notes).toBeNull();
  });

  it("複数件が新しい順で返る", async () => {
    const a = await createItem(db, { ...SAMPLE, brand: "a" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createItem(db, { ...SAMPLE, brand: "b" });

    const list = await listItems(db);
    expect(list.map((i) => i.brand)).toEqual(["b", "a"]);
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it("空テーブルでは空配列を返す", async () => {
    expect(await listItems(db)).toEqual([]);
  });
});

describe("getItem", () => {
  it("存在するidでアイテムを返す", async () => {
    const created = await createItem(db, SAMPLE);
    const fetched = await getItem(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("存在しないidでnullを返す", async () => {
    expect(await getItem(db, "no-such-id")).toBeNull();
  });
});

describe("deleteItem", () => {
  it("削除に成功するとtrueを返し行が消える", async () => {
    const created = await createItem(db, SAMPLE);
    expect(await deleteItem(db, created.id)).toBe(true);
    expect(await getItem(db, created.id)).toBeNull();
    expect(await listItems(db)).toHaveLength(0);
  });

  it("存在しないidに対してfalseを返す", async () => {
    expect(await deleteItem(db, "no-such-id")).toBe(false);
  });
});

describe("updateItem", () => {
  const UPDATE: ClothingItemUpdate = {
    category: "bottoms",
    subcategory: "デニム",
    colors: [{ name: "blue", hex: "#0000ff" }],
    pattern: "stripe",
    material: "denim",
    silhouette: "slim",
    season: ["spring", "autumn"],
    formality: 3,
    occasion: ["office"],
    tags: ["updated"],
    brand: "levis",
    notes: "updated notes",
  };

  it("フィールドが更新されupdatedAtが変わる", async () => {
    const created = await createItem(db, SAMPLE);
    // Ensure updated_at will be different
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateItem(db, created.id, UPDATE);

    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.category).toBe("bottoms");
    expect(updated!.subcategory).toBe("デニム");
    expect(updated!.colors).toEqual([{ name: "blue", hex: "#0000ff" }]);
    expect(updated!.pattern).toBe("stripe");
    expect(updated!.season).toEqual(["spring", "autumn"]);
    expect(updated!.brand).toBe("levis");
    expect(updated!.notes).toBe("updated notes");
    // imageKey is immutable
    expect(updated!.imageKey).toBe(SAMPLE.imageKey);
    // createdAt is preserved, updatedAt is refreshed
    expect(updated!.createdAt).toBe(created.createdAt);
    expect(updated!.updatedAt).not.toBe(created.updatedAt);
  });

  it("JSONカラム(colors/season/occasion/tags)のラウンドトリップ", async () => {
    const created = await createItem(db, SAMPLE);
    const updated = await updateItem(db, created.id, UPDATE);

    expect(updated!.colors).toEqual(UPDATE.colors);
    expect(updated!.season).toEqual(UPDATE.season);
    expect(updated!.occasion).toEqual(UPDATE.occasion);
    expect(updated!.tags).toEqual(UPDATE.tags);
  });

  it("存在しないidに対してnullを返す", async () => {
    const result = await updateItem(db, "no-such-id", UPDATE);
    expect(result).toBeNull();
  });
});
