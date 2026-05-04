import { execSync } from "node:child_process";

export default async function globalSetup() {
  // ローカル D1 にマイグレーションを適用 + 既存データをクリア
  execSync("npx wrangler d1 migrations apply dress-up --local", {
    stdio: "pipe",
  });
  execSync(
    'npx wrangler d1 execute dress-up --local --command "DELETE FROM clothing_items"',
    { stdio: "pipe" },
  );
}
