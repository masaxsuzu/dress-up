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

function isSqliteBusy(e: unknown): boolean {
  // execSync の失敗は message ではなく stderr (Buffer) 側に理由が載る。
  const err = e as {
    message?: string;
    stderr?: string | Buffer;
    stdout?: string | Buffer;
  };
  const parts = [err?.message, err?.stderr?.toString(), err?.stdout?.toString()];
  return parts.some(
    (s) => s !== undefined && /SQLITE_BUSY|database is locked/i.test(s),
  );
}

// Playwright は webServer (npm run dev) を起動してから globalSetup を走らせる。
// dev サーバは OpenNext shim 経由で同じローカル D1 SQLite を開くため、ここでの
// wrangler 実行が SQLITE_BUSY で弾かれることがある (実際に CI で発生)。
// マイグレーションも DELETE も冪等なので、ロック競合のときだけ短い backoff で
// やり直す。ロック以外のエラーは即座に投げ直して、本物の失敗を隠さない。
async function runWithLockRetry(command: string, attempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      execSync(command, { stdio: "pipe" });
      return;
    } catch (e) {
      if (attempt === attempts || !isSqliteBusy(e)) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

export default async function globalSetup() {
  await runWithLockRetry("npx wrangler d1 migrations apply dress-up --local");
  // 前回実行の残留データがテスト間依存を生まないよう、全ユーザテーブルをクリアする。
  await runWithLockRetry(
    'npx wrangler d1 execute dress-up --local --command "DELETE FROM clothing_items; DELETE FROM profile; DELETE FROM latest_recommendation"',
  );
  await waitForApi();
}
