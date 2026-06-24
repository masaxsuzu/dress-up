// /api/recommend — wardrobe + TPO → 3 案。
// Gemini を mock し、hydrate と latest_recommendation への保存も検証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getLatestRecommendation } from "@/lib/latest-recommendation";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import {
  ALICE,
  makeItemInput,
  SAMPLE_PROPOSALS,
} from "@/test/helpers/factories";
import { installGenAIMock, toolCallResponse } from "@/test/helpers/gemini";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const generateContentMock = installGenAIMock();
const { POST } = await import("@/app/api/recommend/route");
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
  generateContentMock.mockReset();
  setTestEnv({
    DB: d1.db,
    IMAGES: r2.bucket,
    GEMINI_API_KEY: "sk",
  } as unknown as CloudflareEnv);
});

async function seedItem(user: string, imageKey = "items/x.jpg") {
  await r2.bucket.put(imageKey, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  const res = await callRoute(itemsPOST, {
    user,
    body: makeItemInput({ imageKey }),
  });
  return ((await res.json()) as { item: { id: string } }).item;
}

describe("POST /api/recommend", () => {
  it("3 案を hydrate + latest_recommendation に保存する", async () => {
    const item = await seedItem(ALICE);
    generateContentMock.mockResolvedValue(
      toolCallResponse("recommend_outfits", {
        proposals: [
          { items: [{ kind: "owned", id: item.id }], reason: "1" },
          SAMPLE_PROPOSALS[1],
          SAMPLE_PROPOSALS[2],
        ],
      }),
    );

    const res = await callRoute(POST, {
      user: ALICE,
      body: { tpo: "週末" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      season: string;
      proposals: Array<{ items: unknown[] }>;
    };
    expect(body.proposals).toHaveLength(3);

    const stored = await getLatestRecommendation(d1.db, ALICE);
    expect(stored?.tpo).toBe("週末");
    expect(stored?.proposals).toHaveLength(3);
  });

  it("空ワードローブでも 200 (all buy 想定)", async () => {
    generateContentMock.mockResolvedValue(
      toolCallResponse("recommend_outfits", { proposals: SAMPLE_PROPOSALS }),
    );
    const res = await callRoute(POST, {
      user: ALICE,
      body: { tpo: "x" },
    });
    expect(res.status).toBe(200);
  });

  it("バリデーション失敗で 400", async () => {
    const res = await callRoute(POST, { user: ALICE, body: { tpo: "" } });
    expect(res.status).toBe(400);
  });

  it("Gemini エラーは 500 で透過する", async () => {
    generateContentMock.mockRejectedValue(new Error("upstream 503"));
    const res = await callRoute(POST, { user: ALICE, body: { tpo: "x" } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "upstream 503" });
  });
});
