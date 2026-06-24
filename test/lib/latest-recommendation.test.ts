import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getLatestRecommendation,
  setLatestRecommendation,
} from "@/lib/latest-recommendation";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { ALICE, BOB, SAMPLE_PROPOSALS } from "@/test/helpers/factories";

let env: TestD1;

beforeAll(async () => {
  env = await createTestD1();
});
afterAll(() => env.dispose());
beforeEach(() => env.reset());

describe("getLatestRecommendation", () => {
  it("未保存なら null", async () => {
    expect(await getLatestRecommendation(env.db, ALICE)).toBeNull();
  });
});

describe("setLatestRecommendation", () => {
  it("初回 INSERT で全項目セット + createdAt が ISO 文字列", async () => {
    const saved = await setLatestRecommendation(env.db, ALICE, {
      tpo: "通勤",
      season: "spring",
      proposals: SAMPLE_PROPOSALS,
    });
    expect(saved.tpo).toBe("通勤");
    expect(saved.proposals).toEqual(SAMPLE_PROPOSALS);
    expect(typeof saved.createdAt).toBe("string");

    expect(await getLatestRecommendation(env.db, ALICE)).toEqual(saved);
  });

  it("2 回目は同じユーザの行を上書きする (1 行だけ)", async () => {
    await setLatestRecommendation(env.db, ALICE, {
      tpo: "old",
      season: "spring",
      proposals: SAMPLE_PROPOSALS,
    });
    await setLatestRecommendation(env.db, ALICE, {
      tpo: "new",
      season: "winter",
      proposals: [SAMPLE_PROPOSALS[0]],
    });

    const count = await env.db
      .prepare(
        "SELECT COUNT(*) as c FROM latest_recommendation WHERE user_email = ?",
      )
      .bind(ALICE)
      .first<{ c: number }>();
    expect(count?.c).toBe(1);

    const fetched = await getLatestRecommendation(env.db, ALICE);
    expect(fetched?.tpo).toBe("new");
    expect(fetched?.season).toBe("winter");
    expect(fetched?.proposals).toHaveLength(1);
  });

  it("ユーザごとに別行で持つ", async () => {
    await setLatestRecommendation(env.db, ALICE, {
      tpo: "alice",
      season: "spring",
      proposals: SAMPLE_PROPOSALS,
    });
    await setLatestRecommendation(env.db, BOB, {
      tpo: "bob",
      season: "summer",
      proposals: [SAMPLE_PROPOSALS[2]],
    });
    expect((await getLatestRecommendation(env.db, ALICE))?.tpo).toBe("alice");
    expect((await getLatestRecommendation(env.db, BOB))?.tpo).toBe("bob");
    expect((await getLatestRecommendation(env.db, BOB))?.proposals).toHaveLength(1);
  });

  it("壊れた JSON が DB に残っていても null を返す", async () => {
    await env.db
      .prepare(
        `INSERT INTO latest_recommendation (user_email, tpo, season, proposals, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(ALICE, "x", "spring", "{ not json", new Date().toISOString())
      .run();
    expect(await getLatestRecommendation(env.db, ALICE)).toBeNull();
  });

  it("schema 違反の proposals は null を返す", async () => {
    await env.db
      .prepare(
        `INSERT INTO latest_recommendation (user_email, tpo, season, proposals, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        ALICE,
        "x",
        "spring",
        JSON.stringify([{ items: [], reason: "" }]),
        new Date().toISOString(),
      )
      .run();
    expect(await getLatestRecommendation(env.db, ALICE)).toBeNull();
  });
});
