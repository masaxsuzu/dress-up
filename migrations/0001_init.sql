-- 服アイテム本体。
-- 配列系は JSON 文字列として保存（D1 = SQLite）。
-- スキーマ後方互換は取らない方針。変更時は手で再投入。
CREATE TABLE clothing_items (
  id                   TEXT    PRIMARY KEY,
  category             TEXT    NOT NULL,
  subcategory          TEXT,
  colors               TEXT    NOT NULL,
  pattern              TEXT,
  material             TEXT,
  silhouette           TEXT,
  season               TEXT    NOT NULL,
  formality            INTEGER NOT NULL,
  occasion             TEXT    NOT NULL DEFAULT '[]',
  tags                 TEXT    NOT NULL DEFAULT '[]',
  brand                TEXT,
  notes                TEXT,
  image_key            TEXT    NOT NULL,
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);

CREATE INDEX idx_clothing_items_category   ON clothing_items(category);
CREATE INDEX idx_clothing_items_created_at ON clothing_items(created_at);
