import { errorResponse } from "@/app/_lib/api-response";
import { getProfile, setProfile } from "@/app/_lib/profile";
import { parseJson, route } from "@/app/_lib/route-handler";
import { isUploadedBy, releaseUpload } from "@/app/_lib/uploads";
import { ProfileInputSchema } from "@/schema/profile";

export const GET = route(async ({ env, user }) => {
  const profile = await getProfile(env.DB, user);
  return Response.json({ profile });
});

export const PUT = route(async ({ req, env, user }) => {
  const parsed = await parseJson(req, ProfileInputSchema);
  if (!parsed.ok) return parsed.res;

  // referenceImageKey も client 由来。他人の key を指定できると、下の
  // 「旧画像を消す」経路で他ユーザーの R2 オブジェクトを削除できてしまう。
  if (
    parsed.data.referenceImageKey &&
    !(await isUploadedBy(env.DB, user, parsed.data.referenceImageKey))
  ) {
    return errorResponse("unknown referenceImageKey", 400);
  }

  const prev = await getProfile(env.DB, user);
  const replaced =
    prev?.referenceImageKey &&
    prev.referenceImageKey !== parsed.data.referenceImageKey
      ? prev.referenceImageKey
      : null;

  const profile = await setProfile(env.DB, user, parsed.data);

  // 参考画像を差し替えた or 削除した場合は旧画像を破棄する。profile 行を
  // 更新した後に呼ぶ (releaseUpload が他からの参照有無を見るため)。
  if (replaced) {
    await releaseUpload(env.DB, env.IMAGES, user, replaced);
  }
  return Response.json({ profile });
});
