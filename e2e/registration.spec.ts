import { expect, test } from "@playwright/test";
import { TINY_PNG, clearItems as clear, itemPayload } from "./helpers";

test("/add でアップロード→VLM失敗→手動入力→保存→一覧に出る", async ({
  page,
  request,
}) => {
  await clear(request);

  // 保存時に裏で自動 iconize が走るので、本物 Gemini に届かないようモック。
  // fire-and-forget なのでレスポンスは何でもよい。
  await page.route(/\/api\/items\/[^/]+\/iconize$/, (route) =>
    route.fulfill({ status: 200, body: "{}" }),
  );

  await page.goto("/add");
  await expect(page.getByRole("heading", { name: "服を追加" })).toBeVisible();

  await page.locator('[data-testid="photo-file-input"]').setInputFiles({
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
  await expect(page.getByText("+ 服を追加")).toBeVisible();
  await expect(page.getByText("まだアイテムがありません。")).toBeVisible();
});

test("詳細ページから編集して変更が反映される", async ({ page, request }) => {
  await clear(request);

  const created = await request.post("/api/items", {
    data: itemPayload({ subcategory: "Tシャツ" }),
  });
  expect(created.ok()).toBeTruthy();
  const { item } = await created.json();

  // 詳細ページに移動して編集ボタンを確認
  await page.goto(`/items/${item.id}`);
  await expect(page.getByRole("link", { name: "編集" })).toBeVisible();
  await page.getByRole("link", { name: "編集" }).click();

  // 編集ページが表示されること (フォームがロードされるまで待つ)
  await expect(page.getByRole("heading", { name: "アイテムを編集" })).toBeVisible({
    timeout: 15_000,
  });
  // 保存ボタンが有効になるまで待つ (データロード完了の目印)
  await expect(page.getByRole("button", { name: "保存" })).toBeEnabled({
    timeout: 15_000,
  });

  // カテゴリをボトムスに変更 (最初のselectがカテゴリ)
  const selects = page.locator("select");
  await selects.first().selectOption("bottoms");
  // サブカテゴリをクリア (旧カテゴリのサブカテゴリが残ると itemLabel がそちらを返す)
  await page.getByLabel("サブカテゴリ").fill("");

  // 保存ボタンをクリック
  await page.getByRole("button", { name: "保存" }).click();

  // 詳細ページに戻る
  await page.waitForURL(`/items/${item.id}`, { timeout: 15_000 });
  await expect(page.getByText("ボトムス")).toBeVisible();
});

test("詳細ページから削除すると一覧から消える", async ({ page, request }) => {
  await clear(request);

  // API 経由で1件作っておく（UIフローはもう一つのテストでカバー済み）
  const created = await request.post("/api/items", {
    data: itemPayload(),
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
