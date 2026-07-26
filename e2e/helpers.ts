import type { APIRequestContext } from "@playwright/test";

// 1x1 透明PNG。VLM モックや画像アップロードのダミーに使う。
export const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
    "0000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

// 全 clothing_items を API 経由で削除 (テスト間の独立性確保)
export async function clearItems(request: APIRequestContext) {
  const res = await request.get("/api/items");
  const { items } = await res.json();
  for (const item of items) {
    await request.delete(`/api/items/${item.id}`);
  }
}

// POST /api/items 用の最小ペイロード。テスト側は必要な差分だけ override する。
// imageKey は seedItem() が実アップロードで得た値を差し込むので、ここでは
// 埋めない (勝手な key を渡しても所有者でないため 400 になる)。
export function itemPayload(overrides: Record<string, unknown> = {}) {
  return {
    category: "tops",
    subcategory: null,
    colors: [{ name: "navy", hex: "#1f2a44" }],
    pattern: null,
    material: null,
    silhouette: null,
    season: ["spring"],
    formality: 2,
    occasion: [],
    tags: [],
    brand: null,
    notes: null,
    ...overrides,
  };
}

// 画像をアップロードして imageKey を得る。所有権は /api/extract が記録するので、
// アイテム登録にはこの経路で得た key を使う必要がある (client が任意の key を
// 名乗れないようにするため)。VLM は失敗してよく、その場合も 200 で key が返る。
export async function uploadImage(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/extract", {
    multipart: {
      file: { name: "seed.png", mimeType: "image/png", buffer: TINY_PNG },
    },
  });
  const body: { imageKey?: string } = await res.json();
  if (!body.imageKey) {
    throw new Error(`uploadImage: imageKey が返らなかった (status ${res.status()})`);
  }
  return body.imageKey;
}

// 実フロー通りに「アップロード → アイテム登録」を行う seed。
export async function seedItem(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  const imageKey = await uploadImage(request);
  const res = await request.post("/api/items", {
    data: itemPayload({ imageKey, ...overrides }),
  });
  if (res.status() !== 201) {
    throw new Error(`seedItem: 期待 201, 実際 ${res.status()} — ${await res.text()}`);
  }
  const body: { item: { id: string; imageKey: string } } = await res.json();
  return body.item;
}
