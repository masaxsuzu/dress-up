// profile テーブル (ユーザ毎 1 行) の D1 読み書き。
import type { Gender, Profile, ProfileInput } from "@/schema/profile";

interface Row {
  user_email: string;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  reference_image_key: string | null;
  updated_at: string;
}

function rowToProfile(row: Row): Profile {
  return {
    gender: row.gender as Gender | null,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bodyType: row.body_type,
    referenceImageKey: row.reference_image_key,
    updatedAt: row.updated_at,
  };
}

export async function getProfile(
  db: D1Database,
  userEmail: string,
): Promise<Profile | null> {
  const row = await db
    .prepare("SELECT * FROM profile WHERE user_email = ?")
    .bind(userEmail)
    .first<Row>();
  return row ? rowToProfile(row) : null;
}

export async function setProfile(
  db: D1Database,
  userEmail: string,
  input: ProfileInput,
): Promise<Profile> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO profile (
        user_email, gender, height_cm, weight_kg, body_type, reference_image_key, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        gender = excluded.gender,
        height_cm = excluded.height_cm,
        weight_kg = excluded.weight_kg,
        body_type = excluded.body_type,
        reference_image_key = excluded.reference_image_key,
        updated_at = excluded.updated_at`,
    )
    .bind(
      userEmail,
      input.gender,
      input.heightCm,
      input.weightKg,
      input.bodyType,
      input.referenceImageKey,
      now,
    )
    .run();
  return { ...input, updatedAt: now };
}
