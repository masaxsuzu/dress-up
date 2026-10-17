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

  test("アイテム一覧を PDF として自分宛てに送信できる (実メール送信はモック)", async ({
    page,
    request,
  }) => {
    await seedItem(request, { category: "tops" });

    await page.goto("/");
    await expect(page.locator("article")).toHaveCount(1);

    const button = page.getByTestId("export-pdf-button");
    await expect(button).toBeEnabled();

    await page.route("**/api/wardrobe/email", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["content-type"]).toBe("application/pdf");
      expect(route.request().postDataBuffer()?.subarray(0, 5).toString()).toBe("%PDF-");
      await route.fulfill({ json: { accepted: true } });
    });
    await button.click();
    await expect(page.getByRole("status")).toContainText("送信を受け付けました");

    await expect(button).toBeEnabled();
    await expect(button).toHaveText("PDF を自分にメール");
  });

  test("メール送信に失敗したらエラーを表示し、再試行できる", async ({ page, request }) => {
    await seedItem(request, { category: "tops" });
    await page.route("**/api/wardrobe/email", (route) => route.fulfill({
      status: 503,
      json: { error: "メール送信の設定がまだ完了していません。" },
    }));
    await page.goto("/");
    const button = page.getByTestId("export-pdf-button");
    const error = page.getByRole("alert").filter({ hasText: "PDF のメール送信に失敗しました" });
    await button.click();
    await expect(error).toContainText("メール送信の設定がまだ完了していません。");
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(button).toBeEnabled();

    await page.route("**/api/wardrobe/email", (route) => route.fulfill({ json: { accepted: true } }));
    await button.click();
    await expect(page.getByRole("status")).toContainText("送信を受け付けました");
    await expect(error).toHaveCount(0);
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
