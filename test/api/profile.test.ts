// /api/profile の GET / PUT。参考画像差し替え時に旧画像が R2 から消える挙動も検証。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeProfileInput } from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const { GET, PUT } = await import("@/app/api/profile/route");

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

describe("GET /api/profile", () => {
  it("未設定なら { profile: null }", async () => {
    const res = await callRoute(GET, { user: ALICE });
    expect(await res.json()).toEqual({ profile: null });
  });

  it("PUT した値を読み戻せる", async () => {
    await callRoute(PUT, {
      user: ALICE,
      body: makeProfileInput({ gender: "female", heightCm: 160 }),
    });

    const res = await callRoute(GET, { user: ALICE });
    const body = (await res.json()) as { profile: { gender: string; heightCm: number } };
    expect(body.profile.gender).toBe("female");
    expect(body.profile.heightCm).toBe(160);
  });

  it("ユーザごとに別プロフィールを持つ", async () => {
    await callRoute(PUT, {
      user: ALICE,
      body: makeProfileInput({ gender: "female" }),
    });
    await callRoute(PUT, {
      user: BOB,
      body: makeProfileInput({ gender: "male" }),
    });

    const a = (await (await callRoute(GET, { user: ALICE })).json()) as {
      profile: { gender: string };
    };
    const b = (await (await callRoute(GET, { user: BOB })).json()) as {
      profile: { gender: string };
    };
    expect(a.profile.gender).toBe("female");
    expect(b.profile.gender).toBe("male");
  });
});

describe("PUT /api/profile", () => {
  it("バリデーション失敗で 400", async () => {
    const res = await callRoute(PUT, {
      user: ALICE,
      body: { gender: "not-a-gender" },
    });
    expect(res.status).toBe(400);
  });

  it("参考画像を差し替えると旧画像が R2 から消える", async () => {
    await r2.bucket.put("profile/old.jpg", new Uint8Array([1]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    await r2.bucket.put("profile/new.jpg", new Uint8Array([2]), {
      httpMetadata: { contentType: "image/jpeg" },
    });

    await callRoute(PUT, {
      user: ALICE,
      body: makeProfileInput({ referenceImageKey: "profile/old.jpg" }),
    });
    await callRoute(PUT, {
      user: ALICE,
      body: makeProfileInput({ referenceImageKey: "profile/new.jpg" }),
    });

    expect(await r2.bucket.get("profile/old.jpg")).toBeNull();
    expect(await r2.bucket.get("profile/new.jpg")).not.toBeNull();
  });

  it("参考画像を null に戻すと旧画像が消える", async () => {
    await r2.bucket.put("profile/p.jpg", new Uint8Array([1]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    await callRoute(PUT, {
      user: ALICE,
      body: makeProfileInput({ referenceImageKey: "profile/p.jpg" }),
    });
    await callRoute(PUT, {
      user: ALICE,
      body: makeProfileInput({ referenceImageKey: null }),
    });
    expect(await r2.bucket.get("profile/p.jpg")).toBeNull();
  });
});
