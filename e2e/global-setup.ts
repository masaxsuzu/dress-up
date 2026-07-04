import { execSync } from "node:child_process";

async function waitForApi(maxMs = 30_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://localhost:3000/api/items");
      if (res.headers.get("content-type")?.includes("application/json")) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for /api/items to return JSON");
}

export default async function globalSetup() {
  execSync("npx wrangler d1 migrations apply dress-up --local", { stdio: "pipe" });
  // 前回実行の残留データがテスト間依存を生まないよう、全ユーザテーブルをクリアする。
  execSync(
    'npx wrangler d1 execute dress-up --local --command "DELETE FROM clothing_items; DELETE FROM profile; DELETE FROM latest_recommendation"',
    { stdio: "pipe" },
  );
  await waitForApi();
}
