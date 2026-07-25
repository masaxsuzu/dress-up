// /api/profile/reference-image — 参考画像アップロード。
// 拡張子・content-type のホワイトリスト挙動を検証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";

const { POST } = await import("@/app/api/profile/reference-image/route");

let r2: TestR2;

beforeAll(async () => {
  r2 = await createTestR2();
});
afterAll(() => r2.dispose());
beforeEach(async () => {
  await r2.reset();
  setTestEnv({ IMAGES: r2.bucket } as unknown as CloudflareEnv);
});

function imageForm(file: Blob, name = "x.jpg"): FormData {
  const form = new FormData();
  form.append("file", file, name);
  return form;
}

describe("POST /api/profile/reference-image", () => {
  it("成功で profile/<uuid>.jpg を返し R2 に保存される", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" });
    const res = await callRoute(POST, { formData: imageForm(file) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { imageKey: string };
    expect(body.imageKey).toMatch(/^profile\/[0-9a-f-]{36}\.jpg$/);
    expect(await r2.bucket.get(body.imageKey)).not.toBeNull();
  });

  it("file が無いと 400", async () => {
    const res = await callRoute(POST, { formData: new FormData() });
    expect(res.status).toBe(400);
  });

  it("非対応の content-type は 400", async () => {
    const file = new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" });
    const res = await callRoute(POST, { formData: imageForm(file, "x.pdf") });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unsupported content type/);
  });
});
