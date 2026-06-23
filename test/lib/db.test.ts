import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createItem,
  deleteItem,
  getItem,
  imageKeyOwnedBy,
  listItems,
  setIconKey,
  updateItem,
} from "@/lib/db";
import { setProfile } from "@/lib/profile";
import type { ClothingItemInput, ClothingItemUpdate } from "@/schema/clothing";

let mf: Miniflare;
let db: D1Database;

const USER = "alice@example.com";
const OTHER = "bob@example.com";

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
  await db.exec("DELETE FROM profile");
});

describe("createItem + listItems", () => {
  it("ラウンドトリップで配列とnullが保たれる", async () => {
    const item = await createItem(db, USER, SAMPLE);

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.createdAt).toBe(item.updatedAt);
    expect(typeof item.createdAt).toBe("string");

    const list = await listItems(db, USER);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(item);
    expect(list[0].colors).toEqual(SAMPLE.colors);
    expect(list[0].season).toEqual(SAMPLE.season);
    expect(list[0].notes).toBeNull();
  });

  it("複数件が新しい順で返る", async () => {
    const a = await createItem(db, USER, { ...SAMPLE, brand: "a" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createItem(db, USER, { ...SAMPLE, brand: "b" });

    const list = await listItems(db, USER);
    expect(list.map((i) => i.brand)).toEqual(["b", "a"]);
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it("空テーブルでは空配列を返す", async () => {
    expect(await listItems(db, USER)).toEqual([]);
  });
});

describe("テナント分離", () => {
  it("listItems は呼び出し元ユーザの行だけ返す", async () => {
    await createItem(db, USER, { ...SAMPLE, brand: "alice-1" });
    await createItem(db, USER, { ...SAMPLE, brand: "alice-2" });
    await createItem(db, OTHER, { ...SAMPLE, brand: "bob-1" });

    const alice = await listItems(db, USER);
    const bob = await listItems(db, OTHER);
    expect(alice.map((i) => i.brand).sort()).toEqual(["alice-1", "alice-2"]);
    expect(bob.map((i) => i.brand)).toEqual(["bob-1"]);
  });

  it("getItem は別ユーザの id では null", async () => {
    const item = await createItem(db, USER, SAMPLE);
    expect(await getItem(db, USER, item.id)).not.toBeNull();
    expect(await getItem(db, OTHER, item.id)).toBeNull();
  });

  it("deleteItem は別ユーザの id では false", async () => {
    const item = await createItem(db, USER, SAMPLE);
    expect(await deleteItem(db, OTHER, item.id)).toBe(false);
    expect(await getItem(db, USER, item.id)).not.toBeNull();
  });

  it("updateItem は別ユーザの id では null", async () => {
    const item = await createItem(db, USER, SAMPLE);
    const updated = await updateItem(db, OTHER, item.id, {
      ...SAMPLE,
      brand: "hacked",
    });
    expect(updated).toBeNull();
    const stillAlice = await getItem(db, USER, item.id);
    expect(stillAlice?.brand).toBe("muji");
  });
});

describe("getItem", () => {
  it("存在するidでアイテムを返す", async () => {
    const created = await createItem(db, USER, SAMPLE);
    const fetched = await getItem(db, USER, created.id);
    expect(fetched).toEqual(created);
  });

  it("存在しないidでnullを返す", async () => {
    expect(await getItem(db, USER, "no-such-id")).toBeNull();
  });
});

describe("deleteItem", () => {
  it("削除に成功するとtrueを返し行が消える", async () => {
    const created = await createItem(db, USER, SAMPLE);
    expect(await deleteItem(db, USER, created.id)).toBe(true);
    expect(await getItem(db, USER, created.id)).toBeNull();
    expect(await listItems(db, USER)).toHaveLength(0);
  });

  it("存在しないidに対してfalseを返す", async () => {
    expect(await deleteItem(db, USER, "no-such-id")).toBe(false);
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
    const created = await createItem(db, USER, SAMPLE);
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateItem(db, USER, created.id, UPDATE);

    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.category).toBe("bottoms");
    expect(updated!.subcategory).toBe("デニム");
    expect(updated!.colors).toEqual([{ name: "blue", hex: "#0000ff" }]);
    expect(updated!.pattern).toBe("stripe");
    expect(updated!.season).toEqual(["spring", "autumn"]);
    expect(updated!.brand).toBe("levis");
    expect(updated!.notes).toBe("updated notes");
    expect(updated!.imageKey).toBe(SAMPLE.imageKey);
    expect(updated!.createdAt).toBe(created.createdAt);
    expect(updated!.updatedAt).not.toBe(created.updatedAt);
  });

  it("JSONカラム(colors/season/occasion/tags)のラウンドトリップ", async () => {
    const created = await createItem(db, USER, SAMPLE);
    const updated = await updateItem(db, USER, created.id, UPDATE);

    expect(updated!.colors).toEqual(UPDATE.colors);
    expect(updated!.season).toEqual(UPDATE.season);
    expect(updated!.occasion).toEqual(UPDATE.occasion);
    expect(updated!.tags).toEqual(UPDATE.tags);
  });

  it("存在しないidに対してnullを返す", async () => {
    const result = await updateItem(db, USER, "no-such-id", UPDATE);
    expect(result).toBeNull();
  });
});

describe("setIconKey", () => {
  it("作成直後の iconKey は null", async () => {
    const created = await createItem(db, USER, SAMPLE);
    expect(created.iconKey).toBeNull();
    const fetched = await getItem(db, USER, created.id);
    expect(fetched!.iconKey).toBeNull();
  });

  it("setIconKey で更新後 getItem に反映される", async () => {
    const created = await createItem(db, USER, SAMPLE);
    await setIconKey(db, USER, created.id, "icons/x.png");
    const fetched = await getItem(db, USER, created.id);
    expect(fetched!.iconKey).toBe("icons/x.png");
  });

  it("setIconKey は別ユーザの id では何もしない", async () => {
    const created = await createItem(db, USER, SAMPLE);
    await setIconKey(db, OTHER, created.id, "icons/x.png");
    const fetched = await getItem(db, USER, created.id);
    expect(fetched!.iconKey).toBeNull();
  });

  it("listItems / updateItem を経ても iconKey は保持される", async () => {
    const created = await createItem(db, USER, SAMPLE);
    await setIconKey(db, USER, created.id, "icons/y.png");
    const updated = await updateItem(db, USER, created.id, {
      ...SAMPLE,
      brand: "new-brand",
    });
    expect(updated!.iconKey).toBe("icons/y.png");
    const list = await listItems(db, USER);
    expect(list[0].iconKey).toBe("icons/y.png");
  });
});

describe("imageKeyOwnedBy", () => {
  it("自分の item.imageKey は true、他人の同じ key は false", async () => {
    const item = await createItem(db, USER, {
      ...SAMPLE,
      imageKey: "items/alice.jpg",
    });
    expect(await imageKeyOwnedBy(db, USER, item.imageKey)).toBe(true);
    expect(await imageKeyOwnedBy(db, OTHER, item.imageKey)).toBe(false);
  });

  it("iconKey もチェック対象", async () => {
    const item = await createItem(db, USER, SAMPLE);
    await setIconKey(db, USER, item.id, "icons/alice-x.png");
    expect(await imageKeyOwnedBy(db, USER, "icons/alice-x.png")).toBe(true);
    expect(await imageKeyOwnedBy(db, OTHER, "icons/alice-x.png")).toBe(false);
  });

  it("profile.reference_image_key もチェック対象", async () => {
    await setProfile(db, USER, {
      gender: null,
      heightCm: null,
      weightKg: null,
      bodyType: null,
      referenceImageKey: "profile/alice-ref.jpg",
    });
    expect(await imageKeyOwnedBy(db, USER, "profile/alice-ref.jpg")).toBe(true);
    expect(await imageKeyOwnedBy(db, OTHER, "profile/alice-ref.jpg")).toBe(false);
  });

  it("どこにも紐付かない key は false", async () => {
    expect(await imageKeyOwnedBy(db, USER, "items/unknown.jpg")).toBe(false);
  });
});
