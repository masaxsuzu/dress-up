import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getProfile, setProfile } from "@/lib/profile";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { ALICE, BOB } from "@/test/helpers/factories";

let env: TestD1;

beforeAll(async () => {
  env = await createTestD1();
});
afterAll(() => env.dispose());
beforeEach(() => env.reset());

describe("getProfile", () => {
  it("未設定なら null", async () => {
    expect(await getProfile(env.db, ALICE)).toBeNull();
  });
});

describe("setProfile", () => {
  it("初回 INSERT で全項目セットされ updatedAt が付く", async () => {
    const result = await setProfile(env.db, ALICE, {
      gender: "male",
      heightCm: 175,
      weightKg: 65,
      bodyType: "細身",
      referenceImageKey: "profile/x.jpg",
    });
    expect(result.gender).toBe("male");
    expect(result.heightCm).toBe(175);
    expect(typeof result.updatedAt).toBe("string");

    const fetched = await getProfile(env.db, ALICE);
    expect(fetched).toEqual(result);
  });

  it("2 回目の setProfile は同じユーザの行を上書き", async () => {
    await setProfile(env.db, ALICE, {
      gender: "male",
      heightCm: 175,
      weightKg: 65,
      bodyType: "細身",
      referenceImageKey: null,
    });
    const r2 = await setProfile(env.db, ALICE, {
      gender: "female",
      heightCm: 160,
      weightKg: null,
      bodyType: null,
      referenceImageKey: "profile/y.jpg",
    });

    const count = await env.db
      .prepare("SELECT COUNT(*) as c FROM profile")
      .first<{ c: number }>();
    expect(count?.c).toBe(1);

    const fetched = await getProfile(env.db, ALICE);
    expect(fetched?.gender).toBe("female");
    expect(fetched?.heightCm).toBe(160);
    expect(fetched?.weightKg).toBeNull();
    expect(fetched?.referenceImageKey).toBe("profile/y.jpg");
    expect(fetched?.updatedAt).toBe(r2.updatedAt);
  });

  it("ユーザごとに別行を持つ", async () => {
    await setProfile(env.db, ALICE, {
      gender: "female",
      heightCm: 160,
      weightKg: null,
      bodyType: null,
      referenceImageKey: null,
    });
    await setProfile(env.db, BOB, {
      gender: "male",
      heightCm: 180,
      weightKg: null,
      bodyType: null,
      referenceImageKey: null,
    });

    expect((await getProfile(env.db, ALICE))?.gender).toBe("female");
    expect((await getProfile(env.db, BOB))?.gender).toBe("male");

    const count = await env.db
      .prepare("SELECT COUNT(*) as c FROM profile")
      .first<{ c: number }>();
    expect(count?.c).toBe(2);
  });

  it("null だらけでも保存できる", async () => {
    await setProfile(env.db, ALICE, {
      gender: null,
      heightCm: null,
      weightKg: null,
      bodyType: null,
      referenceImageKey: null,
    });
    const fetched = await getProfile(env.db, ALICE);
    expect(fetched).not.toBeNull();
    expect(fetched?.gender).toBeNull();
  });
});
