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
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import {
  ALICE,
  BOB,
  makeItemInput,
  makeItemUpdate,
} from "@/test/helpers/factories";

let env: TestD1;

beforeAll(async () => {
  env = await createTestD1();
});
afterAll(() => env.dispose());
beforeEach(() => env.reset());

describe("createItem + listItems", () => {
  it("ラウンドトリップで配列とnullが保たれる", async () => {
    const input = makeItemInput({ notes: null });
    const item = await createItem(env.db, ALICE, input);

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.createdAt).toBe(item.updatedAt);

    const list = await listItems(env.db, ALICE);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(item);
    expect(list[0].colors).toEqual(input.colors);
    expect(list[0].season).toEqual(input.season);
    expect(list[0].notes).toBeNull();
  });

  it("複数件が新しい順で返る", async () => {
    const a = await createItem(env.db, ALICE, makeItemInput({ brand: "a" }));
    await new Promise((r) => setTimeout(r, 5));
    const b = await createItem(env.db, ALICE, makeItemInput({ brand: "b" }));

    const list = await listItems(env.db, ALICE);
    expect(list.map((i) => i.brand)).toEqual(["b", "a"]);
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it("空テーブルでは空配列を返す", async () => {
    expect(await listItems(env.db, ALICE)).toEqual([]);
  });
});

describe("テナント分離", () => {
  it("listItems は呼び出し元ユーザの行だけ返す", async () => {
    await createItem(env.db, ALICE, makeItemInput({ brand: "alice-1" }));
    await createItem(env.db, ALICE, makeItemInput({ brand: "alice-2" }));
    await createItem(env.db, BOB, makeItemInput({ brand: "bob-1" }));

    const alice = await listItems(env.db, ALICE);
    const bob = await listItems(env.db, BOB);
    expect(alice.map((i) => i.brand).sort()).toEqual(["alice-1", "alice-2"]);
    expect(bob.map((i) => i.brand)).toEqual(["bob-1"]);
  });

  it("getItem は別ユーザの id では null", async () => {
    const item = await createItem(env.db, ALICE, makeItemInput());
    expect(await getItem(env.db, ALICE, item.id)).not.toBeNull();
    expect(await getItem(env.db, BOB, item.id)).toBeNull();
  });

  it("deleteItem は別ユーザの id では false", async () => {
    const item = await createItem(env.db, ALICE, makeItemInput());
    expect(await deleteItem(env.db, BOB, item.id)).toBe(false);
    expect(await getItem(env.db, ALICE, item.id)).not.toBeNull();
  });

  it("updateItem は別ユーザの id では null", async () => {
    const item = await createItem(env.db, ALICE, makeItemInput({ brand: "muji" }));
    const updated = await updateItem(
      env.db,
      BOB,
      item.id,
      makeItemUpdate({ brand: "hacked" }),
    );
    expect(updated).toBeNull();
    const stillAlice = await getItem(env.db, ALICE, item.id);
    expect(stillAlice?.brand).toBe("muji");
  });
});

describe("getItem", () => {
  it("存在しないidでnullを返す", async () => {
    expect(await getItem(env.db, ALICE, "no-such-id")).toBeNull();
  });
});

describe("deleteItem", () => {
  it("削除に成功するとtrueを返し行が消える", async () => {
    const created = await createItem(env.db, ALICE, makeItemInput());
    expect(await deleteItem(env.db, ALICE, created.id)).toBe(true);
    expect(await getItem(env.db, ALICE, created.id)).toBeNull();
    expect(await listItems(env.db, ALICE)).toHaveLength(0);
  });

  it("存在しないidに対してfalseを返す", async () => {
    expect(await deleteItem(env.db, ALICE, "no-such-id")).toBe(false);
  });
});

describe("updateItem", () => {
  it("フィールドが更新されupdatedAtが変わる", async () => {
    const created = await createItem(env.db, ALICE, makeItemInput());
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateItem(env.db, ALICE, created.id, makeItemUpdate());

    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.category).toBe("bottoms");
    expect(updated!.colors).toEqual([{ name: "blue", hex: "#0000ff" }]);
    expect(updated!.imageKey).toBe(created.imageKey); // immutable
    expect(updated!.createdAt).toBe(created.createdAt);
    expect(updated!.updatedAt).not.toBe(created.updatedAt);
  });

  it("JSONカラム(colors/season/occasion/tags)のラウンドトリップ", async () => {
    const created = await createItem(env.db, ALICE, makeItemInput());
    const u = makeItemUpdate();
    const updated = await updateItem(env.db, ALICE, created.id, u);

    expect(updated!.colors).toEqual(u.colors);
    expect(updated!.season).toEqual(u.season);
    expect(updated!.occasion).toEqual(u.occasion);
    expect(updated!.tags).toEqual(u.tags);
  });

  it("存在しないidに対してnullを返す", async () => {
    const result = await updateItem(env.db, ALICE, "no-such-id", makeItemUpdate());
    expect(result).toBeNull();
  });
});

