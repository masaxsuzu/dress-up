import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_ITEM = {
  category: "tops",
  subcategory: "Tシャツ",
  colors: [{ name: "white", hex: "#ffffff" }],
  pattern: null,
  material: null,
  silhouette: null,
  season: ["spring"],
  formality: 2,
  occasion: [],
  tags: [],
  brand: null,
  notes: null,
  imageKey: "items/dummy-icon-test.png",
};

async function clear(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/items");
  const { items } = await res.json();
  for (const item of items) {
    await request.delete(`/api/items/${item.id}`);
  }
}

// ---------------------------------------------------------------------------
// Case 1: Gallery thumbnail when iconKey is absent
// ---------------------------------------------------------------------------

test("iconKey なし: ギャラリーのサムネイルは imageKey を src とし objectFit:cover を持つ", async ({
  page,
  request,
}) => {
  await clear(request);

  // Create an item with NO iconKey (the default — iconKey column is NULL).
  const created = await request.post("/api/items", { data: BASE_ITEM });
  expect(created.ok()).toBeTruthy();

  await page.goto("/");

  // There should be exactly one <article> in the gallery.
  const article = page.locator("article").first();
  await expect(article).toBeVisible();

  const img = article.locator("img").first();
  await expect(img).toBeVisible();

  // src must reference imageKey directly (no iconKey fallback path).
  const src = await img.getAttribute("src");
  expect(src).toContain("/api/images/items/dummy-icon-test.png");
  expect(src).not.toContain("icons/");

  // Gallery uses objectFit: "cover" when there is no iconKey.
  // The gallery.tsx sets objectFit inline — read it from the computed style.
  const objectFit = await img.evaluate(
    (el) => (el as HTMLImageElement).style.objectFit,
  );
  expect(objectFit).toBe("cover");
});

// ---------------------------------------------------------------------------
// Case 2: Iconize button — success path (label transition + reload)
// ---------------------------------------------------------------------------

test("iconize ボタン: POST 成功 → 「生成中...」が見え、ページがリロードされる", async ({
  page,
  request,
}) => {
  await clear(request);

  const created = await request.post("/api/items", { data: BASE_ITEM });
  expect(created.ok()).toBeTruthy();
  const { item } = await created.json();

  await page.goto(`/items/${item.id}`);
  await expect(page.getByText("カテゴリ")).toBeVisible();

  // Mock the iconize endpoint to return 200 with a fake iconKey.
  // Use a slight delay so the "生成中..." state is observable.
  await page.route(`/api/items/${item.id}/iconize`, async (route) => {
    // Small artificial delay (200ms) to make the loading state visible.
    await new Promise((r) => setTimeout(r, 200));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ iconKey: "icons/fake-icon.png" }),
    });
  });

  // The button initially shows "アイコン化" (hasIcon is false).
  const btn = page.getByRole("button", { name: "アイコン化" });
  await expect(btn).toBeVisible();

  // Click the button.  It should immediately transition to "生成中...".
  const clickPromise = btn.click();

  // Wait for the loading label to appear.
  await expect(page.getByRole("button", { name: "生成中..." })).toBeVisible({
    timeout: 5_000,
  });

  // After the mock resolves, window.location.reload() fires.
  // Wait for the navigation that reload triggers.
  await page.waitForURL(`/items/${item.id}`, { timeout: 10_000 });

  // Consume the click promise.
  await clickPromise;

  // After reload the page re-renders from server; detail content should be visible.
  await expect(page.getByText("カテゴリ")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Case 3: Iconize button — failure path (エラー label + danger style)
// ---------------------------------------------------------------------------

test("iconize ボタン: POST 失敗 → 「エラー」ラベルと danger (赤) スタイルになる", async ({
  page,
  request,
}) => {
  await clear(request);

  const created = await request.post("/api/items", { data: BASE_ITEM });
  expect(created.ok()).toBeTruthy();
  const { item } = await created.json();

  await page.goto(`/items/${item.id}`);
  await expect(page.getByText("カテゴリ")).toBeVisible();

  // Mock the iconize endpoint to return 500.
  await page.route(`/api/items/${item.id}/iconize`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "generation failed" }),
    });
  });

  const btn = page.getByRole("button", { name: "アイコン化" });
  await expect(btn).toBeVisible();
  await btn.click();

  // After the 500 response, the label should become "エラー".
  const errorBtn = page.getByRole("button", { name: "エラー" });
  await expect(errorBtn).toBeVisible({ timeout: 5_000 });

  // The danger variant sets background: "#c00" — verify the inline style.
  const bg = await errorBtn.evaluate(
    (el) => (el as HTMLButtonElement).style.background,
  );
  // The value may be rgb(204, 0, 0) or #c00 depending on the browser;
  // match either form.
  expect(bg === "#c00" || bg === "rgb(204, 0, 0)").toBeTruthy();
});

// ---------------------------------------------------------------------------
// Case 4: Delete → navigate to / (already covered, skip)
// ---------------------------------------------------------------------------

// NOTE: 削除後に一覧ページへ遷移するケースは registration.spec.ts:103-136 で
// 十分にカバーされている。重複するので本 spec ではスキップする。
