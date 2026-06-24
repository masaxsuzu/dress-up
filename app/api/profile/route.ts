import { getProfile, setProfile } from "@/lib/profile";
import { deleteImage } from "@/lib/r2";
import { parseJson, route } from "@/lib/route-handler";
import { ProfileInputSchema } from "@/schema/profile";

export const GET = route(async ({ env, user }) => {
  const profile = await getProfile(env.DB, user);
  return Response.json({ profile });
});

export const PUT = route(async ({ req, env, user }) => {
  const parsed = await parseJson(req, ProfileInputSchema);
  if (!parsed.ok) return parsed.res;

  // 参考画像を差し替えた or 削除した場合は旧画像を R2 から消す。
  const prev = await getProfile(env.DB, user);
  if (
    prev?.referenceImageKey &&
    prev.referenceImageKey !== parsed.data.referenceImageKey
  ) {
    await deleteImage(env.IMAGES, prev.referenceImageKey).catch(() => {});
  }

  const profile = await setProfile(env.DB, user, parsed.data);
  return Response.json({ profile });
});
