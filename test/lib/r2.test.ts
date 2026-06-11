import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteImage, loadImageBase64, putIcon, putImage } from "@/lib/r2";

let mf: Miniflare;
let bucket: R2Bucket;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    r2Buckets: { IMAGES: "test-images" },
  });
  bucket = (await mf.getR2Bucket("IMAGES")) as unknown as R2Bucket;
});

afterAll(async () => {
  await mf.dispose();
});

beforeEach(async () => {
  const list = await bucket.list();
  for (const obj of list.objects) {
    await bucket.delete(obj.key);
  }
});

const PAYLOAD = new Uint8Array([1, 2, 3, 4]).buffer;

describe("putImage", () => {
  it("jpegを items/<uuid>.jpg として保存する", async () => {
    const key = await putImage(bucket, PAYLOAD, "image/jpeg");
    expect(key).toMatch(/^items\/[0-9a-f-]{36}\.jpg$/);
    const obj = await bucket.get(key);
    expect(obj).not.toBeNull();
    expect(obj!.httpMetadata?.contentType).toBe("image/jpeg");
  });

  it("png/webp/gifで適切な拡張子を付ける", async () => {
    const png = await putImage(bucket, PAYLOAD, "image/png");
    const webp = await putImage(bucket, PAYLOAD, "image/webp");
    const gif = await putImage(bucket, PAYLOAD, "image/gif");
    expect(png).toMatch(/\.png$/);
    expect(webp).toMatch(/\.webp$/);
    expect(gif).toMatch(/\.gif$/);
  });

  it("未知のMIMEはbin拡張子になる", async () => {
    const key = await putImage(bucket, PAYLOAD, "application/octet-stream");
    expect(key).toMatch(/\.bin$/);
  });
});

describe("putIcon", () => {
  it("icons/<itemId>.<ext> として保存しContent-Typeを残す", async () => {
    const key = await putIcon(bucket, "item-42", PAYLOAD, "image/png");
    expect(key).toBe("icons/item-42.png");
    const obj = await bucket.get(key);
    expect(obj).not.toBeNull();
    expect(obj!.httpMetadata?.contentType).toBe("image/png");
  });

  it("同じitemIdで再呼び出しすると上書きする", async () => {
    await putIcon(bucket, "item-x", PAYLOAD, "image/png");
    const newPayload = new Uint8Array([9, 9, 9]).buffer;
    const key = await putIcon(bucket, "item-x", newPayload, "image/png");
    const obj = await bucket.get(key);
    const got = new Uint8Array(await obj!.arrayBuffer());
    expect(Array.from(got)).toEqual([9, 9, 9]);
  });
});

describe("loadImageBase64", () => {
  it("存在するキーで mediaType と base64 を返す", async () => {
    const key = await putImage(bucket, PAYLOAD, "image/png");
    const result = await loadImageBase64(bucket, key);
    expect(result).not.toBeNull();
    expect(result!.mediaType).toBe("image/png");
    expect(result!.base64).toBe(Buffer.from(PAYLOAD).toString("base64"));
  });

  it("存在しないキーで null を返す", async () => {
    const result = await loadImageBase64(bucket, "items/no-such-key.jpg");
    expect(result).toBeNull();
  });

  it("許可されていない Content-Type で null を返す", async () => {
    // bucket に直接 application/pdf のオブジェクトを置いて確認する
    await bucket.put("items/test.pdf", PAYLOAD, {
      httpMetadata: { contentType: "application/pdf" },
    });
    const result = await loadImageBase64(bucket, "items/test.pdf");
    expect(result).toBeNull();
  });
});

describe("deleteImage", () => {
  it("削除後に bucket.get が null を返す", async () => {
    const key = await putImage(bucket, PAYLOAD, "image/png");
    await deleteImage(bucket, key);
    expect(await bucket.get(key)).toBeNull();
  });

  it("存在しないkeyの削除はthrowしない", async () => {
    await expect(
      deleteImage(bucket, "items/no-such-key.jpg"),
    ).resolves.toBeUndefined();
  });
});
