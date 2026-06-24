// /api/recommend/latest の hydrate 挙動。
// 保存後にアイテムが削除されても安全に placeholder で読み戻せること。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setLatestRecommendation } from "@/lib/latest-recommendation";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeItemInput } from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const { GET } = await import("@/app/api/recommend/latest/route");
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

async function createItemAs(user: string) {
  const res = await callRoute(itemsPOST, { user, body: makeItemInput() });
  const body = (await res.json()) as { item: { id: string } };
  return body.item;
}

describe("GET /api/recommend/latest", () => {
  it("未保存なら { latest: null }", async () => {
    const res = await callRoute(GET, { user: ALICE });
    expect(await res.json()).toEqual({ latest: null });
  });

  it("保存済みなら proposals が hydrate されて返る", async () => {
    const item = await createItemAs(ALICE);
    await setLatestRecommendation(d1.db, ALICE, {
      tpo: "週末",
      season: "spring",
      proposals: [
        {
          items: [{ kind: "owned", id: item.id }],
          reason: "シンプル",
        },
      ],
    });

    const res = await callRoute(GET, { user: ALICE });
    const body = (await res.json()) as {
      latest: {
        tpo: string;
        proposals: Array<{ items: Array<{ kind: string; item?: { id: string } }> }>;
      };
    };
    expect(body.latest.tpo).toBe("週末");
    expect(body.latest.proposals[0].items[0]).toMatchObject({
      kind: "owned",
      item: { id: item.id },
    });
  });

  it("保存後にアイテムが削除されても placeholder で安全に返る", async () => {
    await setLatestRecommendation(d1.db, ALICE, {
      tpo: "x",
      season: "spring",
      proposals: [
        {
          items: [{ kind: "owned", id: "deleted-id" }],
          reason: "r",
        },
      ],
    });

    const res = await callRoute(GET, { user: ALICE });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      latest: { proposals: Array<{ items: Array<{ kind: string }> }> };
    };
    expect(body.latest.proposals[0].items[0]).toMatchObject({ kind: "buy" });
  });

  it("ユーザごとに分離される (BOB の latest は ALICE に見えない)", async () => {
    await setLatestRecommendation(d1.db, BOB, {
      tpo: "bob-only",
      season: "spring",
      proposals: [
        {
          items: [{ kind: "buy", category: "tops", description: "x" }],
          reason: "r",
        },
      ],
    });
    const res = await callRoute(GET, { user: ALICE });
    expect(await res.json()).toEqual({ latest: null });
  });
});
