import { expect, test } from "@playwright/test";
import { TINY_PNG } from "./helpers";

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
  // ページマウント時の GET /api/recommend/latest はデフォルト「保存無し」で
  // 黙らせる。restored 表示の検証は専用テストで上書きする。
  test.beforeEach(async ({ page }) => {
    await page.route("/api/recommend/latest", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ latest: null }),
      }),
    );
  });

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

    // シーン+季節+案数の見出し
    await expect(page.getByText(/シーン:.+3 案/)).toBeVisible();

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

  test("見返し: 最新の保存提案を復元 + 画像は『全身画像を生成』ボタン待ち", async ({
    page,
  }) => {
    // beforeEach の latest:null をこのテストでは上書き
    await page.unroute("/api/recommend/latest");
    await page.route("/api/recommend/latest", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          latest: {
            tpo: "前回の通勤",
            season: "spring",
            proposals: THREE_PROPOSALS.proposals,
            createdAt: "2026-06-23T10:00:00.000Z",
          },
        }),
      }),
    );
    // 画像 API が auto-fire 走ってないことを確認するため、呼ばれたら必ず失敗マークを残す
    let imageCalled = false;
    await page.route("/api/outfit-image", (route) => {
      imageCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: TINY_PNG,
      });
    });

    await page.goto("/recommend");

    // 「前回の提案」ラベルが出る + tpo が引き継がれる
    await expect(page.getByText(/前回の提案/)).toBeVisible();
    await expect(page.getByText(/前回の通勤/)).toBeVisible();

    // 3 案分の「全身画像を生成」ボタンが出ている (auto fire していない)
    await expect(
      page.getByRole("button", { name: "全身画像を生成" }),
    ).toHaveCount(3);

    // 自動では発火しないので、画像 API は呼ばれていない
    await page.waitForTimeout(500);
    expect(imageCalled).toBe(false);

    // ボタンを押すと 1 つだけ画像が出る
    await page
      .getByRole("button", { name: "全身画像を生成" })
      .first()
      .click();
    await expect(page.locator('img[alt="全身コーデ"]')).toHaveCount(1, {
      timeout: 10_000,
    });
  });
});
