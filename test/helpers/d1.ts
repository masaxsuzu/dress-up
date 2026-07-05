// D1 を使うテストの共通セットアップ。Miniflare で in-memory SQLite を立てて
// migrations/ 配下の全 SQL を順に適用する。各 spec ファイルで
//   const env = await createTestD1();
//   afterAll(() => env.dispose());
//   beforeEach(() => env.reset());
// と書くだけで済むようにする。

import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname, "../../migrations");

// マイグレーションファイルを読んで SQL 文ごとに分割。コメントは事前に剥がす。
function loadMigrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const out: string[] = [];
  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...statements);
  }
  return out;
}

const TABLES = ["clothing_items", "profile", "latest_recommendation"] as const;

export type TestD1 = {
  db: D1Database;
  /** すべての永続テーブルから行を削除する (テスト間分離)。 */
  reset: () => Promise<void>;
  /** Miniflare を畳む。afterAll で呼ぶ。 */
  dispose: () => Promise<void>;
};

export async function createTestD1(): Promise<TestD1> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    d1Databases: { DB: "test" },
  });
  const db = await mf.getD1Database("DB");

  for (const stmt of loadMigrationStatements()) {
    await db.prepare(stmt).run();
  }

  return {
    db,
    reset: async () => {
      for (const t of TABLES) {
        await db.exec(`DELETE FROM ${t}`);
      }
    },
    dispose: () => mf.dispose(),
  };
}
