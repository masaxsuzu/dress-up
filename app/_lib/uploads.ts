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

/** まだどこかの行がこの key を指しているか (指しているなら実体を消せない)。 */
async function isStillReferenced(
  db: D1Database,
  imageKey: string,
): Promise<boolean> {
  const fromItems = await db
    .prepare(
      `SELECT 1 FROM clothing_items
       WHERE image_key = ? OR icon_key = ? LIMIT 1`,
    )
    .bind(imageKey, imageKey)
    .first();
  if (fromItems) return true;

  const fromProfile = await db
    .prepare("SELECT 1 FROM profile WHERE reference_image_key = ? LIMIT 1")
    .bind(imageKey)
    .first();
  return !!fromProfile;
}

/**
 * 画像の実体と所有レコードを破棄する。行が持っている key をそのまま消すのは
 * 危険なので、**必ずこれを通す**。次の 2 つを満たすときだけ削除する:
 *
 * 1. その key を自分がアップロードしている — 参照している行があるだけでは不可。
 *    旧バグで作られた「他人の key を指す行」が残っていても他ユーザーの画像を
 *    消せないようにするため (書き込み側のゲートだけに頼らない)。
 * 2. 他のどの行からも参照されていない — 同じ key を複数のアイテムが共有して
 *    いる場合、片方を消しただけで残りの画像まで失われるのを防ぐ。
 *
 * 呼び出しは参照元の行を削除・更新した**後**に行うこと (2 の判定のため)。
 */
export async function releaseUpload(
  db: D1Database,
  bucket: R2Bucket,
  userEmail: string,
  imageKey: string,
): Promise<void> {
  if (!(await isUploadedBy(db, userEmail, imageKey))) return;
  if (await isStillReferenced(db, imageKey)) return;

  await bucket.delete(imageKey).catch(() => undefined);
  await forgetUpload(db, imageKey);
}
