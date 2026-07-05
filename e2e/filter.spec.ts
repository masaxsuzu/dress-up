import { expect, test } from "@playwright/test";
import { clearItems as clearAll, itemPayload } from "./helpers";

// Seed helper — creates items via the API
async function createItem(
  request: import("@playwright/test").APIRequestContext,
  overrides: Record<string, unknown>,
) {
  const res = await request.post("/api/items", {
    data: itemPayload({ colors: [{ name: "white", hex: "#ffffff" }], ...overrides }),
  });
  expect(res.ok()).toBeTruthy();
  const body: { item: unknown } = await res.json();
  return body.item;
}

test.describe("/ 絞り込み", () => {
  test.beforeEach(async ({ request }) => {
    await clearAll(request);
  });

  test("カテゴリチップで絞り込める", async ({ page, request }) => {
    // 2 tops + 1 bottoms
    await createItem(request, { category: "tops", season: ["spring"] });
    await createItem(request, { category: "tops", season: ["summer"] });
    await createItem(request, { category: "bottoms", season: ["autumn"] });

    await page.goto("/");
    await expect(page.locator("article")).toHaveCount(3);

    // Click "トップス" chip
    await page.getByRole("button", { name: "トップス" }).click();
    await expect(page.locator("article")).toHaveCount(2);

    // URL should contain category=tops
    expect(page.url()).toContain("category=tops");

    // Click "ボトムス" chip — now OR between tops and bottoms selected
    await page.getByRole("button", { name: "ボトムス" }).click();
    await expect(page.locator("article")).toHaveCount(3);

    // Clear filters
    await page.getByRole("button", { name: "クリア" }).click();
    await expect(page.locator("article")).toHaveCount(3);
  });

  test("シーズンチップで絞り込める", async ({ page, request }) => {
    await createItem(request, { category: "tops", season: ["spring"] });
    await createItem(request, {
      category: "bottoms",
      season: ["autumn", "winter"],
    });

    await page.goto("/");
    await expect(page.locator("article")).toHaveCount(2);

    await page.getByRole("button", { name: "秋" }).click();
    await expect(page.locator("article")).toHaveCount(1);
  });

  test("フリーテキスト検索でブランドを絞り込める", async ({
    page,
    request,
  }) => {
    await createItem(request, { brand: "Uniqlo", category: "tops" });
    await createItem(request, { brand: "Zara", category: "bottoms" });

    await page.goto("/");
    await expect(page.locator("article")).toHaveCount(2);

    const searchInput = page.getByPlaceholder("ブランド・素材・タグで検索");
    await searchInput.fill("Uniqlo");
    await searchInput.blur();

    await expect(page.locator("article")).toHaveCount(1);
  });

  test("URL パラメータ ?category=tops で初期絞り込みが反映される", async ({
    page,
    request,
  }) => {
    await createItem(request, { category: "tops" });
    await createItem(request, { category: "shoes" });

    await page.goto("/?category=tops");
    await expect(page.locator("article")).toHaveCount(1);

    // Chip should appear active (bold border)
    const chip = page.getByRole("button", { name: "トップス" });
    await expect(chip).toBeVisible();
  });
});
