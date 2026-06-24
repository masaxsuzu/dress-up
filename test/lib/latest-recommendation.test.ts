import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getLatestRecommendation,
  setLatestRecommendation,
} from "@/lib/latest-recommendation";
import type { ProposalDraft } from "@/schema/recommend";

let mf: Miniflare;
let db: D1Database;

const ALICE = "alice@example.com";
const BOB = "bob@example.com";

const SAMPLE: ProposalDraft[] = [
  {
    items: [{ kind: "owned", id: "tops-1" }],
    reason: "1: 安全",
  },
  {
    items: [
      { kind: "owned", id: "tops-1" },
      { kind: "buy", category: "shoes", description: "白スニーカー" },
    ],
    reason: "2: 軽め",
  },
  {
    items: [{ kind: "buy", category: "tops", description: "ネイビーポロ" }],
    reason: "3: 買い替え",
  },
];

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
  await db.exec("DELETE FROM latest_recommendation");
});

describe("getLatestRecommendation", () => {
  it("未保存なら null", async () => {
    expect(await getLatestRecommendation(db, ALICE)).toBeNull();
  });
});

describe("setLatestRecommendation", () => {
  it("初回 INSERT で全項目セット + createdAt が ISO 文字列", async () => {
    const saved = await setLatestRecommendation(db, ALICE, {
      tpo: "通勤",
      season: "spring",
      proposals: SAMPLE,
    });
    expect(saved.tpo).toBe("通勤");
    expect(saved.season).toBe("spring");
    expect(saved.proposals).toEqual(SAMPLE);
    expect(typeof saved.createdAt).toBe("string");

    const fetched = await getLatestRecommendation(db, ALICE);
    expect(fetched).toEqual(saved);
  });

  it("2 回目は同じユーザの行を上書きする (1 行だけ)", async () => {
    await setLatestRecommendation(db, ALICE, {
      tpo: "old",
      season: "spring",
      proposals: SAMPLE,
    });
    await setLatestRecommendation(db, ALICE, {
      tpo: "new",
      season: "winter",
      proposals: [SAMPLE[0]],
    });

    const count = await db
      .prepare("SELECT COUNT(*) as c FROM latest_recommendation WHERE user_email = ?")
      .bind(ALICE)
      .first<{ c: number }>();
    expect(count?.c).toBe(1);

    const fetched = await getLatestRecommendation(db, ALICE);
    expect(fetched?.tpo).toBe("new");
    expect(fetched?.season).toBe("winter");
    expect(fetched?.proposals).toHaveLength(1);
  });

  it("ユーザごとに別行で持つ", async () => {
    await setLatestRecommendation(db, ALICE, {
      tpo: "alice",
      season: "spring",
      proposals: SAMPLE,
    });
    await setLatestRecommendation(db, BOB, {
      tpo: "bob",
      season: "summer",
      proposals: [SAMPLE[2]],
    });
    expect((await getLatestRecommendation(db, ALICE))?.tpo).toBe("alice");
    expect((await getLatestRecommendation(db, BOB))?.tpo).toBe("bob");
    expect((await getLatestRecommendation(db, BOB))?.proposals).toHaveLength(1);
  });

  it("壊れた JSON が DB に残っていても null を返す (safe parse)", async () => {
    await db
      .prepare(
        `INSERT INTO latest_recommendation (user_email, tpo, season, proposals, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(ALICE, "x", "spring", "{ not json", new Date().toISOString())
      .run();
    expect(await getLatestRecommendation(db, ALICE)).toBeNull();
  });

  it("schema 違反の proposals は null を返す", async () => {
    await db
      .prepare(
        `INSERT INTO latest_recommendation (user_email, tpo, season, proposals, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        ALICE,
        "x",
        "spring",
        JSON.stringify([{ items: [], reason: "" }]), // items min(1) 違反
        new Date().toISOString(),
      )
      .run();
    expect(await getLatestRecommendation(db, ALICE)).toBeNull();
  });
});
