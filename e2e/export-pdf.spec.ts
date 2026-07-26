import { expect, test } from "@playwright/test";
import { clearItems as clearAll, seedItem } from "./helpers";

test.describe("/ 写真付き PDF エクスポート", () => {
  test.beforeEach(async ({ request }) => {
    await clearAll(request);
  });

  test("アイテムが0件ならボタンごと非表示", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("export-pdf-button")).toHaveCount(0);
  });

  test("アイテム一覧を PDF としてダウンロードできる (imageKey が R2 に無くても失敗しない)", async ({
    page,
    request,
  }) => {
    await seedItem(request, { category: "tops" });

    await page.goto("/");
    await expect(page.locator("article")).toHaveCount(1);

    const button = page.getByTestId("export-pdf-button");
    await expect(button).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await button.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^dress-up-wardrobe-\d{4}-\d{2}-\d{2}\.pdf$/);
    const path = await download.path();
    expect(path).toBeTruthy();

    await expect(button).toBeEnabled();
    await expect(button).toHaveText("写真付き PDF");
  });

  test("絞り込み中は表示中のアイテムのみが対象になる (0件時はボタンが無効)", async ({
    page,
    request,
  }) => {
    await seedItem(request, { category: "tops" });
    await page.goto("/");
    await expect(page.locator("article")).toHaveCount(1);

    await page.getByRole("button", { name: "ボトムス" }).click();
    await expect(page.locator("article")).toHaveCount(0);

    await expect(page.getByTestId("export-pdf-button")).toBeDisabled();
  });
});
