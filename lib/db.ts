import type {
  ClothingCategory,
  ClothingItem,
  ClothingItemInput,
  ClothingItemUpdate,
  Pattern,
} from "@/schema/clothing";

interface Row {
  id: string;
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

export async function listItems(db: D1Database): Promise<ClothingItem[]> {
  const result = await db
    .prepare("SELECT * FROM clothing_items ORDER BY created_at DESC")
    .all<Row>();
  return result.results.map(rowToItem);
}

export async function getItem(
  db: D1Database,
  id: string,
): Promise<ClothingItem | null> {
  const row = await db
    .prepare("SELECT * FROM clothing_items WHERE id = ?")
    .bind(id)
    .first<Row>();
  return row ? rowToItem(row) : null;
}

export async function createItem(
  db: D1Database,
  input: ClothingItemInput,
): Promise<ClothingItem> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO clothing_items (
        id, category, subcategory, colors, pattern, material, silhouette,
        season, formality, occasion, tags, brand, notes,
        image_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
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
  id: string,
  iconKey: string,
): Promise<void> {
  await db
    .prepare("UPDATE clothing_items SET icon_key = ? WHERE id = ?")
    .bind(iconKey, id)
    .run();
}

export async function deleteItem(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM clothing_items WHERE id = ?")
    .bind(id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function updateItem(
  db: D1Database,
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
      WHERE id = ?`,
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
      id,
    )
    .run();

  if ((result.meta.changes ?? 0) === 0) return null;

  return getItem(db, id);
}
