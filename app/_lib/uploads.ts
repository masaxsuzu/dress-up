// 画像の所有権レコード (uploaded_images テーブル)。
//
// R2 のキーはクライアントが `POST /api/items` や `PUT /api/profile` の body に
// 載せて送ってくる。その値を信じると「他人の key を自分のものとして申告する」
// だけで所有者になれてしまうため、**発行した時点でサーバが記録し**、以降は
// この表だけを所有権の根拠にする。
import { z } from "zod";

const OwnerRow = z.object({ user_email: z.string() });

/** アップロード直後に所有者を記録する。key の発行元 (R2 put) と必ず対で呼ぶ。 */
export async function recordUpload(
  db: D1Database,
  userEmail: string,
  imageKey: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO uploaded_images (image_key, user_email, created_at)
       VALUES (?, ?, ?)`,
    )
    .bind(imageKey, userEmail, new Date().toISOString())
    .run();
}

/**
 * その key を自分がアップロードしたか。
 * client 由来の key を受け取る全ての経路で、保存前にこれを通すこと。
 */
export async function isUploadedBy(
  db: D1Database,
  userEmail: string,
  imageKey: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT user_email FROM uploaded_images WHERE image_key = ?")
    .bind(imageKey)
    .first();
  const parsed = OwnerRow.safeParse(row);
  return parsed.success && parsed.data.user_email === userEmail;
}

/** R2 からオブジェクトを消したときに所有レコードも片付ける。 */
export async function forgetUpload(
  db: D1Database,
  imageKey: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM uploaded_images WHERE image_key = ?")
    .bind(imageKey)
    .run();
}
