-- ユーザプロフィール (1 ユーザ前提なので 1 行限定)。
-- id = 1 を CHECK 制約で固定して、INSERT OR REPLACE で upsert する。
CREATE TABLE profile (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  gender                 TEXT,
  height_cm              INTEGER,
  weight_kg              INTEGER,
  body_type              TEXT,
  reference_image_key    TEXT,
  updated_at             TEXT NOT NULL
);
