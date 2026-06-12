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

// outfit 提案の成功レスポンス
const OUTFIT_RESPONSE = {
  season: "spring",
  kind: "outfit",
  items: [DUMMY_ITEM],
  reason: "このコーデはカジュアルなランチに最適です。",
};

// shopping 提案の成功レスポンス
const SHOPPING_RESPONSE = {
  season: "spring",
  kind: "shopping",
  missing: [
    {
      category: "bottoms",
      description: "カジュアルなシーンに合うチノパンツ",
    },
  ],
  reason: "既存のワードローブからコーデを組むには、ボトムスが不足しています。",
};

test.describe("/recommend", () => {
  test("outfit 提案フロー: コーデ提案が表示される", async ({ page }) => {
    // /api/recommend を outfit レスポンスでモック
    await page.route("/api/recommend", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(OUTFIT_RESPONSE),
      });
    });

    await page.goto("/recommend");

    // シーン入力
    await page.locator("textarea").fill("同僚と週末ランチ");

    // ボタンをクリック
    await page.getByRole("button", { name: "コーデを見つける" }).click();

    // 「コーデ提案」のラベルが出る
    await expect(page.getByText("コーデ提案")).toBeVisible();

    // 「使ったアイテム」見出しが出る
    await expect(page.getByRole("heading", { name: "使ったアイテム" })).toBeVisible();

    // アイテムサムネイル画像が 1 枚以上ある
    const thumbnails = page.locator(`img[src*="/api/images/"]`);
    await expect(thumbnails).toHaveCount(1);

    // 「説明」見出しが出る
    await expect(page.getByRole("heading", { name: "説明" })).toBeVisible();

    // reason テキストが出る
    await expect(
      page.getByText("このコーデはカジュアルなランチに最適です。"),
    ).toBeVisible();
  });

  test("shopping 提案フロー: 買い足し提案が表示される", async ({ page }) => {
    // /api/recommend を shopping レスポンスでモック
    await page.route("/api/recommend", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SHOPPING_RESPONSE),
      });
    });

    await page.goto("/recommend");

    await page.locator("textarea").fill("結婚式の二次会");
    await page.getByRole("button", { name: "コーデを見つける" }).click();

    // 「買い足し提案」ラベルが出る（コーデ提案ではなくこちら）
    await expect(page.getByText("買い足し提案")).toBeVisible();

    // 「買い足したいアイテム」見出し
    await expect(
      page.getByRole("heading", { name: "買い足したいアイテム" }),
    ).toBeVisible();

    // missing.description が表示される
    await expect(
      page.getByText("カジュアルなシーンに合うチノパンツ"),
    ).toBeVisible();
  });

  test("全身イメージ生成: ボタン押下で画像が表示される", async ({ page }) => {
    // /api/recommend を outfit レスポンスでモック
    await page.route("/api/recommend", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(OUTFIT_RESPONSE),
      });
    });

    // /api/outfit-image を 1x1 PNG バイナリで返すモック
    await page.route("/api/outfit-image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: TINY_PNG,
      });
    });

    await page.goto("/recommend");

    await page.locator("textarea").fill("カジュアルなお出かけ");
    await page.getByRole("button", { name: "コーデを見つける" }).click();

    // outfit カードが出るまで待つ
    await expect(page.getByText("コーデ提案")).toBeVisible();

    // 「全身イメージを生成」ボタンを押す
    await page
      .getByRole("button", { name: "全身イメージを生成（AI 画像、~10 秒）" })
      .click();

    // 生成完了後: alt="全身コーデ" の img が表示される
    await expect(page.locator('img[alt="全身コーデ"]')).toBeVisible({
      timeout: 15_000,
    });

    // ボタンが「作り直す」に切り替わる
    await expect(
      page.getByRole("button", { name: "全身イメージを作り直す" }),
    ).toBeVisible();
  });

  test("全身イメージ生成失敗: エラーメッセージと再試行ボタンが表示される", async ({
    page,
  }) => {
    // /api/recommend を outfit レスポンスでモック
    await page.route("/api/recommend", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(OUTFIT_RESPONSE),
      });
    });

    // /api/outfit-image を 500 エラーでモック
    await page.route("/api/outfit-image", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "画像生成サービスが利用できません" }),
      });
    });

    await page.goto("/recommend");

    await page.locator("textarea").fill("雨の通勤");
    await page.getByRole("button", { name: "コーデを見つける" }).click();

    // outfit カードが出るまで待つ
    await expect(page.getByText("コーデ提案")).toBeVisible();

    // 「全身イメージを生成」ボタンを押す
    await page
      .getByRole("button", { name: "全身イメージを生成（AI 画像、~10 秒）" })
      .click();

    // エラーメッセージが表示される
    await expect(
      page.getByText("画像生成サービスが利用できません"),
    ).toBeVisible({ timeout: 15_000 });

    // 「再試行」ボタンが表示される
    await expect(
      page.getByRole("button", { name: "全身イメージを再試行" }),
    ).toBeVisible();
  });

  test("エラー伝搬: /api/recommend が 500 を返すとエラーが表示される", async ({
    page,
  }) => {
    // /api/recommend を 500 エラーでモック
    await page.route("/api/recommend", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Gemini API が利用できません" }),
      });
    });

    await page.goto("/recommend");

    await page.locator("textarea").fill("カフェでの作業");
    await page.getByRole("button", { name: "コーデを見つける" }).click();

    // error 文字列が画面に表示される
    await expect(
      page.getByText("Gemini API が利用できません"),
    ).toBeVisible({ timeout: 10_000 });
  });
});
