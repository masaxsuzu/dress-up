-- マルチユーザ化: 全テーブルを user_email で分離する。
-- 既存データは保持する方針。新規列の DEFAULT に sentinel
-- '__unmigrated__' を入れておくので、マイグレーション後に手動で
--   UPDATE clothing_items SET user_email = '<your email>' WHERE user_email = '__unmigrated__';
--   UPDATE profile       SET user_email = '<your email>' WHERE user_email = '__unmigrated__';
-- を流して所有者を割り当てる前提。

-- clothing_items: ALTER で user_email を追加 (既存行は sentinel)
ALTER TABLE clothing_items ADD COLUMN user_email TEXT NOT NULL DEFAULT '__unmigrated__';

CREATE INDEX idx_clothing_items_user_email ON clothing_items(user_email);
CREATE INDEX idx_clothing_items_user_created ON clothing_items(user_email, created_at);
CREATE INDEX idx_clothing_items_user_category ON clothing_items(user_email, category);

-- profile: 旧スキーマは id = 1 を CHECK で固定していて、SQLite では
-- ALTER で CHECK 制約を外せないので、新テーブルを作って INSERT 移送する。
CREATE TABLE profile_new (
  user_email             TEXT    PRIMARY KEY,
  gender                 TEXT,
  height_cm              INTEGER,
  weight_kg              INTEGER,
  body_type              TEXT,
  reference_image_key    TEXT,
  updated_at             TEXT    NOT NULL
);

-- 既存の 1 行があれば sentinel user_email で引き継ぐ。
INSERT INTO profile_new (user_email, gender, height_cm, weight_kg, body_type, reference_image_key, updated_at)
SELECT '__unmigrated__', gender, height_cm, weight_kg, body_type, reference_image_key, updated_at
FROM profile;

DROP TABLE profile;
ALTER TABLE profile_new RENAME TO profile;
