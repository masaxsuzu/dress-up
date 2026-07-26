import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { ALICE, BOB } from "@/test/helpers/factories";
import { forgetUpload, isUploadedBy, recordUpload } from "./uploads";

let env: TestD1;

beforeAll(async () => {
  env = await createTestD1();
});
afterAll(async () => {
  await env.dispose();
});
beforeEach(async () => {
  await env.reset();
});

describe("recordUpload / isUploadedBy", () => {
  it("記録した本人には true、他人には false", async () => {
    await recordUpload(env.db, ALICE, "items/alice.jpg");

    expect(await isUploadedBy(env.db, ALICE, "items/alice.jpg")).toBe(true);
    expect(await isUploadedBy(env.db, BOB, "items/alice.jpg")).toBe(false);
  });

  it("記録の無い key は誰にとっても false", async () => {
    expect(await isUploadedBy(env.db, ALICE, "items/unknown.jpg")).toBe(false);
  });

  it("同じ key を再記録しても衝突せず所有者が更新される", async () => {
    // iconize は item id 固定キーなので、アイコン再生成で同じ key を上書きする。
    await recordUpload(env.db, ALICE, "icons/x.png");
    await recordUpload(env.db, ALICE, "icons/x.png");

    expect(await isUploadedBy(env.db, ALICE, "icons/x.png")).toBe(true);
  });
});

describe("forgetUpload", () => {
  it("削除後は所有者でも false になる", async () => {
    await recordUpload(env.db, ALICE, "items/alice.jpg");
    await forgetUpload(env.db, "items/alice.jpg");

    expect(await isUploadedBy(env.db, ALICE, "items/alice.jpg")).toBe(false);
  });

  it("存在しない key を消しても失敗しない", async () => {
    await expect(
      forgetUpload(env.db, "items/never-existed.jpg"),
    ).resolves.toBeUndefined();
  });
});
