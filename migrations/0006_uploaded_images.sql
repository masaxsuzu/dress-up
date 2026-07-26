-- 画像の所有権を「アップロードした事実」で持つテーブル。
--
-- これ以前は imageKey / referenceImageKey がクライアント指定値で、所有判定は
-- 「その key を含む行が自分の user_email で存在するか」だけだった。つまり他人の
-- key を自分のアイテムやプロフィールとして登録すれば所有者になれてしまい、
-- 他ユーザーの画像を読めるうえ、PUT /api/profile や DELETE /api/items の
-- 「旧画像を R2 から消す」経路を通じて削除までできた。
--
-- 所有権を発行時にサーバが記録し、以降はこの表を唯一の根拠にする。
CREATE TABLE uploaded_images (
  image_key  TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_uploaded_images_user ON uploaded_images(user_email);

-- 既存データのバックフィル。これが無いと、移行前に登録された画像が全て
-- 参照できなくなる (所有レコードが存在しないため)。R2 のオブジェクトには
-- 一切触らない。
INSERT OR IGNORE INTO uploaded_images (image_key, user_email, created_at)
  SELECT image_key, user_email, created_at FROM clothing_items;

INSERT OR IGNORE INTO uploaded_images (image_key, user_email, created_at)
  SELECT icon_key, user_email, updated_at FROM clothing_items
  WHERE icon_key IS NOT NULL;

INSERT OR IGNORE INTO uploaded_images (image_key, user_email, created_at)
  SELECT reference_image_key, user_email, updated_at FROM profile
  WHERE reference_image_key IS NOT NULL;
