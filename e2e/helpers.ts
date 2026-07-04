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
    imageKey: "items/dummy.png",
    ...overrides,
  };
}
