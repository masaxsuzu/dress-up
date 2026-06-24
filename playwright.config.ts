import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // Next dev は初回ヒットしたルートを動的にコンパイルする。
  // 後半の spec (registration など) で /add や /items/[id] を初回 hit すると
  // この compile に 5s デフォルトを超えることがあり、特に CI / リソース細い環境で
  // 偽 fail を生む。expect.toBeVisible / page.goto の暗黙待ちを 15s に伸ばす。
  expect: { timeout: 15_000 },
  // CI でのみリトライ。ローカルは即 fail させて気付く。
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // page.goto / page.click のデフォルト navigation/action timeout も伸ばす。
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: "npm run dev",
    // url ではなく port を使う。url を使うと初回 GET / が 500（DB未マイグレーション）
    // の段階で失敗し、globalSetup が走る前に webServer がタイムアウトする。
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
