// 0006 のバックフィル検証。
//
// 他のテストは test/helpers/d1.ts が空 DB に全マイグレーションを流すため、
// 「移行前から存在するデータが移行を越えて生き残るか」は誰も見ていない。
// ここだけは 0005 までを適用してデータを入れ、そのあと 0006 を当てる。
// バックフィルが壊れると既存の画像が全て読めなくなる (所有レコードが無い
// key は isUploadedBy が false を返すため) ので、その回帰を防ぐ。
import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname);

// test/helpers/d1.ts と同じ分割 (コメントを剥がしてから ; で切る)。
function statementsOf(file: string): string[] {
  return readFileSync(resolve(MIGRATIONS_DIR, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const TARGET = "0006_uploaded_images.sql";

async function applyThrough(db: D1Database, files: string[]) {
  for (const f of files) {
    for (const st of statementsOf(f)) await db.prepare(st).run();
  }
}

describe(`migration ${TARGET}`, () => {
  it("移行前から在るアイテム・アイコン・プロフィール画像が正しい所有者で残る", async () => {
    const mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response(); } }",
      d1Databases: { DB: "test" },
    });
    const db = await mf.getD1Database("DB");

    const all = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    await applyThrough(
      db,
      all.filter((f) => f < TARGET),
    );

    const now = new Date().toISOString();
    // Alice: 画像 + アイコン + プロフィール参考画像 / Bob: 画像のみ
    await db
      .prepare(
        `INSERT INTO clothing_items (id,user_email,category,subcategory,colors,pattern,material,silhouette,season,formality,occasion,tags,brand,notes,image_key,icon_key,created_at,updated_at)
         VALUES ('i1','alice@x','tops',NULL,'[]',NULL,NULL,NULL,'[]',2,'[]','[]',NULL,NULL,'items/a.jpg','icons/a.png',?,?)`,
      )
      .bind(now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO clothing_items (id,user_email,category,subcategory,colors,pattern,material,silhouette,season,formality,occasion,tags,brand,notes,image_key,icon_key,created_at,updated_at)
         VALUES ('i2','bob@x','tops',NULL,'[]',NULL,NULL,NULL,'[]',2,'[]','[]',NULL,NULL,'items/b.jpg',NULL,?,?)`,
      )
      .bind(now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO profile (user_email,gender,height_cm,weight_kg,body_type,reference_image_key,updated_at)
         VALUES ('alice@x',NULL,NULL,NULL,NULL,'profile/a-ref.jpg',?)`,
      )
      .bind(now)
      .run();

    await applyThrough(db, [TARGET]);

    const { results } = await db
      .prepare("SELECT image_key, user_email FROM uploaded_images ORDER BY image_key")
      .all();

    expect(results).toEqual([
      { image_key: "icons/a.png", user_email: "alice@x" },
      { image_key: "items/a.jpg", user_email: "alice@x" },
      { image_key: "items/b.jpg", user_email: "bob@x" },
      { image_key: "profile/a-ref.jpg", user_email: "alice@x" },
    ]);

    await mf.dispose();
  });
});
