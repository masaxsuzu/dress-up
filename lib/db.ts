import type {
  ClothingCategory,
  ClothingItem,
  ClothingItemInput,
  ClothingItemUpdate,
  Pattern,
} from "@/schema/clothing";

interface Row {
  id: string;
  user_email: string;
  category: string;
  subcategory: string | null;
  colors: string;
  pattern: string | null;
  material: string | null;
  silhouette: string | null;
  season: string;
  formality: number;
  occasion: string;
  tags: string;
  brand: string | null;
  notes: string | null;
  image_key: string;
  icon_key: string | null;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: Row): ClothingItem {
  return {
    id: row.id,
    category: row.category as ClothingCategory,
    subcategory: row.subcategory,
    colors: JSON.parse(row.colors),
    pattern: row.pattern as Pattern | null,
    material: row.material,
    silhouette: row.silhouette,
    season: JSON.parse(row.season),
    formality: row.formality,
    occasion: JSON.parse(row.occasion),
    tags: JSON.parse(row.tags),
    brand: row.brand,
    notes: row.notes,
    imageKey: row.image_key,
    iconKey: row.icon_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 全クエリは user_email で絞る。「他人のアイテム」が漏れる経路はここで塞ぐ。

export async function listItems(
  db: D1Database,
  userEmail: string,
): Promise<ClothingItem[]> {
  const result = await db
    .prepare(
      "SELECT * FROM clothing_items WHERE user_email = ? ORDER BY created_at DESC",
    )
    .bind(userEmail)
    .all<Row>();
  return result.results.map(rowToItem);
}

export async function getItem(
  db: D1Database,
  userEmail: string,
  id: string,
): Promise<ClothingItem | null> {
  const row = await db
    .prepare("SELECT * FROM clothing_items WHERE user_email = ? AND id = ?")
    .bind(userEmail, id)
    .first<Row>();
  return row ? rowToItem(row) : null;
}

export async function createItem(
  db: D1Database,
  userEmail: string,
  input: ClothingItemInput,
): Promise<ClothingItem> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO clothing_items (
        id, user_email, category, subcategory, colors, pattern, material, silhouette,
        season, formality, occasion, tags, brand, notes,
        image_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userEmail,
      input.category,
      input.subcategory,
      JSON.stringify(input.colors),
      input.pattern,
      input.material,
      input.silhouette,
      JSON.stringify(input.season),
      input.formality,
      JSON.stringify(input.occasion),
      JSON.stringify(input.tags),
      input.brand,
      input.notes,
      input.imageKey,
      now,
      now,
    )
    .run();

  return { ...input, id, iconKey: null, createdAt: now, updatedAt: now };
}

export async function setIconKey(
  db: D1Database,
  userEmail: string,
  id: string,
  iconKey: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE clothing_items SET icon_key = ? WHERE user_email = ? AND id = ?",
    )
    .bind(iconKey, userEmail, id)
    .run();
}

export async function deleteItem(
  db: D1Database,
  userEmail: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM clothing_items WHERE user_email = ? AND id = ?")
    .bind(userEmail, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function updateItem(
  db: D1Database,
  userEmail: string,
  id: string,
  input: ClothingItemUpdate,
): Promise<ClothingItem | null> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `UPDATE clothing_items SET
        category = ?, subcategory = ?, colors = ?, pattern = ?, material = ?,
        silhouette = ?, season = ?, formality = ?, occasion = ?, tags = ?,
        brand = ?, notes = ?, updated_at = ?
      WHERE user_email = ? AND id = ?`,
    )
    .bind(
      input.category,
      input.subcategory,
      JSON.stringify(input.colors),
      input.pattern,
      input.material,
      input.silhouette,
      JSON.stringify(input.season),
      input.formality,
      JSON.stringify(input.occasion),
      JSON.stringify(input.tags),
      input.brand,
      input.notes,
      now,
      userEmail,
      id,
    )
    .run();

  if ((result.meta.changes ?? 0) === 0) return null;

  return getItem(db, userEmail, id);
}

// /api/images の owner check 用: 指定 key がこのユーザの所有物か?
// items / icons / profile の reference_image_key のいずれかに該当すれば true。
export async function imageKeyOwnedBy(
  db: D1Database,
  userEmail: string,
  imageKey: string,
): Promise<boolean> {
  // clothing_items.image_key または icon_key にマッチ
  const fromItems = await db
    .prepare(
      `SELECT 1 FROM clothing_items
       WHERE user_email = ? AND (image_key = ? OR icon_key = ?) LIMIT 1`,
    )
    .bind(userEmail, imageKey, imageKey)
    .first<{ "1": number }>();
  if (fromItems) return true;

  // profile.reference_image_key にマッチ
  const fromProfile = await db
    .prepare(
      `SELECT 1 FROM profile WHERE user_email = ? AND reference_image_key = ? LIMIT 1`,
    )
    .bind(userEmail, imageKey)
    .first<{ "1": number }>();
  return !!fromProfile;
}