describe("setIconKey", () => {
  it("作成直後の iconKey は null、setIconKey 後は反映", async () => {
    const created = await createItem(env.db, ALICE, makeItemInput());
    expect(created.iconKey).toBeNull();
    await setIconKey(env.db, ALICE, created.id, "icons/x.png");
    const fetched = await getItem(env.db, ALICE, created.id);
    expect(fetched!.iconKey).toBe("icons/x.png");
  });

  it("setIconKey は別ユーザの id では何もしない", async () => {
    const created = await createItem(env.db, ALICE, makeItemInput());
    await setIconKey(env.db, BOB, created.id, "icons/x.png");
    const fetched = await getItem(env.db, ALICE, created.id);
    expect(fetched!.iconKey).toBeNull();
  });

  it("updateItem を経ても iconKey は保持される", async () => {
    const created = await createItem(env.db, ALICE, makeItemInput());
    await setIconKey(env.db, ALICE, created.id, "icons/y.png");
    const updated = await updateItem(
      env.db,
      ALICE,
      created.id,
      makeItemUpdate({ brand: "new-brand" }),
    );
    expect(updated!.iconKey).toBe("icons/y.png");
  });
});

describe("imageKeyOwnedBy", () => {
  it("自分の item.imageKey は true、他人は false", async () => {
    const item = await createItem(
      env.db,
      ALICE,
      makeItemInput({ imageKey: "items/alice.jpg" }),
    );
    expect(await imageKeyOwnedBy(env.db, ALICE, item.imageKey)).toBe(true);
    expect(await imageKeyOwnedBy(env.db, BOB, item.imageKey)).toBe(false);
  });

  it("iconKey もチェック対象", async () => {
    const item = await createItem(env.db, ALICE, makeItemInput());
    await setIconKey(env.db, ALICE, item.id, "icons/alice-x.png");
    expect(await imageKeyOwnedBy(env.db, ALICE, "icons/alice-x.png")).toBe(true);
    expect(await imageKeyOwnedBy(env.db, BOB, "icons/alice-x.png")).toBe(false);
  });

  it("profile.reference_image_key もチェック対象", async () => {
    await setProfile(env.db, ALICE, {
      gender: null,
      heightCm: null,
      weightKg: null,
      bodyType: null,
      referenceImageKey: "profile/alice-ref.jpg",
    });
    expect(await imageKeyOwnedBy(env.db, ALICE, "profile/alice-ref.jpg")).toBe(true);
    expect(await imageKeyOwnedBy(env.db, BOB, "profile/alice-ref.jpg")).toBe(false);
  });

  it("どこにも紐付かない key は false", async () => {
    expect(await imageKeyOwnedBy(env.db, ALICE, "items/unknown.jpg")).toBe(false);
  });
});
