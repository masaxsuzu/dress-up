import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  deleteImage,
  loadImageBase64,
  putIcon,
  putImage,
  putProfileImage,
} from "@/lib/r2";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";

let env: TestR2;

beforeAll(async () => {
  env = await createTestR2();
});
afterAll(() => env.dispose());
beforeEach(() => env.reset());

const PAYLOAD = new Uint8Array([1, 2, 3, 4]).buffer;

describe("putImage", () => {
  it("jpegを items/<uuid>.jpg として保存する", async () => {
    const key = await putImage(env.bucket, PAYLOAD, "image/jpeg");
    expect(key).toMatch(/^items\/[0-9a-f-]{36}\.jpg$/);
    const obj = await env.bucket.get(key);
    expect(obj).not.toBeNull();
    expect(obj!.httpMetadata?.contentType).toBe("image/jpeg");
  });

  it("png/webp/gifで適切な拡張子を付ける", async () => {
    const png = await putImage(env.bucket, PAYLOAD, "image/png");
    const webp = await putImage(env.bucket, PAYLOAD, "image/webp");
    const gif = await putImage(env.bucket, PAYLOAD, "image/gif");
    expect(png).toMatch(/\.png$/);
    expect(webp).toMatch(/\.webp$/);
    expect(gif).toMatch(/\.gif$/);
  });

  it("未知のMIMEはbin拡張子になる", async () => {
    const key = await putImage(env.bucket, PAYLOAD, "application/octet-stream");
    expect(key).toMatch(/\.bin$/);
  });
});

describe("putIcon", () => {
  it("icons/<itemId>.<ext> として保存し Content-Type を残す", async () => {
    const key = await putIcon(env.bucket, "item-42", PAYLOAD, "image/png");
    expect(key).toBe("icons/item-42.png");
    const obj = await env.bucket.get(key);
    expect(obj!.httpMetadata?.contentType).toBe("image/png");
  });

  it("同じ itemId で再呼び出しすると上書きする", async () => {
    await putIcon(env.bucket, "item-x", PAYLOAD, "image/png");
    const newPayload = new Uint8Array([9, 9, 9]).buffer;
    const key = await putIcon(env.bucket, "item-x", newPayload, "image/png");
    const obj = await env.bucket.get(key);
    const got = new Uint8Array(await obj!.arrayBuffer());
    expect(Array.from(got)).toEqual([9, 9, 9]);
  });
});

describe("putProfileImage", () => {
  it("profile/<uuid>.<ext> として保存する", async () => {
    const key = await putProfileImage(env.bucket, PAYLOAD, "image/jpeg");
    expect(key).toMatch(/^profile\/[0-9a-f-]{36}\.jpg$/);
    const obj = await env.bucket.get(key);
    expect(obj!.httpMetadata?.contentType).toBe("image/jpeg");
  });
});

describe("loadImageBase64", () => {
  it("存在するキーで mediaType と base64 を返す", async () => {
    const key = await putImage(env.bucket, PAYLOAD, "image/png");
    const result = await loadImageBase64(env.bucket, key);
    expect(result).not.toBeNull();
    expect(result!.mediaType).toBe("image/png");
    expect(result!.base64).toBe(Buffer.from(PAYLOAD).toString("base64"));
  });

  it("存在しないキーで null を返す", async () => {
    expect(await loadImageBase64(env.bucket, "items/no-such-key.jpg")).toBeNull();
  });

  it("許可されていない Content-Type で null を返す", async () => {
    await env.bucket.put("items/test.pdf", PAYLOAD, {
      httpMetadata: { contentType: "application/pdf" },
    });
    expect(await loadImageBase64(env.bucket, "items/test.pdf")).toBeNull();
  });
});

describe("deleteImage", () => {
  it("削除後に bucket.get が null を返す", async () => {
    const key = await putImage(env.bucket, PAYLOAD, "image/png");
    await deleteImage(env.bucket, key);
    expect(await env.bucket.get(key)).toBeNull();
  });

  it("存在しないkeyの削除はthrowしない", async () => {
    await expect(
      deleteImage(env.bucket, "items/no-such-key.jpg"),
    ).resolves.toBeUndefined();
  });
});
