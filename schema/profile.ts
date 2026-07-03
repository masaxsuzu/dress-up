// ユーザプロフィール (性別/身長/体重/体型/参考画像) の Zod スキーマ。
import { z } from "zod";

// 性別は enum。男性/女性以外も拾えるよう "other" を用意。
export const GenderSchema = z.enum(["male", "female", "other"]);
export type Gender = z.infer<typeof GenderSchema>;

// 1 行限定のプロフィール。すべて optional (未設定なら中性デフォルトに fallback)。
// referenceImageKey は R2 の `profile/<uuid>.<ext>` を指す。
export const ProfileSchema = z.object({
  gender: GenderSchema.nullable(),
  heightCm: z.number().int().min(50).max(250).nullable(),
  weightKg: z.number().int().min(20).max(300).nullable(),
  bodyType: z.string().max(200).nullable(),
  referenceImageKey: z.string().nullable(),
  updatedAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// クライアントが PUT する形。updatedAt はサーバが付ける。
export const ProfileInputSchema = ProfileSchema.omit({ updatedAt: true });
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
