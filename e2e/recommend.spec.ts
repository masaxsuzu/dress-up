import { expect, test } from "@playwright/test";

// 1x1 透明PNG（outfit-image のモックレスポンス用）
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
    "0000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

// テスト用のダミー ClothingItem
const DUMMY_ITEM = {
  id: "item-001",
  category: "tops",
  subcategory: "Tシャツ",
  colors: [{ name: "navy", hex: "#1f2a44" }],
  pattern: "solid",
  material: "cotton",
  silhouette: "regular",
  season: ["spring", "summer"],
  formality: 2,
  occasion: ["casual"],
  tags: ["basic"],
  brand: null,
  notes: null,
  imageKey: "items/dummy.png",
  iconKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// 3 案レスポンス。1 案目は全 owned、2 案目は owned+buy 混在、3 案目は全 buy。
const THREE_PROPOSALS = {
  season: "spring",
  proposals: [
    {
      items: [{ kind: "owned", item: DUMMY_ITEM }],
      reason: "1: シンプルなランチ向け。",
    },
    {
      items: [
        { kind: "owned", item: DUMMY_ITEM },
        { kind: "buy", category: "bottoms", description: "ベージュのチノパン" },
      ],
      reason: "2: 明るく仕上げる。",
    },
    {
      items: [
        { kind: "buy", category: "tops", description: "ネイビーのポロシャツ" },
        { kind: "buy", category: "bottoms", description: "黒のスラックス" },
      ],
      reason: "3: 全部新しく揃える案。",
    },
  ],
};

test.describe("/recommend", () => {
  test("3 案表示: それぞれ全身画像と構成と説明が出る", async ({ page }) => {
    await page.route("/api/recommend", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_PROPOSALS),
      }),
    );
    // 3 つの提案が並列に /api/outfit-image を叩く。すべて成功扱い。
    await page.route("/api/outfit-image", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: TINY_PNG,
      }),
    );

    await page.goto("/recommend");
    await page.locator("textarea").fill("同僚と週末ランチ");
    await page.getByRole("button", { name: "コーデを 3 案出す" }).click();

    // 季節+案数の見出し
    await expect(page.getByText(/季節:.+3 案/)).toBeVisible();

    // 3 つの提案ヘッダー
    await expect(page.getByRole("heading", { name: "提案 1" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "提案 2" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "提案 3" })).toBeVisible();

    // 3 枚の全身画像
    await expect(page.locator('img[alt="全身コーデ"]')).toHaveCount(3, {
      timeout: 15_000,
    });

    // 説明テキストが全部見える
    await expect(page.getByText("1: シンプルなランチ向け。")).toBeVisible();
    await expect(page.getByText("2: 明るく仕上げる。")).toBeVisible();
    await expect(page.getByText("3: 全部新しく揃える案。")).toBeVisible();
  });

  test("買い足し点数バッジと買い足しアイテムの description が出る", async ({
    page,
  }) => {
    await page.route("/api/recommend", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_PROPOSALS),
      }),
    );
    await page.route("/api/outfit-image", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
    );

    await page.goto("/recommend");
    await page.locator("textarea").fill("週末カフェ");
    await page.getByRole("button", { name: "コーデを 3 案出す" }).click();

    // 提案 2 の買い足しが 1 点
    await expect(page.getByText("買い足し 1 点")).toBeVisible();
    // 提案 3 の買い足しが 2 点
    await expect(page.getByText("買い足し 2 点")).toBeVisible();

    // buy アイテムの description が表示される
    await expect(page.getByText("ベージュのチノパン")).toBeVisible();
    await expect(page.getByText("ネイビーのポロシャツ")).toBeVisible();
    await expect(page.getByText("黒のスラックス")).toBeVisible();
  });

  test("画像生成失敗: 該当案だけエラー表示と再試行ボタン", async ({ page }) => {
    await page.route("/api/recommend", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_PROPOSALS),
      }),
    );
    // すべての画像生成を 500 で落とす
    await page.route("/api/outfit-image", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Flash Image が混雑中" }),
      }),
    );

    await page.goto("/recommend");
    await page.locator("textarea").fill("雨の通勤");
    await page.getByRole("button", { name: "コーデを 3 案出す" }).click();

    // 3 件分のエラーメッセージ
    await expect(
      page.getByText(/画像の生成に失敗しました: Flash Image が混雑中/),
    ).toHaveCount(3, { timeout: 15_000 });

    // 再試行ボタンが 3 つ
    await expect(page.getByRole("button", { name: "再試行" })).toHaveCount(3);
  });

  test("エラー伝搬: /api/recommend が 500 を返すとエラーが表示される", async ({
    page,
  }) => {
    await page.route("/api/recommend", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Gemini API が利用できません" }),
      }),
    );

    await page.goto("/recommend");
    await page.locator("textarea").fill("カフェでの作業");
    await page.getByRole("button", { name: "コーデを 3 案出す" }).click();

    await expect(page.getByText("Gemini API が利用できません")).toBeVisible({
      timeout: 10_000,
    });
  });
});
