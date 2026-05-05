import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteImage, getImage, putImage } from "@/lib/r2";

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

describe("getImage", () => {
  it("存在するkeyでR2ObjectBodyを返す", async () => {
    const key = await putImage(bucket, PAYLOAD, "image/png");
    const obj = await getImage(bucket, key);
    expect(obj).not.toBeNull();
  });

  it("存在しないkeyでnullを返す", async () => {
    const obj = await getImage(bucket, "items/no-such-key.jpg");
    expect(obj).toBeNull();
  });
});

describe("deleteImage", () => {
  it("削除後にgetがnullを返す", async () => {
    const key = await putImage(bucket, PAYLOAD, "image/png");
    await deleteImage(bucket, key);
    expect(await getImage(bucket, key)).toBeNull();
  });

  it("存在しないkeyの削除はthrowしない", async () => {
    await expect(
      deleteImage(bucket, "items/no-such-key.jpg"),
    ).resolves.toBeUndefined();
  });
});
