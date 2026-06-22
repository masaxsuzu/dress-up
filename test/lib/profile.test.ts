import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getProfile, setProfile } from "@/lib/profile";

let mf: Miniflare;
let db: D1Database;

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
  await db.exec("DELETE FROM profile");
});

describe("getProfile", () => {
  it("未設定なら null", async () => {
    expect(await getProfile(db)).toBeNull();
  });
});

describe("setProfile", () => {
  it("初回 INSERT で全項目セットされ updatedAt が付く", async () => {
    const result = await setProfile(db, {
      gender: "male",
      heightCm: 175,
      weightKg: 65,
      bodyType: "細身",
      referenceImageKey: "profile/x.jpg",
    });
    expect(result.gender).toBe("male");
    expect(result.heightCm).toBe(175);
    expect(typeof result.updatedAt).toBe("string");

    const fetched = await getProfile(db);
    expect(fetched).toEqual(result);
  });

  it("2 回目の setProfile は UPSERT (id=1 行を上書き)", async () => {
    await setProfile(db, {
      gender: "male",
      heightCm: 175,
      weightKg: 65,
      bodyType: "細身",
      referenceImageKey: null,
    });
    const r2 = await setProfile(db, {
      gender: "female",
      heightCm: 160,
      weightKg: null,
      bodyType: null,
      referenceImageKey: "profile/y.jpg",
    });

    const list = await db.prepare("SELECT COUNT(*) as c FROM profile").first<{ c: number }>();
    expect(list?.c).toBe(1);

    const fetched = await getProfile(db);
    expect(fetched?.gender).toBe("female");
    expect(fetched?.heightCm).toBe(160);
    expect(fetched?.weightKg).toBeNull();
    expect(fetched?.bodyType).toBeNull();
    expect(fetched?.referenceImageKey).toBe("profile/y.jpg");
    expect(fetched?.updatedAt).toBe(r2.updatedAt);
  });

  it("null だらけでも保存できる", async () => {
    await setProfile(db, {
      gender: null,
      heightCm: null,
      weightKg: null,
      bodyType: null,
      referenceImageKey: null,
    });
    const fetched = await getProfile(db);
    expect(fetched).not.toBeNull();
    expect(fetched?.gender).toBeNull();
  });
});
