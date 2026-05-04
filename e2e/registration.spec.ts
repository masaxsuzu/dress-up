import { expect, test } from "@playwright/test";

// 1x1 透明PNG。VLMが無くても Cloudflare Access も無くても /add フローを通せる。
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
    "0000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

async function clear(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/items");
  const { items } = await res.json();
  for (const item of items) {
    await request.delete(`/api/items/${item.id}`);
  }
}

test("/add でアップロード→VLM失敗→手動入力→保存→一覧に出る", async ({
  page,
  request,
}) => {
  await clear(request);

  await page.goto("/add");
  await expect(page.getByRole("heading", { name: "服を追加" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  await page.getByRole("button", { name: "属性を抽出" }).click();

  // 抽出が終わって（成功でも失敗でも）フォームと保存ボタンが出るのを待つ
  await expect(page.getByRole("button", { name: "保存" })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole("button", { name: "保存" }).click();

  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "dress-up" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(1);
});

test("/ 一覧に追加ボタンがある", async ({ page, request }) => {
  await clear(request);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /服を追加/ })).toBeVisible();
  await expect(page.getByText("まだアイテムがありません。")).toBeVisible();
});

test("詳細ページから削除すると一覧から消える", async ({ page, request }) => {
  await clear(request);

  // API 経由で1件作っておく（UIフローはもう一つのテストでカバー済み）
  const created = await request.post("/api/items", {
    data: {
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
    },
  });
  expect(created.ok()).toBeTruthy();
  const { item } = await created.json();

  await page.goto(`/items/${item.id}`);
  await expect(page.getByText("カテゴリ")).toBeVisible();

  // confirm() を自動承認
  page.on("dialog", (d) => d.accept());

  await page.getByRole("button", { name: "削除" }).click();
  await page.waitForURL("/");
  await expect(page.getByText("まだアイテムがありません。")).toBeVisible();
});
