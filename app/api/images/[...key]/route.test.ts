// /api/images/[...key] の owner check。URL 推測で他人の画像を読めないことを保証する。

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "@/test/helpers/d1";
import { createTestR2, type TestR2 } from "@/test/helpers/r2";
import { ALICE, BOB, makeItemInput } from "@/test/helpers/factories";
import { callRoute, setTestEnv } from "@/test/helpers/route-runner";
import { setIconKey } from "@/lib/db";

const { GET } = await import("@/app/api/images/[...key]/route");
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

async function createItemAs(user: string, key: string) {
  await r2.bucket.put(key, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  const res = await callRoute(itemsPOST, {
    user,
    body: makeItemInput({ imageKey: key }),
  });
  return ((await res.json()) as { item: { id: string } }).item;
}

describe("GET /api/images/[...key]", () => {
  it("自分のアイテム画像は 200 + body を返す", async () => {
    await createItemAs(ALICE, "items/own.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "own.jpg"] },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("他人のアイテム画像は 404 (R2 には存在していても)", async () => {
    await createItemAs(ALICE, "items/secret.jpg");
    const res = await callRoute(GET, {
      user: BOB,
      params: { key: ["items", "secret.jpg"] },
    });
    expect(res.status).toBe(404);
  });

  it("DB にも R2 にも無い key は 404", async () => {
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "ghost.jpg"] },
    });
    expect(res.status).toBe(404);
  });

  it("200 応答に ETag ヘッダが付く", async () => {
    await createItemAs(ALICE, "items/etag.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "etag.jpg"] },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
  });

  it("If-None-Match が一致すると 304 (body 無し)", async () => {
    await createItemAs(ALICE, "items/cond.jpg");
    const first = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "cond.jpg"] },
    });
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();

    const second = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "cond.jpg"] },
      headers: { "If-None-Match": etag! },
    });
    expect(second.status).toBe(304);
    const bytes = await second.arrayBuffer();
    expect(bytes.byteLength).toBe(0);
  });

  it("If-None-Match がトリムすると空文字になる値だと無視され通常の 200 になる", async () => {
    await createItemAs(ALICE, "items/blank.jpg");
    // 素の半角スペースだけだと fetch の Headers 実装自体が前後を trim して "" にしてしまい
    // route 側では raw 自体が falsy になる (!raw 分岐) だけで `trimmed` の空文字分岐までは
    // 届かない。Headers の前後除去は 0x09/0x20 のみが対象なので、JS の String#trim() では
    // 消えるが Headers では残る垂直タブ (\u000B) を使い、raw は truthy かつ trimmed が空、
    // という分岐を確実に踏む。
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "blank.jpg"] },
      headers: { "If-None-Match": "\u000B" },
    });
    expect(res.status).toBe(200);
  });

  it("クォートのみ (中身が空) の ETag はフォールバックせず通常の 200 になる", async () => {
    await createItemAs(ALICE, "items/empty-quoted.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "empty-quoted.jpg"] },
      headers: { "If-None-Match": '""' },
    });
    expect(res.status).toBe(200);
  });

  it("If-None-Match: * はオブジェクトが存在すれば常に 304", async () => {
    await createItemAs(ALICE, "items/wild.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "wild.jpg"] },
      headers: { "If-None-Match": "*" },
    });
    expect(res.status).toBe(304);
  });

  it("W/ (weak validator) プレフィックス付きでも ETag が一致すれば 304", async () => {
    await createItemAs(ALICE, "items/weak.jpg");
    const first = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "weak.jpg"] },
    });
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();

    const second = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "weak.jpg"] },
      headers: { "If-None-Match": `W/${etag}` },
    });
    expect(second.status).toBe(304);
  });

  it("If-None-Match が不一致だと 200 (body 付き) のまま返す", async () => {
    await createItemAs(ALICE, "items/mismatch.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "mismatch.jpg"] },
      headers: { "If-None-Match": '"totally-different-etag"' },
    });
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("R2.get が例外を投げると (壊れた onlyIf 等) 404 で透過する", async () => {
    await createItemAs(ALICE, "items/throwing.jpg");
    setTestEnv({
      DB: d1.db,
      IMAGES: {
        get: () => {
          throw new Error("boom");
        },
      } as unknown as R2Bucket,
      GEMINI_API_KEY: "test-key",
    } as unknown as CloudflareEnv);

    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "throwing.jpg"] },
    });
    expect(res.status).toBe(404);
  });

  it("DB には所有記録があるが R2 から削除済みの画像は 404", async () => {
    await createItemAs(ALICE, "items/deleted.jpg");
    await r2.bucket.delete("items/deleted.jpg");
    const res = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "deleted.jpg"] },
    });
    expect(res.status).toBe(404);
  });

  it("httpMetadata.contentType が無いと application/octet-stream にフォールバックする", async () => {
    await r2.bucket.put("items/no-content-type.bin", new Uint8Array([9, 9, 9]));
    const res = await callRoute(itemsPOST, {
      user: ALICE,
      body: makeItemInput({ imageKey: "items/no-content-type.bin" }),
    });
    expect(res.status).toBe(201);

    const getRes = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "no-content-type.bin"] },
    });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("items/ キーの Cache-Control は immutable、icons/ は付かない", async () => {
    await createItemAs(ALICE, "items/cache-check.jpg");
    const itemRes = await callRoute(GET, {
      user: ALICE,
      params: { key: ["items", "cache-check.jpg"] },
    });
    expect(itemRes.headers.get("Cache-Control")).toContain("immutable");

    const created = await createItemAs(ALICE, "items/for-icon.jpg");
    await r2.bucket.put("icons/cache-check.png", new Uint8Array([1]), {
      httpMetadata: { contentType: "image/png" },
    });
    await setIconKey(d1.db, ALICE, created.id, "icons/cache-check.png");

    const iconRes = await callRoute(GET, {
      user: ALICE,
      params: { key: ["icons", "cache-check.png"] },
    });
    expect(iconRes.status).toBe(200);
    expect(iconRes.headers.get("Cache-Control")).not.toContain("immutable");
  });
});
