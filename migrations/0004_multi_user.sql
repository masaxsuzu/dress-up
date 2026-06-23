-- マルチユーザ化: 全テーブルを user_email で分離する。
-- 既存データは drop して作り直す方針 (CLAUDE.md「スキーマ後方互換は取らない」)。
--
-- 0001_init: clothing_items
-- 0002_icon_key: ALTER で icon_key を足したもの
-- 0003_profile: profile (1 行限定)
-- 0004: clothing_items / profile を drop して user_email 列付きで作り直す。
--
-- R2 オブジェクト (items/<uuid>.<ext> / icons/<id>.<ext> / profile/<uuid>.<ext>)
-- もオーファンになるが、cleanup は手動 (使われない blob として残るだけで
-- 課金影響は微々たるもの)。

DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS clothing_items;

CREATE TABLE clothing_items (
  id                   TEXT    PRIMARY KEY,
  user_email           TEXT    NOT NULL,
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
  icon_key             TEXT,
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);

CREATE INDEX idx_clothing_items_user_email ON clothing_items(user_email);
CREATE INDEX idx_clothing_items_user_created ON clothing_items(user_email, created_at);
CREATE INDEX idx_clothing_items_user_category ON clothing_items(user_email, category);

-- プロフィールはユーザ毎 1 行。user_email を PRIMARY KEY に。
CREATE TABLE profile (
  user_email             TEXT    PRIMARY KEY,
  gender                 TEXT,
  height_cm              INTEGER,
  weight_kg              INTEGER,
  body_type              TEXT,
  reference_image_key    TEXT,
  updated_at             TEXT    NOT NULL
);
